/**
 * MCP Authentication and Authorization Middleware
 * Secure external MCP protocol access with multiple authentication methods
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createErrorResponse, MCPErrorCode } from '../utils/mcpResponseFormatter';

// Authentication Configuration
interface MCPAuthConfig {
  jwtSecret: string;
  jwtExpirationTime: string;
  apiKeyLifetime: number; // in days
  enableOAuth2: boolean;
  maxRequestsPerMinute: number;
  rateLimitWindowMs: number;
}

const authConfig: MCPAuthConfig = {
  jwtSecret: process.env.MCP_JWT_SECRET || 'mcp-healthcare-secret-key',
  jwtExpirationTime: process.env.MCP_JWT_EXPIRATION || '24h',
  apiKeyLifetime: parseInt(process.env.MCP_API_KEY_LIFETIME || '365'), // 1 year
  enableOAuth2: process.env.MCP_ENABLE_OAUTH2 === 'true',
  maxRequestsPerMinute: parseInt(process.env.MCP_RATE_LIMIT || '60'),
  rateLimitWindowMs: 60 * 1000 // 1 minute
};

// Authentication Types
export enum AuthenticationType {
  BEARER_TOKEN = 'bearer_token',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2'
}

export interface MCPAuthUser {
  id: string;
  email?: string;
  organization?: string;
  permissions: string[];
  authType: AuthenticationType;
  rateLimit?: {
    maxRequestsPerMinute: number;
    currentCount: number;
    resetTime: Date;
  };
  metadata?: {
    createdAt: Date;
    lastAccessAt: Date;
    apiVersion: string;
    clientName?: string;
  };
}

// Permission Levels
export enum MCPPermission {
  // Read Permissions
  READ_MEDICARE_DATA = 'read:medicare_data',
  READ_POPULATION_HEALTH = 'read:population_health',
  READ_FACILITY_DATA = 'read:facility_data',

  // Analysis Permissions
  ANALYZE_MEDICARE = 'analyze:medicare',
  ANALYZE_HEALTH_RISKS = 'analyze:health_risks',
  ANALYZE_FACILITIES = 'analyze:facilities',
  ANALYZE_COMPREHENSIVE = 'analyze:comprehensive',

  // Advanced Permissions
  ACCESS_EXTERNAL_DATA = 'access:external_data',
  BULK_ANALYSIS = 'bulk:analysis',
  EXPORT_DATA = 'export:data',

  // Admin Permissions
  MANAGE_USERS = 'admin:manage_users',
  VIEW_ANALYTICS = 'admin:view_analytics'
}

// In-memory stores (in production, these would be database-backed)
const authenticatedUsers = new Map<string, MCPAuthUser>();
const rateLimitStore = new Map<string, { count: number; resetTime: Date }>();
const validApiKeys = new Map<string, { userId: string; permissions: string[]; expiresAt: Date }>();

export class MCPAuthService {
  static initializeService(): void {
    console.log('🔐 Initializing MCP Authentication Service');

    // Create default admin API key if none exists
    if (validApiKeys.size === 0) {
      const adminApiKey = this.generateApiKey();
      validApiKeys.set(adminApiKey, {
        userId: 'admin-user',
        permissions: Object.values(MCPPermission),
        expiresAt: new Date(Date.now() + authConfig.apiKeyLifetime * 24 * 60 * 60 * 1000)
      });

      console.log(`🔑 Admin API Key generated: ${adminApiKey}`);
      console.log('⚠️  Store this key securely - it will not be shown again');
    }

    console.log('✅ MCP Authentication Service initialized');
  }

  static generateApiKey(): string {
    // Generate a secure API key with prefix for identification
    const randomBytes = crypto.randomBytes(32);
    const apiKey = `mcp_hc_${randomBytes.toString('hex')}`;
    return apiKey;
  }

  static generateJWT(user: Partial<MCPAuthUser>): string {
    const payload = {
      userId: user.id,
      email: user.email,
      organization: user.organization,
      permissions: user.permissions,
      authType: user.authType,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: authConfig.jwtExpirationTime
    });
  }

  static verifyJWT(token: string): MCPAuthUser | null {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;

      return {
        id: decoded.userId,
        email: decoded.email,
        organization: decoded.organization,
        permissions: decoded.permissions || [],
        authType: AuthenticationType.BEARER_TOKEN,
        metadata: {
          createdAt: new Date(decoded.iat * 1000),
          lastAccessAt: new Date(),
          apiVersion: 'v1.0.0'
        }
      };
    } catch (error) {
      console.warn('⚠️ JWT verification failed:', error);
      return null;
    }
  }

  static validateApiKey(apiKey: string): MCPAuthUser | null {
    const keyData = validApiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    // Check expiration
    if (keyData.expiresAt < new Date()) {
      validApiKeys.delete(apiKey);
      return null;
    }

    return {
      id: keyData.userId,
      permissions: keyData.permissions,
      authType: AuthenticationType.API_KEY,
      metadata: {
        createdAt: keyData.expiresAt,
        lastAccessAt: new Date(),
        apiVersion: 'v1.0.0'
      }
    };
  }

  static createUser(userData: {
    id: string;
    email?: string;
    organization?: string;
    permissions: string[];
    clientName?: string;
  }): { user: MCPAuthUser; apiKey?: string; token?: string } {
    const user: MCPAuthUser = {
      ...userData,
      authType: AuthenticationType.API_KEY,
      rateLimit: {
        maxRequestsPerMinute: authConfig.maxRequestsPerMinute,
        currentCount: 0,
        resetTime: new Date(Date.now() + authConfig.rateLimitWindowMs)
      },
      metadata: {
        createdAt: new Date(),
        lastAccessAt: new Date(),
        apiVersion: 'v1.0.0',
        clientName: userData.clientName
      }
    };

    // Generate API key
    const apiKey = this.generateApiKey();
    validApiKeys.set(apiKey, {
      userId: user.id,
      permissions: user.permissions,
      expiresAt: new Date(Date.now() + authConfig.apiKeyLifetime * 24 * 60 * 60 * 1000)
    });

    // Generate JWT token
    const token = this.generateJWT(user);

    authenticatedUsers.set(user.id, user);

    return { user, apiKey, token };
  }

  static checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitStore.get(userId);

    if (!userLimit || userLimit.resetTime.getTime() <= now) {
      // Reset or create rate limit
      rateLimitStore.set(userId, {
        count: 1,
        resetTime: new Date(now + authConfig.rateLimitWindowMs)
      });
      return true;
    }

    if (userLimit.count >= authConfig.maxRequestsPerMinute) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  static hasPermission(user: MCPAuthUser, requiredPermission: string): boolean {
    return user.permissions.includes(requiredPermission) ||
           user.permissions.includes('admin:*') || // Admin wildcard
           user.permissions.includes('*'); // Super admin
  }

  static getRequiredPermission(toolName: string): string {
    const toolPermissionMap: Record<string, string> = {
      'medicare_eligibility_analysis': MCPPermission.ANALYZE_MEDICARE,
      'population_health_assessment': MCPPermission.ANALYZE_HEALTH_RISKS,
      'facility_adequacy_calculator': MCPPermission.ANALYZE_FACILITIES,
      'healthcare_dashboard_composite': MCPPermission.ANALYZE_COMPREHENSIVE
    };

    return toolPermissionMap[toolName] || MCPPermission.READ_MEDICARE_DATA;
  }
}

// Authentication Middleware
export const authenticateMCPRequest = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  let user: MCPAuthUser | null = null;

  try {
    // Try Bearer Token Authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = MCPAuthService.verifyJWT(token);
    }
    // Try API Key Authentication
    else if (apiKey) {
      user = MCPAuthService.validateApiKey(apiKey);
    }

    if (!user) {
      return res.status(401).json(createErrorResponse(
        'authentication',
        MCPErrorCode.AUTHENTICATION_REQUIRED,
        'Valid authentication required. Provide Bearer token or X-API-Key header.',
        {
          supportedMethods: ['Bearer Token', 'API Key'],
          documentationUrl: '/api/v1/mcp/docs/authentication'
        }
      ));
    }

    // Check rate limiting
    if (!MCPAuthService.checkRateLimit(user.id)) {
      return res.status(429).json(createErrorResponse(
        'rate_limit',
        MCPErrorCode.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded. Maximum requests per minute exceeded.',
        {
          maxRequestsPerMinute: authConfig.maxRequestsPerMinute,
          retryAfterSeconds: 60
        }
      ));
    }

    // Add user to request
    (req as any).mcpUser = user;
    next();

  } catch (error) {
    console.error('❌ MCP authentication error:', error);
    return res.status(500).json(createErrorResponse(
      'authentication',
      MCPErrorCode.INTERNAL_SERVER_ERROR,
      'Authentication service error.',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    ));
  }
};

// Authorization Middleware
export const authorizeMCPTool = (requiredPermission?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).mcpUser as MCPAuthUser;

    if (!user) {
      return res.status(401).json(createErrorResponse(
        'authorization',
        MCPErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required before authorization check.'
      ));
    }

    // Determine required permission
    const toolName = req.params.toolName || req.body.tool || 'unknown';
    const permission = requiredPermission || MCPAuthService.getRequiredPermission(toolName);

    if (!MCPAuthService.hasPermission(user, permission)) {
      return res.status(403).json(createErrorResponse(
        'authorization',
        MCPErrorCode.AUTHORIZATION_FAILED,
        `Insufficient permissions for tool: ${toolName}`,
        {
          requiredPermission: permission,
          userPermissions: user.permissions,
          toolName
        }
      ));
    }

    next();
  };
};

// Initialize the service
MCPAuthService.initializeService();

export { MCPAuthService, authConfig };
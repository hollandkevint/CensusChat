/**
 * MCP Healthcare Service
 * External MCP protocol implementation for healthcare analytics
 * Exposes healthcare analytics as MCP-compatible tools for external consumption
 */

import { getHealthcareAnalyticsModule, HealthcareAnalyticsModule } from '../modules/healthcare_analytics';
import { getMCPMonitoring } from '../utils/mcpMonitoring';
import {
  GeographicParams,
  RiskFactorParams,
  FacilityParams,
  QueryRequest,
  QueryResult,
  AnalysisResult,
  RiskAnalysis,
  AdequacyMetrics
} from '../modules/healthcare_analytics/types/HealthcareAnalyticsTypes';
import {
  MCPResponseFormatter,
  MCPErrorCode,
  createHealthcareResponse,
  createErrorResponse,
  MCPResponseEnvelope,
  HealthcareMCPResponse
} from '../utils/mcpResponseFormatter';

// MCP Protocol Version
export const MCP_HEALTHCARE_PROTOCOL_VERSION = 'v1.0.0';

// MCP Tool Definitions
export interface MCPToolDefinition {
  name: string;
  version: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  handler: (params: any) => Promise<MCPToolResponse>;
}

export interface MCPToolResponse extends MCPResponseEnvelope {
  // Extends the standardized MCP response envelope
}

export interface MCPHealthcareCapabilities {
  version: string;
  tools: string[];
  features: string[];
  authentication: {
    required: boolean;
    methods: string[];
  };
  rateLimit: {
    maxRequestsPerMinute: number;
    burstLimit: number;
  };
}

export class MCPHealthcareService {
  private healthcareModule: HealthcareAnalyticsModule;
  private monitoring = getMCPMonitoring();
  private tools: Map<string, MCPToolDefinition> = new Map();
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor() {
    console.log('🏥 Initializing MCP Healthcare Service');
    this.healthcareModule = getHealthcareAnalyticsModule({
      enableCaching: true,
      cacheTTLSeconds: 600, // 10 minutes for external MCP calls
      maxConcurrentQueries: 5,
      queryTimeoutSeconds: 30, // Longer timeout for external calls
      enableExternalDataSources: true
    });

    this.initializeMCPTools();
    console.log('✅ MCP Healthcare Service initialized');
  }

  private initializeMCPTools(): void {
    console.log('📋 Registering MCP healthcare tools...');

    // Medicare Eligibility Analysis Tool
    this.tools.set('medicare_eligibility_analysis', {
      name: 'medicare_eligibility_analysis',
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      description: 'Comprehensive Medicare eligibility analysis with demographic insights, market opportunities, and 5-year projections',
      parameters: {
        type: 'object',
        properties: {
          geography_type: {
            type: 'string',
            enum: ['state', 'county'],
            description: 'Geographic analysis level'
          },
          geography_codes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of geographic areas to analyze'
          },
          analysis_focus: {
            type: 'string',
            enum: ['basic', 'market_opportunity', 'projections', 'dual_eligible'],
            description: 'Specific Medicare analysis focus',
            default: 'basic'
          },
          year: {
            type: 'string',
            description: 'Analysis year (optional)',
            default: new Date().getFullYear().toString()
          }
        },
        required: ['geography_type', 'geography_codes']
      },
      handler: this.executeMedicareEligibilityAnalysis.bind(this)
    });

    // Population Health Risk Assessment Tool
    this.tools.set('population_health_assessment', {
      name: 'population_health_assessment',
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      description: 'Multi-dimensional population health risk assessment including social determinants, chronic disease burden, and health equity analysis',
      parameters: {
        type: 'object',
        properties: {
          geography_type: {
            type: 'string',
            enum: ['state', 'county'],
            description: 'Geographic analysis level'
          },
          geography_codes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of geographic areas to analyze'
          },
          risk_factors: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['income', 'insurance', 'age', 'education', 'social_determinants']
            },
            description: 'Risk factors to include in analysis',
            default: ['income', 'insurance', 'age']
          },
          analysis_focus: {
            type: 'string',
            enum: ['basic_risk', 'chronic_disease', 'social_determinants', 'health_equity'],
            description: 'Specific population health analysis focus',
            default: 'basic_risk'
          }
        },
        required: ['geography_type', 'geography_codes', 'risk_factors']
      },
      handler: this.executePopulationHealthAssessment.bind(this)
    });

    // Healthcare Facility Adequacy Calculator Tool
    this.tools.set('facility_adequacy_calculator', {
      name: 'facility_adequacy_calculator',
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      description: 'Healthcare facility adequacy analysis including access patterns, rural health considerations, and emergency service coverage',
      parameters: {
        type: 'object',
        properties: {
          geography_type: {
            type: 'string',
            enum: ['state', 'county'],
            description: 'Geographic analysis level'
          },
          geography_codes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of geographic areas to analyze'
          },
          facility_type: {
            type: 'string',
            enum: ['hospital', 'clinic', 'specialty', 'emergency', 'all'],
            description: 'Type of healthcare facility to analyze',
            default: 'all'
          },
          analysis_focus: {
            type: 'string',
            enum: ['basic_adequacy', 'specialty_access', 'rural_health', 'emergency_coverage'],
            description: 'Specific facility adequacy analysis focus',
            default: 'basic_adequacy'
          }
        },
        required: ['geography_type', 'geography_codes']
      },
      handler: this.executeFacilityAdequacyCalculator.bind(this)
    });

    // Comprehensive Healthcare Dashboard Tool
    this.tools.set('healthcare_dashboard_composite', {
      name: 'healthcare_dashboard_composite',
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      description: 'Comprehensive healthcare analytics dashboard combining Medicare, population health, and facility adequacy metrics',
      parameters: {
        type: 'object',
        properties: {
          geography_type: {
            type: 'string',
            enum: ['state', 'county'],
            description: 'Geographic analysis level'
          },
          geography_codes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of geographic areas to analyze'
          },
          focus_area: {
            type: 'string',
            enum: ['medicare', 'population_health', 'facility_adequacy', 'comprehensive'],
            description: 'Primary focus area for dashboard',
            default: 'comprehensive'
          }
        },
        required: ['geography_type', 'geography_codes']
      },
      handler: this.executeComprehensiveDashboard.bind(this)
    });

    console.log(`✅ Registered ${this.tools.size} MCP healthcare tools`);
  }

  // MCP Tool Handlers
  async executeMedicareEligibilityAnalysis(params: GeographicParams & { analysis_focus?: string; year?: string }): Promise<MCPToolResponse> {
    const correlationId = this.monitoring.startOperation('mcp_medicare_analysis', 'external', 'medicare_eligibility_analysis');
    const startTime = Date.now();

    try {
      console.log('🏥 Executing Medicare eligibility analysis via MCP', params);

      // Build query request for healthcare analytics module
      const queryRequest: QueryRequest = {
        naturalLanguageQuery: `Analyze Medicare eligibility for ${params.geography_codes.join(', ')} with focus on ${params.analysis_focus || 'basic'}`,
        parameters: {
          geography_type: params.geography_type,
          geography_codes: params.geography_codes,
          focus_area: 'medicare',
          analysis_focus: params.analysis_focus || 'basic',
          year: params.year
        }
      };

      const result = await this.healthcareModule.executeQuery(queryRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || 'Medicare analysis failed');
      }

      this.monitoring.completeOperation(correlationId, true);

      return createHealthcareResponse(
        'medicare_eligibility_analysis',
        result.data,
        {
          executionTime,
          recordCount: result.metadata.recordCount,
          sources: result.metadata.federatedSources,
          confidenceLevel: result.metadata.confidenceLevel,
          correlationId
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.monitoring.completeOperation(correlationId, false, errorMessage);
      console.error('❌ Medicare eligibility analysis failed:', error);

      return createErrorResponse(
        'medicare_eligibility_analysis',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        errorMessage,
        { originalError: error instanceof Error ? error.stack : error },
        { executionTime, correlationId }
      );
    }
  }

  async executePopulationHealthAssessment(params: RiskFactorParams & { analysis_focus?: string }): Promise<MCPToolResponse> {
    const correlationId = this.monitoring.startOperation('mcp_population_health', 'external', 'population_health_assessment');
    const startTime = Date.now();

    try {
      console.log('🏥 Executing population health assessment via MCP', params);

      const queryRequest: QueryRequest = {
        naturalLanguageQuery: `Assess population health risks for ${params.geography_codes.join(', ')} focusing on ${params.risk_factors.join(', ')} with ${params.analysis_focus || 'basic_risk'} analysis`,
        parameters: {
          geography_type: params.geography_type,
          geography_codes: params.geography_codes,
          risk_factors: params.risk_factors,
          focus_area: 'population_health',
          analysis_focus: params.analysis_focus || 'basic_risk'
        }
      };

      const result = await this.healthcareModule.executeQuery(queryRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || 'Population health assessment failed');
      }

      this.monitoring.completeOperation(correlationId, true);

      return createHealthcareResponse(
        'population_health_assessment',
        result.data,
        {
          executionTime,
          recordCount: result.metadata.recordCount,
          sources: result.metadata.federatedSources,
          confidenceLevel: result.metadata.confidenceLevel,
          correlationId
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.monitoring.completeOperation(correlationId, false, errorMessage);
      console.error('❌ Population health assessment failed:', error);

      return createErrorResponse(
        'population_health_assessment',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        errorMessage,
        { originalError: error instanceof Error ? error.stack : error },
        { executionTime, correlationId }
      );
    }
  }

  async executeFacilityAdequacyCalculator(params: FacilityParams & { analysis_focus?: string }): Promise<MCPToolResponse> {
    const correlationId = this.monitoring.startOperation('mcp_facility_adequacy', 'external', 'facility_adequacy_calculator');
    const startTime = Date.now();

    try {
      console.log('🏥 Executing facility adequacy analysis via MCP', params);

      const queryRequest: QueryRequest = {
        naturalLanguageQuery: `Calculate healthcare facility adequacy for ${params.geography_codes.join(', ')} focusing on ${params.facility_type || 'all'} facilities with ${params.analysis_focus || 'basic_adequacy'} analysis`,
        parameters: {
          geography_type: params.geography_type,
          geography_codes: params.geography_codes,
          facility_type: params.facility_type,
          focus_area: 'facility_adequacy',
          analysis_focus: params.analysis_focus || 'basic_adequacy'
        }
      };

      const result = await this.healthcareModule.executeQuery(queryRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || 'Facility adequacy analysis failed');
      }

      this.monitoring.completeOperation(correlationId, true);

      return createHealthcareResponse(
        'facility_adequacy_calculator',
        result.data,
        {
          executionTime,
          recordCount: result.metadata.recordCount,
          sources: result.metadata.federatedSources,
          confidenceLevel: result.metadata.confidenceLevel,
          correlationId
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.monitoring.completeOperation(correlationId, false, errorMessage);
      console.error('❌ Facility adequacy analysis failed:', error);

      return createErrorResponse(
        'facility_adequacy_calculator',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        errorMessage,
        { originalError: error instanceof Error ? error.stack : error },
        { executionTime, correlationId }
      );
    }
  }

  async executeComprehensiveDashboard(params: GeographicParams & { focus_area?: string }): Promise<MCPToolResponse> {
    const correlationId = this.monitoring.startOperation('mcp_comprehensive_dashboard', 'external', 'healthcare_dashboard_composite');
    const startTime = Date.now();

    try {
      console.log('🏥 Executing comprehensive healthcare dashboard via MCP', params);

      const queryRequest: QueryRequest = {
        naturalLanguageQuery: `Generate comprehensive healthcare dashboard for ${params.geography_codes.join(', ')} with focus on ${params.focus_area || 'comprehensive'}`,
        parameters: {
          geography_type: params.geography_type,
          geography_codes: params.geography_codes,
          focus_area: params.focus_area || 'comprehensive'
        }
      };

      const result = await this.healthcareModule.executeQuery(queryRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || 'Comprehensive dashboard generation failed');
      }

      this.monitoring.completeOperation(correlationId, true);

      return createHealthcareResponse(
        'healthcare_dashboard_composite',
        result.data,
        {
          executionTime,
          recordCount: result.metadata.recordCount,
          sources: result.metadata.federatedSources,
          confidenceLevel: result.metadata.confidenceLevel,
          correlationId
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.monitoring.completeOperation(correlationId, false, errorMessage);
      console.error('❌ Comprehensive dashboard generation failed:', error);

      return createErrorResponse(
        'healthcare_dashboard_composite',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        errorMessage,
        { originalError: error instanceof Error ? error.stack : error },
        { executionTime, correlationId }
      );
    }
  }

  // MCP Protocol Methods
  async executeTool(toolName: string, parameters: any): Promise<MCPToolResponse> {
    // Rate limiting check
    if (!this.checkRateLimit()) {
      return createErrorResponse(
        toolName,
        MCPErrorCode.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded. Maximum 60 requests per minute.',
        { maxRequestsPerMinute: 60, currentCount: this.requestCount }
      );
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return createErrorResponse(
        toolName,
        MCPErrorCode.TOOL_NOT_FOUND,
        `Unknown tool: ${toolName}.`,
        { availableTools: Array.from(this.tools.keys()) }
      );
    }

    // Validate parameters
    const validation = this.validateToolParameters(tool, parameters);
    if (!validation.valid) {
      return createErrorResponse(
        toolName,
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter validation failed.',
        { validationErrors: validation.errors, providedParameters: Object.keys(parameters) }
      );
    }

    // Execute tool
    return await tool.handler(parameters);
  }

  getCapabilities(): MCPHealthcareCapabilities {
    return {
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      tools: Array.from(this.tools.keys()),
      features: [
        'medicare_eligibility_analysis',
        'population_health_assessment',
        'facility_adequacy_calculation',
        'comprehensive_healthcare_dashboard',
        'multi_source_data_federation',
        'real_time_analytics',
        'geographic_analysis',
        'performance_optimization'
      ],
      authentication: {
        required: true,
        methods: ['bearer_token', 'api_key', 'oauth2']
      },
      rateLimit: {
        maxRequestsPerMinute: 60,
        burstLimit: 10
      }
    };
  }

  getToolDefinitions(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async healthCheck(): Promise<{ healthy: boolean; tools: Record<string, boolean>; version: string }> {
    const toolHealth: Record<string, boolean> = {};

    // Check healthcare module health
    const moduleHealth = await this.healthcareModule.healthCheck();

    // Test each tool with minimal parameters
    for (const [toolName, _] of this.tools) {
      try {
        const testParams = this.generateTestParameters(toolName);
        const result = await this.executeTool(toolName, testParams);
        toolHealth[toolName] = result.success;
      } catch (error) {
        toolHealth[toolName] = false;
      }
    }

    const healthyTools = Object.values(toolHealth).filter(h => h).length;
    const totalTools = Object.keys(toolHealth).length;

    return {
      healthy: moduleHealth.healthy && healthyTools === totalTools,
      tools: toolHealth,
      version: MCP_HEALTHCARE_PROTOCOL_VERSION
    };
  }

  // Helper Methods
  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counter every minute
    if (timeSinceReset > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check rate limit
    if (this.requestCount >= 60) {
      return false;
    }

    this.requestCount++;
    return true;
  }

  private validateToolParameters(tool: MCPToolDefinition, parameters: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const requiredParams = tool.parameters.required || [];

    // Check required parameters
    for (const param of requiredParams) {
      if (!parameters[param]) {
        errors.push(`Required parameter missing: ${param}`);
      }
    }

    // Check parameter types and values
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramDef = tool.parameters.properties[paramName];
      if (!paramDef) continue;

      if (paramDef.enum && !paramDef.enum.includes(paramValue)) {
        errors.push(`Invalid value for ${paramName}. Expected one of: ${paramDef.enum.join(', ')}`);
      }

      if (paramDef.type === 'array' && !Array.isArray(paramValue)) {
        errors.push(`Parameter ${paramName} must be an array`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private generateTestParameters(toolName: string): any {
    // Generate minimal test parameters for health checks
    const baseParams = {
      geography_type: 'state',
      geography_codes: ['Florida']
    };

    switch (toolName) {
      case 'population_health_assessment':
        return { ...baseParams, risk_factors: ['income'] };

      case 'facility_adequacy_calculator':
        return { ...baseParams, facility_type: 'all' };

      default:
        return baseParams;
    }
  }
}

// Singleton instance
let mcpHealthcareServiceInstance: MCPHealthcareService | null = null;

export function getMCPHealthcareService(): MCPHealthcareService {
  if (!mcpHealthcareServiceInstance) {
    mcpHealthcareServiceInstance = new MCPHealthcareService();
  }
  return mcpHealthcareServiceInstance;
}

export function resetMCPHealthcareService(): void {
  mcpHealthcareServiceInstance = null;
}
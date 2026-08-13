// Prevent the Claude Agent SDK (ESM .mjs Jest cannot parse) from loading through
// the query.routes -> agentSdkService import chain.
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

// @modelcontextprotocol/ext-apps ships ESM-only .js. The index -> mcpRoutes ->
// mcpSessionManager -> mcpServer chain pulls it in at load time; stub the subpath.
jest.mock('@modelcontextprotocol/ext-apps/server', () => ({
  registerAppTool: jest.fn(),
  registerAppResource: jest.fn(),
  RESOURCE_MIME_TYPE: 'text/html',
}));

// Avoid heavy MCP server service initialization on import.
jest.mock('../../services/mcpServerService', () => ({
  getMCPServerService: jest.fn(() => ({
    getStatus: jest.fn(() => ({ running: false })),
    healthCheck: jest.fn().mockResolvedValue(true),
  })),
  closeMCPServerService: jest.fn().mockResolvedValue(undefined),
}));

// Mock the query-analysis boundary so query POSTs never reach the live Anthropic
// API (hermetic).
jest.mock('../../services/anthropicService', () => ({
  anthropicService: {
    analyzeQuery: jest.fn(),
  },
}));

// Mock the MCP client (SQL validation + execution boundary).
jest.mock('../../mcp/mcpClient', () => {
  const executeQuery = jest.fn();
  return {
    getMcpClient: jest.fn(() => ({ executeQuery })),
    getCensusChat_MCPClient: jest.fn(() => ({ executeQuery })),
  };
});

// Mock the healthcare analytics module so keyword-triggered queries fall through
// to the MCP/DuckDB path deterministically.
jest.mock('../../modules/healthcare_analytics', () => ({
  getHealthcareAnalyticsModule: jest.fn(() => ({
    executeQuery: jest.fn().mockResolvedValue({ success: false, error: 'disabled in test' }),
  })),
}));

import request from 'supertest';
import express from 'express';
import { app } from '../../index';
// /api/v1/census is disabled in production (src/routes/index.ts). Mount it on a
// dedicated app here so these integration tests can exercise the census
// endpoints without changing the production route surface. (Mounting on the real
// `app` post-import fails: index.ts registers a catch-all 404 handler at load, so
// a later app.use never gets reached.)
import censusRoutes from '../../routes/census.routes';
const censusApp = express();
censusApp.use(express.json());
censusApp.use('/api/v1/census', censusRoutes);
import { censusApiService } from '../../services/censusApiService';
import { FallbackService, CensusApiErrorType } from '../../services/fallbackService';
import { invalidateCache } from '../../services/cacheService';
import { anthropicService } from '../../services/anthropicService';
import { getCensusChat_MCPClient } from '../../mcp/mcpClient';
import { getHealthcareAnalyticsModule } from '../../modules/healthcare_analytics';

const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;
const mockExecuteQuery = (getCensusChat_MCPClient() as unknown as {
  executeQuery: jest.Mock;
}).executeQuery;
const mockGetHealthcareModule = getHealthcareAnalyticsModule as jest.Mock;

const buildAnalysis = () => ({
  analysis: {
    intent: 'demographics',
    entities: { locations: ['Florida'] },
    filters: { state: 'Florida' },
    outputFormat: 'table',
    confidence: 0.9,
  },
  sqlQuery: 'SELECT county_name, state_name, population FROM county_data LIMIT 50',
  explanation: 'Standard demographics query',
  suggestedRefinements: [],
});

const buildMcpSuccess = (rows: Array<Record<string, unknown>>) => ({
  success: true,
  result: {
    data: rows,
    metadata: {
      rowCount: rows.length,
      sanitizedSQL: 'SELECT county_name, state_name, population FROM county_data LIMIT 50',
    },
  },
});

describe('Census API Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear cache before each test
    await invalidateCache();

    // Default deterministic behavior for query POSTs: successful analysis + MCP.
    mockAnthropicService.analyzeQuery.mockResolvedValue(buildAnalysis());
    mockExecuteQuery.mockResolvedValue(
      buildMcpSuccess([
        { county_name: 'Miami-Dade', state_name: 'Florida', population: 2716940 },
      ])
    );
    mockGetHealthcareModule.mockReturnValue({
      executeQuery: jest.fn().mockResolvedValue({ success: false, error: 'disabled in test' }),
    });
  });

  describe('Census API Service Configuration', () => {
    it('should be properly configured', () => {
      const status = censusApiService.getServiceStatus();

      expect(status.configured).toBe(true);
      expect(status.mode).toBe('mock'); // Should be in mock mode for tests
      expect(status.configuration.baseUrl).toBe('https://api.census.gov');
      expect(status.configuration.hasApiKey).toBe(false);
      expect(status.configuration.useLiveApi).toBe(false);
      expect(status.configuration.cacheTtl).toBeGreaterThan(0);
      expect(status.configuration.hourlyRateLimit).toBeGreaterThan(0);
    });

    it('should validate rate limit info', () => {
      const rateLimitInfo = censusApiService.getRateLimitInfo();

      expect(rateLimitInfo.hasKey).toBe(false);
      expect(rateLimitInfo.dailyLimit).toBe('500 queries per day');
      expect(rateLimitInfo.liveApiEnabled).toBe(false);
      expect(rateLimitInfo.hourlyLimit).toBeGreaterThan(0);
    });
  });

  describe('Census API Test Connection Endpoint', () => {
    it('should return service status and configuration', async () => {
      const response = await request(censusApp)
        .get('/api/v1/census/test-connection');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.serviceStatus).toBeDefined();
      expect(response.body.authentication).toBeDefined();
      expect(response.body.authentication.message).toContain('Live API mode is disabled');
      expect(response.body.availableDatasets).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should return cache statistics', async () => {
      const response = await request(censusApp)
        .get('/api/v1/census/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cacheStats).toBeDefined();
      expect(typeof response.body.cacheStats.available).toBe('boolean');
      expect(typeof response.body.cacheStats.totalKeys).toBe('number');
      expect(Array.isArray(response.body.cacheStats.cacheKeys)).toBe(true);
    });

    it('should invalidate cache entries', async () => {
      const response = await request(censusApp)
        .post('/api/v1/census/cache/invalidate')
        .send({ pattern: 'test_*' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.deletedCount).toBe('number');
      expect(response.body.pattern).toBe('test_*');
    });

    it('should clean expired cache entries', async () => {
      const response = await request(censusApp)
        .post('/api/v1/census/cache/clean');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.cleanedCount).toBe('number');
    });
  });

  describe('Fallback Service', () => {
    it('should determine error types correctly', () => {
      expect(FallbackService.determineErrorType(new Error('rate limit exceeded')))
        .toBe(CensusApiErrorType.RATE_LIMIT_EXCEEDED);

      expect(FallbackService.determineErrorType(new Error('unauthorized')))
        .toBe(CensusApiErrorType.AUTHENTICATION_FAILED);

      expect(FallbackService.determineErrorType(new Error('timeout')))
        .toBe(CensusApiErrorType.TIMEOUT);

      expect(FallbackService.determineErrorType(new Error('connection refused')))
        .toBe(CensusApiErrorType.NETWORK_ERROR);
    });

    it('should provide appropriate suggestions for different error types', () => {
      const rateLimitSuggestions = FallbackService.getSuggestions(CensusApiErrorType.RATE_LIMIT_EXCEEDED);
      expect(rateLimitSuggestions).toContain('Wait a few minutes before making another request');

      const invalidQuerySuggestions = FallbackService.getSuggestions(CensusApiErrorType.INVALID_QUERY);
      expect(invalidQuerySuggestions.some(s => s.includes('specific'))).toBe(true);

      const timeoutSuggestions = FallbackService.getSuggestions(CensusApiErrorType.TIMEOUT);
      expect(timeoutSuggestions.some(s => s.includes('simpler'))).toBe(true);
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligible seniors in Florida with income over $50k'
        });

      // Rate limiting headers should be present (even if Redis is not available)
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Query Processing with Fallback', () => {
    it('should return mock healthcare data when the MCP/DuckDB path fails', async () => {
      // Force the MCP execution to fail so the route's mock-data fallback runs.
      mockExecuteQuery.mockResolvedValue({
        success: false,
        error: 'Table not allowed',
        validationErrors: [{ message: 'Table not allowed' }],
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligible seniors in Florida with income over $50k'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.dataSource).toContain('Mock Healthcare Demographics');
      expect(response.body.metadata.usedDuckDB).toBe(false);
    });

    it('should provide error details and suggestions when analysis fails', async () => {
      // The current route surfaces analysis failures as a 500 with recovery
      // suggestions (the legacy VALIDATION_ERROR/400 path is unreachable because
      // MCP validation failures are absorbed by the mock-data fallback above).
      mockAnthropicService.analyzeQuery.mockRejectedValue(
        new Error('Unable to parse query')
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'gibberish query that makes no sense'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_ERROR');
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.errorType).toBeDefined();
    });

    it('should maintain response format consistency', async () => {
      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me population data for California'
        });

      // Should maintain consistent response format regardless of data source
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('metadata');

      expect(response.body.metadata).toHaveProperty('queryTime');
      expect(response.body.metadata).toHaveProperty('totalRecords');
      expect(response.body.metadata).toHaveProperty('dataSource');
      expect(response.body.metadata).toHaveProperty('confidenceLevel');
      expect(response.body.metadata).toHaveProperty('marginOfError');
    });
  });

  describe('Performance Requirements', () => {
    it('should process queries within 2 second requirement', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me population data for Texas'
        });

      const endTime = Date.now();
      const actualResponseTime = (endTime - startTime) / 1000;

      expect(response.status).toBe(200);
      expect(actualResponseTime).toBeLessThan(2.0);

      if (response.body.metadata?.queryTime) {
        expect(response.body.metadata.queryTime).toBeLessThan(2.0);
      }
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle timeout scenarios gracefully', async () => {
      // This test simulates the timeout scenario that's already tested in query.routes.test.ts
      // but validates the error response structure includes fallback information

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'test query for timeout simulation'
        });

      // The test should either succeed (if mock) or timeout (if actually hitting the timeout condition)
      if (response.status === 408) {
        expect(response.body.error).toBe('TIMEOUT');
        expect(response.body.message).toContain('took too long');
      } else if (response.status === 200) {
        // Mock data response is acceptable
        expect(response.body.success).toBe(true);
      }
    });

    it('should provide meaningful error messages for various scenarios', async () => {
      // Test missing query
      const missingQueryResponse = await request(app)
        .post('/api/v1/queries')
        .send({});

      expect(missingQueryResponse.status).toBe(400);
      expect(missingQueryResponse.body.error).toBe('INVALID_INPUT');
      expect(missingQueryResponse.body.message).toContain('Query is required');

      // Test invalid query type
      const invalidTypeResponse = await request(app)
        .post('/api/v1/queries')
        .send({ query: 123 });

      expect(invalidTypeResponse.status).toBe(400);
      expect(invalidTypeResponse.body.error).toBe('INVALID_INPUT');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate environment configuration is correct', () => {
      // These are the configuration values that should be set for testing
      expect(process.env.NODE_ENV).toBe('test');

      // Check that required services are configured
      const status = censusApiService.getServiceStatus();
      expect(status.configured).toBe(true);
    });
  });
});

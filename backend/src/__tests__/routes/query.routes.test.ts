// Prevent the Claude Agent SDK (shipped as an ESM .mjs that Jest cannot parse)
// from loading through the query.routes -> agentSdkService import chain.
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

// @modelcontextprotocol/ext-apps ships ESM-only .js that Jest cannot parse. The
// index -> mcpRoutes -> mcpSessionManager -> mcpServer chain pulls it in at load
// time, so stub the subpath the server module consumes.
jest.mock('@modelcontextprotocol/ext-apps/server', () => ({
  registerAppTool: jest.fn(),
  registerAppResource: jest.fn(),
  RESOURCE_MIME_TYPE: 'text/html',
}));

// Avoid the heavy MCP server service initialization through the index import.
jest.mock('../../services/mcpServerService', () => ({
  getMCPServerService: jest.fn(() => ({
    getStatus: jest.fn(() => ({ running: false })),
    healthCheck: jest.fn().mockResolvedValue(true),
  })),
  closeMCPServerService: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../../index';
import { anthropicService } from '../../services/anthropicService';
import { getCensusChat_MCPClient } from '../../mcp/mcpClient';
import { getHealthcareAnalyticsModule } from '../../modules/healthcare_analytics';

// Mock the anthropicService (query analysis boundary)
jest.mock('../../services/anthropicService', () => ({
  anthropicService: {
    analyzeQuery: jest.fn(),
  },
}));

// Mock the MCP client (SQL validation + execution boundary)
jest.mock('../../mcp/mcpClient', () => {
  const executeQuery = jest.fn();
  return {
    getMcpClient: jest.fn(() => ({ executeQuery })),
    getCensusChat_MCPClient: jest.fn(() => ({ executeQuery })),
  };
});

// Mock the healthcare analytics module so keyword-triggered queries fall through
// to the MCP/DuckDB path deterministically unless a test opts in.
jest.mock('../../modules/healthcare_analytics', () => ({
  getHealthcareAnalyticsModule: jest.fn(() => ({
    executeQuery: jest.fn().mockResolvedValue({ success: false, error: 'disabled in test' }),
  })),
}));

const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;
const mockExecuteQuery = (getCensusChat_MCPClient() as unknown as {
  executeQuery: jest.Mock;
}).executeQuery;
const mockGetHealthcareModule = getHealthcareAnalyticsModule as jest.Mock;

/**
 * Standard analyzeQuery response shape returned by the current route contract.
 */
const buildAnalysis = (overrides: Record<string, unknown> = {}) => ({
  analysis: {
    intent: 'demographics',
    entities: {},
    filters: {},
    outputFormat: 'table',
    confidence: 0.9,
    ...overrides,
  },
  sqlQuery: 'SELECT county_name, state_name, population FROM county_data LIMIT 50',
  explanation: 'Standard demographics query',
  suggestedRefinements: [],
});

/**
 * Successful MCP execution result matching MCPToolCallResult.
 */
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

describe('POST /api/v1/queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QUERY_TIMEOUT_MS;
    delete process.env.USE_AGENT_SDK;
    // Re-establish default healthcare-module behavior after clearAllMocks.
    mockGetHealthcareModule.mockReturnValue({
      executeQuery: jest.fn().mockResolvedValue({ success: false, error: 'disabled in test' }),
    });
  });

  it('should successfully process a valid query via the MCP/DuckDB path', async () => {
    const mockAnalysis = {
      intent: 'demographics',
      entities: {
        locations: ['Florida'],
        demographics: ['seniors'],
        ageGroups: ['65+'],
        incomeRanges: ['$50k+'],
      },
      filters: { minAge: 65, minIncome: 50000, state: 'FL' },
      outputFormat: 'table',
      confidence: 0.95,
    };

    mockAnthropicService.analyzeQuery.mockResolvedValue({
      analysis: mockAnalysis,
      sqlQuery: 'SELECT * FROM county_data WHERE state_name = \'FL\'',
      explanation: 'Query for seniors in Florida',
      suggestedRefinements: [],
    });

    mockExecuteQuery.mockResolvedValue(
      buildMcpSuccess([
        { county_name: 'Miami-Dade', state_name: 'Florida', population: 2716940 },
        { county_name: 'Broward', state_name: 'Florida', population: 1944375 },
      ])
    );

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'Show me Medicare eligible seniors in Florida with income over $50k',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.length).toBe(2);
    expect(response.body.metadata).toBeDefined();
    expect(response.body.metadata.queryTime).toBeDefined();
    expect(response.body.metadata.usedDuckDB).toBe(true);
    expect(response.body.metadata.dataSource).toContain('MCP Validated');
    expect(response.body.metadata.analysis.analysis).toEqual(mockAnalysis);
    expect(mockAnthropicService.analyzeQuery).toHaveBeenCalledWith(
      'Show me Medicare eligible seniors in Florida with income over $50k'
    );
  });

  it('should return 400 for missing query', async () => {
    const response = await request(app)
      .post('/api/v1/queries')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('INVALID_INPUT');
    expect(response.body.message).toContain('Query is required');
  });

  it('should return 400 for non-string query', async () => {
    const response = await request(app)
      .post('/api/v1/queries')
      .send({ query: 123 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('INVALID_INPUT');
  });

  it('should return 408 when processing exceeds the timeout budget', async () => {
    // Shrink the timeout budget so the test does not wait the 30s default.
    process.env.QUERY_TIMEOUT_MS = '150';

    mockAnthropicService.analyzeQuery.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(buildAnalysis()), 1500); // exceeds 150ms budget
      });
    });

    const response = await request(app)
      .post('/api/v1/queries')
      .send({ query: 'Show me seniors in Florida' });

    expect(response.status).toBe(408);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('TIMEOUT');
    expect(response.body.message).toContain('took too long');
  }, 10000);

  it('should fall back to mock healthcare data when MCP execution fails', async () => {
    mockAnthropicService.analyzeQuery.mockResolvedValue(buildAnalysis());
    mockExecuteQuery.mockResolvedValue({
      success: false,
      error: 'Table not allowed',
      validationErrors: [{ message: 'Table not allowed' }],
    });

    const response = await request(app)
      .post('/api/v1/queries')
      .send({ query: 'Show me population data' });

    // Current route contract: MCP failures are absorbed by the mock-data
    // fallback, so the request still succeeds with usedDuckDB = false.
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.usedDuckDB).toBe(false);
    expect(response.body.metadata.dataSource).toContain('Mock Healthcare Demographics');
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('should return 400 with suggestions when query analysis fails validation', async () => {
    mockAnthropicService.analyzeQuery.mockRejectedValue(
      new Error('Unable to parse query')
    );

    const response = await request(app)
      .post('/api/v1/queries')
      .send({ query: 'gibberish query that makes no sense' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.suggestions).toBeDefined();
    expect(response.body.suggestions.length).toBeGreaterThan(0);
  });

  it('should process queries within 2 second requirement', async () => {
    const startTime = Date.now();

    mockAnthropicService.analyzeQuery.mockResolvedValue(buildAnalysis());
    mockExecuteQuery.mockResolvedValue(
      buildMcpSuccess([{ county_name: 'Harris', state_name: 'Texas', population: 4731145 }])
    );

    const response = await request(app)
      .post('/api/v1/queries')
      .send({ query: 'Show me population data' });

    const actualResponseTime = (Date.now() - startTime) / 1000;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.queryTime).toBeLessThan(2.0);
    expect(actualResponseTime).toBeLessThan(2.0);
  });

  it('should handle concurrent requests through the MCP path', async () => {
    mockAnthropicService.analyzeQuery.mockResolvedValue(buildAnalysis());
    mockExecuteQuery.mockResolvedValue(
      buildMcpSuccess([{ county_name: 'Harris', state_name: 'Texas', population: 4731145 }])
    );

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        request(app)
          .post('/api/v1/queries')
          .send({ query: `Query ${i}: Show me population data` })
      );
    }

    const responses = await Promise.all(promises);

    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedDuckDB).toBe(true);
    });
  });
});

// The Claude Agent SDK and the Model Context Protocol SDK both ship as ESM that
// Jest's ts-jest transform does not process (they live under node_modules and
// are ignored by the transform). Importing `app` pulls them in transitively
// (query.routes -> agentSdkService, and the /mcp routers -> mcp/mcpServer,
// mcp/mcpSessionManager). This suite only exercises /api/v1/queries, which does
// not touch any of these modules, so replace them with factory mocks to avoid
// loading/parsing the real ESM files.
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    tool = jest.fn();
    registerTool = jest.fn();
    connect = jest.fn();
  },
}));
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: class {
    handleRequest = jest.fn();
    close = jest.fn();
  },
}));
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: () => false,
}));
jest.mock('@modelcontextprotocol/ext-apps/server', () => ({
  registerAppTool: jest.fn(),
  registerAppResource: jest.fn(),
  RESOURCE_MIME_TYPE: 'text/html+skybridge',
}));

// Collaborators of the /api/v1/queries route. Factory mocks (rather than
// auto-mocks) keep the real modules — and any ESM/DuckDB they pull in — from
// loading. Vars are `mock`-prefixed so jest's hoist lint allows the reference.
const mockAnalyzeQuery = jest.fn();
jest.mock('../../services/anthropicService', () => ({
  anthropicService: { analyzeQuery: mockAnalyzeQuery },
}));

const mockHealthcareExecuteQuery = jest.fn();
jest.mock('../../modules/healthcare_analytics', () => ({
  getHealthcareAnalyticsModule: () => ({ executeQuery: mockHealthcareExecuteQuery }),
}));

const mockMcpExecuteQuery = jest.fn();
jest.mock('../../mcp/mcpClient', () => ({
  getCensusChat_MCPClient: () => ({ executeQuery: mockMcpExecuteQuery }),
}));

jest.mock('../../utils/auditLogger', () => ({
  getAuditLogger: () => ({ logSuccess: jest.fn(), logValidationFailure: jest.fn() }),
}));

import request from 'supertest';

// Load the app lazily (after the mock-prefixed vars above are initialized) to
// avoid a temporal-dead-zone reference inside the factory mocks.
let app: import('express').Express;
beforeAll(() => {
  app = require('../../index').app;
});

/** Standard analyzeQuery result for a demographics query. */
function analysisFor(locations: string[], state?: string) {
  return {
    analysis: {
      intent: 'demographics' as const,
      entities: { locations },
      filters: state ? { state } : {},
      outputFormat: 'table' as const,
      confidence: 0.95,
    },
    sqlQuery:
      "SELECT county_name, state_name, population FROM county_data LIMIT 50",
    explanation: 'test',
  };
}

describe('Query Routes - MCP Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks (mockClear) does not drain queued mock*ValueOnce results.
    // Reset each collaborator so an unconsumed "once" cannot leak forward.
    mockAnalyzeQuery.mockReset();
    mockHealthcareExecuteQuery.mockReset();
    mockMcpExecuteQuery.mockReset();
    mockAnalyzeQuery.mockResolvedValue(analysisFor(['Florida']));
  });

  describe('Healthcare Analytics Integration', () => {
    it('should use MCP healthcare analytics for Medicare-related queries', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: true,
        data: [
          {
            county: 'Miami-Dade',
            state: 'Florida',
            population_65_plus: 486234,
            medicare_eligible_rate: 17.89,
          },
        ],
        metadata: {
          recordCount: 1,
          federatedSources: ['CensusChat Internal MCP'],
          executionTime: 150,
          confidenceLevel: 0.95,
          queryPattern: 'medicare_eligibility',
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('medicare_eligible_rate', 17.89);
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
      expect(response.body.metadata.usedDuckDB).toBe(false);
      expect(response.body.metadata.dataSource).toBe('CensusChat Internal MCP');
      expect(mockHealthcareExecuteQuery).toHaveBeenCalled();
      // Non-healthcare DuckDB path must not run.
      expect(mockMcpExecuteQuery).not.toHaveBeenCalled();
    });

    it('should use MCP analytics for health-related queries', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: true,
        data: [
          {
            county: 'Broward',
            state: 'Florida',
            risk_category: 'Moderate Risk',
          },
        ],
        metadata: {
          recordCount: 1,
          federatedSources: ['CensusChat Internal MCP'],
          executionTime: 200,
          confidenceLevel: 0.95,
          queryPattern: 'population_health',
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'What are the health risk factors in Florida counties?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('risk_category', 'Moderate Risk');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
      expect(mockHealthcareExecuteQuery).toHaveBeenCalled();
    });

    it('should use MCP analytics for facility-related queries', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: true,
        data: [
          {
            county: 'Palm Beach',
            state: 'Florida',
            adequacy_rating: 'Adequately Served',
          },
        ],
        metadata: {
          recordCount: 1,
          federatedSources: ['CensusChat Internal MCP'],
          executionTime: 180,
          confidenceLevel: 0.95,
          queryPattern: 'facility_adequacy',
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'How adequate is hospital facility access in Florida?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('adequacy_rating', 'Adequately Served');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
      expect(mockHealthcareExecuteQuery).toHaveBeenCalled();
    });

    it('should fall back to DuckDB when MCP analytics fails', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: false,
        data: [],
        error: 'MCP service unavailable',
      });

      mockMcpExecuteQuery.mockResolvedValueOnce({
        success: true,
        result: {
          data: [
            {
              county_name: 'Miami-Dade',
              state_name: 'Florida',
              population: 2716940,
            },
          ],
          metadata: { rowCount: 1, sanitizedSQL: 'SELECT ... FROM county_data' },
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
      expect(response.body.metadata.dataSource).toContain('DuckDB Production (MCP Validated)');
    });

    it('should fall back to mock data when both MCP and DuckDB fail', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: false,
        data: [],
        error: 'MCP service unavailable',
      });

      // MCP validation/execution fails -> route falls back to mock demographics.
      mockMcpExecuteQuery.mockResolvedValueOnce({
        success: false,
        error: 'Database unavailable',
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(false);
      expect(response.body.metadata.dataSource).toBe(
        'Mock Healthcare Demographics (Foundation data simulation)'
      );
      expect(response.body.data).toHaveLength(5); // Mock data contains 5 counties
    });

    it('should not use MCP analytics for non-healthcare queries', async () => {
      mockAnalyzeQuery.mockResolvedValueOnce(analysisFor(['California'], 'California'));

      mockMcpExecuteQuery.mockResolvedValueOnce({
        success: true,
        result: {
          data: [
            {
              county_name: 'Los Angeles',
              state_name: 'California',
              population: 10014009,
            },
          ],
          metadata: { rowCount: 1, sanitizedSQL: 'SELECT ... FROM county_data' },
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me population data for California' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
      // Healthcare analytics path must not run for a non-healthcare query.
      expect(mockHealthcareExecuteQuery).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling with MCP', () => {
    it('should handle query processing timeout gracefully', async () => {
      const original = process.env.QUERY_TIMEOUT_MS;
      process.env.QUERY_TIMEOUT_MS = '50';

      // Analytics hangs forever; the route's timeout budget must win the race.
      mockHealthcareExecuteQuery.mockReturnValueOnce(new Promise(() => {}));

      try {
        const response = await request(app)
          .post('/api/v1/queries')
          .send({ query: 'Show me Medicare eligibility rates in Florida' });

        expect(response.status).toBe(408);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('TIMEOUT');
        expect(response.body.message).toContain('Query processing took too long');
      } finally {
        if (original === undefined) delete process.env.QUERY_TIMEOUT_MS;
        else process.env.QUERY_TIMEOUT_MS = original;
      }
    });

    it('should handle MCP analytics errors within timeout', async () => {
      mockHealthcareExecuteQuery.mockRejectedValueOnce(
        new Error('MCP server connection failed')
      );

      mockMcpExecuteQuery.mockResolvedValueOnce({
        success: true,
        result: {
          data: [
            { county_name: 'Miami-Dade', state_name: 'Florida', population: 2716940 },
          ],
          metadata: { rowCount: 1, sanitizedSQL: 'SELECT ... FROM county_data' },
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
    });

    it('should handle validation errors from Anthropic service', async () => {
      mockAnalyzeQuery.mockRejectedValueOnce(
        new Error('MCP validation failed: Invalid query format')
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'invalid query format' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('trouble understanding your query');
      expect(response.body.suggestions).toBeDefined();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track execution time for MCP analytics', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: true,
        data: [{ county: 'Miami-Dade', state: 'Florida' }],
        metadata: {
          recordCount: 1,
          federatedSources: ['CensusChat Internal MCP'],
          executionTime: 350,
          confidenceLevel: 0.95,
          queryPattern: 'medicare_eligibility',
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.metadata.queryTime).toBeGreaterThanOrEqual(0);
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
    });
  });

  describe('Data Source Reporting', () => {
    it('should correctly report MCP data source in metadata', async () => {
      mockHealthcareExecuteQuery.mockResolvedValueOnce({
        success: true,
        data: [{ county: 'Miami-Dade', state: 'Florida' }],
        metadata: {
          recordCount: 1,
          federatedSources: ['CensusChat + External MCP'],
          executionTime: 150,
          confidenceLevel: 0.95,
          queryPattern: 'medicare_eligibility',
        },
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({ query: 'Show me Medicare eligibility rates in Florida' })
        .expect(200);

      expect(response.body.metadata.dataSource).toBe('CensusChat + External MCP');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
      expect(response.body.metadata.analysis).toBeDefined();
    });
  });
});

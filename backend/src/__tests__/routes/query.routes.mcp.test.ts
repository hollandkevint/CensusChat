import request from 'supertest';
import { app } from '../../index';
import { getHealthcareAnalyticsModule } from '../../modules/healthcare_analytics';
import { anthropicService } from '../../services/anthropicService';
import { getDuckDBPool, closeDuckDBPool } from '../../utils/duckdbPool';

// Mock dependencies
jest.mock('../../services/anthropicService');
jest.mock('../../modules/healthcare_analytics', () => ({
  getHealthcareAnalyticsModule: jest.fn()
}));

const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;
const mockGetHealthcareModule = getHealthcareAnalyticsModule as jest.Mock;

// Shared healthcare analytics module mock
const mockHealthcareModule = {
  executeQuery: jest.fn()
};

function healthcareResult(data: any[], sources: string[] = ['CensusChat Internal MCP']) {
  return {
    success: true,
    data,
    metadata: {
      recordCount: data.length,
      federatedSources: sources,
      executionTime: 150,
      confidenceLevel: 0.95,
      queryPattern: 'SELECT ...'
    }
  };
}

async function seedCountyData() {
  const pool = getDuckDBPool();
  await pool.initialize();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS county_data (
      county_name VARCHAR,
      state_name VARCHAR,
      population BIGINT,
      median_income BIGINT,
      poverty_rate DOUBLE
    )
  `);
  await pool.query('DELETE FROM county_data');
  await pool.query(`
    INSERT INTO county_data (county_name, state_name, population, median_income, poverty_rate)
    VALUES
      ('Miami-Dade', 'Florida', 2716940, 52800, 15.8),
      ('Broward', 'Florida', 1944375, 59734, 12.4)
  `);
}

const VALID_SQL = "SELECT county_name, state_name, population FROM county_data WHERE state_name = 'Florida'";
const INVALID_SQL = 'SELECT secret FROM not_allowed_table';

function mockAnalysis(sqlQuery: string = VALID_SQL) {
  mockAnthropicService.analyzeQuery.mockResolvedValue({
    analysis: {
      intent: 'demographics',
      entities: {
        locations: ['Florida']
      },
      filters: {},
      outputFormat: 'table',
      confidence: 0.95
    },
    sqlQuery,
    explanation: 'Test query',
    suggestedRefinements: []
  } as any);
}

describe('Query Routes - MCP Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetHealthcareModule.mockReturnValue(mockHealthcareModule);
    mockAnalysis();
    await seedCountyData();
  });

  afterAll(async () => {
    await closeDuckDBPool();
  });

  describe('Healthcare Analytics Integration', () => {
    it('should use MCP healthcare analytics for Medicare-related queries', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce(
        healthcareResult([
          {
            county: 'Miami-Dade',
            state: 'Florida',
            population_65_plus: 486234,
            medicare_eligible_rate: 17.89,
            senior_population_category: 'Moderate Senior Population'
          }
        ])
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('medicare_eligible_rate', 17.89);
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);

      expect(mockHealthcareModule.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          naturalLanguageQuery: 'Show me Medicare eligibility rates in Florida'
        })
      );
    });

    it('should use MCP analytics for health-related queries', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce(
        healthcareResult([
          {
            county: 'Broward',
            state: 'Florida',
            population_total: 1944375,
            median_household_income: 59734,
            income_risk_score: 2,
            risk_category: 'Moderate Risk'
          }
        ])
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'What are the health risk factors in Florida counties?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('risk_category', 'Moderate Risk');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);

      expect(mockHealthcareModule.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({ focus_area: 'population_health' })
        })
      );
    });

    it('should use MCP analytics for facility-related queries', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce(
        healthcareResult([
          {
            county: 'Palm Beach',
            state: 'Florida',
            population_total: 1496770,
            facilities_per_10k_estimate: 149.68,
            adequacy_rating: 'Adequately Served'
          }
        ])
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'How adequate are hospital facilities in Florida for health planning?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('adequacy_rating', 'Adequately Served');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
    });

    it('should fall back to DuckDB when MCP analytics fails', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce({
        success: false,
        data: [],
        metadata: { recordCount: 0, federatedSources: [], executionTime: 0, confidenceLevel: 0, queryPattern: '' },
        error: 'MCP service unavailable'
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
      expect(response.body.metadata.dataSource).toBe('DuckDB Production (MCP Validated)');
    });

    it('should fall back to mock data when both MCP and DuckDB fail', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce({
        success: false,
        data: [],
        metadata: { recordCount: 0, federatedSources: [], executionTime: 0, confidenceLevel: 0, queryPattern: '' },
        error: 'MCP service unavailable'
      });

      // SQL that fails validation forces the mock-data fallback
      mockAnalysis(INVALID_SQL);

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(false);
      expect(response.body.metadata.dataSource).toBe('Mock Healthcare Demographics (Foundation data simulation)');
      expect(response.body.data).toHaveLength(5); // Mock data contains 5 counties
    });

    it('should not use MCP analytics for non-healthcare queries', async () => {
      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me population data for California'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);

      // Should not call MCP analytics
      expect(mockHealthcareModule.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling with MCP', () => {
    it('should handle MCP analytics timeout gracefully', async () => {
      // Simulate a hanging analysis - the route's timeout (2s in tests) should fire
      mockAnthropicService.analyzeQuery.mockImplementation(
        () => new Promise(() => {}) as any
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        });

      expect(response.status).toBe(408);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('TIMEOUT');
      expect(response.body.message).toContain('Query processing took too long');
    }, 10000);

    it('should handle MCP analytics errors within timeout', async () => {
      mockHealthcareModule.executeQuery.mockRejectedValueOnce(
        new Error('MCP server connection failed')
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
    });

    it('should handle validation errors from Anthropic service', async () => {
      mockAnthropicService.analyzeQuery.mockRejectedValueOnce(
        new Error('MCP validation failed: Invalid query format')
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'invalid query format'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('trouble understanding your query');
      expect(response.body.suggestions).toBeDefined();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track execution time for MCP analytics', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce(
        healthcareResult([{ county: 'Miami-Dade', state: 'Florida' }])
      );

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      const endTime = Date.now();

      expect(response.body.metadata.queryTime).toBeGreaterThanOrEqual(0);
      expect(response.body.metadata.queryTime).toBeLessThan((endTime - startTime) / 1000 + 0.1);
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
    });
  });

  describe('Data Source Reporting', () => {
    it('should correctly report MCP data source in metadata', async () => {
      mockHealthcareModule.executeQuery.mockResolvedValueOnce(
        healthcareResult(
          [{ county: 'Miami-Dade', state: 'Florida' }],
          ['CensusChat + External MCP']
        )
      );

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.metadata.dataSource).toBe('CensusChat + External MCP');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
      expect(response.body.metadata.analysis).toBeDefined();
    });
  });
});

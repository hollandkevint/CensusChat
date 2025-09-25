import request from 'supertest';
import { app } from '../../index';
import { HealthcareAnalyticsTools } from '../../utils/mcpTools';
import { anthropicService } from '../../services/anthropicService';

// Mock dependencies
jest.mock('../../utils/mcpTools');
jest.mock('../../services/anthropicService');
jest.mock('../../utils/duckdbPool');

const mockHealthcareAnalyticsTools = HealthcareAnalyticsTools as jest.Mocked<typeof HealthcareAnalyticsTools>;
const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;

describe('Query Routes - MCP Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful query analysis
    mockAnthropicService.analyzeQuery.mockResolvedValue({
      intent: 'demographics',
      entities: {
        locations: ['Florida'],
        metrics: ['medicare_eligibility']
      },
      confidence: 0.95
    });
  });

  describe('Healthcare Analytics Integration', () => {
    it('should use MCP healthcare analytics for Medicare-related queries', async () => {
      const mockAnalysisResult = {
        success: true,
        data: [
          {
            county: 'Miami-Dade',
            state: 'Florida',
            population_65_plus: 486234,
            medicare_eligible_rate: 17.89,
            senior_population_category: 'Moderate Senior Population'
          }
        ],
        metadata: {
          analysisType: 'medicare_eligibility',
          executionTime: 150,
          dataSource: 'CensusChat Internal MCP',
          recordCount: 1
        }
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

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

      expect(mockHealthcareAnalyticsTools.executeAnalysis).toHaveBeenCalledWith({
        analysisType: 'medicare_eligibility',
        parameters: {
          geography_type: 'county',
          geography_codes: ['Florida'],
          risk_factors: ['income', 'insurance', 'age']
        },
        useExternalData: false
      });
    });

    it('should use MCP analytics for health-related queries', async () => {
      const mockAnalysisResult = {
        success: true,
        data: [
          {
            county: 'Broward',
            state: 'Florida',
            population_total: 1944375,
            median_household_income: 59734,
            income_risk_score: 2,
            risk_category: 'Moderate Risk'
          }
        ],
        metadata: {
          analysisType: 'population_health',
          executionTime: 200,
          dataSource: 'CensusChat Internal MCP',
          recordCount: 1
        }
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'What are the health risk factors in Florida counties?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('risk_category', 'Moderate Risk');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);

      expect(mockHealthcareAnalyticsTools.executeAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisType: 'population_health'
        })
      );
    });

    it('should use MCP analytics for facility-related queries', async () => {
      const mockAnalysisResult = {
        success: true,
        data: [
          {
            county: 'Palm Beach',
            state: 'Florida',
            population_total: 1496770,
            facilities_per_10k_estimate: 149.68,
            adequacy_rating: 'Adequately Served'
          }
        ],
        metadata: {
          analysisType: 'facility_adequacy',
          executionTime: 180,
          dataSource: 'CensusChat Internal MCP',
          recordCount: 1
        }
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'How adequate are hospital facilities in Florida?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('adequacy_rating', 'Adequately Served');
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);

      expect(mockHealthcareAnalyticsTools.executeAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisType: 'facility_adequacy'
        })
      );
    });

    it('should fall back to DuckDB when MCP analytics fails', async () => {
      const mockAnalysisResult = {
        success: false,
        error: 'MCP service unavailable'
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

      // Mock DuckDB pool to simulate fallback
      const mockDuckDBPool = require('../../utils/duckdbPool').getDuckDBPool();
      mockDuckDBPool.query.mockResolvedValueOnce([
        {
          county: 'Miami-Dade',
          state: 'Florida',
          seniors: 486234,
          median_income: 52800,
          total_population: 2716940
        }
      ]);

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.usedMCPAnalytics).toBe(false);
      expect(response.body.metadata.usedDuckDB).toBe(true);
      expect(response.body.metadata.dataSource).toBe('DuckDB Production Healthcare Demographics');
    });

    it('should fall back to mock data when both MCP and DuckDB fail', async () => {
      const mockAnalysisResult = {
        success: false,
        error: 'MCP service unavailable'
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

      // Mock DuckDB pool to fail
      const mockDuckDBPool = require('../../utils/duckdbPool').getDuckDBPool();
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Database unavailable'));

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
      // Mock analysis result that doesn't match healthcare patterns
      mockAnthropicService.analyzeQuery.mockResolvedValueOnce({
        intent: 'demographics',
        entities: {
          locations: ['California'],
          metrics: ['population_total']
        },
        confidence: 0.95
      });

      // Mock DuckDB pool for regular query
      const mockDuckDBPool = require('../../utils/duckdbPool').getDuckDBPool();
      mockDuckDBPool.query.mockResolvedValueOnce([
        {
          county: 'Los Angeles',
          state: 'California',
          seniors: 1234567,
          median_income: 70032,
          total_population: 10014009
        }
      ]);

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
      expect(mockHealthcareAnalyticsTools.executeAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling with MCP', () => {
    it('should handle MCP analytics timeout gracefully', async () => {
      jest.useFakeTimers();

      // Create a promise that never resolves to simulate hanging
      const hangingPromise = new Promise(() => {});
      mockHealthcareAnalyticsTools.executeAnalysis.mockReturnValueOnce(hangingPromise);

      const responsePromise = request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        });

      // Fast-forward time to trigger the 2-second timeout
      jest.advanceTimersByTime(2001);

      const response = await responsePromise;

      expect(response.status).toBe(408);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('TIMEOUT');
      expect(response.body.message).toContain('Query processing took too long');

      jest.useRealTimers();
    });

    it('should handle MCP analytics errors within timeout', async () => {
      mockHealthcareAnalyticsTools.executeAnalysis.mockRejectedValueOnce(
        new Error('MCP server connection failed')
      );

      // Mock DuckDB fallback
      const mockDuckDBPool = require('../../utils/duckdbPool').getDuckDBPool();
      mockDuckDBPool.query.mockResolvedValueOnce([
        {
          county: 'Miami-Dade',
          state: 'Florida',
          seniors: 486234,
          median_income: 52800,
          total_population: 2716940
        }
      ]);

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
      const mockAnalysisResult = {
        success: true,
        data: [{ county: 'Miami-Dade', state: 'Florida' }],
        metadata: {
          analysisType: 'medicare_eligibility',
          executionTime: 350,
          dataSource: 'CensusChat Internal MCP',
          recordCount: 1
        }
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        })
        .expect(200);

      const endTime = Date.now();

      expect(response.body.metadata.queryTime).toBeGreaterThan(0);
      expect(response.body.metadata.queryTime).toBeLessThan((endTime - startTime) / 1000 + 0.1);
      expect(response.body.metadata.usedMCPAnalytics).toBe(true);
    });

    it('should maintain 2-second timeout requirement', async () => {
      jest.useFakeTimers();

      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve({
          success: true,
          data: [],
          metadata: { recordCount: 0 }
        }), 3000); // 3 seconds - should timeout
      });

      mockHealthcareAnalyticsTools.executeAnalysis.mockReturnValueOnce(slowPromise);

      const responsePromise = request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me Medicare eligibility rates in Florida'
        });

      jest.advanceTimersByTime(2001);

      const response = await responsePromise;

      expect(response.status).toBe(408);
      expect(response.body.error).toBe('TIMEOUT');

      jest.useRealTimers();
    });
  });

  describe('Data Source Reporting', () => {
    it('should correctly report MCP data source in metadata', async () => {
      const mockAnalysisResult = {
        success: true,
        data: [{ county: 'Miami-Dade', state: 'Florida' }],
        metadata: {
          analysisType: 'medicare_eligibility',
          executionTime: 150,
          dataSource: 'CensusChat + External MCP',
          recordCount: 1
        }
      };

      mockHealthcareAnalyticsTools.executeAnalysis.mockResolvedValueOnce(mockAnalysisResult);

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
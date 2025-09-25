import request from 'supertest';
import { app } from '../../index';
import { anthropicService } from '../../services/anthropicService';
import { getDuckDBPool, closeDuckDBPool } from '../../utils/duckdbPool';

// Mock the anthropicService
jest.mock('../../services/anthropicService', () => ({
  anthropicService: {
    analyzeQuery: jest.fn()
  }
}));

// Mock DuckDB for controlled testing
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn((sql, callback) => {
      setTimeout(() => callback(null), 10);
    }),
    all: jest.fn((sql, callback) => {
      // Return mock healthcare data
      const mockData = [
        {
          county: 'Miami-Dade',
          state: 'Florida',
          seniors: 486234,
          median_income: 52800,
          total_population: 2716940
        },
        {
          county: 'Broward',
          state: 'Florida',
          seniors: 312567,
          median_income: 59734,
          total_population: 1944375
        }
      ];
      setTimeout(() => callback(null, mockData), 10);
    }),
    close: jest.fn((callback) => {
      setTimeout(() => callback(null), 10);
    }),
  })),
}));

const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;

describe('POST /api/v1/queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up DuckDB pool after each test
    await closeDuckDBPool();
  });

  it('should successfully process a valid query', async () => {
    const mockAnalysis = {
      intent: 'demographics',
      entities: {
        locations: ['Florida'],
        demographics: ['seniors'],
        ageGroups: ['65+'],
        incomeRanges: ['$50k+']
      },
      filters: {
        minAge: 65,
        minIncome: 50000,
        state: 'FL'
      },
      outputFormat: 'table',
      confidence: 0.95
    };

    mockAnthropicService.analyzeQuery.mockResolvedValue({
      analysis: mockAnalysis,
      sqlQuery: 'SELECT * FROM census_data WHERE age >= 65',
      explanation: 'Query for seniors in Florida',
      suggestedRefinements: []
    });

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'Show me Medicare eligible seniors in Florida with income over $50k'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.metadata).toBeDefined();
    expect(response.body.metadata.queryTime).toBeDefined();
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
      .send({
        query: 123
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('INVALID_INPUT');
  });

  it('should return 408 for timeout', async () => {
    mockAnthropicService.analyzeQuery.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(resolve, 3000); // 3 seconds - exceeds 2 second timeout
      });
    });

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'Show me seniors in Florida'
      });

    expect(response.status).toBe(408);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('TIMEOUT');
    expect(response.body.message).toContain('took too long');
  }, 10000); // 10 second test timeout

  it('should return 400 for MCP validation errors with suggestions', async () => {
    mockAnthropicService.analyzeQuery.mockRejectedValue(
      new Error('Unable to parse query')
    );

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'gibberish query that makes no sense'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.suggestions).toBeDefined();
    expect(response.body.suggestions.length).toBeGreaterThan(0);
  });

  it('should return 400 for MCP validation errors (covers unexpected errors)', async () => {
    mockAnthropicService.analyzeQuery.mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'Show me population data'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('should handle query processing within 2 second requirement', async () => {
    const startTime = Date.now();

    mockAnthropicService.analyzeQuery.mockResolvedValue({
      analysis: {
        intent: 'demographics',
        entities: {},
        filters: {},
        outputFormat: 'table',
        confidence: 0.8
      },
      sqlQuery: 'SELECT * FROM census_data',
      explanation: 'Basic query',
      suggestedRefinements: []
    });

    const response = await request(app)
      .post('/api/v1/queries')
      .send({
        query: 'Show me population data'
      });

    const endTime = Date.now();
    const actualResponseTime = (endTime - startTime) / 1000;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.queryTime).toBeLessThan(2.0);
    expect(actualResponseTime).toBeLessThan(2.0);
  });

  describe('DuckDB Pool Integration', () => {
    beforeEach(() => {
      // Set environment variable to enable production DuckDB
      process.env.USE_PRODUCTION_DUCKDB = 'true';
    });

    afterEach(() => {
      // Reset environment variable
      delete process.env.USE_PRODUCTION_DUCKDB;
    });

    it('should use DuckDB pool when feature flag is enabled', async () => {
      mockAnthropicService.analyzeQuery.mockResolvedValue({
        analysis: {
          intent: 'demographics',
          entities: { locations: ['Florida'] },
          filters: { state: 'FL' },
          outputFormat: 'table',
          confidence: 0.95
        },
        sqlQuery: 'SELECT * FROM demographics WHERE state = ?',
        explanation: 'Florida demographics query',
        suggestedRefinements: []
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me demographics for Florida'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Mock returns 2 records
      expect(response.body.metadata.dataSource).toBe('DuckDB Production Healthcare Demographics');
      expect(response.body.metadata.usedDuckDB).toBe(true);
    });

    it('should fall back to mock data when DuckDB pool fails', async () => {
      // Mock DuckDB to fail
      const mockDatabase = jest.fn().mockImplementation(() => ({
        run: jest.fn((sql, callback) => callback(new Error('Connection failed'))),
        all: jest.fn((sql, callback) => callback(new Error('Query failed'))),
        close: jest.fn((callback) => callback(null)),
      }));
      (require('duckdb') as any).Database = mockDatabase;

      mockAnthropicService.analyzeQuery.mockResolvedValue({
        analysis: {
          intent: 'demographics',
          entities: {},
          filters: {},
          outputFormat: 'table',
          confidence: 0.8
        },
        sqlQuery: 'SELECT * FROM demographics',
        explanation: 'Basic query',
        suggestedRefinements: []
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me population data'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.dataSource).toContain('Mock Healthcare Demographics');
      expect(response.body.metadata.usedDuckDB).toBe(false);
    });

    it('should handle concurrent requests with DuckDB pool', async () => {
      mockAnthropicService.analyzeQuery.mockResolvedValue({
        analysis: {
          intent: 'demographics',
          entities: {},
          filters: {},
          outputFormat: 'table',
          confidence: 0.9
        },
        sqlQuery: 'SELECT * FROM demographics',
        explanation: 'Concurrent query',
        suggestedRefinements: []
      });

      // Make 5 concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/v1/queries')
            .send({
              query: `Query ${i}: Show me population data`
            })
        );
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.metadata.usedDuckDB).toBe(true);
      });
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should use fallback when production DuckDB is disabled', async () => {
      // Ensure feature flag is disabled
      process.env.USE_PRODUCTION_DUCKDB = 'false';

      mockAnthropicService.analyzeQuery.mockResolvedValue({
        analysis: {
          intent: 'demographics',
          entities: {},
          filters: {},
          outputFormat: 'table',
          confidence: 0.8
        },
        sqlQuery: 'SELECT * FROM demographics',
        explanation: 'Query with feature flag disabled',
        suggestedRefinements: []
      });

      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'Show me population data'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.dataSource).toContain('Mock Healthcare Demographics');
      expect(response.body.metadata.usedDuckDB).toBe(false);

      // Clean up
      delete process.env.USE_PRODUCTION_DUCKDB;
    });
  });
});
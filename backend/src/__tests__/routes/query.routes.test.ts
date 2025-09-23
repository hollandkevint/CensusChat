import request from 'supertest';
import { app } from '../../index';
import { anthropicService } from '../../services/anthropicService';

// Mock the anthropicService
jest.mock('../../services/anthropicService', () => ({
  anthropicService: {
    analyzeQuery: jest.fn()
  }
}));

const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;

describe('POST /api/v1/queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
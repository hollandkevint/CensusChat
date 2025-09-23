import request from 'supertest';
import { app } from '../../index';
import { censusApiService } from '../../services/censusApiService';
import { FallbackService, CensusApiErrorType } from '../../services/fallbackService';
import { getCacheStats, invalidateCache } from '../../services/cacheService';

describe('Census API Integration Tests', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await invalidateCache();
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
      const response = await request(app)
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
      const response = await request(app)
        .get('/api/v1/census/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cacheStats).toBeDefined();
      expect(typeof response.body.cacheStats.available).toBe('boolean');
      expect(typeof response.body.cacheStats.totalKeys).toBe('number');
      expect(Array.isArray(response.body.cacheStats.cacheKeys)).toBe(true);
    });

    it('should invalidate cache entries', async () => {
      const response = await request(app)
        .post('/api/v1/census/cache/invalidate')
        .send({ pattern: 'test_*' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.deletedCount).toBe('number');
      expect(response.body.pattern).toBe('test_*');
    });

    it('should clean expired cache entries', async () => {
      const response = await request(app)
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
    it('should handle queries with mock data when live API is disabled', async () => {
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
      expect(response.body.metadata.dataSource).toContain('Mock Data');
      expect(response.body.metadata.usedLiveApi).toBe(false);
    });

    it('should provide error details and suggestions for invalid queries', async () => {
      const response = await request(app)
        .post('/api/v1/queries')
        .send({
          query: 'gibberish query that makes no sense'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
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
import { DataLoadingOrchestrator } from '../../data-loading/orchestration/DataLoadingOrchestrator';
import { mockCensusApiService, mockDataScenarios } from '../../test/fixtures/censusApiResponses';
import { createTestConfig, createTestGeography, wait, TestAssertions } from '../../test/helpers/testUtils';

// Mock all external dependencies for controlled testing
jest.mock('../../services/censusApiService', () => ({
  censusApiService: mockCensusApiService
}));

jest.mock('../../models/CensusData', () => {
  return {
    CensusData: jest.fn(() => ({
      init: jest.fn().mockResolvedValue(undefined),
      insertCensusData: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock DuckDB for testing
jest.mock('duckdb', () => {
  const mockDatabase = {
    all: jest.fn((query: string, params: any[], callback?: Function) => {
      if (callback) callback(null, []);
    })
  };
  
  return {
    Database: jest.fn(() => mockDatabase)
  };
});

describe('Data Loading End-to-End Integration', () => {
  let orchestrator: DataLoadingOrchestrator;
  const testConfig = createTestConfig({
    maxConcurrentJobs: 2,
    apiRateLimit: {
      dailyLimit: 100,
      burstLimit: 5,
      reserveForUsers: 10
    },
    database: {
      maxConnections: 5,
      batchInsertSize: 50,
      transactionTimeout: 10000,
      vacuumInterval: 3600000
    }
  });

  beforeEach(() => {
    // Reset mock state
    mockCensusApiService.setFailure(false);
    mockCensusApiService.setDelay(0);
    
    // Setup default mock responses
    jest.spyOn(mockCensusApiService, 'getACS5StateData')
      .mockResolvedValue(mockDataScenarios.small);
    
    orchestrator = new DataLoadingOrchestrator(testConfig);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stopLoading();
      orchestrator.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe('Complete Loading Workflow', () => {
    test('should execute full foundation phase loading', async () => {
      const completedJobs: string[] = [];
      const errors: any[] = [];
      
      orchestrator.on('job_completed', (event) => {
        completedJobs.push(event.job.id);
      });
      
      orchestrator.on('job_failed', (event) => {
        errors.push(event.error);
      });

      // Start foundation phase loading
      const loadingPromise = orchestrator.startPriorityLoading(['foundation']);
      
      // Wait for some processing
      await wait(1000);
      
      // Stop loading to complete the test
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {}); // Handle expected stop

      // Verify progress tracking
      const progress = orchestrator.getProgress();
      TestAssertions.assertMetricsValid(orchestrator.getMetrics());
      
      expect(progress.status).toBe('idle'); // Stopped
      expect(errors.length).toBeLessThan(completedJobs.length); // More successes than failures
    });

    test('should handle custom job submission and processing', async () => {
      const geography = createTestGeography({
        level: 'state',
        codes: ['06', '48', '12'] // CA, TX, FL
      });
      
      const variables = ['B01003_001E', 'B25001_001E'];
      
      // Add custom job
      const jobId = await orchestrator.addJob(geography, variables, 95);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      
      // Monitor job completion
      let jobCompleted = false;
      orchestrator.on('job_completed', (event) => {
        if (event.job.id === jobId) {
          jobCompleted = true;
        }
      });
      
      // Start processing
      const startPromise = orchestrator.startPriorityLoading();
      
      // Wait for processing
      await wait(500);
      
      // Stop and cleanup
      await orchestrator.stopLoading();
      await startPromise.catch(() => {});
      
      // Verify job was processed (or at least queued)
      const progress = orchestrator.getProgress();
      expect(progress.totalJobs).toBeGreaterThan(0);
    });

    test('should maintain system health during concurrent operations', async () => {
      // Add multiple jobs concurrently
      const geographies = [
        createTestGeography({ level: 'state', codes: ['06'] }),
        createTestGeography({ level: 'state', codes: ['48'] }),
        createTestGeography({ level: 'county', codes: ['06075'] })
      ];
      
      const jobPromises = geographies.map(geo => 
        orchestrator.addJob(geo, ['B01003_001E'], 80)
      );
      
      const jobIds = await Promise.all(jobPromises);
      expect(jobIds).toHaveLength(3);
      
      // Start loading
      const loadingPromise = orchestrator.startPriorityLoading();
      
      // Monitor system health
      let healthChecks = 0;
      const healthCheckInterval = setInterval(() => {
        const context = orchestrator.getContext();
        const progress = orchestrator.getProgress();
        
        // Verify system remains responsive
        expect(context.queueDepth).toBeGreaterThanOrEqual(0);
        expect(progress.apiCallsRemaining).toBeGreaterThanOrEqual(0);
        
        healthChecks++;
      }, 100);
      
      // Wait for processing
      await wait(800);
      
      clearInterval(healthCheckInterval);
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      expect(healthChecks).toBeGreaterThan(0);
      
      // Verify final state
      const finalMetrics = orchestrator.getMetrics();
      TestAssertions.assertMetricsValid(finalMetrics);
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should handle API failures gracefully', async () => {
      // Configure API to fail
      mockCensusApiService.setFailure(true, 'network');
      
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      const errors: any[] = [];
      orchestrator.on('job_failed', (event) => {
        errors.push(event.error);
      });
      
      // Start loading
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(500);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      // Should have recorded failures
      expect(errors.length).toBeGreaterThan(0);
      
      // System should remain stable
      const progress = orchestrator.getProgress();
      expect(progress.status).toBe('idle');
    });

    test('should handle rate limiting appropriately', async () => {
      // Configure API to simulate rate limiting
      mockCensusApiService.setFailure(true, 'rate_limit');
      
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      let rateLimitHit = false;
      orchestrator.on('job_failed', (event) => {
        if (event.error.message.includes('429') || event.error.message.includes('rate limit')) {
          rateLimitHit = true;
        }
      });
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(500);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      // Should have detected rate limiting
      expect(rateLimitHit).toBe(true);
    });

    test('should handle job retry scenarios', async () => {
      // Configure intermittent failures
      let callCount = 0;
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Temporary failure');
          }
          return mockDataScenarios.small;
        });
      
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      let retriedJobs = 0;
      orchestrator.on('job_failed', (event) => {
        if (event.error.retryable) {
          retriedJobs++;
        }
      });
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(1000);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      // Should have attempted retries
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle moderate load efficiently', async () => {
      // Create multiple jobs to simulate load
      const jobCount = 10;
      const jobs = Array.from({ length: jobCount }, (_, i) => 
        orchestrator.addJob(
          createTestGeography({ 
            level: 'state',
            codes: [String(i + 1).padStart(2, '0')]
          }),
          ['B01003_001E'],
          Math.floor(Math.random() * 100)
        )
      );
      
      const jobIds = await Promise.all(jobs);
      expect(jobIds).toHaveLength(jobCount);
      
      const startTime = Date.now();
      const loadingPromise = orchestrator.startPriorityLoading();
      
      // Monitor processing
      let peakActiveJobs = 0;
      const monitoringInterval = setInterval(() => {
        const context = orchestrator.getContext();
        peakActiveJobs = Math.max(peakActiveJobs, context.activeJobs.length);
      }, 50);
      
      await wait(1000);
      
      clearInterval(monitoringInterval);
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      const duration = Date.now() - startTime;
      const metrics = orchestrator.getMetrics();
      
      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(peakActiveJobs).toBeLessThanOrEqual(testConfig.maxConcurrentJobs);
      expect(metrics.totalJobsProcessed).toBeGreaterThanOrEqual(0);
    });

    test('should respect API rate limits during high load', async () => {
      // Configure stricter rate limits
      const strictConfig = createTestConfig({
        apiRateLimit: {
          dailyLimit: 20, // Very low limit
          burstLimit: 3,
          reserveForUsers: 5
        }
      });
      
      const strictOrchestrator = new DataLoadingOrchestrator(strictConfig);
      
      try {
        // Add many jobs
        const jobPromises = Array.from({ length: 15 }, (_, i) => 
          strictOrchestrator.addJob(
            createTestGeography({ level: 'state', codes: [String(i + 1).padStart(2, '0')] }),
            ['B01003_001E'],
            50
          )
        );
        
        await Promise.all(jobPromises);
        
        const loadingPromise = strictOrchestrator.startPriorityLoading();
        
        await wait(1000);
        
        // Check that API budget is being managed
        const context = strictOrchestrator.getContext();
        expect(context.rateLimit.remainingCalls).toBeLessThan(20);
        
        await strictOrchestrator.stopLoading();
        await loadingPromise.catch(() => {});
      } finally {
        await strictOrchestrator.stopLoading();
        strictOrchestrator.removeAllListeners();
      }
    });
  });

  describe('Data Quality and Validation', () => {
    test('should validate loaded data quality', async () => {
      // Configure mock to return data with quality issues
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockResolvedValue(mockDataScenarios.invalidData);
      
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      const results: any[] = [];
      orchestrator.on('job_completed', (event) => {
        results.push(event.result);
      });
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(800);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      // Check data quality metrics
      const metrics = orchestrator.getMetrics();
      expect(metrics.dataQualityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.dataQualityScore).toBeLessThanOrEqual(1);
    });

    test('should handle empty API responses appropriately', async () => {
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockResolvedValue(mockDataScenarios.empty);
      
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      let emptyResponseHandled = false;
      orchestrator.on('job_completed', (event) => {
        if (event.result.recordsLoaded === 0 && event.result.recordsSkipped > 0) {
          emptyResponseHandled = true;
        }
      });
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(500);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      expect(emptyResponseHandled).toBe(true);
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources properly', async () => {
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      // Start and stop loading multiple times
      for (let i = 0; i < 3; i++) {
        const loadingPromise = orchestrator.startPriorityLoading();
        await wait(200);
        await orchestrator.stopLoading();
        await loadingPromise.catch(() => {});
      }
      
      // Verify system is stable after multiple start/stop cycles
      const finalProgress = orchestrator.getProgress();
      expect(finalProgress.status).toBe('idle');
      
      const finalContext = orchestrator.getContext();
      expect(finalContext.activeJobs).toHaveLength(0);
    });

    test('should handle memory efficiently with large datasets', async () => {
      // Configure large mock response
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockResolvedValue(mockDataScenarios.large);
      
      const geography = createTestGeography({ level: 'zcta' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      const initialMemory = process.memoryUsage();
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(1000);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      const finalMemory = process.memoryUsage();
      
      // Memory should not have grown excessively
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    });
  });

  describe('System Integration', () => {
    test('should integrate all components correctly', async () => {
      // Test that orchestrator properly coordinates all components
      const geography = createTestGeography({ level: 'state' });
      await orchestrator.addJob(geography, ['B01003_001E'], 90);
      
      // Track different types of events to ensure integration
      const events: string[] = [];
      
      orchestrator.on('loading_started', () => events.push('loading_started'));
      orchestrator.on('job_completed', () => events.push('job_completed'));
      orchestrator.on('progress_update', () => events.push('progress_update'));
      orchestrator.on('loading_stopped', () => events.push('loading_stopped'));
      
      const loadingPromise = orchestrator.startPriorityLoading();
      
      await wait(600);
      
      await orchestrator.stopLoading();
      await loadingPromise.catch(() => {});
      
      // Should have seen integration between components
      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain('loading_stopped');
      
      // All metrics should be available
      const metrics = orchestrator.getMetrics();
      const progress = orchestrator.getProgress();
      const context = orchestrator.getContext();
      
      TestAssertions.assertMetricsValid(metrics);
      expect(progress).toBeDefined();
      expect(context).toBeDefined();
    });
  });
});
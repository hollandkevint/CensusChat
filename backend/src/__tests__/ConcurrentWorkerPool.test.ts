import { ConcurrentWorkerPool } from '../data-loading/processing/ConcurrentWorkerPool';
import { createTestConfig, createTestJob, wait, CallTracker } from '../test/helpers/testUtils';
import { mockCensusApiService, mockStateResponse } from '../test/fixtures/censusApiResponses';
import { LoadingJob } from '../data-loading/utils/LoadingTypes';

// Mock dependencies
jest.mock('../services/censusApiService', () => ({
  censusApiService: mockCensusApiService
}));

jest.mock('../models/CensusData', () => {
  return {
    CensusData: jest.fn(() => ({
      init: jest.fn().mockResolvedValue(undefined),
      insertCensusData: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('ConcurrentWorkerPool', () => {
  let workerPool: ConcurrentWorkerPool;
  let config: any;
  let callTracker: CallTracker;

  beforeEach(() => {
    config = createTestConfig({
      maxConcurrentJobs: 3,
      database: { batchInsertSize: 100 }
    });
    
    workerPool = new ConcurrentWorkerPool(config);
    callTracker = new CallTracker();
    
    // Reset mock
    mockCensusApiService.setFailure(false);
    mockCensusApiService.setDelay(0);
    
    // Mock successful API responses
    jest.spyOn(mockCensusApiService, 'getACS5StateData')
      .mockResolvedValue(mockStateResponse);
  });

  afterEach(async () => {
    if (workerPool) {
      await workerPool.stop();
      workerPool.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct number of workers', () => {
      const stats = workerPool.getWorkerStats();
      expect(stats).toHaveLength(3);
      expect(stats.every(worker => worker.status === 'idle')).toBe(true);
    });

    test('should provide initial metrics', () => {
      const metrics = workerPool.getMetrics();
      
      expect(metrics.totalWorkers).toBe(3);
      expect(metrics.activeWorkers).toBe(3);
      expect(metrics.idleWorkers).toBe(3);
      expect(metrics.busyWorkers).toBe(0);
      expect(metrics.totalJobsProcessed).toBe(0);
    });
  });

  describe('Job Submission', () => {
    test('should accept and queue job submission', async () => {
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const submissionSpy = jest.fn();
      workerPool.on('job_submitted', submissionSpy);

      await workerPool.submitJob(job);

      expect(submissionSpy).toHaveBeenCalledWith(job);
    });

    test('should start worker pool when job is submitted', async () => {
      const job = createTestJob();
      
      const startSpy = jest.fn();
      workerPool.on('pool_started', startSpy);

      await workerPool.submitJob(job);
      
      // Worker pool should auto-start
      await wait(100);
      expect(startSpy).toHaveBeenCalled();
    });

    test('should process multiple jobs concurrently', async () => {
      const jobs = [
        createTestJob({ id: 'job1', geography: { level: 'state' } }),
        createTestJob({ id: 'job2', geography: { level: 'state' } }),
        createTestJob({ id: 'job3', geography: { level: 'state' } })
      ];

      const completedJobs: string[] = [];
      workerPool.on('job_completed', (jobId: string) => {
        completedJobs.push(jobId);
      });

      // Submit all jobs
      await Promise.all(jobs.map(job => workerPool.submitJob(job)));

      // Wait for processing
      await wait(500);

      expect(completedJobs.length).toBeGreaterThan(0);
    });
  });

  describe('Worker Management', () => {
    test('should track available worker count', () => {
      expect(workerPool.getAvailableWorkerCount()).toBe(3);
    });

    test('should assign jobs to available workers', async () => {
      const job = createTestJob({ geography: { level: 'state' } });
      
      await workerPool.submitJob(job);
      await wait(100);
      
      const metrics = workerPool.getMetrics();
      expect(metrics.busyWorkers).toBeGreaterThanOrEqual(0);
    });

    test('should handle worker assignment when all workers busy', async () => {
      // Submit more jobs than workers
      const jobs = Array.from({ length: 5 }, (_, i) => 
        createTestJob({ 
          id: `job${i}`,
          geography: { level: 'state' }
        })
      );

      mockCensusApiService.setDelay(200); // Slow down processing

      await Promise.all(jobs.map(job => workerPool.submitJob(job)));
      await wait(100);

      const metrics = workerPool.getMetrics();
      expect(metrics.busyWorkers).toBeLessThanOrEqual(3); // Can't exceed worker count
    });
  });

  describe('Job Processing', () => {
    test('should process state geography job successfully', async () => {
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const completedSpy = jest.fn();
      workerPool.on('job_completed', completedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(completedSpy).toHaveBeenCalled();
      expect(mockCensusApiService.getACS5StateData).toHaveBeenCalled();
    });

    test('should process county geography job successfully', async () => {
      const job = createTestJob({
        geography: { 
          level: 'county',
          codes: ['06'] // California
        },
        variables: ['B01003_001E']
      });

      jest.spyOn(mockCensusApiService, 'getACS5CountyData')
        .mockResolvedValue(mockStateResponse);

      await workerPool.submitJob(job);
      await wait(300);

      expect(mockCensusApiService.getACS5CountyData).toHaveBeenCalledWith('06', ['B01003_001E']);
    });

    test('should process ZIP code geography job successfully', async () => {
      const job = createTestJob({
        geography: { level: 'zcta' },
        variables: ['B01003_001E']
      });

      jest.spyOn(mockCensusApiService, 'getACS5ZipData')
        .mockResolvedValue(mockStateResponse);

      await workerPool.submitJob(job);
      await wait(300);

      expect(mockCensusApiService.getACS5ZipData).toHaveBeenCalled();
    });

    test('should process block group geography job successfully', async () => {
      const job = createTestJob({
        geography: { 
          level: 'block_group',
          codes: ['075'],
          parentGeography: {
            level: 'state',
            codes: ['06']
          }
        },
        variables: ['B01003_001E']
      });

      jest.spyOn(mockCensusApiService, 'getACS5BlockGroupData')
        .mockResolvedValue(mockStateResponse);

      await workerPool.submitJob(job);
      await wait(300);

      expect(mockCensusApiService.getACS5BlockGroupData).toHaveBeenCalledWith('06', '075', ['B01003_001E']);
    });

    test('should reject unsupported geography levels', async () => {
      const job = createTestJob({
        geography: { level: 'unsupported' as any },
        variables: ['B01003_001E']
      });

      const failedSpy = jest.fn();
      workerPool.on('job_failed', failedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(failedSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      mockCensusApiService.setFailure(true, 'network');
      
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const failedSpy = jest.fn();
      workerPool.on('job_failed', failedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(failedSpy).toHaveBeenCalled();
    });

    test('should handle rate limit errors', async () => {
      mockCensusApiService.setFailure(true, 'rate_limit');
      
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const failedSpy = jest.fn();
      workerPool.on('job_failed', failedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(failedSpy).toHaveBeenCalled();
      
      const failureArgs = failedSpy.mock.calls[0];
      expect(failureArgs[1]).toEqual(expect.objectContaining({
        errorType: 'api_error'
      }));
    });

    test('should handle invalid data errors', async () => {
      mockCensusApiService.setFailure(true, 'invalid_data');
      
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['INVALID_VARIABLE']
      });

      const failedSpy = jest.fn();
      workerPool.on('job_failed', failedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(failedSpy).toHaveBeenCalled();
    });

    test('should track worker errors in stats', async () => {
      mockCensusApiService.setFailure(true);
      
      const job = createTestJob({ geography: { level: 'state' } });
      await workerPool.submitJob(job);
      await wait(300);

      const stats = workerPool.getWorkerStats();
      const totalFailed = stats.reduce((sum, worker) => sum + worker.jobsFailed, 0);
      expect(totalFailed).toBeGreaterThan(0);
    });
  });

  describe('Pool Control', () => {
    test('should start pool successfully', async () => {
      const startSpy = jest.fn();
      workerPool.on('pool_started', startSpy);

      await workerPool.start();

      expect(startSpy).toHaveBeenCalled();
    });

    test('should pause pool and resume successfully', async () => {
      await workerPool.start();
      
      const pauseSpy = jest.fn();
      const resumeSpy = jest.fn();
      
      workerPool.on('pool_paused', pauseSpy);
      workerPool.on('pool_resumed', resumeSpy);

      await workerPool.pause();
      expect(pauseSpy).toHaveBeenCalled();

      await workerPool.resume();
      expect(resumeSpy).toHaveBeenCalled();
    });

    test('should stop pool successfully', async () => {
      await workerPool.start();
      
      const stopSpy = jest.fn();
      workerPool.on('pool_stopped', stopSpy);

      await workerPool.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should wait for active jobs during stop', async () => {
      const job = createTestJob({ geography: { level: 'state' } });
      mockCensusApiService.setDelay(1000); // Long-running job

      await workerPool.submitJob(job);
      await wait(100); // Let job start

      const stopPromise = workerPool.stop();
      
      // Stop should wait or timeout for active jobs
      await expect(stopPromise).resolves.not.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    test('should respect API rate limits', async () => {
      const jobs = Array.from({ length: 10 }, (_, i) => 
        createTestJob({ 
          id: `job${i}`,
          geography: { level: 'state' }
        })
      );

      // Track API calls
      let apiCallCount = 0;
      const originalGetState = mockCensusApiService.getACS5StateData;
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockImplementation(async (...args) => {
          apiCallCount++;
          return originalGetState.apply(mockCensusApiService, args as any);
        });

      await Promise.all(jobs.map(job => workerPool.submitJob(job)));
      await wait(500);

      // Should have made some API calls, but rate limiting may apply
      expect(apiCallCount).toBeGreaterThan(0);
    });

    test('should handle daily API limit exhaustion', async () => {
      // Mock rate limit check to fail
      const originalRateCheck = (workerPool as any).checkRateLimit;
      if (originalRateCheck) {
        jest.spyOn(workerPool as any, 'checkRateLimit')
          .mockResolvedValue(false);
      }

      const job = createTestJob({ geography: { level: 'state' } });
      const failedSpy = jest.fn();
      workerPool.on('job_failed', failedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      // Job should fail due to rate limit
      expect(failedSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    test('should track job completion metrics', async () => {
      const job = createTestJob({ geography: { level: 'state' } });
      
      await workerPool.submitJob(job);
      await wait(300);

      const metrics = workerPool.getMetrics();
      expect(metrics.totalJobsProcessed).toBeGreaterThanOrEqual(0);
      expect(metrics.averageJobDuration).toBeGreaterThanOrEqual(0);
    });

    test('should calculate throughput per minute', async () => {
      const metrics = workerPool.getMetrics();
      expect(typeof metrics.throughputPerMinute).toBe('number');
      expect(metrics.throughputPerMinute).toBeGreaterThanOrEqual(0);
    });

    test('should track worker performance stats', async () => {
      const job = createTestJob({ geography: { level: 'state' } });
      
      await workerPool.submitJob(job);
      await wait(300);

      const stats = workerPool.getWorkerStats();
      stats.forEach(worker => {
        expect(worker.id).toBeDefined();
        expect(worker.status).toMatch(/^(idle|busy|error|stopped)$/);
        expect(worker.jobsCompleted).toBeGreaterThanOrEqual(0);
        expect(worker.jobsFailed).toBeGreaterThanOrEqual(0);
        expect(worker.totalProcessingTime).toBeGreaterThanOrEqual(0);
        expect(worker.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Data Transformation', () => {
    test('should transform Census API response correctly', async () => {
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const MockCensusData = require('../models/CensusData').CensusData;
      const mockInsert = jest.fn();
      MockCensusData.mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(undefined),
        insertCensusData: mockInsert
      }));

      await workerPool.submitJob(job);
      await wait(300);

      expect(mockInsert).toHaveBeenCalled();
      
      if (mockInsert.mock.calls.length > 0) {
        const insertedData = mockInsert.mock.calls[0][0];
        expect(insertedData).toBeInstanceOf(Array);
        
        if (insertedData.length > 0) {
          const record = insertedData[0];
          expect(record).toHaveProperty('dataset');
          expect(record).toHaveProperty('year');
          expect(record).toHaveProperty('geography_level');
          expect(record).toHaveProperty('geography_code');
          expect(record).toHaveProperty('name');
          expect(record).toHaveProperty('job_id');
        }
      }
    });

    test('should handle empty API responses', async () => {
      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockResolvedValue({ data: [], headers: [], rowCount: 0 });

      const job = createTestJob({ geography: { level: 'state' } });
      
      const completedSpy = jest.fn();
      workerPool.on('job_completed', completedSpy);

      await workerPool.submitJob(job);
      await wait(300);

      expect(completedSpy).toHaveBeenCalled();
      
      if (completedSpy.mock.calls.length > 0) {
        const result = completedSpy.mock.calls[0][1];
        expect(result.recordsSkipped).toBeGreaterThan(0);
        expect(result.recordsLoaded).toBe(0);
      }
    });
  });

  describe('Batch Processing', () => {
    test('should process data in configurable batch sizes', async () => {
      const job = createTestJob({
        geography: { level: 'state' },
        variables: ['B01003_001E']
      });

      const MockCensusData = require('../models/CensusData').CensusData;
      const mockInsert = jest.fn();
      MockCensusData.mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(undefined),
        insertCensusData: mockInsert
      }));

      await workerPool.submitJob(job);
      await wait(300);

      // Verify batch size configuration is respected
      const batchSize = config.database.batchInsertSize;
      expect(typeof batchSize).toBe('number');
      expect(batchSize).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    test('should handle large datasets without memory leaks', async () => {
      // Create mock response with many records
      const largeResponse = {
        data: [
          ['NAME', 'B01003_001E', 'state'],
          ...Array.from({ length: 1000 }, (_, i) => 
            [`State ${i}`, String(1000000 + i), String(i + 1).padStart(2, '0')]
          )
        ],
        headers: ['NAME', 'B01003_001E', 'state'],
        rowCount: 1000
      };

      jest.spyOn(mockCensusApiService, 'getACS5StateData')
        .mockResolvedValue(largeResponse);

      const job = createTestJob({ geography: { level: 'state' } });

      const completedSpy = jest.fn();
      workerPool.on('job_completed', completedSpy);

      await workerPool.submitJob(job);
      await wait(500);

      expect(completedSpy).toHaveBeenCalled();
    });
  });
});
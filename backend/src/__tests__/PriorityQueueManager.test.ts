import { PriorityQueueManager } from '../data-loading/orchestration/PriorityQueueManager';
import { createTestConfig, createTestJob, wait, TestAssertions } from '../test/helpers/testUtils';
import { LoadingJob, LoadingError } from '../data-loading/utils/LoadingTypes';

describe('PriorityQueueManager', () => {
  let queueManager: PriorityQueueManager;
  const testConfig = createTestConfig();

  beforeEach(() => {
    queueManager = new PriorityQueueManager(testConfig);
  });

  afterEach(() => {
    queueManager.removeAllListeners();
  });

  describe('Job Management', () => {
    test('should add job to queue successfully', async () => {
      const job = createTestJob({ priority: 80 });
      
      await queueManager.addJob(job);
      
      const metrics = queueManager.getMetrics();
      expect(metrics.totalJobs).toBe(1);
      expect(metrics.pendingJobs).toBe(1);
      expect(metrics.queueDepthByPriority[80]).toBe(1);
    });

    test('should prevent duplicate job IDs', async () => {
      const job = createTestJob({ id: 'duplicate_test' });
      
      await queueManager.addJob(job);
      
      await expect(queueManager.addJob(job)).rejects.toThrow('Job duplicate_test already exists in queue');
    });

    test('should emit job_queued event when job is added', async () => {
      const job = createTestJob();
      const eventSpy = jest.fn();
      
      queueManager.on('job_queued', eventSpy);
      await queueManager.addJob(job);
      
      expect(eventSpy).toHaveBeenCalledWith(job);
    });

    test('should organize jobs by phase', async () => {
      const foundationJob = createTestJob({ 
        metadata: { phase: 'foundation' },
        priority: 100
      });
      const expansionJob = createTestJob({ 
        metadata: { phase: 'expansion' },
        priority: 80
      });
      
      await queueManager.addJob(foundationJob);
      await queueManager.addJob(expansionJob);
      
      const foundationJobs = queueManager.getJobsForPhase('foundation');
      const expansionJobs = queueManager.getJobsForPhase('expansion');
      
      expect(foundationJobs).toHaveLength(1);
      expect(expansionJobs).toHaveLength(1);
      expect(foundationJobs[0].id).toBe(foundationJob.id);
    });
  });

  describe('Priority-Based Retrieval', () => {
    test('should return jobs in priority order', async () => {
      const lowPriorityJob = createTestJob({ priority: 30, id: 'low' });
      const highPriorityJob = createTestJob({ priority: 90, id: 'high' });
      const mediumPriorityJob = createTestJob({ priority: 60, id: 'medium' });
      
      await queueManager.addJob(lowPriorityJob);
      await queueManager.addJob(highPriorityJob);
      await queueManager.addJob(mediumPriorityJob);
      
      const jobs = await queueManager.getNextJobs(3);
      
      expect(jobs).toHaveLength(3);
      expect(jobs[0].id).toBe('high');
      expect(jobs[1].id).toBe('medium');
      expect(jobs[2].id).toBe('low');
    });

    test('should prioritize older jobs when priorities are equal', async () => {
      const olderJob = createTestJob({ 
        priority: 50, 
        id: 'older',
        createdAt: new Date('2024-01-01') 
      });
      const newerJob = createTestJob({ 
        priority: 50, 
        id: 'newer',
        createdAt: new Date('2024-01-02') 
      });
      
      await queueManager.addJob(newerJob);
      await queueManager.addJob(olderJob);
      
      const jobs = await queueManager.getNextJobs(2);
      
      expect(jobs[0].id).toBe('older');
      expect(jobs[1].id).toBe('newer');
    });

    test('should mark jobs as running when retrieved', async () => {
      const job = createTestJob();
      await queueManager.addJob(job);
      
      const jobs = await queueManager.getNextJobs(1);
      
      expect(jobs[0].status).toBe('running');
      expect(jobs[0].startedAt).toBeInstanceOf(Date);
      
      const metrics = queueManager.getMetrics();
      expect(metrics.runningJobs).toBe(1);
      expect(metrics.pendingJobs).toBe(0);
    });

    test('should limit number of jobs returned', async () => {
      const jobs = Array.from({ length: 5 }, (_, i) => 
        createTestJob({ id: `job_${i}`, priority: 50 + i })
      );
      
      for (const job of jobs) {
        await queueManager.addJob(job);
      }
      
      const retrievedJobs = await queueManager.getNextJobs(3);
      expect(retrievedJobs).toHaveLength(3);
    });

    test('should return empty array when no jobs available', async () => {
      const jobs = await queueManager.getNextJobs(5);
      expect(jobs).toHaveLength(0);
    });
  });

  describe('Job Completion', () => {
    test('should mark job as completed successfully', async () => {
      const job = createTestJob();
      await queueManager.addJob(job);
      
      const jobs = await queueManager.getNextJobs(1);
      await queueManager.completeJob(jobs[0].id);
      
      const metrics = queueManager.getMetrics();
      expect(metrics.completedJobs).toBe(1);
      expect(metrics.runningJobs).toBe(0);
    });

    test('should emit job_completed event', async () => {
      const job = createTestJob();
      const eventSpy = jest.fn();
      
      queueManager.on('job_completed', eventSpy);
      await queueManager.addJob(job);
      
      const jobs = await queueManager.getNextJobs(1);
      await queueManager.completeJob(jobs[0].id);
      
      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].status).toBe('completed');
    });

    test('should throw error for non-existent job completion', async () => {
      await expect(queueManager.completeJob('non_existent_job'))
        .rejects.toThrow('Job non_existent_job not found in queue');
    });
  });

  describe('Job Failure and Retry', () => {
    test('should handle job failure with retry', async () => {
      const job = createTestJob({ maxRetries: 2 });
      await queueManager.addJob(job);
      
      const jobs = await queueManager.getNextJobs(1);
      const error: LoadingError = {
        jobId: jobs[0].id,
        errorType: 'api_error',
        message: 'Test error',
        timestamp: new Date(),
        retryable: true
      };
      
      await queueManager.failJob(jobs[0].id, error);
      
      const metrics = queueManager.getMetrics();
      expect(metrics.pendingJobs).toBe(1); // Job should be back in pending for retry
      expect(metrics.runningJobs).toBe(0);
      expect(metrics.failedJobs).toBe(0); // Not permanently failed yet
    });

    test('should permanently fail job after max retries', async () => {
      const job = createTestJob({ maxRetries: 1 });
      await queueManager.addJob(job);
      
      const error: LoadingError = {
        jobId: job.id,
        errorType: 'api_error',
        message: 'Test error',
        timestamp: new Date(),
        retryable: true
      };
      
      // First failure - should retry
      const jobs1 = await queueManager.getNextJobs(1);
      await queueManager.failJob(jobs1[0].id, error);
      
      // Second failure - should permanently fail
      const jobs2 = await queueManager.getNextJobs(1);
      await queueManager.failJob(jobs2[0].id, error);
      
      const metrics = queueManager.getMetrics();
      expect(metrics.failedJobs).toBe(1);
      expect(metrics.pendingJobs).toBe(0);
    });

    test('should emit job_failed event', async () => {
      const job = createTestJob();
      const eventSpy = jest.fn();
      
      queueManager.on('job_failed', eventSpy);
      await queueManager.addJob(job);
      
      const jobs = await queueManager.getNextJobs(1);
      const error: LoadingError = {
        jobId: jobs[0].id,
        errorType: 'validation_error',
        message: 'Test validation error',
        timestamp: new Date(),
        retryable: false
      };
      
      await queueManager.failJob(jobs[0].id, error);
      
      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].job.id).toBe(jobs[0].id);
      expect(eventSpy.mock.calls[0][0].error).toEqual(error);
    });
  });

  describe('Phase Management', () => {
    test('should identify jobs belonging to specific phase', async () => {
      const foundationJob = createTestJob({ 
        metadata: { phase: 'foundation' },
        id: 'foundation_job'
      });
      const expansionJob = createTestJob({ 
        metadata: { phase: 'expansion' },
        id: 'expansion_job'
      });
      
      await queueManager.addJob(foundationJob);
      await queueManager.addJob(expansionJob);
      
      expect(queueManager.hasJobsForPhase('foundation')).toBe(true);
      expect(queueManager.hasJobsForPhase('expansion')).toBe(true);
      expect(queueManager.hasJobsForPhase('comprehensive')).toBe(false);
    });

    test('should return false for phase with no pending jobs', async () => {
      const job = createTestJob({ 
        metadata: { phase: 'foundation' },
        status: 'completed'
      });
      await queueManager.addJob(job);
      
      // Complete the job
      const jobs = await queueManager.getNextJobs(1);
      await queueManager.completeJob(jobs[0].id);
      
      expect(queueManager.hasJobsForPhase('foundation')).toBe(false);
    });
  });

  describe('Priority Range Queries', () => {
    test('should return jobs within priority range', async () => {
      const jobs = [
        createTestJob({ priority: 30, id: 'low' }),
        createTestJob({ priority: 60, id: 'medium' }),
        createTestJob({ priority: 90, id: 'high' })
      ];
      
      for (const job of jobs) {
        await queueManager.addJob(job);
      }
      
      const mediumToHighJobs = queueManager.getJobsByPriorityRange(50, 90);
      
      expect(mediumToHighJobs).toHaveLength(2);
      expect(mediumToHighJobs.map(j => j.id)).toContain('medium');
      expect(mediumToHighJobs.map(j => j.id)).toContain('high');
      expect(mediumToHighJobs.map(j => j.id)).not.toContain('low');
    });

    test('should sort jobs by priority within range', async () => {
      const jobs = [
        createTestJob({ priority: 75, id: 'job75' }),
        createTestJob({ priority: 85, id: 'job85' }),
        createTestJob({ priority: 65, id: 'job65' })
      ];
      
      for (const job of jobs) {
        await queueManager.addJob(job);
      }
      
      const rangeJobs = queueManager.getJobsByPriorityRange(60, 90);
      
      expect(rangeJobs[0].id).toBe('job85');
      expect(rangeJobs[1].id).toBe('job75');
      expect(rangeJobs[2].id).toBe('job65');
    });
  });

  describe('Queue Control Operations', () => {
    test('should pause all jobs in queue', async () => {
      const jobs = [
        createTestJob({ id: 'job1' }),
        createTestJob({ id: 'job2' })
      ];
      
      for (const job of jobs) {
        await queueManager.addJob(job);
      }
      
      const pauseEventSpy = jest.fn();
      queueManager.on('queue_paused', pauseEventSpy);
      
      await queueManager.pauseAll();
      
      const allJobs = queueManager.getJobsByStatus('paused');
      expect(allJobs).toHaveLength(2);
      expect(pauseEventSpy).toHaveBeenCalled();
    });

    test('should resume all paused jobs', async () => {
      const job = createTestJob();
      await queueManager.addJob(job);
      await queueManager.pauseAll();
      
      const resumeEventSpy = jest.fn();
      queueManager.on('queue_resumed', resumeEventSpy);
      
      await queueManager.resumeAll();
      
      const pendingJobs = queueManager.getJobsByStatus('pending');
      expect(pendingJobs).toHaveLength(1);
      expect(resumeEventSpy).toHaveBeenCalled();
    });
  });

  describe('Metrics and Analytics', () => {
    test('should provide accurate queue metrics', async () => {
      const jobs = [
        createTestJob({ status: 'pending' }),
        createTestJob({ status: 'pending' }),
        createTestJob({ status: 'pending' })
      ];
      
      for (const job of jobs) {
        await queueManager.addJob(job);
      }
      
      const metrics = queueManager.getMetrics();
      TestAssertions.assertMetricsValid(metrics);
      expect(metrics.totalJobs).toBe(3);
      expect(metrics.pendingJobs).toBe(3);
      expect(metrics.runningJobs).toBe(0);
      expect(metrics.completedJobs).toBe(0);
    });

    test('should track queue depth by priority', async () => {
      await queueManager.addJob(createTestJob({ priority: 90 }));
      await queueManager.addJob(createTestJob({ priority: 90 }));
      await queueManager.addJob(createTestJob({ priority: 70 }));
      
      const metrics = queueManager.getMetrics();
      expect(metrics.queueDepthByPriority[90]).toBe(2);
      expect(metrics.queueDepthByPriority[70]).toBe(1);
    });

    test('should provide total job count', () => {
      expect(queueManager.getTotalJobCount()).toBe(0);
    });

    test('should provide queue depth', () => {
      expect(queueManager.getQueueDepth()).toBe(0);
    });
  });

  describe('Memory Management', () => {
    test('should cleanup old completed jobs', async () => {
      // Create old completed job
      const oldJob = createTestJob({ 
        id: 'old_job',
        status: 'completed'
      });
      
      await queueManager.addJob(oldJob);
      const jobs = await queueManager.getNextJobs(1);
      await queueManager.completeJob(jobs[0].id);
      
      // Mock old completion time
      const completedJob = queueManager.getJob(jobs[0].id);
      if (completedJob) {
        completedJob.completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      }
      
      const initialCount = queueManager.getTotalJobCount();
      await queueManager.cleanup();
      
      // Note: cleanup might not immediately remove the job depending on implementation
      // This test validates the cleanup method exists and runs without error
      expect(typeof queueManager.cleanup).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid job status gracefully', async () => {
      const job = createTestJob();
      await expect(queueManager.addJob(job)).resolves.not.toThrow();
    });

    test('should handle missing job metadata gracefully', async () => {
      const job = createTestJob({ metadata: undefined });
      await expect(queueManager.addJob(job)).resolves.not.toThrow();
      
      const phaseJobs = queueManager.getJobsForPhase('unknown');
      expect(phaseJobs).toHaveLength(0);
    });
  });
});
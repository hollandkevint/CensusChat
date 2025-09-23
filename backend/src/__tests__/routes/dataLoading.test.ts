import request from 'supertest';
import express from 'express';
import dataLoadingRoutes from '../../routes/dataLoading';
import { dataLoadingOrchestrator } from '../../data-loading/orchestration/DataLoadingOrchestrator';

// Mock the orchestrator
jest.mock('../../data-loading/orchestration/DataLoadingOrchestrator', () => ({
  dataLoadingOrchestrator: {
    startPriorityLoading: jest.fn(),
    pauseLoading: jest.fn(),
    resumeLoading: jest.fn(),
    stopLoading: jest.fn(),
    addJob: jest.fn(),
    getProgress: jest.fn(),
    getMetrics: jest.fn(),
    getContext: jest.fn()
  }
}));

// Mock configuration manager
jest.mock('../../data-loading/utils/LoadingConfiguration', () => ({
  configurationManager: {
    getConfiguration: jest.fn(),
    updateConfiguration: jest.fn(),
    getApiCallBudget: jest.fn()
  }
}));

// Mock priority definitions
jest.mock('../../data-loading/utils/PriorityDefinitions', () => ({
  LOADING_PHASES: [
    {
      name: 'foundation',
      description: 'Core high-value data',
      priority: 100,
      estimatedJobs: 150,
      estimatedApiCalls: 200,
      geographies: [],
      variables: []
    },
    {
      name: 'expansion',
      description: 'Extended coverage',
      priority: 80,
      estimatedJobs: 300,
      estimatedApiCalls: 400,
      dependencies: ['foundation'],
      geographies: [],
      variables: []
    }
  ],
  PRIORITY_STATES: [
    { code: '06', name: 'California', priority: 100 },
    { code: '48', name: 'Texas', priority: 95 }
  ],
  PRIORITY_METRO_AREAS: [
    { cbsa: '41860', name: 'San Francisco-Oakland-Berkeley, CA', priority: 100 },
    { cbsa: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA', priority: 95 }
  ]
}));

describe('Data Loading Routes', () => {
  let app: express.Application;
  let mockOrchestrator: jest.Mocked<typeof dataLoadingOrchestrator>;
  let mockConfigManager: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/data-loading', dataLoadingRoutes);

    mockOrchestrator = dataLoadingOrchestrator as jest.Mocked<typeof dataLoadingOrchestrator>;
    mockConfigManager = require('../../data-loading/utils/LoadingConfiguration').configurationManager;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockOrchestrator.getProgress.mockReturnValue({
      jobId: 'test_job_123',
      totalJobs: 100,
      completedJobs: 25,
      progressPercentage: 25.0,
      recordsPerSecond: 15.5,
      apiCallsUsed: 50,
      apiCallsRemaining: 450,
      status: 'loading',
      estimatedCompletion: new Date('2024-01-15T14:30:00Z'),
      errors: []
    });

    mockOrchestrator.getMetrics.mockReturnValue({
      totalJobsProcessed: 25,
      totalRecordsLoaded: 1000,
      totalApiCalls: 50,
      averageRecordsPerSecond: 15.5,
      dataQualityScore: 0.98,
      uptime: 3600000,
      errorRate: 0.02,
      cacheHitRate: 0.85,
      databasePerformance: {
        insertRate: 500,
        queryResponseTime: 150,
        connectionPoolUsage: 0.6
      }
    });

    mockOrchestrator.getContext.mockReturnValue({
      config: {},
      metrics: {},
      progress: {},
      rateLimit: {
        totalCalls: 500,
        remainingCalls: 450,
        resetTime: new Date(),
        burstAvailable: 10,
        estimatedDepletion: new Date()
      },
      connections: [],
      activeJobs: [],
      queueDepth: 5
    });

    mockConfigManager.getConfiguration.mockReturnValue({
      maxConcurrentJobs: 3,
      maxRetries: 3,
      apiRateLimit: {
        dailyLimit: 500,
        reserveForUsers: 50
      }
    });

    mockConfigManager.getApiCallBudget.mockReturnValue({
      available: 450,
      reserved: 50,
      total: 500
    });
  });

  describe('POST /start', () => {
    test('should start loading successfully', async () => {
      mockOrchestrator.startPriorityLoading.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/data-loading/start')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Data loading started successfully',
        phases: 'all phases',
        timestamp: expect.any(String)
      });

      expect(mockOrchestrator.startPriorityLoading).toHaveBeenCalledWith(undefined);
    });

    test('should start loading with specific phases', async () => {
      mockOrchestrator.startPriorityLoading.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/data-loading/start')
        .send({ phases: ['foundation', 'expansion'] })
        .expect(200);

      expect(response.body.phases).toEqual(['foundation', 'expansion']);
      expect(mockOrchestrator.startPriorityLoading).toHaveBeenCalledWith(['foundation', 'expansion']);
    });

    test('should handle loading start errors', async () => {
      mockOrchestrator.startPriorityLoading.mockRejectedValue(new Error('Loading already in progress'));

      const response = await request(app)
        .post('/api/v1/data-loading/start')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Loading already in progress'
      });
    });
  });

  describe('GET /progress', () => {
    test('should return current loading progress', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/progress')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        progress: {
          jobId: 'test_job_123',
          totalJobs: 100,
          completedJobs: 25,
          progressPercentage: 25.0,
          recordsPerSecond: 15.5,
          apiCallsUsed: 50,
          apiCallsRemaining: 450,
          status: 'loading',
          estimatedCompletion: '2024-01-15T14:30:00.000Z',
          errors: []
        }
      });

      expect(mockOrchestrator.getProgress).toHaveBeenCalled();
    });

    test('should handle progress retrieval errors', async () => {
      mockOrchestrator.getProgress.mockImplementation(() => {
        throw new Error('Progress unavailable');
      });

      const response = await request(app)
        .get('/api/v1/data-loading/progress')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Progress unavailable'
      });
    });
  });

  describe('GET /metrics', () => {
    test('should return system metrics and health', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        metrics: {
          totalJobsProcessed: 25,
          totalRecordsLoaded: 1000,
          totalApiCalls: 50,
          averageRecordsPerSecond: 15.5,
          dataQualityScore: 0.98,
          uptime: 3600000,
          errorRate: 0.02,
          cacheHitRate: 0.85,
          databasePerformance: {
            insertRate: 500,
            queryResponseTime: 150,
            connectionPoolUsage: 0.6
          }
        },
        systemHealth: {
          totalConnections: 0,
          activeJobs: 0,
          queueDepth: 5,
          apiUsage: {
            used: 50,
            remaining: 450,
            limit: 500,
            percentage: 10
          }
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Control Operations', () => {
    test('should pause loading', async () => {
      mockOrchestrator.pauseLoading.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/data-loading/pause')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Data loading paused successfully',
        timestamp: expect.any(String)
      });

      expect(mockOrchestrator.pauseLoading).toHaveBeenCalled();
    });

    test('should resume loading', async () => {
      mockOrchestrator.resumeLoading.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/data-loading/resume')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Data loading resumed successfully',
        timestamp: expect.any(String)
      });

      expect(mockOrchestrator.resumeLoading).toHaveBeenCalled();
    });

    test('should stop loading', async () => {
      mockOrchestrator.stopLoading.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/data-loading/stop')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Data loading stopped successfully',
        timestamp: expect.any(String)
      });

      expect(mockOrchestrator.stopLoading).toHaveBeenCalled();
    });

    test('should handle control operation errors', async () => {
      mockOrchestrator.pauseLoading.mockRejectedValue(new Error('Cannot pause'));

      const response = await request(app)
        .post('/api/v1/data-loading/pause')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Cannot pause'
      });
    });
  });

  describe('POST /jobs', () => {
    test('should add custom job successfully', async () => {
      mockOrchestrator.addJob.mockResolvedValue('custom_job_123');

      const jobPayload = {
        geography: {
          level: 'county',
          codes: ['06075', '06001']
        },
        variables: ['B01003_001E', 'B25001_001E'],
        priority: 85
      };

      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send(jobPayload)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Custom job added successfully',
        jobId: 'custom_job_123',
        geography: jobPayload.geography,
        variables: jobPayload.variables,
        priority: 85,
        timestamp: expect.any(String)
      });

      expect(mockOrchestrator.addJob).toHaveBeenCalledWith(
        jobPayload.geography,
        jobPayload.variables,
        85
      );
    });

    test('should validate required geography field', async () => {
      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send({
          variables: ['B01003_001E'],
          priority: 85
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Geography specification with level is required'
      });

      expect(mockOrchestrator.addJob).not.toHaveBeenCalled();
    });

    test('should validate required variables field', async () => {
      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send({
          geography: { level: 'state' },
          priority: 85
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Variables array is required'
      });

      expect(mockOrchestrator.addJob).not.toHaveBeenCalled();
    });

    test('should handle job creation errors', async () => {
      mockOrchestrator.addJob.mockRejectedValue(new Error('Invalid geography'));

      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send({
          geography: { level: 'state' },
          variables: ['B01003_001E']
        })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid geography'
      });
    });
  });

  describe('GET /phases', () => {
    test('should return available loading phases', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/phases')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        phases: [
          {
            name: 'foundation',
            description: 'Core high-value data',
            priority: 100,
            estimatedJobs: 150,
            estimatedApiCalls: 200,
            dependencies: [],
            geographyCount: 0,
            variableCount: 0
          },
          {
            name: 'expansion',
            description: 'Extended coverage',
            priority: 80,
            estimatedJobs: 300,
            estimatedApiCalls: 400,
            dependencies: ['foundation'],
            geographyCount: 0,
            variableCount: 0
          }
        ],
        totalPhases: 2
      });
    });
  });

  describe('GET /priorities', () => {
    test('should return priority configurations', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/priorities')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        priorities: {
          states: [
            { code: '06', name: 'California', priority: 100 },
            { code: '48', name: 'Texas', priority: 95 }
          ],
          metros: [
            { cbsa: '41860', name: 'San Francisco-Oakland-Berkeley, CA', priority: 100 },
            { cbsa: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA', priority: 95 }
          ],
          geographyLevels: {
            metro: 100,
            state: 90,
            county: 70,
            zcta: 60,
            place: 50,
            tract: 30,
            block_group: 20
          }
        }
      });
    });
  });

  describe('Configuration Management', () => {
    test('should get current configuration', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/config')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        configuration: {
          maxConcurrentJobs: 3,
          maxRetries: 3,
          apiRateLimit: {
            dailyLimit: 500,
            reserveForUsers: 50
          }
        },
        apiCallBudget: {
          available: 450,
          reserved: 50,
          total: 500
        },
        timestamp: expect.any(String)
      });
    });

    test('should update configuration', async () => {
      mockConfigManager.updateConfiguration.mockImplementation(() => {});
      mockConfigManager.getConfiguration.mockReturnValue({
        maxConcurrentJobs: 5,
        maxRetries: 3,
        apiRateLimit: {
          dailyLimit: 500,
          reserveForUsers: 50
        }
      });

      const updates = { maxConcurrentJobs: 5 };

      const response = await request(app)
        .patch('/api/v1/data-loading/config')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.configuration.maxConcurrentJobs).toBe(5);
      expect(mockConfigManager.updateConfiguration).toHaveBeenCalledWith(updates);
    });

    test('should validate configuration updates', async () => {
      const response = await request(app)
        .patch('/api/v1/data-loading/config')
        .send({ maxConcurrentJobs: 15 }) // Exceeds limit
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'maxConcurrentJobs must be between 1 and 10'
      });

      expect(mockConfigManager.updateConfiguration).not.toHaveBeenCalled();
    });
  });

  describe('GET /analytics', () => {
    test('should return analytics data', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/analytics?hours=24')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        analytics: {
          timeRange: '24 hours',
          summary: {
            totalJobs: 100,
            completedJobs: 25,
            failedJobs: 0,
            successRate: '25.00%',
            averageRecordsPerSecond: 15.5
          },
          apiUsage: {
            callsUsed: 50,
            callsRemaining: 450,
            usagePercentage: expect.any(String)
          },
          systemHealth: {
            status: 'loading',
            activeJobs: 0,
            queueDepth: 5,
            recentErrors: []
          }
        },
        timestamp: expect.any(String)
      });
    });

    test('should validate hours parameter', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/analytics?hours=200') // Exceeds max
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Hours parameter must be between 1 and 168'
      });
    });
  });

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/v1/data-loading/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        checks: {
          apiCallsRemaining: true,
          errorRate: true,
          systemResponsive: true
        },
        details: {
          activeJobs: 0,
          queueDepth: 5,
          apiCallsRemaining: 450,
          recentErrorCount: 0,
          status: 'loading'
        },
        timestamp: expect.any(String)
      });
    });

    test('should return degraded status when issues detected', async () => {
      mockOrchestrator.getProgress.mockReturnValue({
        jobId: 'test_job_123',
        totalJobs: 100,
        completedJobs: 25,
        progressPercentage: 25.0,
        recordsPerSecond: 15.5,
        apiCallsUsed: 50,
        apiCallsRemaining: 30, // Low remaining calls
        status: 'loading',
        estimatedCompletion: new Date('2024-01-15T14:30:00Z'),
        errors: Array.from({ length: 15 }, (_, i) => ({ // High error count
          jobId: `failed_job_${i}`,
          errorType: 'api_error',
          message: 'Test error',
          timestamp: new Date(),
          retryable: true
        })) as any
      });

      const response = await request(app)
        .get('/api/v1/data-loading/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.apiCallsRemaining).toBe(false);
      expect(response.body.checks.errorRate).toBe(false);
    });

    test('should handle health check errors', async () => {
      mockOrchestrator.getProgress.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      const response = await request(app)
        .get('/api/v1/data-loading/health')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      mockOrchestrator.getProgress.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/api/v1/data-loading/progress')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Unexpected error'
      });
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/data-loading/start')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle JSON parsing errors
    });
  });

  describe('Input Validation', () => {
    test('should validate empty job geography', async () => {
      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send({
          geography: {}, // Missing level
          variables: ['B01003_001E']
        })
        .expect(400);

      expect(response.body.error).toContain('Geography specification with level is required');
    });

    test('should validate empty variables array', async () => {
      const response = await request(app)
        .post('/api/v1/data-loading/jobs')
        .send({
          geography: { level: 'state' },
          variables: [] // Empty array
        })
        .expect(400);

      expect(response.body.error).toContain('Variables array is required');
    });
  });
});
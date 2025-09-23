import { Router } from 'express';

const router = Router();

/**
 * Test endpoint to safely load and test DataLoadingOrchestrator
 * This endpoint will dynamically import the orchestrator to avoid startup crashes
 */
router.get('/test-orchestrator', async (req, res) => {
  try {
    console.log('🔍 Testing DataLoadingOrchestrator initialization...');

    // Step 1: Test configuration loading
    console.log('1. Testing configuration manager...');
    const { configurationManager } = await import('../data-loading/utils/LoadingConfiguration');
    const config = configurationManager.getConfiguration();
    console.log('✅ Configuration manager loaded successfully');

    // Step 2: Test individual dependencies first
    console.log('2. Testing PriorityQueueManager...');
    const { PriorityQueueManager } = await import('../data-loading/orchestration/PriorityQueueManager');
    console.log('✅ PriorityQueueManager imported successfully');

    console.log('3. Testing ConcurrentWorkerPool...');
    const { ConcurrentWorkerPool } = await import('../data-loading/processing/ConcurrentWorkerPool');
    console.log('✅ ConcurrentWorkerPool imported successfully');

    console.log('4. Testing DataLoadMonitor...');
    const { DataLoadMonitor } = await import('../data-loading/monitoring/DataLoadMonitor');
    console.log('✅ DataLoadMonitor imported successfully');

    // Step 5: Test DataLoadingOrchestrator class import (not instantiation)
    console.log('5. Testing DataLoadingOrchestrator class import...');
    const { DataLoadingOrchestrator } = await import('../data-loading/orchestration/DataLoadingOrchestrator');
    console.log('✅ DataLoadingOrchestrator class imported successfully');

    // Step 6: Test manual instantiation
    console.log('6. Testing manual DataLoadingOrchestrator instantiation...');
    const orchestrator = new DataLoadingOrchestrator();
    console.log('✅ DataLoadingOrchestrator instance created successfully');

    // Step 7: Test basic operations
    console.log('7. Testing basic operations...');
    const progress = orchestrator.getProgress();
    const context = orchestrator.getContext();
    console.log('✅ Basic operations successful');

    res.json({
      success: true,
      message: 'DataLoadingOrchestrator initialization test passed',
      results: {
        configLoaded: true,
        orchestratorCreated: true,
        basicOperationsWork: true,
        progress: {
          status: progress.status,
          totalJobs: progress.totalJobs,
          completedJobs: progress.completedJobs
        },
        context: {
          queueDepth: context.queueDepth,
          activeJobsCount: context.activeJobs.length,
          connectionCount: context.connections.length
        },
        config: {
          maxConcurrentJobs: config.maxConcurrentJobs,
          apiRateLimit: config.apiRateLimit
        }
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ DataLoadingOrchestrator test failed:', error);

    res.status(500).json({
      success: false,
      message: 'DataLoadingOrchestrator initialization failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date()
    });
  }
});

/**
 * Test data loading phases endpoint
 */
router.get('/test-phases', async (req, res) => {
  try {
    console.log('🔍 Testing loading phases...');

    const { LOADING_PHASES } = await import('../data-loading/utils/PriorityDefinitions');

    const phaseSummary = LOADING_PHASES.map(phase => ({
      name: phase.name,
      description: phase.description,
      priority: phase.priority,
      estimatedJobs: phase.estimatedJobs,
      geographyCount: phase.geographies.length,
      variableCount: phase.variables.length
    }));

    res.json({
      success: true,
      message: 'Loading phases test passed',
      totalPhases: LOADING_PHASES.length,
      phases: phaseSummary,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Loading phases test failed:', error);

    res.status(500).json({
      success: false,
      message: 'Loading phases test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
  }
});

export { router as dataLoadTestRoutes };
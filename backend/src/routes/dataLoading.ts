import { Router, Request, Response } from 'express';
import { dataLoadingOrchestrator } from '../data-loading/orchestration/DataLoadingOrchestrator';
import { GeographySpec } from '../data-loading/utils/LoadingTypes';
import { LOADING_PHASES, PRIORITY_STATES, PRIORITY_METRO_AREAS } from '../data-loading/utils/PriorityDefinitions';
import { configurationManager } from '../data-loading/utils/LoadingConfiguration';

const router = Router();

/**
 * Start priority-based data loading
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { phases } = req.body;
    
    console.log('🚀 Starting data loading via API...');
    
    // Start the loading process (don't await to return immediately)
    dataLoadingOrchestrator.startPriorityLoading(phases)
      .then(() => {
        console.log('✅ Data loading completed successfully');
      })
      .catch((error) => {
        console.error('❌ Data loading failed:', error);
      });
    
    res.json({ 
      success: true, 
      message: 'Data loading started successfully',
      phases: phases || 'all phases',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to start data loading:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get current loading progress
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const progress = dataLoadingOrchestrator.getProgress();
    
    res.json({
      success: true,
      progress: {
        ...progress,
        progressPercentage: Math.round(progress.progressPercentage * 100) / 100,
        recordsPerSecond: Math.round(progress.recordsPerSecond * 100) / 100,
        estimatedCompletion: progress.estimatedCompletion.toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get progress:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get loading metrics and system health
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = dataLoadingOrchestrator.getMetrics();
    const context = dataLoadingOrchestrator.getContext();
    
    res.json({
      success: true,
      metrics,
      systemHealth: {
        totalConnections: context.connections.length,
        activeJobs: context.activeJobs.length,
        queueDepth: context.queueDepth,
        apiUsage: {
          used: context.rateLimit.totalCalls - context.rateLimit.remainingCalls,
          remaining: context.rateLimit.remainingCalls,
          limit: context.rateLimit.totalCalls,
          percentage: ((context.rateLimit.totalCalls - context.rateLimit.remainingCalls) / context.rateLimit.totalCalls) * 100
        }
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to get metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Pause data loading
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    await dataLoadingOrchestrator.pauseLoading();
    
    res.json({ 
      success: true, 
      message: 'Data loading paused successfully',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to pause data loading:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Resume data loading
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    await dataLoadingOrchestrator.resumeLoading();
    
    res.json({ 
      success: true, 
      message: 'Data loading resumed successfully',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to resume data loading:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Stop data loading
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    await dataLoadingOrchestrator.stopLoading();
    
    res.json({ 
      success: true, 
      message: 'Data loading stopped successfully',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to stop data loading:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Add a custom loading job
 */
router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const { geography, variables, priority } = req.body;
    
    if (!geography || !geography.level) {
      return res.status(400).json({
        success: false,
        error: 'Geography specification with level is required'
      });
    }
    
    if (!variables || !Array.isArray(variables) || variables.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variables array is required'
      });
    }
    
    const geographySpec: GeographySpec = {
      level: geography.level,
      codes: geography.codes,
      parentGeography: geography.parentGeography,
      filter: geography.filter
    };
    
    const jobId = await dataLoadingOrchestrator.addJob(
      geographySpec,
      variables,
      priority
    );
    
    res.json({
      success: true,
      message: 'Custom job added successfully',
      jobId,
      geography: geographySpec,
      variables,
      priority,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to add custom job:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get available loading phases
 */
router.get('/phases', async (req: Request, res: Response) => {
  try {
    const phases = LOADING_PHASES.map(phase => ({
      name: phase.name,
      description: phase.description,
      priority: phase.priority,
      estimatedJobs: phase.estimatedJobs,
      estimatedApiCalls: phase.estimatedApiCalls,
      dependencies: phase.dependencies || [],
      geographyCount: phase.geographies.length,
      variableCount: phase.variables.length
    }));
    
    res.json({
      success: true,
      phases,
      totalPhases: phases.length
    });
    
  } catch (error) {
    console.error('❌ Failed to get phases:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get priority geographies and variables
 */
router.get('/priorities', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      priorities: {
        states: PRIORITY_STATES.slice(0, 10).map(state => ({
          code: state.code,
          name: state.name,
          priority: state.priority
        })),
        metros: PRIORITY_METRO_AREAS.slice(0, 10).map(metro => ({
          cbsa: metro.cbsa,
          name: metro.name,
          priority: metro.priority
        })),
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
    
  } catch (error) {
    console.error('❌ Failed to get priorities:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get current configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = configurationManager.getConfiguration();
    const apiCallBudget = configurationManager.getApiCallBudget();
    
    res.json({
      success: true,
      configuration: {
        maxConcurrentJobs: config.maxConcurrentJobs,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs,
        apiRateLimit: config.apiRateLimit,
        priorities: config.priorities,
        validation: config.validation,
        monitoring: config.monitoring
      },
      apiCallBudget,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to get configuration:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Update configuration
 */
router.patch('/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    // Validate critical updates
    if (updates.maxConcurrentJobs && (updates.maxConcurrentJobs < 1 || updates.maxConcurrentJobs > 10)) {
      return res.status(400).json({
        success: false,
        error: 'maxConcurrentJobs must be between 1 and 10'
      });
    }
    
    if (updates.apiRateLimit?.dailyLimit && updates.apiRateLimit.dailyLimit < 100) {
      return res.status(400).json({
        success: false,
        error: 'API daily limit must be at least 100'
      });
    }
    
    configurationManager.updateConfiguration(updates);
    const newConfig = configurationManager.getConfiguration();
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      configuration: {
        maxConcurrentJobs: newConfig.maxConcurrentJobs,
        maxRetries: newConfig.maxRetries,
        retryDelayMs: newConfig.retryDelayMs,
        apiRateLimit: newConfig.apiRateLimit,
        priorities: newConfig.priorities,
        validation: newConfig.validation,
        monitoring: newConfig.monitoring
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to update configuration:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get loading history and analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;
    const hoursNum = parseInt(hours as string);
    
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) { // Max 1 week
      return res.status(400).json({
        success: false,
        error: 'Hours parameter must be between 1 and 168'
      });
    }
    
    const context = dataLoadingOrchestrator.getContext();
    const progress = dataLoadingOrchestrator.getProgress();
    
    res.json({
      success: true,
      analytics: {
        timeRange: `${hoursNum} hours`,
        summary: {
          totalJobs: progress.totalJobs,
          completedJobs: progress.completedJobs,
          failedJobs: progress.errors.length,
          successRate: progress.totalJobs > 0 ? 
            ((progress.completedJobs / progress.totalJobs) * 100).toFixed(2) + '%' : '0%',
          averageRecordsPerSecond: Math.round(progress.recordsPerSecond * 100) / 100
        },
        apiUsage: {
          callsUsed: progress.apiCallsUsed,
          callsRemaining: progress.apiCallsRemaining,
          usagePercentage: progress.apiCallsUsed > 0 ? 
            ((progress.apiCallsUsed / (progress.apiCallsUsed + progress.apiCallsRemaining)) * 100).toFixed(2) + '%' : '0%'
        },
        systemHealth: {
          status: context.activeJobs.length > 0 ? 'loading' : 'idle',
          activeJobs: context.activeJobs.length,
          queueDepth: context.queueDepth,
          recentErrors: progress.errors.slice(-5) // Latest 5 errors
        }
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Failed to get analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const progress = dataLoadingOrchestrator.getProgress();
    const context = dataLoadingOrchestrator.getContext();
    
    const isHealthy = progress.errors.length < 10 && // Less than 10 recent errors
                     progress.apiCallsRemaining > 50; // At least 50 API calls remaining
    
    res.status(isHealthy ? 200 : 503).json({
      success: true,
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        apiCallsRemaining: progress.apiCallsRemaining > 50,
        errorRate: progress.errors.length < 10,
        systemResponsive: true
      },
      details: {
        activeJobs: context.activeJobs.length,
        queueDepth: context.queueDepth,
        apiCallsRemaining: progress.apiCallsRemaining,
        recentErrorCount: progress.errors.length,
        status: progress.status
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({ 
      success: false, 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
  }
});

export default router;
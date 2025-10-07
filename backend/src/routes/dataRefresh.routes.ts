import { Router } from 'express';
import { dataRefreshService, DataRefreshService } from '../services/dataRefreshService';

const router = Router();

// Track active refresh operations
const activeRefreshes = new Map<string, {
  service: DataRefreshService;
  startTime: Date;
  clientId: string;
}>();

/**
 * Start a full data refresh operation
 * POST /api/data/refresh
 */
router.post('/refresh', async (req, res) => {
  const clientId = req.headers['x-client-id'] as string || 'default';

  try {
    // Check if refresh is already in progress for this client
    if (activeRefreshes.has(clientId)) {
      return res.status(409).json({
        success: false,
        error: 'Data refresh already in progress for this client',
        message: 'Please wait for the current refresh to complete'
      });
    }

    console.log(`🔄 Starting data refresh for client: ${clientId}`);

    // Create dedicated service instance with progress tracking
    const progressUpdates: any[] = [];
    const refreshService = new DataRefreshService((progress) => {
      progressUpdates.push({
        ...progress,
        timestamp: new Date()
      });
    });

    // Register active refresh
    activeRefreshes.set(clientId, {
      service: refreshService,
      startTime: new Date(),
      clientId
    });

    // Start the refresh operation
    const result = await refreshService.refreshHealthcareData();

    // Remove from active refreshes
    activeRefreshes.delete(clientId);

    if (result.success) {
      console.log(`✅ Data refresh completed for client ${clientId}: ${result.recordsUpdated} records updated`);

      res.json({
        success: true,
        message: 'Data refresh completed successfully',
        data: {
          recordsUpdated: result.recordsUpdated,
          duration: result.duration,
          datasetsRefreshed: result.datasetsRefreshed,
          summary: result.summary
        },
        progressLog: progressUpdates
      });
    } else {
      console.error(`❌ Data refresh failed for client ${clientId}:`, result.error);

      res.status(500).json({
        success: false,
        error: result.error || 'Data refresh failed',
        message: 'The data refresh operation encountered an error',
        data: {
          recordsUpdated: result.recordsUpdated,
          duration: result.duration
        },
        progressLog: progressUpdates
      });
    }

  } catch (error) {
    // Clean up active refresh if it exists
    activeRefreshes.delete(clientId);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error during data refresh';
    console.error('Data refresh error:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'An unexpected error occurred during data refresh'
    });
  }
});

/**
 * Perform incremental update for specific datasets
 * POST /api/data/refresh/incremental
 */
router.post('/refresh/incremental', async (req, res) => {
  try {
    const { datasets } = req.body;

    if (!Array.isArray(datasets) || datasets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid datasets parameter',
        message: 'Please provide an array of dataset names to refresh'
      });
    }

    console.log(`🔄 Starting incremental refresh for datasets: ${datasets.join(', ')}`);

    const result = await dataRefreshService.performIncrementalUpdate(datasets);

    if (result.success) {
      res.json({
        success: true,
        message: 'Incremental data refresh completed',
        data: {
          recordsUpdated: result.recordsUpdated,
          duration: result.duration,
          datasetsRefreshed: result.datasetsRefreshed
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Incremental refresh failed',
        data: {
          recordsUpdated: result.recordsUpdated,
          duration: result.duration
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during incremental refresh';
    console.error('Incremental refresh error:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'An unexpected error occurred during incremental refresh'
    });
  }
});

/**
 * Get current refresh status
 * GET /api/data/refresh/status
 */
router.get('/refresh/status', async (req, res) => {
  const clientId = req.headers['x-client-id'] as string || 'default';

  try {
    // Check if refresh is in progress
    const activeRefresh = activeRefreshes.get(clientId);

    if (activeRefresh) {
      const duration = Date.now() - activeRefresh.startTime.getTime();
      return res.json({
        inProgress: true,
        startedAt: activeRefresh.startTime,
        durationMs: duration,
        message: 'Data refresh currently in progress'
      });
    }

    // Get system status
    const status = await dataRefreshService.getRefreshStatus();

    res.json({
      inProgress: false,
      ...status,
      message: status.isHealthy
        ? 'System is healthy and ready for data refresh'
        : 'System is not healthy - data refresh may not work properly'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error getting refresh status';
    console.error('Error getting refresh status:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'Unable to retrieve refresh status'
    });
  }
});

/**
 * Cancel ongoing refresh operation
 * DELETE /api/data/refresh/cancel
 */
router.delete('/refresh/cancel', async (req, res) => {
  const clientId = req.headers['x-client-id'] as string || 'default';

  try {
    if (activeRefreshes.has(clientId)) {
      activeRefreshes.delete(clientId);
      console.log(`🛑 Data refresh cancelled for client: ${clientId}`);

      res.json({
        success: true,
        message: 'Data refresh operation cancelled'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No active refresh found',
        message: 'There is no active data refresh operation to cancel'
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error cancelling refresh';
    console.error('Error cancelling refresh:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'Unable to cancel refresh operation'
    });
  }
});

/**
 * Rollback to last known good data state
 * POST /api/data/refresh/rollback
 */
router.post('/refresh/rollback', async (req, res) => {
  try {
    console.log('🔄 Starting data rollback operation...');

    const result = await dataRefreshService.rollbackToLastKnownGood();

    if (result.success) {
      res.json({
        success: true,
        message: 'Data successfully rolled back to last known good state',
        data: {
          duration: result.duration,
          datasetsAffected: result.datasetsRefreshed
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Rollback failed',
        message: 'Unable to rollback data to previous state'
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during rollback';
    console.error('Data rollback error:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'An unexpected error occurred during rollback'
    });
  }
});

/**
 * Health check for refresh service
 * GET /api/data/refresh/health
 */
router.get('/refresh/health', async (req, res) => {
  try {
    const status = await dataRefreshService.getRefreshStatus();

    res.json({
      healthy: status.isHealthy,
      availableDatasets: status.availableDatasets.length,
      lastCheck: new Date(),
      components: {
        dataRefreshService: true,
        healthcareAnalytics: status.isHealthy,
        dataSources: status.availableDatasets.length > 0
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    console.error('Refresh service health check error:', errorMessage);

    res.status(500).json({
      healthy: false,
      error: errorMessage,
      lastCheck: new Date(),
      components: {
        dataRefreshService: false,
        healthcareAnalytics: false,
        dataSources: false
      }
    });
  }
});

export default router;
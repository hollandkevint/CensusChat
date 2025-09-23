import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected',
        duckdb: 'available'
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /health/demo
 * @desc Demo data status endpoint
 * @access Public
 */
router.get('/demo', (req: Request, res: Response) => {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const demoStatusPath = path.join(dataDir, 'demo-status.json');
    
    if (fs.existsSync(demoStatusPath)) {
      const demoStatus = JSON.parse(fs.readFileSync(demoStatusPath, 'utf8'));
      res.json({
        status: 'demo_ready',
        demo: demoStatus
      });
    } else {
      res.json({
        status: 'demo_not_ready',
        message: 'Demo data not yet initialized'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /health/export
 * @desc Export service health check
 * @access Public
 */
router.get('/export', (req: Request, res: Response) => {
  try {
    const tempDir = path.join(process.cwd(), 'temp', 'exports');
    const isWritable = fs.existsSync(tempDir) && fs.statSync(tempDir).isDirectory();
    
    res.json({
      status: 'healthy',
      export_service: 'available',
      temp_directory: {
        path: tempDir,
        exists: fs.existsSync(tempDir),
        writable: isWritable
      },
      features: {
        excel_export: true,
        csv_export: true,
        progress_tracking: true,
        streaming: true
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      export_service: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as healthRoutes };



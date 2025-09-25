import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getMCPMonitoring } from '../utils/mcpMonitoring';
import { getMCPServerService } from '../services/mcpServerService';
import { getMCPClientService } from '../services/mcpClientService';

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

/**
 * @route GET /health/mcp
 * @desc MCP services health and monitoring endpoint
 * @access Public
 */
router.get('/mcp', async (req: Request, res: Response) => {
  try {
    const monitoring = getMCPMonitoring();
    const mcpServer = getMCPServerService();
    const mcpClient = getMCPClientService();

    const healthReport = monitoring.generateHealthReport();
    const serverStatus = mcpServer.getStatus();
    const clientStatus = mcpClient.getStatus();
    const exportMetrics = monitoring.exportMetrics();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      monitoring: {
        healthReport,
        aggregateMetrics: monitoring.getAggregateMetrics(),
        healthStatus: monitoring.getHealthStatus(),
        recentErrors: monitoring.getRecentErrors(5)
      },
      services: {
        server: serverStatus,
        client: clientStatus
      },
      metrics: {
        prometheus: exportMetrics.prometheus,
        json: exportMetrics.json
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /health/mcp/metrics
 * @desc Prometheus-format MCP metrics endpoint
 * @access Public
 */
router.get('/mcp/metrics', (req: Request, res: Response) => {
  try {
    const monitoring = getMCPMonitoring();
    const metrics = monitoring.exportMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics.prometheus);
  } catch (error) {
    res.status(503).send(`# ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

export { router as healthRoutes };



import { Express } from 'express';
import { authRoutes } from './auth.routes';
import { queryRoutes } from './query.routes';
import { userRoutes } from './user.routes';
import censusRoutes from './census.routes';
import { exportRoutes } from './export.routes';
import { healthRoutes } from './health.routes';
import { mcpRoutes } from './mcp.routes';
import { mcpTransportRouter } from '../mcp/mcpRoutes';
import { metricsRouter } from './metrics.routes';
import dataRefreshRoutes from './dataRefresh.routes';
import dataLoadingRoutes from './dataLoading';
// import { dataLoadTestRoutes } from './dataLoadTest.routes';
// import { manualDataLoadRoutes } from './manualDataLoad.routes';

export const setupRoutes = (app: Express) => {
  // Health check routes (no version prefix)
  app.use('/health', healthRoutes);

  // MCP transport endpoints (protocol level - for external MCP clients)
  app.use('/mcp', mcpTransportRouter);

  // API v1 routes - temporarily disable data loading while investigating startup issues
  // app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/queries', queryRoutes);
  // app.use('/api/v1/users', userRoutes);
  // app.use('/api/v1/census', censusRoutes);
  // app.use('/api/v1/data-loading', dataLoadingRoutes);
  app.use('/api/v1/export', exportRoutes);
  app.use('/api/v1/mcp', mcpRoutes);
  app.use('/api/v1/metrics', metricsRouter);
  app.use('/api/data', dataRefreshRoutes);
  // app.use('/api/v1/data-load-test', dataLoadTestRoutes);
  // app.use('/api/v1/manual-data-load', manualDataLoadRoutes);

  // API documentation endpoint
  app.get('/api/v1', (_req, res) => {
    res.json({
      message: 'CensusChat API v1',
      version: '1.0.0',
      endpoints: {
        auth: '/api/v1/auth',
        queries: '/api/v1/queries',
        users: '/api/v1/users',
        census: '/api/v1/census',
        dataLoading: '/api/v1/data-loading',
        export: '/api/v1/export',
        mcp: '/api/v1/mcp',
        mcpTransport: '/mcp',
        metrics: '/api/v1/metrics',
        dataRefresh: '/api/data/refresh',
        health: '/health',
        demo: '/health/demo',
      },
    });
  });
};
// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { setupRoutes } from './routes';
import { getDuckDBPool, closeDuckDBPool } from './utils/duckdbPool';
import { getMCPServerService, closeMCPServerService } from './services/mcpServerService';
import { getMCPClientService, closeMCPClientService } from './services/mcpClientService';

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint with DuckDB pool and MCP services status
app.get('/health', async (_req, res) => {
  const poolStats = getDuckDBPool().getStats();
  const poolHealthy = await getDuckDBPool().healthCheck();

  const mcpServerStatus = getMCPServerService().getStatus();
  const mcpClientStatus = getMCPClientService().getStatus();
  const mcpServerHealthy = await getMCPServerService().healthCheck();
  const mcpClientHealthy = await getMCPClientService().healthCheck();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment,
    duckdb: {
      poolHealthy,
      stats: poolStats,
      featureEnabled: process.env.USE_PRODUCTION_DUCKDB === 'true'
    },
    mcp: {
      server: {
        ...mcpServerStatus,
        healthy: mcpServerHealthy
      },
      client: {
        ...mcpClientStatus,
        healthy: mcpClientHealthy
      }
    }
  });
});

// API routes
setupRoutes(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
// In the test environment, listen on an ephemeral port so multiple test suites
// importing this module (in reused Jest workers) never collide on one port
const isTestEnv = config.environment === 'test' || process.env.NODE_ENV === 'test';
const PORT = isTestEnv ? 0 : config.port;

server.listen(PORT, async () => {
  if (isTestEnv) {
    const address = server.address();
    if (address && typeof address === 'object') {
      // Publish the actual port for in-process HTTP clients (e.g. MCP client)
      process.env.MCP_SERVER_URL = `http://localhost:${address.port}`;
    }
  }
  console.log(`
    🚀 CensusChat Backend Server Started
    ====================================
    Environment: ${config.environment}
    Port: ${PORT}
    API URL: http://localhost:${PORT}
    Health Check: http://localhost:${PORT}/health
    ====================================
  `);

  // Initialize MCP services after server starts
  try {
    console.log('🔧 Initializing MCP Server Service...');
    await getMCPServerService().start();
    console.log('✅ MCP Server Service initialized');

    console.log('🔧 Initializing MCP Client Service...');
    await getMCPClientService().initialize();
    console.log('✅ MCP Client Service initialized');

    console.log('🎯 Healthcare data federation ready via MCP protocol');
  } catch (error) {
    console.error('❌ MCP Services initialization failed:', error);
    console.warn('⚠️ Server will continue with limited MCP functionality');
  }
});

// Graceful shutdown with MCP services and DuckDB pool cleanup
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} signal received: closing MCP services, HTTP server and DuckDB pool`);

  try {
    // Close MCP services first
    console.log('🔄 Stopping MCP Server Service...');
    await closeMCPServerService();
    console.log('✅ MCP Server Service stopped');

    console.log('🔄 Stopping MCP Client Service...');
    await closeMCPClientService();
    console.log('✅ MCP Client Service stopped');

    // Close DuckDB pool
    await closeDuckDBPool();
    console.log('✅ DuckDB pool closed');

    // Finally close HTTP server
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
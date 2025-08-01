import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { setupRoutes } from './routes';

// Load environment variables
dotenv.config();

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment
  });
});

// API routes
setupRoutes(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

server.listen(PORT, () => {
  console.log(`
    🚀 CensusChat Backend Server Started
    ====================================
    Environment: ${config.environment}
    Port: ${PORT}
    API URL: http://localhost:${PORT}
    Health Check: http://localhost:${PORT}/health
    ====================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app, server };
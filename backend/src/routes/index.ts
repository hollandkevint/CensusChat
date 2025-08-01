import { Express } from 'express';
import { authRoutes } from './auth.routes';
import { queryRoutes } from './query.routes';
import { userRoutes } from './user.routes';
import censusRoutes from './census.routes';

export const setupRoutes = (app: Express) => {
  // API v1 routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/queries', queryRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/census', censusRoutes);
  
  // API documentation endpoint
  app.get('/api/v1', (req, res) => {
    res.json({
      message: 'CensusChat API v1',
      version: '1.0.0',
      endpoints: {
        auth: '/api/v1/auth',
        queries: '/api/v1/queries',
        users: '/api/v1/users',
        census: '/api/v1/census',
        health: '/health',
      },
    });
  });
};
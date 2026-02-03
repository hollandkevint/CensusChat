import { Router, Request, Response } from 'express';
import { getRecentProfiles, getProfileStats, clearProfiles } from '../utils/duckdbProfiler';
import { getDuckDBPool } from '../utils/duckdbPool';

export const metricsRouter = Router();

// GET /api/v1/metrics/queries - Recent query profiles
metricsRouter.get('/queries', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const profiles = getRecentProfiles(limit);
  res.json({
    success: true,
    data: profiles,
    count: profiles.length
  });
});

// GET /api/v1/metrics/stats - Aggregate query statistics
metricsRouter.get('/stats', (_req: Request, res: Response) => {
  const stats = getProfileStats();
  const poolStats = getDuckDBPool().getStats();
  res.json({
    success: true,
    data: {
      queryPerformance: stats,
      connectionPool: poolStats
    }
  });
});

// DELETE /api/v1/metrics/queries - Clear stored profiles
metricsRouter.delete('/queries', (_req: Request, res: Response) => {
  clearProfiles();
  res.json({
    success: true,
    message: 'Query profiles cleared'
  });
});

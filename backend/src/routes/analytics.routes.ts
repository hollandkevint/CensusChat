/**
 * Analytics Routes - API endpoints for usage analytics and performance metrics
 */

import { Router, Request, Response } from 'express';
import {
  trackQueryEvent,
  getAnalyticsSummary,
  getPerformanceMetrics,
  getPopularQueryPatterns,
  getGeographyUsageStats,
  QueryEvent
} from '../services/analyticsService';

const router = Router();

/**
 * Track a query event
 * POST /api/v1/analytics/track
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const event: QueryEvent = {
      ...req.body,
      timestamp: Date.now()
    };

    // Validate event type
    const validEventTypes = ['query_executed', 'query_cached', 'query_error', 'export_generated', 'share_created'];
    if (!validEventTypes.includes(event.eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid event type. Valid types: ${validEventTypes.join(', ')}`
      });
    }

    const tracked = await trackQueryEvent(event);

    return res.json({
      success: tracked,
      message: tracked ? 'Event tracked' : 'Analytics service unavailable'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get analytics summary
 * GET /api/v1/analytics/summary
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getAnalyticsSummary();

    if (!summary) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service unavailable'
      });
    }

    return res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get performance metrics
 * GET /api/v1/analytics/performance
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await getPerformanceMetrics(Math.min(hours, 168)); // Max 7 days

    if (!metrics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service unavailable'
      });
    }

    return res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get popular query patterns
 * GET /api/v1/analytics/popular
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const patterns = await getPopularQueryPatterns(Math.min(limit, 50));

    return res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Error getting popular patterns:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get geography usage statistics
 * GET /api/v1/analytics/geography
 */
router.get('/geography', async (_req: Request, res: Response) => {
  try {
    const stats = await getGeographyUsageStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting geography stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get dashboard data (combined analytics)
 * GET /api/v1/analytics/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [summary, performance, popular, geography] = await Promise.all([
      getAnalyticsSummary(),
      getPerformanceMetrics(24),
      getPopularQueryPatterns(5),
      getGeographyUsageStats()
    ]);

    return res.json({
      success: true,
      data: {
        summary,
        performance,
        popularCategories: popular,
        geographyUsage: geography,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export const analyticsRoutes = router;

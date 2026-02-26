/**
 * Analytics Service - Track query usage, performance metrics, and cache efficiency
 * Provides insights for optimizing the CensusChat experience
 */

import Redis from 'ioredis';
import { config } from '../config';

// Redis client for analytics
const redis = new Redis({
  host: config.database.redis.host,
  port: config.database.redis.port,
  password: config.database.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 5000,
  keyPrefix: 'census_analytics:',
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 2000);
  }
});

let analyticsAvailable = false;

redis.on('connect', () => {
  console.log('✅ Redis connected for analytics');
  analyticsAvailable = true;
});

redis.on('error', (error) => {
  console.warn('⚠️  Redis analytics error:', error.message);
  analyticsAvailable = false;
});

redis.on('close', () => {
  analyticsAvailable = false;
});

redis.connect().catch((error) => {
  console.warn('⚠️  Redis analytics connection failed:', error.message);
  analyticsAvailable = false;
});

/**
 * Query event types
 */
export type QueryEventType = 'query_executed' | 'query_cached' | 'query_error' | 'export_generated' | 'share_created';

/**
 * Query category types
 */
export type QueryCategory = 'healthcare' | 'marketing' | 'demographics' | 'geographic' | 'custom';

/**
 * Query event data
 */
export interface QueryEvent {
  eventType: QueryEventType;
  timestamp: number;
  queryHash?: string;
  queryCategory?: QueryCategory;
  executionTime?: number;
  rowCount?: number;
  cacheHit?: boolean;
  errorType?: string;
  userId?: string;
  sessionId?: string;
  geographyLevel?: string;
}

/**
 * Analytics summary
 */
export interface AnalyticsSummary {
  totalQueries: number;
  queriesLast24h: number;
  queriesLastHour: number;
  cacheHitRate: number;
  avgExecutionTime: number;
  errorRate: number;
  topCategories: Array<{ category: string; count: number }>;
  queryVolume: Array<{ hour: string; count: number }>;
  performancePercentiles: {
    p50: number;
    p90: number;
    p99: number;
  };
}

/**
 * Track a query event
 */
export async function trackQueryEvent(event: QueryEvent): Promise<boolean> {
  if (!analyticsAvailable) {
    return false;
  }

  try {
    const timestamp = event.timestamp || Date.now();
    const dayKey = new Date(timestamp).toISOString().split('T')[0];
    const hourKey = new Date(timestamp).toISOString().slice(0, 13);

    // Store event in time-series list (keep last 7 days)
    await redis.lpush('events', JSON.stringify({
      ...event,
      timestamp
    }));
    await redis.ltrim('events', 0, 100000); // Keep last 100k events

    // Increment counters
    await redis.incr(`count:total`);
    await redis.incr(`count:day:${dayKey}`);
    await redis.incr(`count:hour:${hourKey}`);

    // Track by event type
    await redis.incr(`count:type:${event.eventType}`);

    // Track by category
    if (event.queryCategory) {
      await redis.incr(`count:category:${event.queryCategory}`);
      await redis.incr(`count:category:${event.queryCategory}:${dayKey}`);
    }

    // Track execution times for percentile calculation
    if (event.executionTime !== undefined) {
      await redis.lpush('execution_times', event.executionTime.toString());
      await redis.ltrim('execution_times', 0, 10000); // Keep last 10k
    }

    // Track cache hits
    if (event.cacheHit !== undefined) {
      await redis.incr(event.cacheHit ? 'count:cache_hits' : 'count:cache_misses');
    }

    // Track errors
    if (event.eventType === 'query_error' && event.errorType) {
      await redis.incr(`count:error:${event.errorType}`);
    }

    // Track geography level usage
    if (event.geographyLevel) {
      await redis.incr(`count:geo:${event.geographyLevel}`);
    }

    return true;
  } catch (error) {
    console.error('Error tracking query event:', error);
    return false;
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  if (!analyticsAvailable) {
    return null;
  }

  try {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const oneHourAgo = now - 3600000;
    const todayKey = new Date().toISOString().split('T')[0];
    const currentHourKey = new Date().toISOString().slice(0, 13);

    // Get total counts
    const totalQueries = parseInt(await redis.get('count:total') || '0');
    const queriesLast24h = parseInt(await redis.get(`count:day:${todayKey}`) || '0');
    const queriesLastHour = parseInt(await redis.get(`count:hour:${currentHourKey}`) || '0');

    // Calculate cache hit rate
    const cacheHits = parseInt(await redis.get('count:cache_hits') || '0');
    const cacheMisses = parseInt(await redis.get('count:cache_misses') || '0');
    const cacheHitRate = cacheHits + cacheMisses > 0
      ? cacheHits / (cacheHits + cacheMisses)
      : 0;

    // Calculate error rate
    const queryExecuted = parseInt(await redis.get('count:type:query_executed') || '0');
    const queryError = parseInt(await redis.get('count:type:query_error') || '0');
    const errorRate = queryExecuted + queryError > 0
      ? queryError / (queryExecuted + queryError)
      : 0;

    // Get execution time statistics
    const executionTimes = await redis.lrange('execution_times', 0, 9999);
    const times = executionTimes.map(t => parseFloat(t)).filter(t => !isNaN(t)).sort((a, b) => a - b);

    const avgExecutionTime = times.length > 0
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0;

    const performancePercentiles = {
      p50: getPercentile(times, 50),
      p90: getPercentile(times, 90),
      p99: getPercentile(times, 99)
    };

    // Get top categories
    const categories: QueryCategory[] = ['healthcare', 'marketing', 'demographics', 'geographic', 'custom'];
    const categoryCountsPromises = categories.map(async (cat) => ({
      category: cat,
      count: parseInt(await redis.get(`count:category:${cat}`) || '0')
    }));
    const topCategories = (await Promise.all(categoryCountsPromises))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);

    // Get query volume by hour (last 24 hours)
    const queryVolume: Array<{ hour: string; count: number }> = [];
    for (let i = 0; i < 24; i++) {
      const hourDate = new Date(now - i * 3600000);
      const hourKey = hourDate.toISOString().slice(0, 13);
      const count = parseInt(await redis.get(`count:hour:${hourKey}`) || '0');
      queryVolume.unshift({
        hour: hourDate.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
        count
      });
    }

    return {
      totalQueries,
      queriesLast24h,
      queriesLastHour,
      cacheHitRate,
      avgExecutionTime,
      errorRate,
      topCategories,
      queryVolume,
      performancePercentiles
    };
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    return null;
  }
}

/**
 * Get performance metrics for a specific time range
 */
export async function getPerformanceMetrics(
  hours: number = 24
): Promise<{
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p99ResponseTime: number;
  queryCount: number;
  errorCount: number;
  cacheHitRate: number;
  timeRange: { start: number; end: number };
} | null> {
  if (!analyticsAvailable) {
    return null;
  }

  try {
    const now = Date.now();
    const startTime = now - hours * 3600000;

    // Get events in time range
    const events = await redis.lrange('events', 0, -1);
    const filteredEvents = events
      .map(e => {
        try {
          return JSON.parse(e) as QueryEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is QueryEvent => e !== null && e.timestamp >= startTime);

    // Calculate metrics
    const queryEvents = filteredEvents.filter(e => e.eventType === 'query_executed');
    const errorEvents = filteredEvents.filter(e => e.eventType === 'query_error');
    const cachedEvents = filteredEvents.filter(e => e.cacheHit === true);

    const executionTimes = queryEvents
      .map(e => e.executionTime)
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b);

    return {
      avgResponseTime: executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0,
      p50ResponseTime: getPercentile(executionTimes, 50),
      p90ResponseTime: getPercentile(executionTimes, 90),
      p99ResponseTime: getPercentile(executionTimes, 99),
      queryCount: queryEvents.length,
      errorCount: errorEvents.length,
      cacheHitRate: queryEvents.length > 0
        ? cachedEvents.length / queryEvents.length
        : 0,
      timeRange: { start: startTime, end: now }
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return null;
  }
}

/**
 * Get popular queries for cache warming
 */
export async function getPopularQueryPatterns(limit: number = 10): Promise<Array<{
  category: QueryCategory;
  count: number;
  avgExecutionTime: number;
}>> {
  if (!analyticsAvailable) {
    return [];
  }

  try {
    const categories: QueryCategory[] = ['healthcare', 'marketing', 'demographics', 'geographic'];

    const results = await Promise.all(categories.map(async (category) => {
      const count = parseInt(await redis.get(`count:category:${category}`) || '0');
      return {
        category,
        count,
        avgExecutionTime: 0 // Would need more tracking to calculate per-category
      };
    }));

    return results
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting popular query patterns:', error);
    return [];
  }
}

/**
 * Get geography level usage statistics
 */
export async function getGeographyUsageStats(): Promise<Array<{
  level: string;
  count: number;
  percentage: number;
}>> {
  if (!analyticsAvailable) {
    return [];
  }

  try {
    const levels = ['state', 'county', 'tract', 'block_group'];

    const results = await Promise.all(levels.map(async (level) => ({
      level,
      count: parseInt(await redis.get(`count:geo:${level}`) || '0')
    })));

    const total = results.reduce((sum, r) => sum + r.count, 0);

    return results.map(r => ({
      ...r,
      percentage: total > 0 ? (r.count / total) * 100 : 0
    }));
  } catch (error) {
    console.error('Error getting geography usage stats:', error);
    return [];
  }
}

/**
 * Reset analytics (for testing)
 */
export async function resetAnalytics(): Promise<boolean> {
  if (!analyticsAvailable) {
    return false;
  }

  try {
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    console.log('✅ Analytics reset');
    return true;
  } catch (error) {
    console.error('Error resetting analytics:', error);
    return false;
  }
}

/**
 * Calculate percentile from sorted array
 */
function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

// Graceful shutdown
process.on('SIGTERM', () => {
  redis.disconnect();
});

export { analyticsAvailable };

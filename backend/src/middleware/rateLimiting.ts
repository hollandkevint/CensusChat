import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

// Redis client for rate limiting
const redis = new Redis({
  host: config.database.redis.host,
  port: config.database.redis.port,
  password: config.database.redis.password,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 2000
});

// Track Redis availability
let redisAvailable = false;

redis.on('connect', () => {
  console.log('✅ Redis connected for rate limiting');
  redisAvailable = true;
});

redis.on('error', (error) => {
  console.warn('⚠️  Redis connection error for rate limiting:', error.message);
  redisAvailable = false;
});

redis.on('close', () => {
  redisAvailable = false;
});

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;          // Time window in milliseconds
  maxRequests: number;       // Maximum requests per window
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skipSuccessfulRequests?: boolean;         // Don't count successful requests
  message?: string;         // Custom error message
}

// Default rate limit configurations
export const RATE_LIMIT_PRESETS = {
  CENSUS_API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: config.rateLimits.census.requestsPerHour,
    message: 'Census API rate limit exceeded. Please wait before making more requests.',
    keyGenerator: (req: Request) => `census:${req.ip || 'unknown'}`
  },
  CENSUS_API_PER_USER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: Math.floor(config.rateLimits.census.requestsPerHour / 4), // 25% of total per user
    message: 'Your personal Census API rate limit exceeded. Please wait before making more requests.',
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id || req.ip || 'anonymous';
      return `census:user:${userId}`;
    }
  },
  QUERY_ENDPOINT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,     // 30 requests per minute
    message: 'Query rate limit exceeded. Please wait before submitting more queries.',
    keyGenerator: (req: Request) => `query:${req.ip || 'unknown'}`
  }
};

/**
 * Creates a rate limiting middleware
 */
export function createRateLimit(rateLimitConfig: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // If Redis is not available, allow request to proceed
    if (!redisAvailable) {
      console.warn('Redis not available, skipping rate limiting');
      next();
      return;
    }

    try {
      // Generate rate limiting key
      const key = rateLimitConfig.keyGenerator ?
        rateLimitConfig.keyGenerator(req) :
        `rate_limit:${req.ip || 'unknown'}`;

      // Get current count and TTL with timeout
      const pipeline = redis.pipeline();
      pipeline.get(key);
      pipeline.ttl(key);
      const results = await Promise.race([
        pipeline.exec(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]) as any[];

      const currentCount = parseInt((results[0]?.[1] as string) || '0', 10);
      const ttl = (results[1]?.[1] as number) || -1;

      // Check if rate limit exceeded
      if (currentCount >= rateLimitConfig.maxRequests) {
        const resetTime = ttl > 0 ? Date.now() + (ttl * 1000) : Date.now() + rateLimitConfig.windowMs;

        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: rateLimitConfig.message || 'Rate limit exceeded',
          details: {
            limit: rateLimitConfig.maxRequests,
            windowMs: rateLimitConfig.windowMs,
            resetTime: new Date(resetTime).toISOString(),
            retryAfter: Math.ceil(ttl || rateLimitConfig.windowMs / 1000)
          }
        });
      }

      // Increment counter
      const newCount = currentCount + 1;
      if (currentCount === 0) {
        // First request in window - set with expiration
        await Promise.race([
          redis.setex(key, Math.ceil(rateLimitConfig.windowMs / 1000), newCount.toString()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
        ]);
      } else {
        // Increment existing counter
        await Promise.race([
          redis.incr(key),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
        ]);
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitConfig.maxRequests - newCount).toString(),
        'X-RateLimit-Reset': (Date.now() + (ttl > 0 ? ttl * 1000 : rateLimitConfig.windowMs)).toString(),
        'X-RateLimit-Window': rateLimitConfig.windowMs.toString()
      });

      next();
    } catch (error) {
      console.warn('Rate limiting error, allowing request to proceed:', error instanceof Error ? error.message : 'Unknown error');
      // If Redis is down, allow request to proceed but log error
      redisAvailable = false;
      next();
    }
  };
}

/**
 * Census API specific rate limiting middleware
 */
export const censusApiRateLimit = createRateLimit(RATE_LIMIT_PRESETS.CENSUS_API);

/**
 * Per-user Census API rate limiting middleware
 */
export const censusApiUserRateLimit = createRateLimit(RATE_LIMIT_PRESETS.CENSUS_API_PER_USER);

/**
 * Query endpoint rate limiting middleware
 */
export const queryRateLimit = createRateLimit(RATE_LIMIT_PRESETS.QUERY_ENDPOINT);

/**
 * Get current rate limit status for a key
 */
export async function getRateLimitStatus(key: string, config: RateLimitConfig): Promise<{
  limit: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
}> {
  try {
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const [countResult, ttlResult] = await pipeline.exec();

    const currentCount = parseInt((countResult?.[1] as string) || '0', 10);
    const ttl = (ttlResult?.[1] as number) || -1;

    const remaining = Math.max(0, config.maxRequests - currentCount);
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs));

    return {
      limit: config.maxRequests,
      remaining,
      resetTime,
      windowMs: config.windowMs
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    // Return default values if Redis is down
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs),
      windowMs: config.windowMs
    };
  }
}

/**
 * Manual rate limit check without incrementing counter
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: Date;
}> {
  // If Redis is not available, allow request
  if (!redisAvailable) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs)
    };
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const results = await Promise.race([
      pipeline.exec(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
    ]) as any[];

    const currentCount = parseInt((results[0]?.[1] as string) || '0', 10);
    const ttl = (results[1]?.[1] as number) || -1;

    const allowed = currentCount < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs));

    return {
      allowed,
      remaining,
      resetTime
    };
  } catch (error) {
    console.warn('Error checking rate limit, allowing request:', error instanceof Error ? error.message : 'Unknown error');
    redisAvailable = false;
    // Allow request if Redis is down
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs)
    };
  }
}

/**
 * Reset rate limit for a specific key (admin function)
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
}

/**
 * Get all rate limit keys with their status
 */
export async function getAllRateLimitStatus(): Promise<{
  key: string;
  count: number;
  ttl: number;
  type: 'census' | 'query' | 'user' | 'unknown';
}[]> {
  try {
    const keys = await redis.keys('rate_limit:*', 'census:*', 'query:*');
    if (keys.length === 0) return [];

    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.get(key);
      pipeline.ttl(key);
    });

    const results = await pipeline.exec();
    const statuses = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const count = parseInt((results[i * 2]?.[1] as string) || '0', 10);
      const ttl = (results[i * 2 + 1]?.[1] as number) || -1;

      let type: 'census' | 'query' | 'user' | 'unknown' = 'unknown';
      if (key.includes('census:user:')) type = 'user';
      else if (key.includes('census:')) type = 'census';
      else if (key.includes('query:')) type = 'query';

      statuses.push({ key, count, ttl, type });
    }

    return statuses;
  } catch (error) {
    console.error('Error getting all rate limit status:', error);
    return [];
  }
}

// Initialize Redis connection
redis.on('connect', () => {
  console.log('✅ Redis connected for rate limiting');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  redis.disconnect();
});

export { redis };
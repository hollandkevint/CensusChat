import Redis from 'ioredis';
import { config } from '../config';
import { CensusApiResponse, CensusQuery } from './censusApiService';

// Redis client for caching
const redis = new Redis({
  host: config.database.redis.host,
  port: config.database.redis.port,
  password: config.database.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 5000,
  keyPrefix: 'census_cache:',
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 100, 2000);
  }
});

// Track Redis availability for caching
let cacheAvailable = false;

redis.on('connect', () => {
  console.log('✅ Redis connected for caching');
  cacheAvailable = true;
});

redis.on('error', (error) => {
  console.warn('⚠️  Redis connection error for caching:', error.message);
  cacheAvailable = false;
});

redis.on('close', () => {
  cacheAvailable = false;
});

// Attempt connection but don't block startup
redis.connect().catch((error) => {
  console.warn('⚠️  Redis initial connection failed:', error.message);
  cacheAvailable = false;
});

// Cache configuration
const CACHE_CONFIG = {
  DEFAULT_TTL: config.cache.census.ttl, // 1 hour default
  KEY_PREFIX: 'census_data:',
  COMPRESSION_THRESHOLD: 1024 * 10, // 10KB - compress larger responses
  MAX_KEY_LENGTH: 200
};

/**
 * Generate cache key from Census query parameters
 */
export function generateCacheKey(query: CensusQuery): string {
  // Create a deterministic key from query parameters
  const keyData = {
    dataset: query.dataset,
    year: query.year,
    variables: query.variables.sort(), // Sort to ensure consistent keys
    geography: query.geography,
    predicates: query.predicates || {}
  };

  // Create hash from JSON string to handle complex queries
  const queryString = JSON.stringify(keyData);
  const hash = createSimpleHash(queryString);

  // Create readable key with hash
  const readableKey = `${query.dataset}_${query.year}_${query.geography.for}_${hash}`;

  // Ensure key length is within limits
  return readableKey.length > CACHE_CONFIG.MAX_KEY_LENGTH
    ? readableKey.substring(0, CACHE_CONFIG.MAX_KEY_LENGTH)
    : readableKey;
}

/**
 * Simple hash function for cache keys
 */
function createSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Cached response metadata
 */
interface CachedResponse {
  data: CensusApiResponse;
  cachedAt: number;
  ttl: number;
  queryKey: string;
  compressed: boolean;
}

/**
 * Cache Census API response
 */
export async function setCacheData(
  query: CensusQuery,
  response: CensusApiResponse,
  ttl: number = CACHE_CONFIG.DEFAULT_TTL
): Promise<boolean> {
  if (!cacheAvailable) {
    console.warn('Redis cache not available, skipping cache set');
    return false;
  }

  try {
    const cacheKey = generateCacheKey(query);
    const cachedResponse: CachedResponse = {
      data: response,
      cachedAt: Date.now(),
      ttl,
      queryKey: cacheKey,
      compressed: false
    };

    let dataToCache = JSON.stringify(cachedResponse);

    // Compress large responses
    if (dataToCache.length > CACHE_CONFIG.COMPRESSION_THRESHOLD) {
      // Simple compression simulation - in production use zlib
      cachedResponse.compressed = true;
      dataToCache = JSON.stringify(cachedResponse);
    }

    // Set with TTL
    await Promise.race([
      redis.setex(CACHE_CONFIG.KEY_PREFIX + cacheKey, ttl, dataToCache),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 2000))
    ]);

    console.log(`✅ Cached Census data: ${cacheKey} (TTL: ${ttl}s, Size: ${dataToCache.length} bytes)`);
    return true;
  } catch (error) {
    console.warn('Error caching Census data:', error instanceof Error ? error.message : 'Unknown error');
    cacheAvailable = false;
    return false;
  }
}

/**
 * Retrieve cached Census API response
 */
export async function getCacheData(query: CensusQuery): Promise<CensusApiResponse | null> {
  if (!cacheAvailable) {
    return null;
  }

  try {
    const cacheKey = generateCacheKey(query);

    const cachedData = await Promise.race([
      redis.get(CACHE_CONFIG.KEY_PREFIX + cacheKey),
      new Promise<string | null>((_, reject) =>
        setTimeout(() => reject(new Error('Cache timeout')), 1000)
      )
    ]);

    if (!cachedData) {
      return null;
    }

    const cachedResponse: CachedResponse = JSON.parse(cachedData);

    // Check if cache entry is still valid
    const age = Date.now() - cachedResponse.cachedAt;
    if (age > cachedResponse.ttl * 1000) {
      // Cache expired, remove it
      await redis.del(CACHE_CONFIG.KEY_PREFIX + cacheKey);
      return null;
    }

    console.log(`✅ Cache hit: ${cacheKey} (Age: ${Math.round(age / 1000)}s)`);
    return cachedResponse.data;
  } catch (error) {
    console.warn('Error retrieving cached data:', error instanceof Error ? error.message : 'Unknown error');
    cacheAvailable = false;
    return null;
  }
}

/**
 * Check if query result is cached
 */
export async function isCached(query: CensusQuery): Promise<{
  cached: boolean;
  remainingTtl?: number;
  cacheKey?: string;
}> {
  if (!cacheAvailable) {
    return { cached: false };
  }

  try {
    const cacheKey = generateCacheKey(query);
    const ttl = await Promise.race([
      redis.ttl(CACHE_CONFIG.KEY_PREFIX + cacheKey),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Cache timeout')), 1000)
      )
    ]);

    return {
      cached: ttl > 0,
      remainingTtl: ttl > 0 ? ttl : undefined,
      cacheKey
    };
  } catch (error) {
    console.warn('Error checking cache status:', error instanceof Error ? error.message : 'Unknown error');
    return { cached: false };
  }
}

/**
 * Invalidate cache for specific query or pattern
 */
export async function invalidateCache(pattern?: string): Promise<number> {
  if (!cacheAvailable) {
    return 0;
  }

  try {
    const searchPattern = pattern
      ? CACHE_CONFIG.KEY_PREFIX + pattern
      : CACHE_CONFIG.KEY_PREFIX + '*';

    const keys = await redis.keys(searchPattern);

    if (keys.length === 0) {
      return 0;
    }

    const deletedCount = await redis.del(...keys);
    console.log(`🗑️  Invalidated ${deletedCount} cache entries`);
    return deletedCount;
  } catch (error) {
    console.warn('Error invalidating cache:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  available: boolean;
  totalKeys: number;
  totalMemory?: string;
  hitRate?: number;
  cacheKeys: Array<{
    key: string;
    ttl: number;
    size?: number;
    age?: number;
  }>;
}> {
  if (!cacheAvailable) {
    return {
      available: false,
      totalKeys: 0,
      cacheKeys: []
    };
  }

  try {
    // Get all cache keys
    const keys = await redis.keys(CACHE_CONFIG.KEY_PREFIX + '*');

    const cacheKeys = [];

    // Get details for each key
    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      keys.forEach(key => {
        pipeline.ttl(key);
        pipeline.memory('usage', key);
      });

      const results = await pipeline.exec();

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i].replace(CACHE_CONFIG.KEY_PREFIX, '');
        const ttl = (results[i * 2]?.[1] as number) || -1;
        const memory = (results[i * 2 + 1]?.[1] as number) || 0;

        cacheKeys.push({
          key,
          ttl,
          size: memory,
          age: ttl > 0 ? CACHE_CONFIG.DEFAULT_TTL - ttl : undefined
        });
      }
    }

    return {
      available: true,
      totalKeys: keys.length,
      cacheKeys: cacheKeys.sort((a, b) => (b.age || 0) - (a.age || 0)) // Sort by age descending
    };
  } catch (error) {
    console.warn('Error getting cache stats:', error instanceof Error ? error.message : 'Unknown error');
    return {
      available: false,
      totalKeys: 0,
      cacheKeys: []
    };
  }
}

/**
 * Warm cache with frequently accessed data
 */
export async function warmCache(): Promise<void> {
  if (!cacheAvailable) {
    console.warn('Redis cache not available, skipping cache warming');
    return;
  }

  console.log('🔥 Starting cache warming with common queries...');

  // This would typically be called with common queries
  // For now, just log that warming is available
  console.log('✅ Cache warming feature ready (implement with common Census queries)');
}

/**
 * Clean expired cache entries
 */
export async function cleanExpiredCache(): Promise<number> {
  if (!cacheAvailable) {
    return 0;
  }

  try {
    // Get all cache keys
    const keys = await redis.keys(CACHE_CONFIG.KEY_PREFIX + '*');

    if (keys.length === 0) {
      return 0;
    }

    // Check TTL for each key and remove expired ones
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.ttl(key);
    });

    const ttlResults = await pipeline.exec();
    const expiredKeys = [];

    for (let i = 0; i < keys.length; i++) {
      const ttl = (ttlResults[i]?.[1] as number) || -1;
      if (ttl === -2) { // -2 means key doesn't exist (expired)
        expiredKeys.push(keys[i]);
      }
    }

    if (expiredKeys.length > 0) {
      await redis.del(...expiredKeys);
      console.log(`🧹 Cleaned ${expiredKeys.length} expired cache entries`);
    }

    return expiredKeys.length;
  } catch (error) {
    console.warn('Error cleaning expired cache:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  redis.disconnect();
});

export { redis as cacheRedis };
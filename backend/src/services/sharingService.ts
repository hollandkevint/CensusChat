/**
 * Sharing Service - Query Result Sharing with Expiration
 * Allows users to create shareable links for query results
 */

import Redis from 'ioredis';
import { config } from '../config';
import crypto from 'crypto';

// Redis client for sharing (separate from cache)
const redis = new Redis({
  host: config.database.redis.host,
  port: config.database.redis.port,
  password: config.database.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 5000,
  keyPrefix: 'census_share:',
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 2000);
  }
});

let sharingAvailable = false;

redis.on('connect', () => {
  console.log('✅ Redis connected for sharing');
  sharingAvailable = true;
});

redis.on('error', (error) => {
  console.warn('⚠️  Redis sharing error:', error.message);
  sharingAvailable = false;
});

redis.on('close', () => {
  sharingAvailable = false;
});

redis.connect().catch((error) => {
  console.warn('⚠️  Redis sharing connection failed:', error.message);
  sharingAvailable = false;
});

/**
 * Expiration options for shared links
 */
export type ExpirationOption = '1h' | '24h' | '7d' | '30d' | 'never';

const EXPIRATION_SECONDS: Record<ExpirationOption, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
  'never': 31536000 * 10 // 10 years as "never"
};

/**
 * Shared query data structure
 */
export interface SharedQuery {
  id: string;
  queryText: string;
  queryResult: {
    sql?: string;
    data: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    executionTime?: number;
  };
  category?: 'healthcare' | 'marketing' | 'demographics' | 'geographic' | 'custom';
  createdAt: number;
  expiresAt: number;
  expirationOption: ExpirationOption;
  viewCount: number;
  createdBy?: string;
  title?: string;
  description?: string;
}

/**
 * Share creation result
 */
export interface ShareResult {
  success: boolean;
  shareId?: string;
  shareUrl?: string;
  expiresAt?: number;
  error?: string;
}

/**
 * Generate a unique share ID
 */
function generateShareId(): string {
  // Generate 8-byte random hex (16 characters)
  const randomPart = crypto.randomBytes(8).toString('hex');
  // Add timestamp component for uniqueness
  const timePart = Date.now().toString(36);
  return `${timePart}-${randomPart}`;
}

/**
 * Create a shareable link for query results
 */
export async function createShare(
  queryText: string,
  queryResult: SharedQuery['queryResult'],
  options: {
    expiration?: ExpirationOption;
    category?: SharedQuery['category'];
    title?: string;
    description?: string;
    createdBy?: string;
  } = {}
): Promise<ShareResult> {
  if (!sharingAvailable) {
    return {
      success: false,
      error: 'Sharing service unavailable'
    };
  }

  try {
    const shareId = generateShareId();
    const expiration = options.expiration || '7d';
    const ttlSeconds = EXPIRATION_SECONDS[expiration];
    const now = Date.now();

    const sharedQuery: SharedQuery = {
      id: shareId,
      queryText,
      queryResult,
      category: options.category,
      createdAt: now,
      expiresAt: now + (ttlSeconds * 1000),
      expirationOption: expiration,
      viewCount: 0,
      createdBy: options.createdBy,
      title: options.title,
      description: options.description
    };

    // Store in Redis with TTL
    await redis.setex(
      shareId,
      ttlSeconds,
      JSON.stringify(sharedQuery)
    );

    // Also add to user's shares list if createdBy is provided
    if (options.createdBy) {
      await redis.zadd(
        `user:${options.createdBy}:shares`,
        now,
        shareId
      );
    }

    console.log(`✅ Created share: ${shareId} (expires in ${expiration})`);

    return {
      success: true,
      shareId,
      shareUrl: `/share/${shareId}`,
      expiresAt: sharedQuery.expiresAt
    };
  } catch (error) {
    console.error('Error creating share:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Retrieve a shared query by ID
 */
export async function getShare(shareId: string): Promise<SharedQuery | null> {
  if (!sharingAvailable) {
    console.warn('Sharing service unavailable');
    return null;
  }

  try {
    const data = await redis.get(shareId);

    if (!data) {
      return null;
    }

    const sharedQuery: SharedQuery = JSON.parse(data);

    // Increment view count
    sharedQuery.viewCount += 1;
    await redis.setex(
      shareId,
      Math.floor((sharedQuery.expiresAt - Date.now()) / 1000),
      JSON.stringify(sharedQuery)
    );

    return sharedQuery;
  } catch (error) {
    console.error('Error retrieving share:', error);
    return null;
  }
}

/**
 * Get share metadata without incrementing view count
 */
export async function getShareMetadata(shareId: string): Promise<{
  exists: boolean;
  title?: string;
  category?: string;
  createdAt?: number;
  expiresAt?: number;
  viewCount?: number;
  rowCount?: number;
} | null> {
  if (!sharingAvailable) {
    return null;
  }

  try {
    const data = await redis.get(shareId);

    if (!data) {
      return { exists: false };
    }

    const sharedQuery: SharedQuery = JSON.parse(data);

    return {
      exists: true,
      title: sharedQuery.title,
      category: sharedQuery.category,
      createdAt: sharedQuery.createdAt,
      expiresAt: sharedQuery.expiresAt,
      viewCount: sharedQuery.viewCount,
      rowCount: sharedQuery.queryResult.rowCount
    };
  } catch (error) {
    console.error('Error retrieving share metadata:', error);
    return null;
  }
}

/**
 * Delete a share
 */
export async function deleteShare(
  shareId: string,
  userId?: string
): Promise<boolean> {
  if (!sharingAvailable) {
    return false;
  }

  try {
    // Get share to check ownership
    const data = await redis.get(shareId);

    if (!data) {
      return false;
    }

    const sharedQuery: SharedQuery = JSON.parse(data);

    // If userId provided, verify ownership
    if (userId && sharedQuery.createdBy !== userId) {
      console.warn(`Unauthorized delete attempt for share ${shareId}`);
      return false;
    }

    // Delete share
    await redis.del(shareId);

    // Remove from user's shares list
    if (sharedQuery.createdBy) {
      await redis.zrem(`user:${sharedQuery.createdBy}:shares`, shareId);
    }

    console.log(`✅ Deleted share: ${shareId}`);
    return true;
  } catch (error) {
    console.error('Error deleting share:', error);
    return false;
  }
}

/**
 * Update share expiration
 */
export async function updateShareExpiration(
  shareId: string,
  newExpiration: ExpirationOption,
  userId?: string
): Promise<ShareResult> {
  if (!sharingAvailable) {
    return {
      success: false,
      error: 'Sharing service unavailable'
    };
  }

  try {
    const data = await redis.get(shareId);

    if (!data) {
      return {
        success: false,
        error: 'Share not found'
      };
    }

    const sharedQuery: SharedQuery = JSON.parse(data);

    // If userId provided, verify ownership
    if (userId && sharedQuery.createdBy !== userId) {
      return {
        success: false,
        error: 'Not authorized to modify this share'
      };
    }

    const ttlSeconds = EXPIRATION_SECONDS[newExpiration];
    const now = Date.now();

    sharedQuery.expiresAt = now + (ttlSeconds * 1000);
    sharedQuery.expirationOption = newExpiration;

    await redis.setex(
      shareId,
      ttlSeconds,
      JSON.stringify(sharedQuery)
    );

    return {
      success: true,
      shareId,
      expiresAt: sharedQuery.expiresAt
    };
  } catch (error) {
    console.error('Error updating share expiration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all shares for a user
 */
export async function getUserShares(
  userId: string,
  limit: number = 50
): Promise<SharedQuery[]> {
  if (!sharingAvailable) {
    return [];
  }

  try {
    // Get share IDs sorted by creation time (newest first)
    const shareIds = await redis.zrevrange(
      `user:${userId}:shares`,
      0,
      limit - 1
    );

    if (shareIds.length === 0) {
      return [];
    }

    // Get all share data
    const pipeline = redis.pipeline();
    shareIds.forEach(id => pipeline.get(id));
    const results = await pipeline.exec();

    const shares: SharedQuery[] = [];
    const expiredIds: string[] = [];

    results?.forEach((result, index) => {
      if (result[1]) {
        try {
          const share: SharedQuery = JSON.parse(result[1] as string);
          shares.push(share);
        } catch {
          // Invalid data, mark for cleanup
          expiredIds.push(shareIds[index]);
        }
      } else {
        // Share expired or deleted
        expiredIds.push(shareIds[index]);
      }
    });

    // Clean up expired references
    if (expiredIds.length > 0) {
      await redis.zrem(`user:${userId}:shares`, ...expiredIds);
    }

    return shares;
  } catch (error) {
    console.error('Error getting user shares:', error);
    return [];
  }
}

/**
 * Get sharing statistics
 */
export async function getSharingStats(): Promise<{
  available: boolean;
  totalShares: number;
  recentShares: number; // Last 24 hours
}> {
  if (!sharingAvailable) {
    return {
      available: false,
      totalShares: 0,
      recentShares: 0
    };
  }

  try {
    // Get all share keys
    const keys = await redis.keys('*');
    const shareKeys = keys.filter(k => !k.includes(':') && k.includes('-'));

    // Count recent shares
    const oneDayAgo = Date.now() - 86400000;
    let recentCount = 0;

    const pipeline = redis.pipeline();
    shareKeys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();

    results?.forEach(result => {
      if (result[1]) {
        try {
          const share: SharedQuery = JSON.parse(result[1] as string);
          if (share.createdAt > oneDayAgo) {
            recentCount++;
          }
        } catch {
          // Invalid data, skip
        }
      }
    });

    return {
      available: true,
      totalShares: shareKeys.length,
      recentShares: recentCount
    };
  } catch (error) {
    console.error('Error getting sharing stats:', error);
    return {
      available: false,
      totalShares: 0,
      recentShares: 0
    };
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  redis.disconnect();
});

export { sharingAvailable };

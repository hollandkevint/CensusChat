/**
 * Query Optimizer - Performance optimization for healthcare analytics queries
 * Implements intelligent caching, connection pooling, and sub-2 second response targets
 */

import { LRUCache } from 'lru-cache';
import { QueryTranslationPattern, FederatedQueryResult, PerformanceMetrics } from '../types/HealthcareAnalyticsTypes';
import { getDuckDBPool } from '../../../utils/duckdbPool';
import crypto from 'crypto';

export interface QueryCacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate: number; // Serve stale data while fetching fresh
  compressionThreshold: number; // Compress results larger than this size
}

export interface QueryOptimizationResult {
  data: any[];
  cached: boolean;
  executionTime: number;
  cacheKey?: string;
  optimizationApplied: string[];
}

export interface QueryPerformanceProfile {
  pattern: string;
  avgExecutionTime: number;
  hitRate: number;
  lastOptimized: Date;
  optimizations: string[];
}

export class QueryOptimizer {
  private cache: LRUCache<string, {
    result: FederatedQueryResult;
    timestamp: number;
    compressed: boolean;
    hitCount: number;
  }>;
  private performanceProfiles: Map<string, QueryPerformanceProfile> = new Map();
  private config: QueryCacheConfig;
  private compressionEnabled: boolean;

  constructor(config: Partial<QueryCacheConfig> = {}) {
    this.config = {
      maxSize: 1000, // Cache up to 1000 queries
      ttl: 300000, // 5 minutes default TTL
      staleWhileRevalidate: 60000, // 1 minute stale-while-revalidate
      compressionThreshold: 100000, // 100KB compression threshold
      ...config
    };

    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      allowStaleOnFetchRejection: true,
      allowStaleOnFetchAbort: true,
      fetchMethod: async (key: string) => {
        console.log(`🔄 Cache miss for key: ${key.substring(0, 20)}...`);
        return null; // Will be handled by the calling function
      }
    });

    this.compressionEnabled = this.isCompressionAvailable();
    console.log('🚀 Query Optimizer initialized with caching and performance profiling');
  }

  /**
   * Generate a cache key based on query pattern and parameters
   */
  private generateCacheKey(pattern: QueryTranslationPattern): string {
    const keyData = {
      intent: pattern.intent,
      geography: pattern.entities.geography?.sort(),
      metrics: pattern.entities.metrics?.sort(),
      timeframe: pattern.entities.timeframe,
      sqlPattern: pattern.sqlPattern,
      parameters: pattern.parameters
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);

    return `healthcare_analytics_${hash}`;
  }

  /**
   * Optimize SQL query for sub-2 second execution
   */
  private optimizeSQL(pattern: QueryTranslationPattern): string {
    let optimizedSQL = pattern.sqlPattern;
    const optimizations: string[] = [];

    // Add LIMIT clause for large result sets
    if (!optimizedSQL.toLowerCase().includes('limit')) {
      optimizedSQL += ' LIMIT 10000';
      optimizations.push('result_limit');
    }

    // Add specific indexes hint for healthcare patterns
    if (pattern.intent === 'healthcare_analytics') {
      // DuckDB-specific optimizations
      if (optimizedSQL.toLowerCase().includes('where')) {
        // Ensure geographic filters use indexes
        optimizedSQL = optimizedSQL.replace(
          /WHERE\s+/gi,
          'WHERE /*+ INDEX(geography_idx) */ '
        );
        optimizations.push('geographic_index_hint');
      }

      // Optimize aggregation queries
      if (optimizedSQL.toLowerCase().includes('group by')) {
        // Use parallel processing for aggregations
        optimizedSQL = `SET threads=4; ${optimizedSQL}`;
        optimizations.push('parallel_aggregation');
      }
    }

    // Memory optimization for large datasets
    if (optimizedSQL.toLowerCase().includes('join')) {
      optimizedSQL = `SET memory_limit='2GB'; ${optimizedSQL}`;
      optimizations.push('memory_optimization');
    }

    return optimizedSQL;
  }

  /**
   * Check if data compression is available
   */
  private isCompressionAvailable(): boolean {
    try {
      require('zlib');
      return true;
    } catch (error) {
      console.warn('⚠️ Compression not available, using uncompressed cache');
      return false;
    }
  }

  /**
   * Compress large result sets
   */
  private compressData(data: any): Buffer | any {
    if (!this.compressionEnabled) return data;

    const serialized = JSON.stringify(data);
    if (serialized.length < this.config.compressionThreshold) {
      return data; // Don't compress small data
    }

    const zlib = require('zlib');
    return zlib.gzipSync(Buffer.from(serialized, 'utf8'));
  }

  /**
   * Decompress cached data
   */
  private decompressData(data: any, compressed: boolean): any {
    if (!compressed || !this.compressionEnabled) return data;

    try {
      const zlib = require('zlib');
      const decompressed = zlib.gunzipSync(data);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      console.error('❌ Failed to decompress cached data:', error);
      return null;
    }
  }

  /**
   * Execute optimized query with caching
   */
  async executeOptimizedQuery(
    pattern: QueryTranslationPattern,
    executeFunction: (optimizedPattern: QueryTranslationPattern) => Promise<FederatedQueryResult>
  ): Promise<QueryOptimizationResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(pattern);
    const optimizations: string[] = [];

    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry) {
      const age = Date.now() - cachedEntry.timestamp;
      const isStale = age > this.config.ttl;

      if (!isStale || age < (this.config.ttl + this.config.staleWhileRevalidate)) {
        // Update hit count
        cachedEntry.hitCount++;

        // Decompress if needed
        const result = this.decompressData(cachedEntry.result, cachedEntry.compressed);

        if (result) {
          console.log(`💨 Cache hit for healthcare analytics query (age: ${age}ms)`);

          // Update performance profile
          this.updatePerformanceProfile(pattern, Date.now() - startTime, true);

          return {
            data: result.data,
            cached: true,
            executionTime: Date.now() - startTime,
            cacheKey,
            optimizationApplied: ['cache_hit']
          };
        }
      }
    }

    // Cache miss or stale - execute query
    console.log(`🎯 Executing optimized healthcare analytics query`);

    // Apply SQL optimizations
    const optimizedSQL = this.optimizeSQL(pattern);
    const optimizedPattern = {
      ...pattern,
      sqlPattern: optimizedSQL
    };

    if (optimizedSQL !== pattern.sqlPattern) {
      optimizations.push('sql_optimization');
    }

    try {
      // Execute with optimization
      const result = await executeFunction(optimizedPattern);
      const executionTime = Date.now() - startTime;

      // Validate sub-2 second requirement
      if (executionTime > 2000) {
        console.warn(`⚠️ Query exceeded 2s target: ${executionTime}ms`);
        optimizations.push('performance_warning');
      } else {
        console.log(`⚡ Query completed in ${executionTime}ms (under 2s target)`);
        optimizations.push('sub_2s_performance');
      }

      // Cache the result
      const compressed = this.compressionEnabled &&
        JSON.stringify(result).length > this.config.compressionThreshold;

      const cacheEntry = {
        result: compressed ? this.compressData(result) : result,
        timestamp: Date.now(),
        compressed,
        hitCount: 0
      };

      this.cache.set(cacheKey, cacheEntry);

      if (compressed) {
        optimizations.push('compression');
      }

      // Update performance profile
      this.updatePerformanceProfile(pattern, executionTime, false);

      return {
        data: result.data,
        cached: false,
        executionTime,
        cacheKey,
        optimizationApplied: optimizations
      };

    } catch (error) {
      console.error('❌ Optimized query execution failed:', error);
      throw error;
    }
  }

  /**
   * Update performance profile for query pattern
   */
  private updatePerformanceProfile(
    pattern: QueryTranslationPattern,
    executionTime: number,
    cached: boolean
  ): void {
    const profileKey = `${pattern.intent}_${pattern.entities.geography?.[0] || 'any'}`;
    const existing = this.performanceProfiles.get(profileKey);

    if (existing) {
      // Update moving average
      existing.avgExecutionTime = (existing.avgExecutionTime + executionTime) / 2;
      existing.hitRate = cached ?
        (existing.hitRate * 0.9 + 1 * 0.1) :
        (existing.hitRate * 0.9);
      existing.lastOptimized = new Date();
    } else {
      this.performanceProfiles.set(profileKey, {
        pattern: profileKey,
        avgExecutionTime: executionTime,
        hitRate: cached ? 1 : 0,
        lastOptimized: new Date(),
        optimizations: []
      });
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const cacheStats = {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRatio: 0
    };

    // Calculate overall hit ratio
    let totalHits = 0;
    let totalRequests = 0;

    for (const [key, entry] of this.cache.dump()) {
      totalHits += entry.value.hitCount;
      totalRequests += entry.value.hitCount + 1; // +1 for initial miss
    }

    cacheStats.hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0;

    const profiles = Array.from(this.performanceProfiles.values());
    const avgExecutionTime = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.avgExecutionTime, 0) / profiles.length
      : 0;

    return {
      cacheStats,
      avgExecutionTime,
      totalQueries: totalRequests,
      sub2sCompliance: profiles.filter(p => p.avgExecutionTime < 2000).length / Math.max(profiles.length, 1),
      performanceProfiles: profiles
    };
  }

  /**
   * Warm up cache with common healthcare queries
   */
  async warmupCache(
    commonPatterns: QueryTranslationPattern[],
    executeFunction: (pattern: QueryTranslationPattern) => Promise<FederatedQueryResult>
  ): Promise<void> {
    console.log(`🔥 Warming up cache with ${commonPatterns.length} common healthcare patterns`);

    const warmupPromises = commonPatterns.map(async (pattern) => {
      try {
        await this.executeOptimizedQuery(pattern, executeFunction);
        console.log(`✅ Warmed cache for pattern: ${pattern.intent}`);
      } catch (error) {
        console.warn(`⚠️ Failed to warm cache for pattern ${pattern.intent}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('🔥 Cache warmup completed');
  }

  /**
   * Clear cache and reset performance profiles
   */
  clearCache(): void {
    this.cache.clear();
    this.performanceProfiles.clear();
    console.log('🧹 Query cache and performance profiles cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
    compressionEnabled: boolean;
    oldestEntry?: Date;
  } {
    const metrics = this.getPerformanceMetrics();
    const dump = this.cache.dump();
    let oldestTimestamp = Date.now();

    for (const [key, entry] of dump) {
      if (entry.value.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.value.timestamp;
      }
    }

    return {
      size: metrics.cacheStats.size,
      maxSize: metrics.cacheStats.maxSize,
      hitRatio: metrics.cacheStats.hitRatio,
      compressionEnabled: this.compressionEnabled,
      oldestEntry: dump.length > 0 ? new Date(oldestTimestamp) : undefined
    };
  }

  /**
   * Optimize database connection pool usage
   */
  async optimizeConnectionPool(): Promise<void> {
    const pool = getDuckDBPool();
    const stats = pool.getStats();

    console.log('🏊 Current DuckDB pool stats:', stats);

    // Check if pool is healthy
    const healthy = await pool.healthCheck();
    if (!healthy) {
      console.warn('⚠️ DuckDB pool health check failed');
      return;
    }

    // Validate MCP extension is available
    const mcpValid = await pool.validateMCPExtension();
    if (!mcpValid) {
      console.warn('⚠️ MCP extension validation failed');
    }

    console.log('✅ Database connection pool optimization validated');
  }
}

// Singleton instance
let queryOptimizerInstance: QueryOptimizer | null = null;

export function getQueryOptimizer(config?: Partial<QueryCacheConfig>): QueryOptimizer {
  if (!queryOptimizerInstance) {
    queryOptimizerInstance = new QueryOptimizer(config);
  }
  return queryOptimizerInstance;
}

export function resetQueryOptimizer(): void {
  if (queryOptimizerInstance) {
    queryOptimizerInstance.clearCache();
    queryOptimizerInstance = null;
  }
}
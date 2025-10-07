/**
 * Performance Monitor - Real-time monitoring and alerting for healthcare analytics
 * Tracks query execution times, performance degradation, and system health
 */

import { EventEmitter } from 'events';
import { PerformanceMetrics, QueryTranslationPattern } from '../types/HealthcareAnalyticsTypes';

export interface PerformanceAlert {
  id: string;
  type: 'performance_degradation' | 'query_timeout' | 'cache_miss_spike' | 'system_health';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metrics: any;
  pattern?: QueryTranslationPattern;
}

export interface PerformanceThreshold {
  maxExecutionTime: number; // milliseconds
  maxCacheMissRate: number; // 0.0 to 1.0
  minCacheHitRate: number; // 0.0 to 1.0
  maxConcurrentQueries: number;
  alertCooldown: number; // milliseconds between similar alerts
}

export interface SystemHealthMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  dbPoolStats: {
    active: number;
    idle: number;
    waiting: number;
    total: number;
  };
  queryStats: {
    executing: number;
    completed: number;
    failed: number;
    avgResponseTime: number;
  };
  cacheStats: {
    hitRate: number;
    size: number;
    maxSize: number;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private alerts: PerformanceAlert[] = [];
  private metrics: Map<string, number[]> = new Map();
  private thresholds: PerformanceThreshold;
  private lastAlerts: Map<string, Date> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queryExecutions: Map<string, Date> = new Map();

  constructor(thresholds: Partial<PerformanceThreshold> = {}) {
    super();

    this.thresholds = {
      maxExecutionTime: 2000, // 2 seconds for sub-2s requirement
      maxCacheMissRate: 0.3, // 30% miss rate triggers alert
      minCacheHitRate: 0.7, // 70% minimum hit rate
      maxConcurrentQueries: 10,
      alertCooldown: 60000, // 1 minute between similar alerts
      ...thresholds
    };

    console.log('📊 Performance Monitor initialized with thresholds:', this.thresholds);
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('⚠️ Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    console.log(`🔍 Performance monitoring started (interval: ${intervalMs}ms)`);
    this.emit('monitoring_started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('⏹️ Performance monitoring stopped');
    this.emit('monitoring_stopped');
  }

  /**
   * Record query execution start
   */
  recordQueryStart(queryId: string, pattern: QueryTranslationPattern): void {
    this.queryExecutions.set(queryId, new Date());

    // Check concurrent query limits
    const concurrentCount = this.queryExecutions.size;
    if (concurrentCount > this.thresholds.maxConcurrentQueries) {
      this.triggerAlert({
        type: 'system_health',
        severity: 'warning',
        message: `High concurrent query count: ${concurrentCount} (max: ${this.thresholds.maxConcurrentQueries})`,
        metrics: { concurrentQueries: concurrentCount },
        pattern
      });
    }
  }

  /**
   * Record query execution completion
   */
  recordQueryCompletion(
    queryId: string,
    executionTime: number,
    pattern: QueryTranslationPattern,
    cached: boolean = false
  ): void {
    this.queryExecutions.delete(queryId);

    // Record execution time
    const patternKey = `${pattern.intent}_${pattern.entities.geography?.[0] || 'any'}`;
    if (!this.metrics.has(patternKey)) {
      this.metrics.set(patternKey, []);
    }

    const times = this.metrics.get(patternKey)!;
    times.push(executionTime);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }

    // Check performance thresholds
    if (executionTime > this.thresholds.maxExecutionTime) {
      this.triggerAlert({
        type: 'performance_degradation',
        severity: executionTime > this.thresholds.maxExecutionTime * 1.5 ? 'critical' : 'warning',
        message: `Query exceeded performance threshold: ${executionTime}ms (max: ${this.thresholds.maxExecutionTime}ms)`,
        metrics: { executionTime, threshold: this.thresholds.maxExecutionTime },
        pattern
      });
    }

    console.log(`📈 Query ${queryId} completed: ${executionTime}ms ${cached ? '(cached)' : '(fresh)'}`);
  }

  /**
   * Record query failure
   */
  recordQueryFailure(queryId: string, error: Error, pattern: QueryTranslationPattern): void {
    this.queryExecutions.delete(queryId);

    this.triggerAlert({
      type: 'query_timeout',
      severity: 'critical',
      message: `Query failed: ${error.message}`,
      metrics: { error: error.message },
      pattern
    });

    console.error(`❌ Query ${queryId} failed:`, error);
  }

  /**
   * Record cache metrics
   */
  recordCacheMetrics(hitRate: number, size: number, maxSize: number): void {
    const missRate = 1 - hitRate;

    // Check cache performance
    if (missRate > this.thresholds.maxCacheMissRate) {
      this.triggerAlert({
        type: 'cache_miss_spike',
        severity: 'warning',
        message: `High cache miss rate: ${(missRate * 100).toFixed(1)}% (max: ${(this.thresholds.maxCacheMissRate * 100).toFixed(1)}%)`,
        metrics: { hitRate, missRate, size, maxSize }
      });
    }

    if (hitRate < this.thresholds.minCacheHitRate) {
      this.triggerAlert({
        type: 'cache_miss_spike',
        severity: 'warning',
        message: `Low cache hit rate: ${(hitRate * 100).toFixed(1)}% (min: ${(this.thresholds.minCacheHitRate * 100).toFixed(1)}%)`,
        metrics: { hitRate, missRate, size, maxSize }
      });
    }
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alertKey = `${alertData.type}_${alertData.severity}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    const now = new Date();

    // Check cooldown period
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.thresholds.alertCooldown) {
      return; // Skip alert during cooldown
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      ...alertData
    };

    this.alerts.push(alert);
    this.lastAlerts.set(alertKey, now);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    console.warn(`🚨 Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    this.emit('alert', alert);
  }

  /**
   * Perform periodic health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthMetrics = await this.collectSystemHealth();

      // Check memory usage
      if (healthMetrics.memoryUsage.percentage > 85) {
        this.triggerAlert({
          type: 'system_health',
          severity: healthMetrics.memoryUsage.percentage > 95 ? 'critical' : 'warning',
          message: `High memory usage: ${healthMetrics.memoryUsage.percentage.toFixed(1)}%`,
          metrics: healthMetrics.memoryUsage
        });
      }

      // Check database pool health
      const poolUtil = (healthMetrics.dbPoolStats.active + healthMetrics.dbPoolStats.waiting) /
                      healthMetrics.dbPoolStats.total;
      if (poolUtil > 0.8) {
        this.triggerAlert({
          type: 'system_health',
          severity: poolUtil > 0.95 ? 'critical' : 'warning',
          message: `High database pool utilization: ${(poolUtil * 100).toFixed(1)}%`,
          metrics: healthMetrics.dbPoolStats
        });
      }

      this.emit('health_check', healthMetrics);

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Collect system health metrics
   */
  private async collectSystemHealth(): Promise<SystemHealthMetrics> {
    const memUsage = process.memoryUsage();

    // Get DuckDB pool stats
    const { getDuckDBPool } = require('../../../utils/duckdbPool');
    const pool = getDuckDBPool();
    const dbStats = pool.getStats();

    return {
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      dbPoolStats: {
        active: dbStats.activeConnections,
        idle: dbStats.idleConnections,
        waiting: dbStats.waitingRequests,
        total: dbStats.totalConnections
      },
      queryStats: {
        executing: this.queryExecutions.size,
        completed: this.getCompletedQueryCount(),
        failed: this.getFailedQueryCount(),
        avgResponseTime: this.getAverageResponseTime()
      },
      cacheStats: {
        hitRate: 0, // Will be updated by cache metrics
        size: 0,
        maxSize: 0
      }
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    alerts: PerformanceAlert[];
    metrics: PerformanceMetrics;
    health: 'healthy' | 'degraded' | 'critical';
    recommendations: string[];
  } {
    const recentAlerts = this.alerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = recentAlerts.filter(alert => alert.severity === 'warning');

    let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      health = 'critical';
    } else if (warningAlerts.length > 0) {
      health = 'degraded';
    }

    const recommendations = this.generateRecommendations(recentAlerts);

    return {
      alerts: recentAlerts,
      metrics: this.computeMetrics(),
      health,
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];
    const alertTypes = new Set(alerts.map(alert => alert.type));

    if (alertTypes.has('performance_degradation')) {
      recommendations.push('Consider optimizing SQL queries or increasing cache TTL');
      recommendations.push('Review query patterns for opportunities to use materialized views');
    }

    if (alertTypes.has('cache_miss_spike')) {
      recommendations.push('Increase cache size or implement cache warming strategies');
      recommendations.push('Review cache key generation for better reuse patterns');
    }

    if (alertTypes.has('system_health')) {
      recommendations.push('Monitor system resources and consider scaling database connections');
      recommendations.push('Implement query rate limiting during peak usage');
    }

    return recommendations;
  }

  /**
   * Compute current performance metrics
   */
  private computeMetrics(): PerformanceMetrics {
    const allTimes: number[] = [];
    Array.from(this.metrics.values()).forEach(times => allTimes.push(...times));

    const avgExecutionTime = allTimes.length > 0
      ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
      : 0;

    const sub2sCount = allTimes.filter(time => time < 2000).length;
    const sub2sCompliance = allTimes.length > 0 ? sub2sCount / allTimes.length : 1;

    return {
      cacheStats: {
        size: 0, // Updated externally
        maxSize: 0,
        hitRatio: 0
      },
      avgExecutionTime,
      totalQueries: allTimes.length,
      sub2sCompliance,
      performanceProfiles: Array.from(this.metrics.entries()).map(([pattern, times]) => ({
        pattern,
        avgExecutionTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        hitRate: 0, // Updated externally
        lastOptimized: new Date(),
        optimizations: []
      }))
    };
  }

  /**
   * Helper methods for query statistics
   */
  private getCompletedQueryCount(): number {
    return Array.from(this.metrics.values()).reduce((sum, times) => sum + times.length, 0);
  }

  private getFailedQueryCount(): number {
    return this.alerts.filter(alert => alert.type === 'query_timeout').length;
  }

  private getAverageResponseTime(): number {
    const allTimes: number[] = [];
    Array.from(this.metrics.values()).forEach(times => allTimes.push(...times));
    return allTimes.length > 0
      ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
      : 0;
  }

  /**
   * Get alerts by severity
   */
  getAlerts(severity?: 'warning' | 'critical'): PerformanceAlert[] {
    return severity
      ? this.alerts.filter(alert => alert.severity === severity)
      : [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  clearAlerts(olderThanMs: number = 3600000): number {
    const cutoff = Date.now() - olderThanMs;
    const initialCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);

    const cleared = initialCount - this.alerts.length;
    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} old performance alerts`);
    }

    return cleared;
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: Date;
    summary: any;
    alerts: PerformanceAlert[];
    systemHealth: SystemHealthMetrics | null;
  } {
    return {
      timestamp: new Date(),
      summary: this.getPerformanceSummary(),
      alerts: this.getAlerts(),
      systemHealth: null // Will be populated by health check
    };
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(thresholds?: Partial<PerformanceThreshold>): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(thresholds);
  }
  return performanceMonitorInstance;
}

export function resetPerformanceMonitor(): void {
  if (performanceMonitorInstance) {
    performanceMonitorInstance.stopMonitoring();
    performanceMonitorInstance = null;
  }
}
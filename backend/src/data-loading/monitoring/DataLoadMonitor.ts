import { EventEmitter } from 'events';
import { 
  LoadingConfiguration, 
  LoadingMetrics, 
  LoadingProgress, 
  LoadingError,
  LoadingJob,
  DataLoadResult 
} from '../utils/LoadingTypes';

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    apiUsage: number;
    memoryUsage: number;
    slowJobDuration: number;
    queueDepth: number;
  };
  notificationChannels: {
    console: boolean;
    email?: string;
    webhook?: string;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  issues: HealthIssue[];
  lastChecked: Date;
}

export interface HealthIssue {
  type: 'performance' | 'error_rate' | 'resource' | 'api_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  suggestion: string;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  jobsPerMinute: number;
  recordsPerSecond: number;
  averageJobDuration: number;
  errorRate: number;
  apiCallsUsed: number;
  memoryUsage: number;
  queueDepth: number;
}

export class DataLoadMonitor extends EventEmitter {
  private config: LoadingConfiguration;
  private alertConfig: AlertConfig;
  
  // Metrics tracking
  private metrics: LoadingMetrics = {
    totalJobsProcessed: 0,
    totalRecordsLoaded: 0,
    totalApiCalls: 0,
    averageRecordsPerSecond: 0,
    dataQualityScore: 1.0,
    uptime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    databasePerformance: {
      insertRate: 0,
      queryResponseTime: 0,
      connectionPoolUsage: 0
    }
  };
  
  // Performance history
  private performanceHistory: PerformanceSnapshot[] = [];
  private maxHistorySize: number = 1440; // 24 hours of minute snapshots
  
  // Job tracking
  private jobStartTimes: Map<string, Date> = new Map();
  private completedJobs: DataLoadResult[] = [];
  private failedJobs: LoadingError[] = [];
  private slowJobs: Array<{ jobId: string; duration: number; threshold: number }> = [];
  
  // System health
  private monitoringStartTime: Date;
  private lastHealthCheck: Date = new Date();
  private currentHealth: SystemHealth = {
    status: 'healthy',
    score: 100,
    issues: [],
    lastChecked: new Date()
  };
  
  // Monitoring intervals
  private metricsInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;
  private alertInterval?: NodeJS.Timeout;

  constructor(config: LoadingConfiguration) {
    super();
    this.config = config;
    this.monitoringStartTime = new Date();
    
    this.alertConfig = {
      enabled: true,
      thresholds: {
        errorRate: config.monitoring.alertThresholds.errorRate,
        apiUsage: config.monitoring.alertThresholds.apiUsage,
        memoryUsage: config.monitoring.alertThresholds.memoryUsage,
        slowJobDuration: 300000, // 5 minutes
        queueDepth: 100
      },
      notificationChannels: {
        console: true
      }
    };
    
    this.startMonitoring();
    console.log('DataLoadMonitor initialized and monitoring started');
  }

  /**
   * Record job start
   */
  recordJobStart(job: LoadingJob): void {
    this.jobStartTimes.set(job.id, new Date());
    this.emit('job_started', { job, timestamp: new Date() });
  }

  /**
   * Record job completion
   */
  recordJobCompletion(result: DataLoadResult): void {
    const startTime = this.jobStartTimes.get(result.jobId);
    if (startTime) {
      const duration = Date.now() - startTime.getTime();
      
      // Check for slow jobs
      if (duration > this.alertConfig.thresholds.slowJobDuration) {
        this.slowJobs.push({
          jobId: result.jobId,
          duration,
          threshold: this.alertConfig.thresholds.slowJobDuration
        });
        
        this.emitAlert('performance', 'medium', 
          `Job ${result.jobId} took ${Math.round(duration/1000)}s (threshold: ${this.alertConfig.thresholds.slowJobDuration/1000}s)`);
      }
      
      this.jobStartTimes.delete(result.jobId);
    }
    
    this.completedJobs.push(result);
    this.updateMetrics();
    
    this.emit('job_completed', { result, timestamp: new Date() });
  }

  /**
   * Record job failure
   */
  recordJobFailure(error: LoadingError): void {
    const startTime = this.jobStartTimes.get(error.jobId);
    if (startTime) {
      this.jobStartTimes.delete(error.jobId);
    }
    
    this.failedJobs.push(error);
    this.updateMetrics();
    
    // Check error rate threshold
    const recentErrorRate = this.calculateRecentErrorRate();
    if (recentErrorRate > this.alertConfig.thresholds.errorRate) {
      this.emitAlert('error_rate', 'high', 
        `Error rate ${(recentErrorRate * 100).toFixed(1)}% exceeds threshold ${(this.alertConfig.thresholds.errorRate * 100).toFixed(1)}%`);
    }
    
    this.emit('job_failed', { error, timestamp: new Date() });
  }

  /**
   * Record API call usage
   */
  recordApiCall(callCount: number = 1): void {
    this.metrics.totalApiCalls += callCount;
    
    // Check API usage threshold
    const usageRatio = this.metrics.totalApiCalls / this.config.apiRateLimit.dailyLimit;
    if (usageRatio > this.alertConfig.thresholds.apiUsage) {
      this.emitAlert('api_limit', 'high', 
        `API usage ${(usageRatio * 100).toFixed(1)}% exceeds threshold ${(this.alertConfig.thresholds.apiUsage * 100).toFixed(1)}%`);
    }
    
    this.updateMetrics();
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): LoadingMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get system health
   */
  getSystemHealth(): SystemHealth {
    this.checkSystemHealth();
    return { ...this.currentHealth };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(hours: number = 1): PerformanceSnapshot[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(snapshot => snapshot.timestamp >= cutoffTime);
  }

  /**
   * Get recent job failures
   */
  getRecentFailures(minutes: number = 60): LoadingError[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.failedJobs.filter(error => error.timestamp >= cutoffTime);
  }

  /**
   * Get slow jobs
   */
  getSlowJobs(): Array<{ jobId: string; duration: number; threshold: number }> {
    return [...this.slowJobs];
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: {
      totalJobs: number;
      successRate: number;
      averageDuration: number;
      throughput: number;
    };
    trends: {
      errorRateTrend: 'improving' | 'stable' | 'worsening';
      throughputTrend: 'improving' | 'stable' | 'declining';
      performanceTrend: 'improving' | 'stable' | 'declining';
    };
    recommendations: string[];
  } {
    const totalJobs = this.completedJobs.length + this.failedJobs.length;
    const successRate = totalJobs > 0 ? this.completedJobs.length / totalJobs : 1;
    
    const averageDuration = this.completedJobs.length > 0 
      ? this.completedJobs.reduce((sum, job) => sum + job.duration, 0) / this.completedJobs.length
      : 0;
    
    const uptime = Date.now() - this.monitoringStartTime.getTime();
    const throughput = uptime > 0 ? (totalJobs / (uptime / 60000)) : 0; // jobs per minute
    
    // Analyze trends (simplified)
    const recentHistory = this.getPerformanceHistory(1);
    const errorRateTrend = this.analyzeTrend(recentHistory.map(h => h.errorRate));
    const throughputTrend = this.analyzeTrend(recentHistory.map(h => h.jobsPerMinute));
    const performanceTrend = this.analyzeTrend(recentHistory.map(h => h.averageJobDuration), true); // Inverted - lower is better
    
    const recommendations = this.generateRecommendations();
    
    return {
      summary: {
        totalJobs,
        successRate,
        averageDuration,
        throughput
      },
      trends: {
        errorRateTrend,
        throughputTrend,
        performanceTrend
      },
      recommendations
    };
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }
    
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = undefined;
    }
    
    console.log('DataLoadMonitor stopped');
  }

  // Private methods

  private startMonitoring(): void {
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);
    
    // Start health checks
    this.healthInterval = setInterval(() => {
      this.checkSystemHealth();
    }, 60000); // Every minute
    
    // Start periodic cleanup
    this.alertInterval = setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  private collectMetrics(): void {
    const now = new Date();
    const uptime = now.getTime() - this.monitoringStartTime.getTime();
    
    // Calculate current performance metrics
    const recentMinute = this.getRecentJobsInTimeWindow(60000); // Last minute
    const jobsPerMinute = recentMinute.length;
    const recordsPerSecond = this.calculateRecordsPerSecond();
    
    // Create performance snapshot
    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      jobsPerMinute,
      recordsPerSecond,
      averageJobDuration: this.calculateAverageJobDuration(),
      errorRate: this.calculateRecentErrorRate(),
      apiCallsUsed: this.metrics.totalApiCalls,
      memoryUsage: this.getMemoryUsage(),
      queueDepth: 0 // Would be provided by external queue manager
    };
    
    this.performanceHistory.push(snapshot);
    
    // Trim history to max size
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }
    
    this.emit('metrics_collected', { metrics: this.metrics, snapshot });
  }

  private updateMetrics(): void {
    const now = new Date();
    const uptime = now.getTime() - this.monitoringStartTime.getTime();
    
    this.metrics = {
      totalJobsProcessed: this.completedJobs.length,
      totalRecordsLoaded: this.completedJobs.reduce((sum, job) => sum + job.recordsLoaded, 0),
      totalApiCalls: this.metrics.totalApiCalls,
      averageRecordsPerSecond: this.calculateRecordsPerSecond(),
      dataQualityScore: this.calculateDataQualityScore(),
      uptime: uptime,
      errorRate: this.calculateRecentErrorRate(),
      cacheHitRate: 0, // Would be calculated based on cache statistics
      databasePerformance: {
        insertRate: this.calculateInsertRate(),
        queryResponseTime: 0, // Would be measured
        connectionPoolUsage: 0 // Would be provided by connection pool
      }
    };
  }

  private checkSystemHealth(): void {
    const issues: HealthIssue[] = [];
    let score = 100;
    
    // Check error rate
    const errorRate = this.calculateRecentErrorRate();
    if (errorRate > this.alertConfig.thresholds.errorRate) {
      const severity = errorRate > this.alertConfig.thresholds.errorRate * 2 ? 'high' : 'medium';
      issues.push({
        type: 'error_rate',
        severity,
        message: `High error rate detected`,
        metric: 'error_rate',
        currentValue: errorRate,
        threshold: this.alertConfig.thresholds.errorRate,
        suggestion: 'Review recent failures and adjust retry logic'
      });
      score -= errorRate > this.alertConfig.thresholds.errorRate * 2 ? 20 : 10;
    }
    
    // Check API usage
    const apiUsage = this.metrics.totalApiCalls / this.config.apiRateLimit.dailyLimit;
    if (apiUsage > this.alertConfig.thresholds.apiUsage) {
      issues.push({
        type: 'api_limit',
        severity: apiUsage > 0.95 ? 'critical' : 'medium',
        message: `API usage approaching limit`,
        metric: 'api_usage',
        currentValue: apiUsage,
        threshold: this.alertConfig.thresholds.apiUsage,
        suggestion: 'Consider pausing non-critical jobs or implement API key'
      });
      score -= apiUsage > 0.95 ? 25 : 15;
    }
    
    // Check memory usage
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > this.alertConfig.thresholds.memoryUsage) {
      issues.push({
        type: 'resource',
        severity: memoryUsage > 0.9 ? 'high' : 'medium',
        message: `High memory usage detected`,
        metric: 'memory_usage',
        currentValue: memoryUsage,
        threshold: this.alertConfig.thresholds.memoryUsage,
        suggestion: 'Consider reducing batch sizes or implementing cleanup'
      });
      score -= memoryUsage > 0.9 ? 15 : 10;
    }
    
    // Check for slow jobs
    const recentSlowJobs = this.slowJobs.filter(job => 
      Date.now() - new Date(job.jobId.split('_')[1]).getTime() < 300000 // Last 5 minutes
    );
    
    if (recentSlowJobs.length > 0) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: `${recentSlowJobs.length} slow jobs detected`,
        metric: 'job_duration',
        currentValue: recentSlowJobs.length,
        threshold: 0,
        suggestion: 'Review job complexity and consider breaking into smaller chunks'
      });
      score -= 10;
    }
    
    // Determine overall status
    let status: SystemHealth['status'] = 'healthy';
    if (score < 70) {
      status = 'critical';
    } else if (score < 85) {
      status = 'warning';
    }
    
    this.currentHealth = {
      status,
      score: Math.max(0, score),
      issues,
      lastChecked: new Date()
    };
    
    if (issues.length > 0) {
      this.emit('health_warning', this.currentHealth);
    }
  }

  // Helper methods

  private calculateRecentErrorRate(windowMs: number = 300000): number {
    const cutoffTime = new Date(Date.now() - windowMs);
    const recentCompleted = this.completedJobs.filter(job => 
      new Date(job.jobId.split('_')[1]) >= cutoffTime
    ).length;
    const recentFailed = this.failedJobs.filter(error => 
      error.timestamp >= cutoffTime
    ).length;
    
    const total = recentCompleted + recentFailed;
    return total > 0 ? recentFailed / total : 0;
  }

  private calculateRecordsPerSecond(): number {
    const uptime = Date.now() - this.monitoringStartTime.getTime();
    const totalRecords = this.metrics.totalRecordsLoaded;
    return uptime > 0 ? totalRecords / (uptime / 1000) : 0;
  }

  private calculateAverageJobDuration(): number {
    if (this.completedJobs.length === 0) return 0;
    return this.completedJobs.reduce((sum, job) => sum + job.duration, 0) / this.completedJobs.length;
  }

  private calculateDataQualityScore(): number {
    if (this.completedJobs.length === 0) return 1.0;
    
    const totalScore = this.completedJobs.reduce((sum, job) => {
      const quality = job.metadata.dataQuality;
      return sum + (quality.completeness * 0.4 + quality.accuracy * 0.4 + quality.consistency * 0.2);
    }, 0);
    
    return totalScore / this.completedJobs.length;
  }

  private calculateInsertRate(): number {
    const recentJobs = this.getRecentJobsInTimeWindow(300000); // Last 5 minutes
    if (recentJobs.length === 0) return 0;
    
    const totalRecords = recentJobs.reduce((sum, job) => sum + job.recordsLoaded, 0);
    return totalRecords / 300; // Records per second over 5 minutes
  }

  private getRecentJobsInTimeWindow(windowMs: number): DataLoadResult[] {
    const cutoffTime = new Date(Date.now() - windowMs);
    return this.completedJobs.filter(job => 
      new Date(job.jobId.split('_')[1]) >= cutoffTime
    );
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    const totalMem = usage.heapTotal + usage.external;
    const maxMem = 1024 * 1024 * 1024; // Assume 1GB max (would be configurable)
    return Math.min(1, totalMem / maxMem);
  }

  private analyzeTrend(values: number[], inverted: boolean = false): 'improving' | 'stable' | 'worsening' | 'declining' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-Math.min(10, values.length));
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const older = values.slice(0, Math.max(1, values.length - 10));
    const olderAverage = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = (average - olderAverage) / Math.max(olderAverage, 0.001);
    const threshold = 0.05; // 5% change threshold
    
    if (Math.abs(change) < threshold) return 'stable';
    
    if (inverted) {
      return change > 0 ? 'declining' : 'improving';
    } else {
      return change > 0 ? 'improving' : 'worsening';
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const health = this.currentHealth;
    
    health.issues.forEach(issue => {
      switch (issue.type) {
        case 'error_rate':
          recommendations.push('Review and improve error handling, consider implementing circuit breakers');
          break;
        case 'api_limit':
          recommendations.push('Implement API key for higher limits or optimize query patterns');
          break;
        case 'resource':
          recommendations.push('Optimize memory usage by reducing batch sizes or implementing data streaming');
          break;
        case 'performance':
          recommendations.push('Profile slow jobs and consider breaking them into smaller chunks');
          break;
      }
    });
    
    // General recommendations based on trends
    const report = this.generatePerformanceReport();
    if (report.trends.throughputTrend === 'declining') {
      recommendations.push('Consider increasing worker pool size or optimizing job processing');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private emitAlert(type: string, severity: string, message: string): void {
    const alert = {
      type,
      severity,
      message,
      timestamp: new Date()
    };
    
    if (this.alertConfig.notificationChannels.console) {
      const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📊';
      console.log(`${emoji} ALERT [${severity.toUpperCase()}]: ${message}`);
    }
    
    this.emit('alert', alert);
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean up old completed jobs (keep failures longer for analysis)
    this.completedJobs = this.completedJobs.filter(job => 
      new Date(job.jobId.split('_')[1]) >= cutoffTime
    );
    
    // Clean up old slow jobs
    this.slowJobs = this.slowJobs.filter(job => 
      Date.now() - new Date(job.jobId.split('_')[1]).getTime() < 3600000 // Last hour
    );
    
    // Clean up old job start times
    for (const [jobId, startTime] of this.jobStartTimes.entries()) {
      if (startTime < cutoffTime) {
        this.jobStartTimes.delete(jobId);
      }
    }
  }
}
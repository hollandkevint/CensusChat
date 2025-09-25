export interface MCPOperationMetrics {
  operationName: string;
  client: string;
  tool?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  correlationId: string;
}

export interface MCPAggregateMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  operationsPerSecond: number;
  errorRate: number;
  lastUpdated: Date;
}

export class MCPMonitoring {
  private metrics: MCPOperationMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k operations
  private readonly cleanupInterval = 300000; // Cleanup every 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log('📊 MCP Monitoring initialized');
    this.startCleanup();
  }

  /**
   * Generate a unique correlation ID for request tracing
   */
  generateCorrelationId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record the start of an MCP operation
   */
  startOperation(operationName: string, client: string, tool?: string): string {
    const correlationId = this.generateCorrelationId();

    const metric: MCPOperationMetrics = {
      operationName,
      client,
      tool,
      startTime: Date.now(),
      success: false,
      timestamp: new Date(),
      correlationId
    };

    this.metrics.push(metric);
    console.log(`📈 MCP Operation started [${correlationId}]: ${operationName} on ${client}${tool ? `.${tool}` : ''}`);

    return correlationId;
  }

  /**
   * Record the completion of an MCP operation
   */
  completeOperation(correlationId: string, success: boolean, error?: string): void {
    const metric = this.metrics.find(m => m.correlationId === correlationId);

    if (!metric) {
      console.warn(`⚠️ MCP Monitoring: Correlation ID ${correlationId} not found`);
      return;
    }

    const now = Date.now();
    metric.endTime = now;
    metric.duration = now - metric.startTime;
    metric.success = success;
    metric.error = error;

    const status = success ? '✅' : '❌';
    const errorText = error ? ` (${error})` : '';
    console.log(`📈 MCP Operation completed [${correlationId}]: ${status} ${metric.duration}ms${errorText}`);

    // Alert on slow operations (>2000ms)
    if (metric.duration > 2000) {
      console.warn(`🐌 Slow MCP operation detected [${correlationId}]: ${metric.duration}ms for ${metric.operationName}`);
    }

    // Alert on high error rates
    this.checkErrorRate();
  }

  /**
   * Get current aggregate metrics
   */
  getAggregateMetrics(): MCPAggregateMetrics {
    const completedMetrics = this.metrics.filter(m => m.duration !== undefined);

    if (completedMetrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        operationsPerSecond: 0,
        errorRate: 0,
        lastUpdated: new Date()
      };
    }

    const durations = completedMetrics.map(m => m.duration!);
    const successful = completedMetrics.filter(m => m.success);
    const failed = completedMetrics.filter(m => !m.success);

    // Calculate operations per second for last 60 seconds
    const oneMinuteAgo = Date.now() - 60000;
    const recentOps = completedMetrics.filter(m => m.startTime > oneMinuteAgo);

    return {
      totalOperations: completedMetrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageLatency: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxLatency: Math.max(...durations),
      minLatency: Math.min(...durations),
      operationsPerSecond: recentOps.length / 60,
      errorRate: (failed.length / completedMetrics.length) * 100,
      lastUpdated: new Date()
    };
  }

  /**
   * Get metrics by client
   */
  getMetricsByClient(client: string): MCPOperationMetrics[] {
    return this.metrics.filter(m => m.client === client);
  }

  /**
   * Get metrics by operation type
   */
  getMetricsByOperation(operationName: string): MCPOperationMetrics[] {
    return this.metrics.filter(m => m.operationName === operationName);
  }

  /**
   * Get recent error metrics for alerting
   */
  getRecentErrors(lastMinutes: number = 5): MCPOperationMetrics[] {
    const cutoff = Date.now() - (lastMinutes * 60000);
    return this.metrics.filter(m =>
      !m.success &&
      m.endTime &&
      m.endTime > cutoff
    );
  }

  /**
   * Check error rate and alert if too high
   */
  private checkErrorRate(): void {
    const recentMetrics = this.metrics.filter(m =>
      m.endTime &&
      m.endTime > (Date.now() - 60000) // Last minute
    );

    if (recentMetrics.length < 5) return; // Need at least 5 operations for meaningful stats

    const errorRate = (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100;

    if (errorRate > 20) { // Alert if >20% error rate
      console.error(`🚨 High MCP error rate detected: ${errorRate.toFixed(1)}% in last minute`);
    }
  }

  /**
   * Get health status for monitoring dashboards
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    errorRate: number;
    averageLatency: number;
    recentErrors: number;
    circuitBreakers: any[];
  } {
    const metrics = this.getAggregateMetrics();
    const recentErrors = this.getRecentErrors(1).length; // Last 1 minute

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.errorRate > 50 || recentErrors > 10) {
      status = 'unhealthy';
    } else if (metrics.errorRate > 20 || metrics.averageLatency > 1000 || recentErrors > 5) {
      status = 'degraded';
    }

    return {
      status,
      errorRate: metrics.errorRate,
      averageLatency: metrics.averageLatency,
      recentErrors,
      circuitBreakers: [] // Will be populated by calling service
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    prometheus: string;
    json: any;
  } {
    const aggregates = this.getAggregateMetrics();

    // Prometheus format metrics
    const prometheus = `
# HELP mcp_operations_total Total number of MCP operations
# TYPE mcp_operations_total counter
mcp_operations_total ${aggregates.totalOperations}

# HELP mcp_operations_success Total number of successful MCP operations
# TYPE mcp_operations_success counter
mcp_operations_success ${aggregates.successfulOperations}

# HELP mcp_operations_failed Total number of failed MCP operations
# TYPE mcp_operations_failed counter
mcp_operations_failed ${aggregates.failedOperations}

# HELP mcp_operation_duration_average Average MCP operation duration in milliseconds
# TYPE mcp_operation_duration_average gauge
mcp_operation_duration_average ${aggregates.averageLatency}

# HELP mcp_operations_per_second Operations per second in last minute
# TYPE mcp_operations_per_second gauge
mcp_operations_per_second ${aggregates.operationsPerSecond}

# HELP mcp_error_rate Error rate percentage
# TYPE mcp_error_rate gauge
mcp_error_rate ${aggregates.errorRate}
    `.trim();

    return {
      prometheus,
      json: {
        ...aggregates,
        recentErrors: this.getRecentErrors(5),
        healthStatus: this.getHealthStatus()
      }
    };
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep last 24 hours
      const beforeCount = this.metrics.length;

      this.metrics = this.metrics.filter(m => m.startTime > cutoff);

      // Also trim if we have too many metrics
      if (this.metrics.length > this.maxMetrics) {
        this.metrics = this.metrics.slice(-this.maxMetrics);
      }

      const afterCount = this.metrics.length;
      if (beforeCount > afterCount) {
        console.log(`🧹 MCP Monitoring cleanup: ${beforeCount - afterCount} old metrics removed`);
      }
    }, this.cleanupInterval);
  }

  /**
   * Stop monitoring and cleanup resources
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    console.log('📊 MCP Monitoring stopped');
  }

  /**
   * Get detailed operation timeline for debugging
   */
  getOperationTimeline(correlationId: string): MCPOperationMetrics | null {
    return this.metrics.find(m => m.correlationId === correlationId) || null;
  }

  /**
   * Force a health check report
   */
  generateHealthReport(): string {
    const health = this.getHealthStatus();
    const aggregates = this.getAggregateMetrics();

    return `
MCP Operations Health Report
===========================
Status: ${health.status.toUpperCase()}
Error Rate: ${health.errorRate.toFixed(2)}%
Average Latency: ${health.averageLatency.toFixed(0)}ms
Recent Errors: ${health.recentErrors}
Total Operations: ${aggregates.totalOperations}
Operations/sec: ${aggregates.operationsPerSecond.toFixed(2)}
Last Updated: ${aggregates.lastUpdated.toISOString()}
    `.trim();
  }
}

// Singleton instance
let mcpMonitoringInstance: MCPMonitoring | null = null;

export function getMCPMonitoring(): MCPMonitoring {
  if (!mcpMonitoringInstance) {
    mcpMonitoringInstance = new MCPMonitoring();
  }
  return mcpMonitoringInstance;
}

export function closeMCPMonitoring(): void {
  if (mcpMonitoringInstance) {
    mcpMonitoringInstance.stop();
    mcpMonitoringInstance = null;
  }
}
import { MCPMonitoring, getMCPMonitoring, closeMCPMonitoring } from '../../utils/mcpMonitoring';

describe('MCPMonitoring', () => {
  let monitoring: MCPMonitoring;

  beforeEach(() => {
    monitoring = new MCPMonitoring();
  });

  afterEach(() => {
    monitoring.stop();
    jest.clearAllTimers();
  });

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = monitoring.generateCorrelationId();
      const id2 = monitoring.generateCorrelationId();

      expect(id1).toMatch(/^mcp_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^mcp_\d+_[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Operation Tracking', () => {
    it('should track operation start', () => {
      const correlationId = monitoring.startOperation('test_operation', 'test_client', 'test_tool');

      expect(correlationId).toMatch(/^mcp_\d+_[a-z0-9]{9}$/);

      const timeline = monitoring.getOperationTimeline(correlationId);
      expect(timeline).toEqual(expect.objectContaining({
        operationName: 'test_operation',
        client: 'test_client',
        tool: 'test_tool',
        success: false,
        correlationId
      }));
    });

    it('should complete operation successfully', async () => {
      const correlationId = monitoring.startOperation('test_operation', 'test_client');
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
      monitoring.completeOperation(correlationId, true);

      const timeline = monitoring.getOperationTimeline(correlationId);
      expect(timeline?.success).toBe(true);
      expect(timeline?.duration).toBeGreaterThanOrEqual(0);
      expect(timeline?.endTime).toBeDefined();
    });

    it('should complete operation with error', async () => {
      const correlationId = monitoring.startOperation('test_operation', 'test_client');
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
      monitoring.completeOperation(correlationId, false, 'Test error');

      const timeline = monitoring.getOperationTimeline(correlationId);
      expect(timeline?.success).toBe(false);
      expect(timeline?.error).toBe('Test error');
      expect(timeline?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown correlation ID gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      monitoring.completeOperation('unknown_id', true);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ MCP Monitoring: Correlation ID unknown_id not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Aggregate Metrics', () => {
    it('should return empty metrics when no operations', () => {
      const metrics = monitoring.getAggregateMetrics();

      expect(metrics).toEqual({
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        operationsPerSecond: 0,
        errorRate: 0,
        lastUpdated: expect.any(Date)
      });
    });

    it('should calculate metrics correctly with operations', async () => {
      // Create successful operation
      const id1 = monitoring.startOperation('op1', 'client1');
      await new Promise(resolve => setTimeout(resolve, 5));
      monitoring.completeOperation(id1, true);

      // Create failed operation
      const id2 = monitoring.startOperation('op2', 'client2');
      await new Promise(resolve => setTimeout(resolve, 5));
      monitoring.completeOperation(id2, false, 'Error');

      const metrics = monitoring.getAggregateMetrics();

      expect(metrics.totalOperations).toBe(2);
      expect(metrics.successfulOperations).toBe(1);
      expect(metrics.failedOperations).toBe(1);
      expect(metrics.errorRate).toBe(50);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Client and Operation Filtering', () => {
    beforeEach(() => {
      const id1 = monitoring.startOperation('op1', 'client1', 'tool1');
      monitoring.completeOperation(id1, true);

      const id2 = monitoring.startOperation('op2', 'client2', 'tool2');
      monitoring.completeOperation(id2, false, 'Error');

      const id3 = monitoring.startOperation('op1', 'client1', 'tool1');
      monitoring.completeOperation(id3, true);
    });

    it('should filter metrics by client', () => {
      const client1Metrics = monitoring.getMetricsByClient('client1');
      const client2Metrics = monitoring.getMetricsByClient('client2');

      expect(client1Metrics).toHaveLength(2);
      expect(client2Metrics).toHaveLength(1);
      expect(client1Metrics[0].client).toBe('client1');
      expect(client2Metrics[0].client).toBe('client2');
    });

    it('should filter metrics by operation', () => {
      const op1Metrics = monitoring.getMetricsByOperation('op1');
      const op2Metrics = monitoring.getMetricsByOperation('op2');

      expect(op1Metrics).toHaveLength(2);
      expect(op2Metrics).toHaveLength(1);
      expect(op1Metrics[0].operationName).toBe('op1');
      expect(op2Metrics[0].operationName).toBe('op2');
    });
  });

  describe('Error Detection and Alerting', () => {
    it('should detect recent errors', () => {
      const id1 = monitoring.startOperation('op1', 'client1');
      monitoring.completeOperation(id1, false, 'Recent error');

      const recentErrors = monitoring.getRecentErrors(5);

      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].error).toBe('Recent error');
      expect(recentErrors[0].success).toBe(false);
    });

    it('should alert on slow operations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const id = monitoring.startOperation('slow_op', 'client1');

      // Manually set start time to simulate slow operation
      const timeline = monitoring.getOperationTimeline(id);
      if (timeline) {
        timeline.startTime = Date.now() - 3000; // 3 seconds ago
      }

      monitoring.completeOperation(id, true);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🐌 Slow MCP operation detected')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Health Status', () => {
    it('should report healthy status with no operations', () => {
      const health = monitoring.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(0);
      expect(health.recentErrors).toBe(0);
    });

    it('should report degraded status with moderate errors', () => {
      // Create operations with 25% error rate
      for (let i = 0; i < 3; i++) {
        const id = monitoring.startOperation(`op${i}`, 'client1');
        monitoring.completeOperation(id, true);
      }

      const id = monitoring.startOperation('op_fail', 'client1');
      monitoring.completeOperation(id, false, 'Error');

      const health = monitoring.getHealthStatus();
      expect(health.status).toBe('degraded');
      expect(health.errorRate).toBe(25);
    });

    it('should report unhealthy status with high error rate', () => {
      // Create operations with 60% error rate
      for (let i = 0; i < 2; i++) {
        const id = monitoring.startOperation(`op_success${i}`, 'client1');
        monitoring.completeOperation(id, true);
      }

      for (let i = 0; i < 3; i++) {
        const id = monitoring.startOperation(`op_fail${i}`, 'client1');
        monitoring.completeOperation(id, false, 'Error');
      }

      const health = monitoring.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.errorRate).toBe(60);
    });
  });

  describe('Metrics Export', () => {
    beforeEach(() => {
      const id1 = monitoring.startOperation('op1', 'client1');
      monitoring.completeOperation(id1, true);

      const id2 = monitoring.startOperation('op2', 'client1');
      monitoring.completeOperation(id2, false, 'Error');
    });

    it('should export Prometheus format metrics', () => {
      const exported = monitoring.exportMetrics();

      expect(exported.prometheus).toContain('mcp_operations_total 2');
      expect(exported.prometheus).toContain('mcp_operations_success 1');
      expect(exported.prometheus).toContain('mcp_operations_failed 1');
      expect(exported.prometheus).toContain('mcp_error_rate 50');
    });

    it('should export JSON format metrics', () => {
      const exported = monitoring.exportMetrics();

      expect(exported.json).toEqual(expect.objectContaining({
        totalOperations: 2,
        successfulOperations: 1,
        failedOperations: 1,
        errorRate: 50,
        recentErrors: expect.any(Array),
        healthStatus: expect.any(Object)
      }));
    });
  });

  describe('Health Report Generation', () => {
    it('should generate formatted health report', () => {
      const id = monitoring.startOperation('test_op', 'client1');
      monitoring.completeOperation(id, true);

      const report = monitoring.generateHealthReport();

      expect(report).toContain('MCP Operations Health Report');
      expect(report).toContain('Status: HEALTHY');
      expect(report).toContain('Total Operations: 1');
      expect(report).toContain('Error Rate: 0.00%');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should start cleanup timer on initialization', () => {
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const newMonitoring = new MCPMonitoring();

      expect(setIntervalSpy).toHaveBeenCalled();

      newMonitoring.stop();
      setIntervalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should stop cleanup timer on stop', () => {
      jest.useFakeTimers();
      const clearSpy = jest.spyOn(global, 'clearInterval');

      monitoring.stop();

      expect(clearSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('Singleton Pattern', () => {
    afterEach(() => {
      closeMCPMonitoring();
    });

    it('should return same instance from getMCPMonitoring', () => {
      const instance1 = getMCPMonitoring();
      const instance2 = getMCPMonitoring();

      expect(instance1).toBe(instance2);
    });

    it('should clean up singleton instance', () => {
      const instance1 = getMCPMonitoring();
      closeMCPMonitoring();
      const instance2 = getMCPMonitoring();

      expect(instance1).not.toBe(instance2);
    });
  });
});
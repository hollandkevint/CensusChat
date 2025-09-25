import { CircuitBreaker, CircuitState } from '../../utils/circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  let mockOperation: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    breaker = new CircuitBreaker('test-service', {
      threshold: 3,
      timeout: 1000,
      resetTimeout: 5000,
      monitorWindow: 10000
    });
    mockOperation = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Circuit States', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().isHealthy).toBe(true);
    });

    it('should remain CLOSED with successful operations', async () => {
      mockOperation.mockResolvedValue('success');

      await breaker.execute(mockOperation);
      await breaker.execute(mockOperation);
      await breaker.execute(mockOperation);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should transition to OPEN after threshold failures', async () => {
      mockOperation.mockRejectedValue(new Error('Service failed'));

      // First two failures should not open circuit
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Third failure should open circuit
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      const stats = breaker.getStats();
      expect(stats.failures).toBe(3);
      expect(stats.isHealthy).toBe(false);
    });

    it('should reject calls when OPEN', async () => {
      mockOperation.mockRejectedValue(new Error('Service failed'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Subsequent calls should be rejected without calling the operation
      mockOperation.mockClear();
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Circuit breaker [test-service] is open');
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('HALF_OPEN State Transitions', () => {
    beforeEach(async () => {
      // Trip circuit to OPEN state
      mockOperation.mockRejectedValue(new Error('Service failed'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      jest.useFakeTimers();

      // Fast forward past timeout
      jest.advanceTimersByTime(1001);

      // Reset mock to avoid count from beforeEach setup
      mockOperation.mockClear();

      // Next call should be in HALF_OPEN state
      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should transition to CLOSED on successful HALF_OPEN call', async () => {
      jest.useFakeTimers();
      jest.advanceTimersByTime(1001);

      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failures).toBe(0);

      jest.useRealTimers();
    });

    it('should transition back to OPEN on failed HALF_OPEN call', async () => {
      jest.useFakeTimers();
      jest.advanceTimersByTime(1001);

      mockOperation.mockRejectedValue(new Error('Still failing'));
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Still failing');

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      jest.useRealTimers();
    });
  });

  describe('Failure Reset Logic', () => {
    it('should reset failure count after monitor window', async () => {
      jest.useFakeTimers();

      mockOperation.mockRejectedValue(new Error('Service failed'));

      // Create one failure
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      expect(breaker.getStats().failures).toBe(1);

      // Fast forward past monitor window
      jest.advanceTimersByTime(10001);

      // Success should reset failure count
      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);

      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });
  });

  describe('Manual Control', () => {
    it('should allow manual opening', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.forceOpen();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.getStats().isHealthy).toBe(false);
    });

    it('should allow manual closing', async () => {
      mockOperation.mockRejectedValue(new Error('Service failed'));

      // Trip circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.forceClose();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.getStats().isHealthy).toBe(true);
    });

    it('should reject operations when manually opened', async () => {
      breaker.forceOpen();

      mockOperation.mockResolvedValue('success');
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Circuit breaker [test-service] is open');
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('Stats and Monitoring', () => {
    it('should provide accurate stats', async () => {
      const initialStats = breaker.getStats();
      expect(initialStats).toEqual({
        name: 'test-service',
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        isHealthy: true
      });

      mockOperation.mockRejectedValue(new Error('Service failed'));
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Service failed');

      const failureStats = breaker.getStats();
      expect(failureStats.failures).toBe(1);
      expect(failureStats.lastFailureTime).toBeGreaterThan(0);
      expect(failureStats.isHealthy).toBe(true); // Still healthy until threshold
    });

    it('should track multiple clients separately', () => {
      const breaker2 = new CircuitBreaker('test-service-2');

      expect(breaker.getStats().name).toBe('test-service');
      expect(breaker2.getStats().name).toBe('test-service-2');
    });
  });

  describe('Error Handling', () => {
    it('should propagate operation errors correctly', async () => {
      const customError = new Error('Custom service error');
      mockOperation.mockRejectedValue(customError);

      await expect(breaker.execute(mockOperation)).rejects.toThrow('Custom service error');
    });

    it('should handle sync operation errors', async () => {
      const syncOperation = jest.fn(() => {
        throw new Error('Sync error');
      });

      await expect(breaker.execute(syncOperation)).rejects.toThrow('Sync error');
    });
  });

  describe('Timeout Integration', () => {
    it('should work with Promise.race timeout patterns', async () => {
      const slowOperation = jest.fn(() => new Promise(resolve => setTimeout(resolve, 2000)));

      const operationWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), 1000);
        });

        return Promise.race([slowOperation(), timeoutPromise]);
      };

      await expect(breaker.execute(operationWithTimeout)).rejects.toThrow('Operation timeout');
      expect(breaker.getStats().failures).toBe(1);
    });
  });
});
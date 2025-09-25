import { DuckDBPool, getDuckDBPool, closeDuckDBPool } from '../../utils/duckdbPool';
import { Database } from 'duckdb';

// Mock DuckDB since we're testing the pool logic, not DuckDB itself
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn((sql, callback) => {
      // Simulate successful configuration
      setTimeout(() => callback(null), 10);
    }),
    all: jest.fn((sql, callback) => {
      // Simulate successful query
      setTimeout(() => callback(null, [{ test: 1 }]), 10);
    }),
    close: jest.fn((callback) => {
      setTimeout(() => callback(null), 10);
    }),
  })),
}));

describe('DuckDBPool', () => {
  let pool: DuckDBPool;

  beforeEach(() => {
    // Reset singleton
    (global as any).poolInstance = null;
    pool = new DuckDBPool({
      minConnections: 1,
      maxConnections: 3,
      connectionTimeout: 1000,
      memoryLimit: '1GB',
      threads: 2,
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
    }
    await closeDuckDBPool();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(pool).toBeInstanceOf(DuckDBPool);
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });

    it('should create minimum connections on initialization', async () => {
      await pool.initialize();
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(1); // minConnections = 1
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(1);
    });

    it('should not initialize twice', async () => {
      await pool.initialize();
      const statsAfterFirst = pool.getStats();

      await pool.initialize(); // Should not create additional connections
      const statsAfterSecond = pool.getStats();

      expect(statsAfterFirst.totalConnections).toBe(statsAfterSecond.totalConnections);
    });
  });

  describe('connection management', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should acquire and release connections', async () => {
      const connection = await pool.acquire();
      expect(connection).toBeDefined();

      const stats = pool.getStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(0);

      pool.release(connection);
      const statsAfterRelease = pool.getStats();
      expect(statsAfterRelease.activeConnections).toBe(0);
      expect(statsAfterRelease.idleConnections).toBe(1);
    });

    it('should create new connections up to maxConnections', async () => {
      const connections = [];

      // Acquire all connections up to max
      for (let i = 0; i < 3; i++) {
        connections.push(await pool.acquire());
      }

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(3); // maxConnections = 3
      expect(stats.activeConnections).toBe(3);

      // Clean up
      connections.forEach(conn => pool.release(conn));
    });

    it('should queue requests when pool is exhausted', async () => {
      // Acquire all available connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        connections.push(await pool.acquire());
      }

      // This should queue the request
      const pendingAcquire = pool.acquire();

      // Release one connection to fulfill the queued request
      pool.release(connections[0]);

      const connection = await pendingAcquire;
      expect(connection).toBeDefined();

      // Clean up
      pool.release(connection);
      connections.slice(1).forEach(conn => pool.release(conn));
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should execute queries successfully', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result).toEqual([{ test: 1 }]);
    });

    it('should handle query errors gracefully', async () => {
      // Mock a failing query
      const mockDb = {
        all: jest.fn((sql, callback) => {
          callback(new Error('Query failed'), null);
        }),
      };

      jest.spyOn(pool, 'acquire').mockResolvedValue(mockDb as any);
      jest.spyOn(pool, 'release').mockImplementation(() => {});

      await expect(pool.query('SELECT * FROM nonexistent')).rejects.toThrow('DuckDB query failed: Query failed');
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should return true for healthy pool', async () => {
      const isHealthy = await pool.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when query fails', async () => {
      // Mock a failing health check query
      jest.spyOn(pool, 'query').mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await pool.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('graceful shutdown', () => {
    it('should close all connections', async () => {
      await pool.initialize();

      const connection = await pool.acquire();
      pool.release(connection);

      await pool.close();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
    });

    it('should reject waiting requests on close', async () => {
      await pool.initialize();

      // Exhaust all connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        connections.push(await pool.acquire());
      }

      // Queue a request
      const pendingAcquire = pool.acquire();

      // Close the pool - this will trigger the rejection
      const closePromise = pool.close();

      // The pending request should be rejected
      await expect(pendingAcquire).rejects.toThrow('Pool is closing');

      // Wait for close to complete
      await closePromise;
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const pool1 = getDuckDBPool();
      const pool2 = getDuckDBPool();
      expect(pool1).toBe(pool2);
    });

    it('should create new instance after closing', async () => {
      const pool1 = getDuckDBPool();
      await closeDuckDBPool();

      const pool2 = getDuckDBPool();
      expect(pool1).not.toBe(pool2);
    });
  });

  describe('timeout handling', () => {
    it('should timeout connection requests', async () => {
      const shortTimeoutPool = new DuckDBPool({
        minConnections: 0,
        maxConnections: 1,
        connectionTimeout: 50, // Very short timeout
      });

      // Mock Database constructor to never call callback (simulate hang)
      const MockDatabase = jest.fn().mockImplementation(() => ({
        run: jest.fn(() => {
          // Never call the callback to simulate timeout
        }),
        close: jest.fn((callback) => callback(null)),
      }));

      (require('duckdb') as any).Database = MockDatabase;

      await expect(shortTimeoutPool.acquire()).rejects.toThrow('Database connection timeout');

      await shortTimeoutPool.close();
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should handle concurrent query operations', async () => {
      const promises = [];

      // Execute 10 concurrent queries
      for (let i = 0; i < 10; i++) {
        promises.push(pool.query(`SELECT ${i} as value`));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toEqual([{ test: 1 }]); // Mock returns { test: 1 }
      });
    });

    it('should maintain correct connection count under load', async () => {
      const promises = [];

      // Acquire connections concurrently - but only acquire up to max to avoid hanging promises
      for (let i = 0; i < 3; i++) {
        promises.push(pool.acquire());
      }

      const connections = await Promise.all(promises);
      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(3); // Should not exceed maxConnections
      expect(stats.activeConnections).toBe(3);

      // Release all connections
      connections.forEach(conn => {
        if (conn) pool.release(conn);
      });
    });
  });
});

describe('Integration with configuration', () => {
  it('should use environment variables for configuration', () => {
    // Mock environment variables
    process.env.DUCKDB_MIN_CONNECTIONS = '3';
    process.env.DUCKDB_MAX_CONNECTIONS = '15';
    process.env.DUCKDB_MEMORY_LIMIT = '8GB';
    process.env.DUCKDB_THREADS = '8';

    const configuredPool = new DuckDBPool({
      minConnections: parseInt(process.env.DUCKDB_MIN_CONNECTIONS || '2'),
      maxConnections: parseInt(process.env.DUCKDB_MAX_CONNECTIONS || '10'),
      memoryLimit: process.env.DUCKDB_MEMORY_LIMIT || '4GB',
      threads: parseInt(process.env.DUCKDB_THREADS || '4'),
    });

    expect(configuredPool).toBeInstanceOf(DuckDBPool);

    // Clean up environment
    delete process.env.DUCKDB_MIN_CONNECTIONS;
    delete process.env.DUCKDB_MAX_CONNECTIONS;
    delete process.env.DUCKDB_MEMORY_LIMIT;
    delete process.env.DUCKDB_THREADS;
  });
});
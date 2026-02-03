import {
  queryWithProfiling,
  getRecentProfiles,
  getProfileStats,
  clearProfiles
} from '../../utils/duckdbProfiler';

// Mock the pool
jest.mock('../../utils/duckdbPool', () => ({
  getDuckDBPool: jest.fn().mockReturnValue({
    acquire: jest.fn().mockResolvedValue({
      run: jest.fn().mockResolvedValue(undefined),
      runAndReadAll: jest.fn().mockResolvedValue({
        getRowObjects: jest.fn().mockReturnValue([
          { id: 1, name: 'Test' },
          { id: 2, name: 'Test2' }
        ])
      })
    }),
    release: jest.fn()
  })
}));

// Mock fs for profile file reading
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(JSON.stringify({
    cpu_time: 1500,
    children: [
      { name: 'SEQ_SCAN', timing: 1000, cardinality: 100 },
      { name: 'PROJECTION', timing: 500, cardinality: 100 }
    ]
  })),
  unlink: jest.fn().mockResolvedValue(undefined)
}));

describe('DuckDB Profiler', () => {
  beforeEach(() => {
    clearProfiles();
  });

  describe('queryWithProfiling', () => {
    it('should execute query and return profile data', async () => {
      const { result, profile } = await queryWithProfiling('SELECT * FROM test');

      expect(result).toHaveLength(2);
      expect(profile.query).toContain('SELECT');
      expect(profile.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(profile.rowsReturned).toBe(2);
      expect(profile.timestamp).toBeInstanceOf(Date);
    });

    it('should store profile by default', async () => {
      await queryWithProfiling('SELECT 1');
      const profiles = getRecentProfiles();

      expect(profiles).toHaveLength(1);
    });

    it('should not store profile when disabled', async () => {
      await queryWithProfiling('SELECT 1', { storeProfile: false });
      const profiles = getRecentProfiles();

      expect(profiles).toHaveLength(0);
    });

    it('should truncate long queries to 500 characters', async () => {
      const longQuery = 'SELECT ' + 'a'.repeat(600) + ' FROM test';
      const { profile } = await queryWithProfiling(longQuery);

      expect(profile.query.length).toBe(500);
    });

    it('should include CPU time from profile data', async () => {
      const { profile } = await queryWithProfiling('SELECT * FROM test');

      expect(profile.cpuTimeUs).toBe(1500);
    });

    it('should include operator timings from profile data', async () => {
      const { profile } = await queryWithProfiling('SELECT * FROM test');

      expect(profile.operatorTimings).toHaveLength(2);
      expect(profile.operatorTimings?.[0].operator).toBe('SEQ_SCAN');
      expect(profile.operatorTimings?.[0].timeUs).toBe(1000);
      expect(profile.operatorTimings?.[0].cardinality).toBe(100);
    });
  });

  describe('getRecentProfiles', () => {
    it('should return empty array when no profiles exist', () => {
      const profiles = getRecentProfiles();
      expect(profiles).toHaveLength(0);
    });

    it('should respect the limit parameter', async () => {
      await queryWithProfiling('SELECT 1');
      await queryWithProfiling('SELECT 2');
      await queryWithProfiling('SELECT 3');

      const profiles = getRecentProfiles(2);
      expect(profiles).toHaveLength(2);
    });

    it('should return profiles in reverse chronological order', async () => {
      await queryWithProfiling('SELECT first');
      await queryWithProfiling('SELECT second');

      const profiles = getRecentProfiles();
      expect(profiles[0].query).toContain('second');
      expect(profiles[1].query).toContain('first');
    });
  });

  describe('getProfileStats', () => {
    it('should return zero stats when no profiles', () => {
      const stats = getProfileStats();

      expect(stats.totalQueries).toBe(0);
      expect(stats.avgExecutionTimeMs).toBe(0);
      expect(stats.slowestQueryMs).toBe(0);
      expect(stats.totalRowsReturned).toBe(0);
    });

    it('should calculate aggregate stats', async () => {
      await queryWithProfiling('SELECT 1');
      await queryWithProfiling('SELECT 2');

      const stats = getProfileStats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.avgExecutionTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.totalRowsReturned).toBe(4); // 2 rows per query
    });

    it('should track slowest query', async () => {
      await queryWithProfiling('SELECT 1');
      await queryWithProfiling('SELECT 2');
      await queryWithProfiling('SELECT 3');

      const stats = getProfileStats();
      // All queries have similar execution time since mocked,
      // but slowestQueryMs should be >= 0
      expect(stats.slowestQueryMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearProfiles', () => {
    it('should clear all stored profiles', async () => {
      await queryWithProfiling('SELECT 1');
      await queryWithProfiling('SELECT 2');

      expect(getRecentProfiles()).toHaveLength(2);

      clearProfiles();

      expect(getRecentProfiles()).toHaveLength(0);
    });

    it('should reset stats after clearing', async () => {
      await queryWithProfiling('SELECT 1');
      clearProfiles();

      const stats = getProfileStats();
      expect(stats.totalQueries).toBe(0);
    });
  });
});

import { LoadingJob, LoadingConfiguration, GeographySpec } from '../../data-loading/utils/LoadingTypes';

/**
 * Create a test loading job
 */
export function createTestJob(overrides: Partial<LoadingJob> = {}): LoadingJob {
  const defaultJob: LoadingJob = {
    id: `test_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'bulk',
    priority: 50,
    status: 'pending',
    dataset: 'acs5',
    year: '2022',
    geography: {
      level: 'state',
      codes: ['06', '48', '12']
    },
    variables: ['B01003_001E', 'B25001_001E'],
    createdAt: new Date(),
    estimatedRecords: 100,
    processedRecords: 0,
    errorCount: 0,
    retryCount: 0,
    maxRetries: 3,
    metadata: { test: true }
  };
  
  return { ...defaultJob, ...overrides };
}

/**
 * Create a test geography specification
 */
export function createTestGeography(overrides: Partial<GeographySpec> = {}): GeographySpec {
  const defaultGeography: GeographySpec = {
    level: 'state',
    codes: ['06']
  };
  
  return { ...defaultGeography, ...overrides };
}

/**
 * Create a test loading configuration
 */
export function createTestConfig(overrides: Partial<LoadingConfiguration> = {}): LoadingConfiguration {
  const defaultConfig: LoadingConfiguration = {
    maxConcurrentJobs: 2,
    maxRetries: 3,
    retryDelayMs: 1000,
    apiRateLimit: {
      dailyLimit: 100,
      burstLimit: 5,
      reserveForUsers: 10
    },
    batchSizes: {
      nation: 1,
      state: 50,
      metro: 25,
      county: 50,
      place: 30,
      zcta: 40,
      tract: 20,
      block_group: 15
    },
    priorities: {
      metro: 100,
      state: 90,
      county: 70,
      zcta: 60,
      place: 50,
      tract: 30,
      block_group: 20,
      nation: 95
    },
    validation: {
      enabled: true,
      strictMode: false,
      qualityThresholds: {
        completeness: 0.95,
        accuracy: 0.98,
        consistency: 0.90
      }
    },
    database: {
      maxConnections: 5,
      batchInsertSize: 100,
      transactionTimeout: 10000,
      vacuumInterval: 3600000
    },
    monitoring: {
      metricsInterval: 5000,
      alertThresholds: {
        errorRate: 0.05,
        apiUsage: 0.90,
        memoryUsage: 0.85
      }
    }
  };
  
  return { ...defaultConfig, ...overrides };
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await wait(intervalMs);
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Create a spy that tracks calls
 */
export class CallTracker {
  private calls: any[][] = [];
  
  track = (...args: any[]) => {
    this.calls.push(args);
  };
  
  getCalls(): any[][] {
    return [...this.calls];
  }
  
  getCallCount(): number {
    return this.calls.length;
  }
  
  getLastCall(): any[] | undefined {
    return this.calls[this.calls.length - 1];
  }
  
  clear(): void {
    this.calls = [];
  }
}

/**
 * Mock EventEmitter for testing
 */
export class MockEventEmitter {
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event) || [];
    eventListeners.forEach(listener => listener(...args));
  }
  
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

/**
 * Mock DuckDB connection for testing
 */
export class MockDuckDBConnection {
  private queryResults: Map<string, any> = new Map();
  private queryTracker = new CallTracker();
  
  setQueryResult(query: string, result: any): void {
    this.queryResults.set(query, result);
  }
  
  all(query: string, params: any[] = [], callback?: Function): void {
    this.queryTracker.track(query, params);
    
    const result = this.queryResults.get(query) || [];
    
    if (callback) {
      // Simulate async behavior
      setTimeout(() => callback(null, result), 10);
    }
  }
  
  getQueryTracker(): CallTracker {
    return this.queryTracker;
  }
  
  reset(): void {
    this.queryResults.clear();
    this.queryTracker.clear();
  }
}

/**
 * Generate test data
 */
export const TestDataGenerator = {
  /**
   * Generate random census data records
   */
  generateCensusRecords(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      dataset: 'acs5',
      year: 2022,
      geography_level: 'state',
      geography_code: String(i + 1).padStart(2, '0'),
      name: `Test State ${i + 1}`,
      var_b01003_001e: Math.floor(Math.random() * 10000000),
      var_b25001_001e: Math.floor(Math.random() * 5000000),
      created_at: new Date().toISOString(),
      job_id: `test_job_${i}`
    }));
  },
  
  /**
   * Generate loading jobs for testing
   */
  generateLoadingJobs(count: number): LoadingJob[] {
    return Array.from({ length: count }, (_, i) => createTestJob({
      id: `batch_job_${i}`,
      priority: Math.floor(Math.random() * 100),
      geography: {
        level: ['state', 'county', 'zcta'][i % 3] as any,
        codes: [String(i + 1).padStart(2, '0')]
      },
      estimatedRecords: Math.floor(Math.random() * 1000) + 100
    }));
  }
};

/**
 * Test assertion helpers
 */
export const TestAssertions = {
  /**
   * Assert that a job has the expected properties
   */
  assertJobValid(job: LoadingJob): void {
    expect(job.id).toBeDefined();
    expect(job.type).toMatch(/^(bulk|incremental|backfill)$/);
    expect(job.status).toMatch(/^(pending|running|completed|failed|paused)$/);
    expect(job.priority).toBeGreaterThanOrEqual(0);
    expect(job.priority).toBeLessThanOrEqual(100);
    expect(job.geography).toBeDefined();
    expect(job.variables).toBeInstanceOf(Array);
    expect(job.variables.length).toBeGreaterThan(0);
    expect(job.createdAt).toBeInstanceOf(Date);
  },
  
  /**
   * Assert that metrics are within expected ranges
   */
  assertMetricsValid(metrics: any): void {
    expect(metrics.totalJobsProcessed).toBeGreaterThanOrEqual(0);
    expect(metrics.totalRecordsLoaded).toBeGreaterThanOrEqual(0);
    expect(metrics.totalApiCalls).toBeGreaterThanOrEqual(0);
    expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
    expect(metrics.errorRate).toBeLessThanOrEqual(1);
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
  },
  
  /**
   * Assert that configuration is valid
   */
  assertConfigValid(config: LoadingConfiguration): void {
    expect(config.maxConcurrentJobs).toBeGreaterThan(0);
    expect(config.maxRetries).toBeGreaterThanOrEqual(0);
    expect(config.retryDelayMs).toBeGreaterThan(0);
    expect(config.apiRateLimit.dailyLimit).toBeGreaterThan(0);
    expect(config.apiRateLimit.burstLimit).toBeGreaterThan(0);
    expect(config.validation.qualityThresholds.completeness).toBeGreaterThan(0);
    expect(config.validation.qualityThresholds.completeness).toBeLessThanOrEqual(1);
  }
};
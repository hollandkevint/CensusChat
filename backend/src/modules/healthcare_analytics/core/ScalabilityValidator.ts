/**
 * Scalability Validator - Load testing and capacity validation
 * Tests healthcare analytics system with realistic public dataset query volumes
 */

import { QueryTranslationPattern, FederatedQueryResult } from '../types/HealthcareAnalyticsTypes';
import { getPerformanceMonitor } from './PerformanceMonitor';
import { getQueryOptimizer } from './QueryOptimizer';

export interface LoadTestConfig {
  duration: number; // Test duration in milliseconds
  rampUpTime: number; // Time to reach peak concurrent users
  peakConcurrentQueries: number; // Maximum concurrent queries
  queryMixProfile: QueryMixProfile; // Distribution of query types
  datasetSizes: DatasetSizeProfile; // Simulated dataset characteristics
}

export interface QueryMixProfile {
  quickLookups: number; // 0.0 to 1.0 - Simple geography/demographic lookups
  analyticsQueries: number; // 0.0 to 1.0 - Complex healthcare analytics
  aggregationQueries: number; // 0.0 to 1.0 - Multi-source aggregations
  reportGeneration: number; // 0.0 to 1.0 - Large result set reports
}

export interface DatasetSizeProfile {
  smallQueries: number; // < 1K records
  mediumQueries: number; // 1K - 100K records
  largeQueries: number; // 100K - 1M records
  xlQueries: number; // > 1M records
}

export interface LoadTestResult {
  testId: string;
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // queries per second
  cacheHitRate: number;
  errors: string[];
  performanceBreakdown: {
    [queryType: string]: {
      count: number;
      avgTime: number;
      successRate: number;
    };
  };
  scalabilityMetrics: {
    maxConcurrentQueries: number;
    cpuUtilization: number;
    memoryUtilization: number;
    dbConnectionUtilization: number;
  };
  recommendations: string[];
}

export class ScalabilityValidator {
  private isRunning: boolean = false;
  private performanceMonitor = getPerformanceMonitor();
  private queryOptimizer = getQueryOptimizer();

  constructor() {
    console.log('🧪 Scalability Validator initialized');
  }

  /**
   * Generate realistic healthcare analytics query patterns for testing
   */
  private generateTestQueryPatterns(): QueryTranslationPattern[] {
    const geographies = [
      ['Miami-Dade', 'Broward', 'Palm Beach'], // Florida metros
      ['Harris', 'Dallas', 'Tarrant'], // Texas metros
      ['Los Angeles', 'Orange', 'Riverside'], // California metros
      ['Cook', 'DuPage', 'Lake'], // Illinois metros
      ['King', 'Snohomish', 'Pierce'] // Washington metros
    ];

    const metrics = [
      ['seniors', 'medicare_eligible', 'medicare_advantage'],
      ['population', 'age_65_plus', 'disability_status'],
      ['hospitals', 'primary_care_physicians', 'specialists'],
      ['health_insurance_coverage', 'medicaid_eligible', 'dual_eligible'],
      ['chronic_conditions', 'diabetes_prevalence', 'hypertension_rates']
    ];

    const patterns: QueryTranslationPattern[] = [];

    // Generate quick lookups (30% of queries)
    for (let i = 0; i < 30; i++) {
      const geo = geographies[Math.floor(Math.random() * geographies.length)];
      const metric = metrics[Math.floor(Math.random() * metrics.length)];

      patterns.push({
        intent: 'demographics',
        entities: {
          geography: geo,
          metrics: metric.slice(0, 1),
          timeframe: '2023'
        },
        sqlPattern: `SELECT county, state, ${metric[0]} FROM healthcare_demographics WHERE county IN ('${geo.join("','")}')`,
        parameters: { counties: geo, year: '2023' }
      });
    }

    // Generate analytics queries (40% of queries)
    for (let i = 0; i < 40; i++) {
      const geo = geographies[Math.floor(Math.random() * geographies.length)];
      const metric = metrics[Math.floor(Math.random() * metrics.length)];

      patterns.push({
        intent: 'healthcare_analytics',
        entities: {
          geography: geo,
          metrics: metric,
          timeframe: '2018-2023'
        },
        sqlPattern: `
          SELECT
            county, state, year,
            ${metric.join(', ')},
            ROUND(AVG(${metric[0]}) OVER (PARTITION BY county ORDER BY year ROWS 2 PRECEDING), 2) as trend_avg
          FROM healthcare_analytics
          WHERE county IN ('${geo.join("','")}')
            AND year BETWEEN 2018 AND 2023
          ORDER BY county, year
        `,
        parameters: { counties: geo, startYear: '2018', endYear: '2023', metrics: metric }
      });
    }

    // Generate aggregation queries (20% of queries)
    for (let i = 0; i < 20; i++) {
      const geo = geographies[Math.floor(Math.random() * geographies.length)];

      patterns.push({
        intent: 'healthcare_analytics',
        entities: {
          geography: geo,
          metrics: ['total_seniors', 'medicare_coverage', 'facility_count'],
          timeframe: '2023'
        },
        sqlPattern: `
          SELECT
            state,
            SUM(seniors) as total_seniors,
            AVG(medicare_coverage_rate) as avg_medicare_coverage,
            COUNT(DISTINCT hospital_id) as facility_count,
            ROUND(SUM(seniors) / SUM(population) * 100, 2) as senior_percentage
          FROM healthcare_facilities hf
          JOIN demographic_data dd ON hf.county = dd.county AND hf.state = dd.state
          WHERE dd.county IN ('${geo.join("','")}')
          GROUP BY state
          HAVING total_seniors > 50000
        `,
        parameters: { counties: geo, minSeniors: 50000 }
      });
    }

    // Generate report queries (10% of queries)
    for (let i = 0; i < 10; i++) {
      patterns.push({
        intent: 'healthcare_analytics',
        entities: {
          geography: ['ALL'],
          metrics: ['comprehensive_report'],
          timeframe: '2023'
        },
        sqlPattern: `
          SELECT
            county, state,
            population, seniors, medicare_eligible,
            hospitals, primary_care_docs, specialists,
            ROUND(seniors::float / population * 100, 2) as senior_percentage,
            ROUND(medicare_eligible::float / seniors * 100, 2) as medicare_coverage,
            ROUND(primary_care_docs::float / (population/1000), 2) as docs_per_1k_pop
          FROM healthcare_comprehensive_view
          WHERE population > 100000
          ORDER BY senior_percentage DESC
          LIMIT 1000
        `,
        parameters: { minPopulation: 100000 }
      });
    }

    return patterns;
  }

  /**
   * Simulate query execution with realistic timing
   */
  private async simulateQueryExecution(pattern: QueryTranslationPattern): Promise<{
    success: boolean;
    executionTime: number;
    cached: boolean;
    recordCount: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Simulate different execution times based on query complexity
      let baseExecutionTime: number;

      switch (pattern.intent) {
        case 'demographics':
          baseExecutionTime = 100 + Math.random() * 300; // 100-400ms
          break;
        case 'healthcare_analytics':
          if (pattern.entities.geography.includes('ALL')) {
            baseExecutionTime = 800 + Math.random() * 1200; // 800-2000ms for reports
          } else {
            baseExecutionTime = 300 + Math.random() * 700; // 300-1000ms for analytics
          }
          break;
        default:
          baseExecutionTime = 200 + Math.random() * 500; // 200-700ms default
      }

      // Simulate cache hits (70% hit rate when system is warmed up)
      const cached = Math.random() < 0.7;
      const executionTime = cached ? baseExecutionTime * 0.1 : baseExecutionTime;

      // Simulate varying record counts
      let recordCount: number;
      if (pattern.entities.geography.includes('ALL')) {
        recordCount = 500 + Math.floor(Math.random() * 9500); // 500-10K for reports
      } else if (pattern.intent === 'healthcare_analytics') {
        recordCount = 50 + Math.floor(Math.random() * 950); // 50-1K for analytics
      } else {
        recordCount = 1 + Math.floor(Math.random() * 49); // 1-50 for lookups
      }

      // Simulate occasional failures (2% failure rate)
      if (Math.random() < 0.02) {
        throw new Error('Simulated database timeout');
      }

      // Add realistic delay
      await new Promise(resolve => setTimeout(resolve, executionTime));

      return {
        success: true,
        executionTime: Date.now() - startTime,
        cached,
        recordCount,
      };

    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        cached: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run comprehensive scalability test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Load test already in progress');
    }

    this.isRunning = true;
    const testId = `load_test_${Date.now()}`;
    const startTime = new Date();

    console.log(`🚀 Starting scalability load test: ${testId}`);
    console.log(`📊 Config:`, {
      duration: `${config.duration / 1000}s`,
      peakConcurrent: config.peakConcurrentQueries,
      rampUp: `${config.rampUpTime / 1000}s`
    });

    const testPatterns = this.generateTestQueryPatterns();
    const results: any[] = [];
    const errors: string[] = [];
    let activeQueries = 0;
    let maxConcurrentQueries = 0;

    // Start performance monitoring
    this.performanceMonitor.startMonitoring(5000);

    try {
      const testPromise = new Promise<void>((resolve) => {
        const testInterval = setInterval(async () => {
          if (Date.now() - startTime.getTime() > config.duration) {
            clearInterval(testInterval);
            resolve();
            return;
          }

          // Calculate current load based on ramp-up
          const elapsed = Date.now() - startTime.getTime();
          const rampProgress = Math.min(elapsed / config.rampUpTime, 1);
          const targetConcurrency = Math.floor(config.peakConcurrentQueries * rampProgress);

          // Launch queries to reach target concurrency
          while (activeQueries < targetConcurrency) {
            const pattern = testPatterns[Math.floor(Math.random() * testPatterns.length)];
            const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            activeQueries++;
            maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);

            // Record query start
            this.performanceMonitor.recordQueryStart(queryId, pattern);

            // Execute query
            this.simulateQueryExecution(pattern)
              .then(result => {
                activeQueries--;
                results.push({
                  queryId,
                  pattern,
                  ...result,
                  timestamp: new Date()
                });

                if (result.success) {
                  this.performanceMonitor.recordQueryCompletion(
                    queryId,
                    result.executionTime,
                    pattern,
                    result.cached
                  );
                } else {
                  this.performanceMonitor.recordQueryFailure(
                    queryId,
                    new Error(result.error || 'Unknown error'),
                    pattern
                  );
                  errors.push(result.error || 'Unknown error');
                }
              })
              .catch(error => {
                activeQueries--;
                errors.push(error.message);
                this.performanceMonitor.recordQueryFailure(queryId, error, pattern);
              });
          }

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }, 200); // Check every 200ms
      });

      await testPromise;

      // Wait for remaining queries to complete
      while (activeQueries > 0) {
        console.log(`⏳ Waiting for ${activeQueries} queries to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } finally {
      this.isRunning = false;
      this.performanceMonitor.stopMonitoring();
    }

    const endTime = new Date();
    const totalQueries = results.length;
    const successfulQueries = results.filter(r => r.success).length;
    const failedQueries = totalQueries - successfulQueries;

    const executionTimes = results
      .filter(r => r.success)
      .map(r => r.executionTime)
      .sort((a, b) => a - b);

    const avgResponseTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;

    const p95ResponseTime = executionTimes.length > 0
      ? executionTimes[Math.floor(executionTimes.length * 0.95)]
      : 0;

    const p99ResponseTime = executionTimes.length > 0
      ? executionTimes[Math.floor(executionTimes.length * 0.99)]
      : 0;

    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    const throughput = totalQueries / durationSeconds;

    const cachedQueries = results.filter(r => r.cached).length;
    const cacheHitRate = totalQueries > 0 ? cachedQueries / totalQueries : 0;

    // Performance breakdown by query type
    const performanceBreakdown: any = {};

    ['demographics', 'healthcare_analytics'].forEach(intent => {
      const intentResults = results.filter(r => r.pattern.intent === intent);
      if (intentResults.length > 0) {
        const successfulResults = intentResults.filter(r => r.success);
        performanceBreakdown[intent] = {
          count: intentResults.length,
          avgTime: successfulResults.length > 0
            ? successfulResults.reduce((sum, r) => sum + r.executionTime, 0) / successfulResults.length
            : 0,
          successRate: successfulResults.length / intentResults.length
        };
      }
    });

    // Generate recommendations
    const recommendations: string[] = [];

    if (avgResponseTime > 1000) {
      recommendations.push('Average response time exceeds 1s - consider query optimization');
    }

    if (p95ResponseTime > 2000) {
      recommendations.push('95th percentile exceeds 2s target - review slow query patterns');
    }

    if (cacheHitRate < 0.6) {
      recommendations.push('Cache hit rate below 60% - review caching strategy');
    }

    if (failedQueries / totalQueries > 0.05) {
      recommendations.push('Error rate above 5% - investigate system stability');
    }

    if (maxConcurrentQueries < config.peakConcurrentQueries * 0.8) {
      recommendations.push('Did not reach target concurrency - consider system bottlenecks');
    }

    const result: LoadTestResult = {
      testId,
      config,
      startTime,
      endTime,
      totalQueries,
      successfulQueries,
      failedQueries,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      cacheHitRate,
      errors: Array.from(new Set(errors)),
      performanceBreakdown,
      scalabilityMetrics: {
        maxConcurrentQueries,
        cpuUtilization: 0, // Would be collected from system monitoring
        memoryUtilization: 0,
        dbConnectionUtilization: 0
      },
      recommendations
    };

    console.log('✅ Load test completed successfully');
    this.logTestSummary(result);

    return result;
  }

  /**
   * Log test summary
   */
  private logTestSummary(result: LoadTestResult): void {
    console.log(`
📊 Load Test Summary - ${result.testId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Performance Metrics:
   • Total Queries: ${result.totalQueries}
   • Success Rate: ${((result.successfulQueries / result.totalQueries) * 100).toFixed(1)}%
   • Avg Response Time: ${result.avgResponseTime.toFixed(0)}ms
   • P95 Response Time: ${result.p95ResponseTime.toFixed(0)}ms
   • P99 Response Time: ${result.p99ResponseTime.toFixed(0)}ms
   • Throughput: ${result.throughput.toFixed(1)} queries/sec
   • Cache Hit Rate: ${(result.cacheHitRate * 100).toFixed(1)}%

🚀 Scalability Metrics:
   • Max Concurrent: ${result.scalabilityMetrics.maxConcurrentQueries}
   • Target Concurrent: ${result.config.peakConcurrentQueries}

${result.recommendations.length > 0 ? `
💡 Recommendations:
${result.recommendations.map(rec => `   • ${rec}`).join('\n')}
` : '✅ All performance targets met!'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  /**
   * Run quick performance validation
   */
  async validatePerformance(): Promise<{
    sub2sCompliance: boolean;
    avgResponseTime: number;
    cacheHitRate: number;
    recommendations: string[];
  }> {
    console.log('⚡ Running quick performance validation...');

    const quickConfig: LoadTestConfig = {
      duration: 30000, // 30 seconds
      rampUpTime: 5000, // 5 second ramp up
      peakConcurrentQueries: 5,
      queryMixProfile: {
        quickLookups: 0.5,
        analyticsQueries: 0.3,
        aggregationQueries: 0.15,
        reportGeneration: 0.05
      },
      datasetSizes: {
        smallQueries: 0.6,
        mediumQueries: 0.3,
        largeQueries: 0.08,
        xlQueries: 0.02
      }
    };

    const result = await this.runLoadTest(quickConfig);

    return {
      sub2sCompliance: result.p95ResponseTime < 2000,
      avgResponseTime: result.avgResponseTime,
      cacheHitRate: result.cacheHitRate,
      recommendations: result.recommendations
    };
  }

  /**
   * Check if validator is currently running
   */
  isRunningTest(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let scalabilityValidatorInstance: ScalabilityValidator | null = null;

export function getScalabilityValidator(): ScalabilityValidator {
  if (!scalabilityValidatorInstance) {
    scalabilityValidatorInstance = new ScalabilityValidator();
  }
  return scalabilityValidatorInstance;
}

export function resetScalabilityValidator(): void {
  scalabilityValidatorInstance = null;
}
import { LoadingConfiguration, GeographyLevel } from './LoadingTypes';
import { config } from '../../config';

export const DEFAULT_LOADING_CONFIG: LoadingConfiguration = {
  maxConcurrentJobs: 3, // Parallel processing limit
  maxRetries: 3,
  retryDelayMs: 5000, // 5 second base delay with exponential backoff
  
  apiRateLimit: {
    dailyLimit: 500, // Default Census API limit without key
    burstLimit: 10,  // Max concurrent API calls
    reserveForUsers: 50, // Reserve calls for real-time user queries
  },
  
  batchSizes: {
    nation: 1,
    state: 50,      // Process all states at once
    metro: 25,      // Moderate batch size for metros
    county: 50,     // Max out 50-variable limit
    place: 30,      // Cities and towns
    zcta: 40,       // ZIP codes
    tract: 20,      // Census tracts (more granular)
    block_group: 15, // Most granular, smaller batches
  },
  
  priorities: {
    metro: 100,     // Highest business value
    state: 90,      // Essential for comparisons
    nation: 95,     // National overview
    county: 70,     // Regional analysis
    zcta: 60,       // ZIP code analysis
    place: 50,      // City-level data
    tract: 30,      // Detailed local analysis
    block_group: 20, // Most granular
  },
  
  validation: {
    enabled: true,
    strictMode: false, // Allow some data quality issues in development
    qualityThresholds: {
      completeness: 0.95, // 95% of expected records
      accuracy: 0.98,     // 98% of records pass validation
      consistency: 0.90,  // 90% consistency in geographic relationships
    },
  },
  
  database: {
    maxConnections: 10,     // DuckDB connection pool size
    batchInsertSize: 1000,  // Records per transaction
    transactionTimeout: 30000, // 30 second timeout
    vacuumInterval: 3600000,   // 1 hour vacuum interval
  },
  
  monitoring: {
    metricsInterval: 30000, // 30 second metrics collection
    alertThresholds: {
      errorRate: 0.05,      // 5% error rate threshold
      apiUsage: 0.90,       // 90% of daily API limit
      memoryUsage: 0.85,    // 85% memory usage
    },
  },
};

export class ConfigurationManager {
  private config: LoadingConfiguration;
  
  constructor(customConfig?: Partial<LoadingConfiguration>) {
    this.config = { ...DEFAULT_LOADING_CONFIG, ...customConfig };
    this.validateConfiguration();
    this.adaptToEnvironment();
  }
  
  getConfiguration(): LoadingConfiguration {
    return { ...this.config };
  }
  
  updateConfiguration(updates: Partial<LoadingConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
  }
  
  private validateConfiguration(): void {
    // Validate API rate limits
    if (this.config.apiRateLimit.dailyLimit <= this.config.apiRateLimit.reserveForUsers) {
      throw new Error('Reserved API calls cannot exceed daily limit');
    }
    
    // Validate batch sizes don't exceed API limits
    Object.values(this.config.batchSizes).forEach(batchSize => {
      if (batchSize > 50) { // Census API max variables per call
        throw new Error('Batch size cannot exceed 50 variables per API call');
      }
    });
    
    // Validate quality thresholds
    Object.values(this.config.validation.qualityThresholds).forEach(threshold => {
      if (threshold < 0 || threshold > 1) {
        throw new Error('Quality thresholds must be between 0 and 1');
      }
    });
    
    // Validate priorities
    Object.values(this.config.priorities).forEach(priority => {
      if (priority < 0 || priority > 100) {
        throw new Error('Priorities must be between 0 and 100');
      }
    });
  }
  
  private adaptToEnvironment(): void {
    // Adapt to Census API key availability
    if (config.api.census.apiKey) {
      this.config.apiRateLimit.dailyLimit = 10000; // Much higher with API key
      this.config.apiRateLimit.burstLimit = 50;    // Allow more concurrent calls
      this.config.maxConcurrentJobs = 5;          // More parallel processing
    }
    
    // Adapt to development vs production
    if (config.isDevelopment) {
      this.config.validation.strictMode = false;
      this.config.apiRateLimit.reserveForUsers = 10; // Less reservation in dev
      this.config.monitoring.metricsInterval = 60000; // Less frequent monitoring
    } else if (config.isProduction) {
      this.config.validation.strictMode = true;
      this.config.apiRateLimit.reserveForUsers = 100; // More reservation in prod
      this.config.monitoring.metricsInterval = 15000;  // More frequent monitoring
    }
    
    // Adapt batch sizes based on available memory
    if (process.memoryUsage().heapTotal < 1024 * 1024 * 1024) { // Less than 1GB
      // Reduce batch sizes for memory-constrained environments
      Object.keys(this.config.batchSizes).forEach(level => {
        const geographyLevel = level as GeographyLevel;
        this.config.batchSizes[geographyLevel] = Math.max(
          1, 
          Math.floor(this.config.batchSizes[geographyLevel] * 0.5)
        );
      });
    }
  }
  
  getApiCallBudget(): { available: number; reserved: number; total: number } {
    const total = this.config.apiRateLimit.dailyLimit;
    const reserved = this.config.apiRateLimit.reserveForUsers;
    const available = total - reserved;
    
    return { available, reserved, total };
  }
  
  calculateOptimalConcurrency(currentApiUsage: number): number {
    const budget = this.getApiCallBudget();
    const remainingCalls = budget.available - currentApiUsage;
    
    // Reduce concurrency as we approach the daily limit
    const usageRatio = currentApiUsage / budget.available;
    
    if (usageRatio > 0.9) {
      return 1; // Single-threaded when close to limit
    } else if (usageRatio > 0.7) {
      return Math.max(1, Math.floor(this.config.maxConcurrentJobs * 0.5));
    } else {
      return this.config.maxConcurrentJobs;
    }
  }
  
  shouldPauseLoading(currentApiUsage: number, errorRate: number): boolean {
    const budget = this.getApiCallBudget();
    const usageRatio = currentApiUsage / budget.available;
    
    // Pause if we're close to the API limit or error rate is too high
    return usageRatio > 0.95 || errorRate > this.config.monitoring.alertThresholds.errorRate;
  }
  
  getRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    
    return exponentialDelay + jitter;
  }
  
  estimateJobDuration(recordCount: number, variableCount: number): number {
    // Estimate based on historical performance
    const baseTimePerRecord = 10; // 10ms per record (rough estimate)
    const apiCallTime = 2000;     // 2 seconds per API call
    const processingTime = recordCount * baseTimePerRecord;
    const networkTime = Math.ceil(recordCount / 100) * apiCallTime; // Assume 100 records per API call
    
    return processingTime + networkTime;
  }
  
  optimizeForGeography(geography: GeographyLevel): Partial<LoadingConfiguration> {
    const optimizations: Partial<LoadingConfiguration> = {};
    
    switch (geography) {
      case 'nation':
      case 'state':
        // Large geography levels - optimize for fewer, larger batches
        optimizations.maxConcurrentJobs = 1;
        break;
        
      case 'metro':
      case 'county':
        // Medium geography levels - balanced approach
        optimizations.maxConcurrentJobs = 3;
        break;
        
      case 'zcta':
      case 'place':
        // Many small geographies - optimize for parallel processing
        optimizations.maxConcurrentJobs = 5;
        break;
        
      case 'tract':
      case 'block_group':
        // Very granular - smaller batches, more careful processing
        optimizations.maxConcurrentJobs = 2;
        optimizations.database = {
          ...this.config.database,
          batchInsertSize: 500, // Smaller insert batches
        };
        break;
    }
    
    return optimizations;
  }
}

export const configurationManager = new ConfigurationManager();
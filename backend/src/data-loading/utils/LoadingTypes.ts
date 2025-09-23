export interface LoadingJob {
  id: string;
  type: 'bulk' | 'incremental' | 'backfill';
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  dataset: string;
  year: string;
  geography: GeographySpec;
  variables: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedRecords: number;
  processedRecords: number;
  errorCount: number;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface GeographySpec {
  level: GeographyLevel;
  codes?: string[]; // Specific geography codes to load
  parentGeography?: {
    level: GeographyLevel;
    codes: string[];
  };
  filter?: {
    states?: string[];
    counties?: string[];
    metros?: string[];
  };
}

export type GeographyLevel = 
  | 'nation' 
  | 'state' 
  | 'county' 
  | 'metro' 
  | 'place' 
  | 'tract' 
  | 'block_group' 
  | 'zcta';

export interface LoadingProgress {
  jobId: string;
  totalJobs: number;
  completedJobs: number;
  currentJob?: LoadingJob;
  estimatedCompletion: Date;
  progressPercentage: number;
  recordsPerSecond: number;
  apiCallsUsed: number;
  apiCallsRemaining: number;
  status: 'idle' | 'loading' | 'paused' | 'error' | 'completed';
  errors: LoadingError[];
}

export interface LoadingError {
  jobId: string;
  errorType: 'api_error' | 'validation_error' | 'database_error' | 'timeout' | 'rate_limit';
  message: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}

export interface LoadingMetrics {
  totalJobsProcessed: number;
  totalRecordsLoaded: number;
  totalApiCalls: number;
  averageRecordsPerSecond: number;
  dataQualityScore: number;
  uptime: number;
  errorRate: number;
  cacheHitRate: number;
  databasePerformance: {
    insertRate: number;
    queryResponseTime: number;
    connectionPoolUsage: number;
  };
}

export interface LoadingConfiguration {
  maxConcurrentJobs: number;
  maxRetries: number;
  retryDelayMs: number;
  apiRateLimit: {
    dailyLimit: number;
    burstLimit: number;
    reserveForUsers: number;
  };
  batchSizes: {
    [key in GeographyLevel]: number;
  };
  priorities: {
    [key in GeographyLevel]: number;
  };
  validation: {
    enabled: boolean;
    strictMode: boolean;
    qualityThresholds: {
      completeness: number;
      accuracy: number;
      consistency: number;
    };
  };
  database: {
    maxConnections: number;
    batchInsertSize: number;
    transactionTimeout: number;
    vacuumInterval: number;
  };
  monitoring: {
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      apiUsage: number;
      memoryUsage: number;
    };
  };
}

export interface DataLoadResult {
  jobId: string;
  success: boolean;
  recordsLoaded: number;
  recordsSkipped: number;
  recordsErrored: number;
  duration: number;
  apiCalls: number;
  validationResults?: ValidationResult;
  metadata: {
    geography: GeographySpec;
    variables: string[];
    dataQuality: {
      completeness: number;
      accuracy: number;
      consistency: number;
    };
  };
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    missingData: number;
    outliers: number;
  };
}

export interface ValidationIssue {
  type: 'missing_data' | 'invalid_range' | 'inconsistent_geography' | 'outlier' | 'duplicate';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recordCount: number;
  sampleRecords?: any[];
}

export interface WorkerTask {
  id: string;
  jobId: string;
  type: 'api_fetch' | 'validate' | 'transform' | 'load';
  payload: any;
  priority: number;
  retryCount: number;
  createdAt: Date;
}

export interface ApiRateLimit {
  totalCalls: number;
  remainingCalls: number;
  resetTime: Date;
  burstAvailable: number;
  estimatedDepletion: Date;
}

export interface DatabaseConnection {
  id: string;
  type: 'reader' | 'writer';
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  transactionCount: number;
}

export interface LoadingContext {
  config: LoadingConfiguration;
  metrics: LoadingMetrics;
  progress: LoadingProgress;
  rateLimit: ApiRateLimit;
  connections: DatabaseConnection[];
  activeJobs: LoadingJob[];
  queueDepth: number;
}

// Event types for monitoring and logging
export type LoadingEvent = 
  | { type: 'job_started'; job: LoadingJob }
  | { type: 'job_completed'; job: LoadingJob; result: DataLoadResult }
  | { type: 'job_failed'; job: LoadingJob; error: LoadingError }
  | { type: 'progress_update'; progress: LoadingProgress }
  | { type: 'rate_limit_warning'; usage: number; limit: number }
  | { type: 'validation_failed'; job: LoadingJob; issues: ValidationIssue[] }
  | { type: 'database_error'; error: string; connectionId: string }
  | { type: 'system_health'; metrics: LoadingMetrics };
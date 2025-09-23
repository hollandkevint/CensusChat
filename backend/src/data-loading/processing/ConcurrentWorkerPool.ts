import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { 
  LoadingJob, 
  LoadingConfiguration, 
  DataLoadResult, 
  LoadingError,
  WorkerTask 
} from '../utils/LoadingTypes';
import { censusApiService } from '../../services/censusApiService';
import { CensusData } from '../../models/CensusData';

export interface WorkerStats {
  id: string;
  status: 'idle' | 'busy' | 'error' | 'stopped';
  currentJobId?: string;
  jobsCompleted: number;
  jobsFailed: number;
  totalProcessingTime: number;
  lastJobStartTime?: Date;
  createdAt: Date;
}

export interface PoolMetrics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  errorWorkers: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  averageJobDuration: number;
  throughputPerMinute: number;
}

export class ConcurrentWorkerPool extends EventEmitter {
  private config: LoadingConfiguration;
  private workers: Map<string, WorkerStats> = new Map();
  private jobQueue: LoadingJob[] = [];
  private activeJobs: Map<string, { job: LoadingJob; workerId: string; startTime: Date }> = new Map();
  
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private completedJobs: number = 0;
  private failedJobs: number = 0;
  private totalProcessingTime: number = 0;
  
  // Rate limiting
  private apiCallsUsed: number = 0;
  private lastApiCallTime: Date = new Date();
  private apiCallQueue: Array<() => Promise<void>> = [];

  constructor(config: LoadingConfiguration) {
    super();
    this.config = config;
    
    // Initialize workers
    this.initializeWorkers();
    
    console.log(`ConcurrentWorkerPool initialized with ${config.maxConcurrentJobs} workers`);
  }

  /**
   * Submit a job to the worker pool
   */
  async submitJob(job: LoadingJob): Promise<void> {
    if (!this.isRunning) {
      await this.start();
    }

    this.jobQueue.push(job);
    console.log(`📋 Job ${job.id} submitted to worker pool (queue size: ${this.jobQueue.length})`);
    
    this.emit('job_submitted', job);
    
    // Try to process immediately if workers are available
    this.processQueue();
  }

  /**
   * Start the worker pool
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    
    // Start processing interval
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000);
    
    console.log('🚀 ConcurrentWorkerPool started');
    this.emit('pool_started');
  }

  /**
   * Pause the worker pool
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    console.log('⏸️  ConcurrentWorkerPool paused');
    this.emit('pool_paused');
  }

  /**
   * Resume the worker pool
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    console.log('▶️  ConcurrentWorkerPool resumed');
    this.emit('pool_resumed');
  }

  /**
   * Stop the worker pool
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    // Wait for active jobs to complete or timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await this.sleep(1000);
    }
    
    // Force stop any remaining jobs
    for (const [jobId, { job, workerId }] of this.activeJobs.entries()) {
      this.handleJobFailure(job, {
        jobId,
        errorType: 'timeout',
        message: 'Job stopped due to pool shutdown',
        timestamp: new Date(),
        retryable: true
      });
    }
    
    console.log('🛑 ConcurrentWorkerPool stopped');
    this.emit('pool_stopped');
  }

  /**
   * Get available worker count
   */
  getAvailableWorkerCount(): number {
    return Array.from(this.workers.values())
      .filter(worker => worker.status === 'idle').length;
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    const workers = Array.from(this.workers.values());
    const now = Date.now();
    
    // Calculate throughput for last minute
    const oneMinuteAgo = now - 60000;
    const recentJobs = this.completedJobs; // Simplified for now
    
    return {
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w.status !== 'stopped').length,
      idleWorkers: workers.filter(w => w.status === 'idle').length,
      busyWorkers: workers.filter(w => w.status === 'busy').length,
      errorWorkers: workers.filter(w => w.status === 'error').length,
      totalJobsProcessed: this.completedJobs,
      totalJobsFailed: this.failedJobs,
      averageJobDuration: this.completedJobs > 0 ? this.totalProcessingTime / this.completedJobs : 0,
      throughputPerMinute: recentJobs
    };
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): WorkerStats[] {
    return Array.from(this.workers.values());
  }

  // Private methods

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.maxConcurrentJobs; i++) {
      const workerId = `worker_${i + 1}`;
      const worker: WorkerStats = {
        id: workerId,
        status: 'idle',
        jobsCompleted: 0,
        jobsFailed: 0,
        totalProcessingTime: 0,
        createdAt: new Date()
      };
      
      this.workers.set(workerId, worker);
    }
  }

  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.isPaused || this.jobQueue.length === 0) {
      return;
    }

    // Get available workers
    const availableWorkers = Array.from(this.workers.entries())
      .filter(([_, worker]) => worker.status === 'idle')
      .map(([workerId, _]) => workerId);

    if (availableWorkers.length === 0) {
      return;
    }

    // Process jobs up to available worker capacity
    const jobsToProcess = Math.min(availableWorkers.length, this.jobQueue.length);
    
    for (let i = 0; i < jobsToProcess; i++) {
      const job = this.jobQueue.shift();
      const workerId = availableWorkers[i];
      
      if (job && workerId) {
        await this.assignJobToWorker(job, workerId);
      }
    }
  }

  private async assignJobToWorker(job: LoadingJob, workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Update worker status
    worker.status = 'busy';
    worker.currentJobId = job.id;
    worker.lastJobStartTime = new Date();

    // Track active job
    this.activeJobs.set(job.id, {
      job,
      workerId,
      startTime: new Date()
    });

    console.log(`👷 Worker ${workerId} assigned job ${job.id}`);
    
    // Process the job
    this.processJob(job, workerId)
      .then(result => {
        this.handleJobSuccess(job, result, workerId);
      })
      .catch(error => {
        this.handleJobFailure(job, {
          jobId: job.id,
          errorType: 'api_error',
          message: error.message,
          details: error,
          timestamp: new Date(),
          retryable: true
        }, workerId);
      });
  }

  private async processJob(job: LoadingJob, workerId: string): Promise<DataLoadResult> {
    const startTime = Date.now();
    let apiCalls = 0;
    let recordsLoaded = 0;
    let recordsSkipped = 0;
    let recordsErrored = 0;

    try {
      // Rate limit check
      if (!await this.checkRateLimit()) {
        throw new Error('API rate limit exceeded');
      }

      // Fetch data from Census API
      console.log(`🌐 Worker ${workerId} fetching data for ${job.geography.level} geography`);
      
      let censusData;
      const variables = job.variables.filter(v => v !== 'NAME'); // NAME is automatically included
      
      // Choose appropriate API method based on geography level
      switch (job.geography.level) {
        case 'state':
          censusData = await censusApiService.getACS5StateData(variables);
          apiCalls = 1;
          break;
          
        case 'county':
          // If specific state codes provided, fetch for each state
          if (job.geography.codes && job.geography.codes.length > 0) {
            const allData = [];
            for (const stateCode of job.geography.codes) {
              const data = await censusApiService.getACS5CountyData(stateCode, variables);
              allData.push(...data.data);
              apiCalls++;
              
              // Rate limiting between calls
              await this.sleep(200);
            }
            censusData = { data: allData, headers: censusData?.headers || [] };
          } else {
            // Fetch all counties (this might need to be chunked for large requests)
            censusData = await censusApiService.getACS5CountyData('*', variables);
            apiCalls = 1;
          }
          break;
          
        case 'zcta':
          censusData = await censusApiService.getACS5ZipData('*', variables);
          apiCalls = 1;
          break;
          
        case 'block_group':
          // Block groups require state and county
          if (job.geography.parentGeography) {
            const stateCode = job.geography.parentGeography.codes[0];
            const countyCode = job.geography.codes?.[0] || '*';
            censusData = await censusApiService.getACS5BlockGroupData(stateCode, countyCode, variables);
            apiCalls = 1;
          } else {
            throw new Error('Block group requests require parent geography (state/county)');
          }
          break;
          
        default:
          throw new Error(`Unsupported geography level: ${job.geography.level}`);
      }

      if (!censusData || !censusData.data || censusData.data.length === 0) {
        console.log(`⚠️  No data returned for job ${job.id}`);
        recordsSkipped = job.estimatedRecords;
      } else {
        // Transform and load data into DuckDB
        console.log(`💾 Worker ${workerId} loading ${censusData.data.length} records to database`);
        
        const censusDataModel = new CensusData();
        await censusDataModel.init();
        
        // Transform the data format
        const transformedData = this.transformCensusData(censusData, job);
        
        // Batch insert the data
        const batchSize = this.config.database.batchInsertSize;
        for (let i = 0; i < transformedData.length; i += batchSize) {
          const batch = transformedData.slice(i, i + batchSize);
          await censusDataModel.insertCensusData(batch);
          recordsLoaded += batch.length;
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        jobId: job.id,
        success: true,
        recordsLoaded,
        recordsSkipped,
        recordsErrored,
        duration,
        apiCalls,
        metadata: {
          geography: job.geography,
          variables: job.variables,
          dataQuality: {
            completeness: recordsLoaded / (recordsLoaded + recordsSkipped + recordsErrored),
            accuracy: 0.98, // Default - would be calculated by validation service
            consistency: 0.95 // Default - would be calculated by validation service
          }
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        jobId: job.id,
        success: false,
        recordsLoaded,
        recordsSkipped,
        recordsErrored: job.estimatedRecords,
        duration,
        apiCalls,
        metadata: {
          geography: job.geography,
          variables: job.variables,
          dataQuality: {
            completeness: 0,
            accuracy: 0,
            consistency: 0
          }
        }
      };
    }
  }

  private transformCensusData(censusData: any, job: LoadingJob): any[] {
    if (!censusData.data || censusData.data.length === 0) {
      return [];
    }

    // First row contains headers
    const headers = censusData.data[0];
    const dataRows = censusData.data.slice(1);
    
    return dataRows.map((row: any[]) => {
      const record: any = {
        dataset: job.dataset,
        year: parseInt(job.year),
        geography_level: job.geography.level,
        geography_code: this.extractGeographyCode(row, headers, job.geography.level),
        name: this.extractName(row, headers),
        created_at: new Date().toISOString(),
        job_id: job.id
      };

      // Add variable values
      headers.forEach((header: string, index: number) => {
        if (header !== 'NAME' && !header.includes('state') && !header.includes('county') && !header.includes('tract')) {
          const value = row[index];
          record[`var_${header.toLowerCase()}`] = value === null || value === '' ? null : value;
        }
      });

      return record;
    });
  }

  private extractGeographyCode(row: any[], headers: string[], geographyLevel: string): string {
    // Extract the appropriate geography code based on level
    switch (geographyLevel) {
      case 'state':
        const stateIndex = headers.indexOf('state');
        return stateIndex >= 0 ? row[stateIndex] : '';
        
      case 'county':
        const countyIndex = headers.indexOf('county');
        const stateIdx = headers.indexOf('state');
        return countyIndex >= 0 && stateIdx >= 0 ? `${row[stateIdx]}${row[countyIndex]}` : '';
        
      case 'zcta':
        const zctaIndex = headers.indexOf('zip code tabulation area');
        return zctaIndex >= 0 ? row[zctaIndex] : '';
        
      case 'block_group':
        const blockGroupIndex = headers.indexOf('block group');
        return blockGroupIndex >= 0 ? row[blockGroupIndex] : '';
        
      default:
        return '';
    }
  }

  private extractName(row: any[], headers: string[]): string {
    const nameIndex = headers.indexOf('NAME');
    return nameIndex >= 0 ? row[nameIndex] : '';
  }

  private async checkRateLimit(): Promise<boolean> {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const callsPerMs = this.config.apiRateLimit.dailyLimit / msPerDay;
    const timeSinceLastCall = now.getTime() - this.lastApiCallTime.getTime();
    
    // Simple rate limiting - ensure we don't exceed burst limit
    if (this.apiCallsUsed >= this.config.apiRateLimit.dailyLimit) {
      return false;
    }
    
    // Update tracking
    this.apiCallsUsed++;
    this.lastApiCallTime = now;
    
    return true;
  }

  private handleJobSuccess(job: LoadingJob, result: DataLoadResult, workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = 'idle';
      worker.currentJobId = undefined;
      worker.jobsCompleted++;
      worker.totalProcessingTime += result.duration;
    }

    this.activeJobs.delete(job.id);
    this.completedJobs++;
    this.totalProcessingTime += result.duration;

    console.log(`✅ Worker ${workerId} completed job ${job.id}: ${result.recordsLoaded} records loaded`);
    this.emit('job_completed', job.id, result);
  }

  private handleJobFailure(job: LoadingJob, error: LoadingError, workerId?: string): void {
    if (workerId) {
      const worker = this.workers.get(workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJobId = undefined;
        worker.jobsFailed++;
      }
    }

    this.activeJobs.delete(job.id);
    this.failedJobs++;

    console.log(`❌ Worker ${workerId || 'unknown'} failed job ${job.id}: ${error.message}`);
    this.emit('job_failed', job.id, error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
import { EventEmitter } from 'events';
import { 
  LoadingJob, 
  LoadingProgress, 
  LoadingMetrics, 
  LoadingConfiguration,
  DataLoadResult,
  LoadingEvent,
  LoadingContext,
  GeographySpec,
  ApiRateLimit,
  LoadingError
} from '../utils/LoadingTypes';
import { PriorityQueueManager } from './PriorityQueueManager';
import { ConcurrentWorkerPool } from '../processing/ConcurrentWorkerPool';
import { DataLoadMonitor } from '../monitoring/DataLoadMonitor';
import { configurationManager } from '../utils/LoadingConfiguration';
import { LOADING_PHASES, calculateJobPriority } from '../utils/PriorityDefinitions';
import { censusApiService } from '../../services/censusApiService';

export class DataLoadingOrchestrator extends EventEmitter {
  private config: LoadingConfiguration;
  private queueManager: PriorityQueueManager;
  private workerPool: ConcurrentWorkerPool;
  private monitor: DataLoadMonitor;
  
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentPhase?: string;
  private apiCallsUsed: number = 0;
  private sessionStartTime: Date;
  
  // State tracking
  private activeJobs: Map<string, LoadingJob> = new Map();
  private completedJobs: Map<string, DataLoadResult> = new Map();
  private failedJobs: Map<string, LoadingError> = new Map();
  
  constructor(customConfig?: Partial<LoadingConfiguration>) {
    super();
    
    this.config = configurationManager.getConfiguration();
    if (customConfig) {
      configurationManager.updateConfiguration(customConfig);
      this.config = configurationManager.getConfiguration();
    }
    
    this.queueManager = new PriorityQueueManager(this.config);
    this.workerPool = new ConcurrentWorkerPool(this.config);
    this.monitor = new DataLoadMonitor(this.config);
    
    this.sessionStartTime = new Date();
    this.setupEventHandlers();
    
    console.log('DataLoadingOrchestrator initialized');
  }
  
  /**
   * Start the priority-based loading sequence
   */
  async startPriorityLoading(phaseNames?: string[]): Promise<void> {
    if (this.isRunning) {
      throw new Error('Loading is already in progress');
    }
    
    console.log('🚀 Starting priority-based Census data loading...');
    this.isRunning = true;
    this.isPaused = false;
    this.sessionStartTime = new Date();
    
    try {
      // Load phases in priority order
      const phasesToLoad = phaseNames 
        ? LOADING_PHASES.filter(p => phaseNames.includes(p.name))
        : LOADING_PHASES;
      
      for (const phase of phasesToLoad.sort((a, b) => b.priority - a.priority)) {
        if (!this.isRunning || this.isPaused) break;
        
        console.log(`📋 Starting loading phase: ${phase.name}`);
        this.currentPhase = phase.name;
        
        await this.executePhase(phase);
        
        console.log(`✅ Completed loading phase: ${phase.name}`);
      }
      
      if (this.isRunning) {
        console.log('🎉 Priority loading completed successfully!');
        this.emit('loading_completed', this.getProgress());
      }
      
    } catch (error) {
      console.error('❌ Priority loading failed:', error);
      this.emit('loading_failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentPhase = undefined;
    }
  }
  
  /**
   * Execute a specific loading phase
   */
  private async executePhase(phase: typeof LOADING_PHASES[0]): Promise<void> {
    // Create jobs for this phase
    const jobs = await this.createJobsForPhase(phase);
    
    console.log(`  Created ${jobs.length} jobs for phase ${phase.name}`);
    
    // Add jobs to the priority queue
    for (const job of jobs) {
      await this.queueManager.addJob(job);
    }
    
    // Process jobs until phase is complete
    await this.processPhaseJobs(phase.name);
  }
  
  /**
   * Create loading jobs for a specific phase
   */
  private async createJobsForPhase(phase: typeof LOADING_PHASES[0]): Promise<LoadingJob[]> {
    const jobs: LoadingJob[] = [];
    
    for (const geography of phase.geographies) {
      // Split into manageable chunks based on geography level
      const chunks = await this.chunkGeographyRequest(geography, phase.variables);
      
      for (const chunk of chunks) {
        const job: LoadingJob = {
          id: this.generateJobId(),
          type: 'bulk',
          priority: calculateJobPriority(chunk.geography, chunk.variables, phase.name),
          status: 'pending',
          dataset: 'acs5',
          year: '2022',
          geography: chunk.geography,
          variables: chunk.variables,
          createdAt: new Date(),
          estimatedRecords: this.estimateRecordCount(chunk.geography),
          processedRecords: 0,
          errorCount: 0,
          retryCount: 0,
          maxRetries: this.config.maxRetries,
          metadata: {
            phase: phase.name,
            chunkIndex: chunks.indexOf(chunk),
            totalChunks: chunks.length
          }
        };
        
        jobs.push(job);
      }
    }
    
    return jobs.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Chunk geography requests into manageable API calls
   */
  private async chunkGeographyRequest(
    geography: GeographySpec, 
    variables: string[]
  ): Promise<Array<{ geography: GeographySpec; variables: string[] }>> {
    const chunks: Array<{ geography: GeographySpec; variables: string[] }> = [];
    const maxVariablesPerCall = 50; // Census API limit
    
    // Chunk variables if needed
    for (let i = 0; i < variables.length; i += maxVariablesPerCall) {
      const variableChunk = variables.slice(i, i + maxVariablesPerCall);
      
      // For large geography sets, we might need to chunk those too
      if (geography.codes && geography.codes.length > 100) {
        // Chunk geography codes for very large requests
        const batchSize = configurationManager.getConfiguration().batchSizes[geography.level] || 25;
        
        for (let j = 0; j < geography.codes.length; j += batchSize) {
          const geoChunk = geography.codes.slice(j, j + batchSize);
          chunks.push({
            geography: { ...geography, codes: geoChunk },
            variables: variableChunk
          });
        }
      } else {
        chunks.push({
          geography,
          variables: variableChunk
        });
      }
    }
    
    return chunks;
  }
  
  /**
   * Process all jobs for a specific phase
   */
  private async processPhaseJobs(phaseName: string): Promise<void> {
    while (this.queueManager.hasJobsForPhase(phaseName) && this.isRunning && !this.isPaused) {
      // Check if we should pause due to rate limits or errors
      if (this.shouldPauseLoading()) {
        console.log('⏸️  Pausing loading due to rate limits or error rate');
        await this.pauseLoading();
        continue;
      }
      
      // Get next batch of jobs within concurrency limits
      const availableWorkers = this.workerPool.getAvailableWorkerCount();
      if (availableWorkers === 0) {
        // Wait for workers to become available
        await this.sleep(1000);
        continue;
      }
      
      const jobsToProcess = await this.queueManager.getNextJobs(
        Math.min(availableWorkers, this.config.maxConcurrentJobs)
      );
      
      if (jobsToProcess.length === 0) {
        await this.sleep(1000);
        continue;
      }
      
      // Submit jobs to worker pool
      for (const job of jobsToProcess) {
        this.activeJobs.set(job.id, job);
        this.workerPool.submitJob(job);
      }
      
      // Wait for some jobs to complete before continuing
      await this.sleep(2000);
    }
    
    // Wait for all active jobs in this phase to complete
    while (this.hasActiveJobsForPhase(phaseName)) {
      await this.sleep(1000);
    }
  }
  
  /**
   * Add a custom loading job
   */
  async addJob(
    geography: GeographySpec,
    variables: string[],
    priority?: number
  ): Promise<string> {
    const job: LoadingJob = {
      id: this.generateJobId(),
      type: 'bulk',
      priority: priority || calculateJobPriority(geography, variables),
      status: 'pending',
      dataset: 'acs5',
      year: '2022',
      geography,
      variables,
      createdAt: new Date(),
      estimatedRecords: this.estimateRecordCount(geography),
      processedRecords: 0,
      errorCount: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      metadata: { custom: true }
    };
    
    await this.queueManager.addJob(job);
    
    console.log(`📝 Added custom job ${job.id} with priority ${job.priority}`);
    return job.id;
  }
  
  /**
   * Pause the loading process
   */
  async pauseLoading(): Promise<void> {
    console.log('⏸️  Pausing data loading...');
    this.isPaused = true;
    await this.workerPool.pause();
    this.emit('loading_paused', this.getProgress());
  }
  
  /**
   * Resume the loading process
   */
  async resumeLoading(): Promise<void> {
    console.log('▶️  Resuming data loading...');
    this.isPaused = false;
    await this.workerPool.resume();
    this.emit('loading_resumed', this.getProgress());
  }
  
  /**
   * Stop the loading process
   */
  async stopLoading(): Promise<void> {
    console.log('🛑 Stopping data loading...');
    this.isRunning = false;
    this.isPaused = false;
    await this.workerPool.stop();
    this.emit('loading_stopped', this.getProgress());
  }
  
  /**
   * Get current loading progress
   */
  getProgress(): LoadingProgress {
    const totalJobs = this.queueManager.getTotalJobCount();
    const completedJobs = this.completedJobs.size;
    const currentJobs = Array.from(this.activeJobs.values());
    
    const progress: LoadingProgress = {
      jobId: currentJobs[0]?.id || '',
      totalJobs,
      completedJobs,
      currentJob: currentJobs[0],
      estimatedCompletion: this.estimateCompletion(),
      progressPercentage: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      recordsPerSecond: this.calculateRecordsPerSecond(),
      apiCallsUsed: this.apiCallsUsed,
      apiCallsRemaining: this.config.apiRateLimit.dailyLimit - this.apiCallsUsed,
      status: this.isRunning ? (this.isPaused ? 'paused' : 'loading') : 'idle',
      errors: Array.from(this.failedJobs.values())
    };
    
    return progress;
  }
  
  /**
   * Get current loading metrics
   */
  getMetrics(): LoadingMetrics {
    return this.monitor.getCurrentMetrics();
  }
  
  /**
   * Get loading context for external monitoring
   */
  getContext(): LoadingContext {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      progress: this.getProgress(),
      rateLimit: this.getCurrentRateLimit(),
      connections: [], // TODO: Get from database manager
      activeJobs: Array.from(this.activeJobs.values()),
      queueDepth: this.queueManager.getQueueDepth()
    };
  }
  
  // Private helper methods
  
  private setupEventHandlers(): void {
    this.workerPool.on('job_completed', (jobId: string, result: DataLoadResult) => {
      const job = this.activeJobs.get(jobId);
      if (job) {
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, result);
        this.apiCallsUsed += result.apiCalls;
        
        console.log(`✅ Job ${jobId} completed: ${result.recordsLoaded} records loaded`);
        this.emit('job_completed', { type: 'job_completed', job, result });
      }
    });
    
    this.workerPool.on('job_failed', (jobId: string, error: LoadingError) => {
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.errorCount++;
        
        if (job.retryCount < job.maxRetries) {
          job.retryCount++;
          job.status = 'pending';
          console.log(`🔄 Retrying job ${jobId} (attempt ${job.retryCount}/${job.maxRetries})`);
          this.queueManager.addJob(job);
        } else {
          this.activeJobs.delete(jobId);
          this.failedJobs.set(jobId, error);
          console.log(`❌ Job ${jobId} failed permanently: ${error.message}`);
        }
        
        this.emit('job_failed', { type: 'job_failed', job, error });
      }
    });
    
    // Set up periodic progress updates
    setInterval(() => {
      if (this.isRunning) {
        this.emit('progress_update', { type: 'progress_update', progress: this.getProgress() });
      }
    }, this.config.monitoring.metricsInterval);
  }
  
  private shouldPauseLoading(): boolean {
    const errorRate = this.calculateErrorRate();
    return configurationManager.shouldPauseLoading(this.apiCallsUsed, errorRate);
  }
  
  private calculateErrorRate(): number {
    const totalJobs = this.completedJobs.size + this.failedJobs.size;
    return totalJobs > 0 ? this.failedJobs.size / totalJobs : 0;
  }
  
  private calculateRecordsPerSecond(): number {
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    const totalRecords = Array.from(this.completedJobs.values())
      .reduce((sum, result) => sum + result.recordsLoaded, 0);
    
    return sessionDuration > 0 ? (totalRecords / (sessionDuration / 1000)) : 0;
  }
  
  private estimateCompletion(): Date {
    const progress = this.getProgress();
    const remainingJobs = progress.totalJobs - progress.completedJobs;
    const recordsPerSecond = this.calculateRecordsPerSecond();
    
    if (recordsPerSecond === 0 || remainingJobs === 0) {
      return new Date();
    }
    
    const estimatedSeconds = remainingJobs * 30; // Rough estimate: 30 seconds per job
    return new Date(Date.now() + estimatedSeconds * 1000);
  }
  
  private getCurrentRateLimit(): ApiRateLimit {
    const budget = configurationManager.getApiCallBudget();
    
    return {
      totalCalls: budget.total,
      remainingCalls: budget.available - this.apiCallsUsed,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      burstAvailable: this.config.apiRateLimit.burstLimit,
      estimatedDepletion: new Date(Date.now() + 
        ((budget.available - this.apiCallsUsed) / this.calculateRecordsPerSecond() * 1000))
    };
  }
  
  private hasActiveJobsForPhase(phaseName: string): boolean {
    return Array.from(this.activeJobs.values())
      .some(job => job.metadata?.phase === phaseName);
  }
  
  private estimateRecordCount(geography: GeographySpec): number {
    // Rough estimates based on geography level
    const estimates = {
      nation: 1,
      state: 51,
      metro: 384,
      county: 3143,
      place: 19495,
      zcta: 33120,
      tract: 74001,
      block_group: 220740
    };
    
    return estimates[geography.level] || 1000;
  }
  
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const dataLoadingOrchestrator = new DataLoadingOrchestrator();
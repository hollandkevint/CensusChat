import { EventEmitter } from 'events';
import { 
  LoadingJob, 
  LoadingConfiguration, 
  LoadingError 
} from '../utils/LoadingTypes';

export interface QueueMetrics {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageWaitTime: number;
  queueDepthByPriority: Record<number, number>;
}

export class PriorityQueueManager extends EventEmitter {
  private config: LoadingConfiguration;
  private jobQueue: Map<string, LoadingJob> = new Map();
  private priorityIndex: Map<number, Set<string>> = new Map();
  private phaseIndex: Map<string, Set<string>> = new Map();
  private runningJobs: Set<string> = new Set();
  private completedJobs: Set<string> = new Set();
  private failedJobs: Set<string> = new Set();
  
  // Performance tracking
  private queueStartTimes: Map<string, Date> = new Map();
  private metrics: QueueMetrics = {
    totalJobs: 0,
    pendingJobs: 0,
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageWaitTime: 0,
    queueDepthByPriority: {}
  };

  constructor(config: LoadingConfiguration) {
    super();
    this.config = config;
    
    // Initialize priority index
    for (let i = 0; i <= 100; i += 10) {
      this.priorityIndex.set(i, new Set());
    }
    
    console.log('PriorityQueueManager initialized');
  }

  /**
   * Add a job to the priority queue
   */
  async addJob(job: LoadingJob): Promise<void> {
    if (this.jobQueue.has(job.id)) {
      throw new Error(`Job ${job.id} already exists in queue`);
    }

    // Add to main queue
    this.jobQueue.set(job.id, job);
    this.queueStartTimes.set(job.id, new Date());

    // Add to priority index
    const priorityBucket = Math.floor(job.priority / 10) * 10;
    if (!this.priorityIndex.has(priorityBucket)) {
      this.priorityIndex.set(priorityBucket, new Set());
    }
    this.priorityIndex.get(priorityBucket)!.add(job.id);

    // Add to phase index if applicable
    const phase = job.metadata?.phase;
    if (phase) {
      if (!this.phaseIndex.has(phase)) {
        this.phaseIndex.set(phase, new Set());
      }
      this.phaseIndex.get(phase)!.add(job.id);
    }

    this.updateMetrics();
    
    console.log(`📝 Added job ${job.id} to queue with priority ${job.priority}`);
    this.emit('job_queued', job);
  }

  /**
   * Get the next highest priority jobs up to the specified count
   */
  async getNextJobs(maxJobs: number): Promise<LoadingJob[]> {
    const jobs: LoadingJob[] = [];
    const availableJobs = this.getAvailableJobIds();

    if (availableJobs.length === 0) {
      return jobs;
    }

    // Sort by priority (highest first), then by creation time (oldest first)
    const sortedJobIds = availableJobs.sort((a, b) => {
      const jobA = this.jobQueue.get(a)!;
      const jobB = this.jobQueue.get(b)!;
      
      if (jobA.priority !== jobB.priority) {
        return jobB.priority - jobA.priority; // Higher priority first
      }
      
      return jobA.createdAt.getTime() - jobB.createdAt.getTime(); // Older first
    });

    // Take up to maxJobs
    for (let i = 0; i < Math.min(maxJobs, sortedJobIds.length); i++) {
      const jobId = sortedJobIds[i];
      const job = this.jobQueue.get(jobId)!;
      
      // Mark as running
      job.status = 'running';
      job.startedAt = new Date();
      this.runningJobs.add(jobId);
      
      jobs.push(job);
    }

    this.updateMetrics();
    
    if (jobs.length > 0) {
      console.log(`🔄 Retrieved ${jobs.length} jobs from queue for processing`);
    }

    return jobs;
  }

  /**
   * Mark a job as completed
   */
  async completeJob(jobId: string): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    job.status = 'completed';
    job.completedAt = new Date();
    
    this.runningJobs.delete(jobId);
    this.completedJobs.add(jobId);
    
    // Remove from indices
    this.removeFromIndices(jobId, job);
    
    this.updateMetrics();
    
    console.log(`✅ Job ${jobId} marked as completed`);
    this.emit('job_completed', job);
  }

  /**
   * Mark a job as failed
   */
  async failJob(jobId: string, error: LoadingError): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    job.status = 'failed';
    job.errorCount++;
    
    this.runningJobs.delete(jobId);
    this.failedJobs.add(jobId);
    
    // Remove from indices if max retries exceeded
    if (job.retryCount >= job.maxRetries) {
      this.removeFromIndices(jobId, job);
    } else {
      // Reset status for retry
      job.status = 'pending';
      job.retryCount++;
    }
    
    this.updateMetrics();
    
    console.log(`❌ Job ${jobId} marked as failed: ${error.message}`);
    this.emit('job_failed', { job, error });
  }

  /**
   * Get jobs for a specific phase
   */
  getJobsForPhase(phaseName: string): LoadingJob[] {
    const jobIds = this.phaseIndex.get(phaseName) || new Set();
    return Array.from(jobIds)
      .map(id => this.jobQueue.get(id))
      .filter((job): job is LoadingJob => job !== undefined);
  }

  /**
   * Check if there are jobs for a specific phase
   */
  hasJobsForPhase(phaseName: string): boolean {
    const phaseJobs = this.getJobsForPhase(phaseName);
    return phaseJobs.some(job => job.status === 'pending');
  }

  /**
   * Get jobs by priority range
   */
  getJobsByPriorityRange(minPriority: number, maxPriority: number): LoadingJob[] {
    const jobs: LoadingJob[] = [];
    
    for (const [priority, jobIds] of this.priorityIndex.entries()) {
      if (priority >= minPriority && priority <= maxPriority) {
        for (const jobId of jobIds) {
          const job = this.jobQueue.get(jobId);
          if (job) {
            jobs.push(job);
          }
        }
      }
    }
    
    return jobs.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Pause all jobs in queue
   */
  async pauseAll(): Promise<void> {
    for (const job of this.jobQueue.values()) {
      if (job.status === 'pending' || job.status === 'running') {
        job.status = 'paused';
      }
    }
    
    this.updateMetrics();
    console.log('⏸️  All jobs in queue paused');
    this.emit('queue_paused');
  }

  /**
   * Resume all paused jobs
   */
  async resumeAll(): Promise<void> {
    for (const job of this.jobQueue.values()) {
      if (job.status === 'paused') {
        job.status = 'pending';
      }
    }
    
    this.updateMetrics();
    console.log('▶️  All paused jobs resumed');
    this.emit('queue_resumed');
  }

  /**
   * Clear completed and failed jobs from memory
   */
  async cleanup(): Promise<void> {
    const initialSize = this.jobQueue.size;
    
    // Remove completed jobs older than 1 hour
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [jobId, job] of this.jobQueue.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') 
          && job.completedAt && job.completedAt < cutoffTime) {
        
        this.jobQueue.delete(jobId);
        this.queueStartTimes.delete(jobId);
        this.completedJobs.delete(jobId);
        this.failedJobs.delete(jobId);
        this.removeFromIndices(jobId, job);
      }
    }
    
    const cleanedCount = initialSize - this.jobQueue.size;
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old jobs from queue`);
    }
    
    this.updateMetrics();
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get total job count
   */
  getTotalJobCount(): number {
    return this.jobQueue.size;
  }

  /**
   * Get queue depth
   */
  getQueueDepth(): number {
    return Array.from(this.jobQueue.values())
      .filter(job => job.status === 'pending').length;
  }

  /**
   * Get specific job by ID
   */
  getJob(jobId: string): LoadingJob | undefined {
    return this.jobQueue.get(jobId);
  }

  /**
   * Get all jobs with a specific status
   */
  getJobsByStatus(status: LoadingJob['status']): LoadingJob[] {
    return Array.from(this.jobQueue.values())
      .filter(job => job.status === status);
  }

  // Private helper methods

  private getAvailableJobIds(): string[] {
    return Array.from(this.jobQueue.entries())
      .filter(([_, job]) => job.status === 'pending')
      .map(([jobId, _]) => jobId);
  }

  private removeFromIndices(jobId: string, job: LoadingJob): void {
    // Remove from priority index
    const priorityBucket = Math.floor(job.priority / 10) * 10;
    const prioritySet = this.priorityIndex.get(priorityBucket);
    if (prioritySet) {
      prioritySet.delete(jobId);
    }

    // Remove from phase index
    const phase = job.metadata?.phase;
    if (phase) {
      const phaseSet = this.phaseIndex.get(phase);
      if (phaseSet) {
        phaseSet.delete(jobId);
      }
    }
  }

  private updateMetrics(): void {
    const allJobs = Array.from(this.jobQueue.values());
    
    this.metrics = {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === 'pending').length,
      runningJobs: allJobs.filter(j => j.status === 'running').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      averageWaitTime: this.calculateAverageWaitTime(),
      queueDepthByPriority: this.calculateQueueDepthByPriority()
    };
  }

  private calculateAverageWaitTime(): number {
    const completedJobs = Array.from(this.jobQueue.values())
      .filter(job => job.status === 'completed' && job.startedAt);
    
    if (completedJobs.length === 0) return 0;
    
    const totalWaitTime = completedJobs.reduce((sum, job) => {
      const startTime = this.queueStartTimes.get(job.id);
      if (startTime && job.startedAt) {
        return sum + (job.startedAt.getTime() - startTime.getTime());
      }
      return sum;
    }, 0);
    
    return totalWaitTime / completedJobs.length;
  }

  private calculateQueueDepthByPriority(): Record<number, number> {
    const depthByPriority: Record<number, number> = {};
    
    for (const [priority, jobIds] of this.priorityIndex.entries()) {
      const pendingCount = Array.from(jobIds)
        .map(id => this.jobQueue.get(id))
        .filter(job => job && job.status === 'pending').length;
      
      if (pendingCount > 0) {
        depthByPriority[priority] = pendingCount;
      }
    }
    
    return depthByPriority;
  }
}
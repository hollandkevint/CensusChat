export interface DataFreshness {
  dataset: string;
  lastUpdated: Date;
  recordCount: number;
  status: 'fresh' | 'stale' | 'refreshing' | 'error';
  dataSource: string;
  version?: string;
  expiryThreshold?: number; // Hours until considered stale
}

export interface DataFreshnessReport {
  overallStatus: 'fresh' | 'stale' | 'mixed' | 'error';
  lastGlobalRefresh?: Date;
  datasets: DataFreshness[];
  summary: {
    totalDatasets: number;
    freshDatasets: number;
    staleDatasets: number;
    refreshingDatasets: number;
    errorDatasets: number;
  };
  recommendations: string[];
}

class DataFreshnessTracker {
  private freshnessCache = new Map<string, DataFreshness>();
  private readonly DEFAULT_STALE_THRESHOLD = 24; // 24 hours

  /**
   * Record a data refresh operation
   */
  recordDataRefresh(dataset: string, recordCount: number, dataSource: string, version?: string): void {
    const freshness: DataFreshness = {
      dataset,
      lastUpdated: new Date(),
      recordCount,
      status: 'fresh',
      dataSource,
      version,
      expiryThreshold: this.getStaleThreshold(dataset)
    };

    this.freshnessCache.set(dataset, freshness);
    console.log(`📊 Recorded data refresh for ${dataset}: ${recordCount} records from ${dataSource}`);
  }

  /**
   * Mark dataset as refreshing
   */
  markDatasetAsRefreshing(dataset: string): void {
    const existing = this.freshnessCache.get(dataset);
    if (existing) {
      existing.status = 'refreshing';
      this.freshnessCache.set(dataset, existing);
    } else {
      // Create new entry for refreshing dataset
      const freshness: DataFreshness = {
        dataset,
        lastUpdated: new Date(),
        recordCount: 0,
        status: 'refreshing',
        dataSource: 'pending',
        expiryThreshold: this.getStaleThreshold(dataset)
      };
      this.freshnessCache.set(dataset, freshness);
    }
  }

  /**
   * Mark dataset as having an error
   */
  markDatasetAsError(dataset: string, error: string): void {
    const existing = this.freshnessCache.get(dataset);
    if (existing) {
      existing.status = 'error';
      this.freshnessCache.set(dataset, existing);
    } else {
      const freshness: DataFreshness = {
        dataset,
        lastUpdated: new Date(),
        recordCount: 0,
        status: 'error',
        dataSource: `Error: ${error}`,
        expiryThreshold: this.getStaleThreshold(dataset)
      };
      this.freshnessCache.set(dataset, freshness);
    }
  }

  /**
   * Get freshness status for a specific dataset
   */
  getDatasetFreshness(dataset: string): DataFreshness | null {
    const freshness = this.freshnessCache.get(dataset);
    if (!freshness) {
      return null;
    }

    // Update status based on time elapsed
    return this.updateFreshnessStatus(freshness);
  }

  /**
   * Get freshness for all tracked datasets
   */
  getAllDatasetFreshness(): DataFreshness[] {
    const allFreshness: DataFreshness[] = [];

    for (const freshness of this.freshnessCache.values()) {
      allFreshness.push(this.updateFreshnessStatus(freshness));
    }

    return allFreshness;
  }

  /**
   * Get comprehensive data freshness report
   */
  getDataFreshnessReport(): DataFreshnessReport {
    const datasets = this.getAllDatasetFreshness();

    // Calculate summary statistics
    const summary = {
      totalDatasets: datasets.length,
      freshDatasets: datasets.filter(d => d.status === 'fresh').length,
      staleDatasets: datasets.filter(d => d.status === 'stale').length,
      refreshingDatasets: datasets.filter(d => d.status === 'refreshing').length,
      errorDatasets: datasets.filter(d => d.status === 'error').length
    };

    // Determine overall status
    let overallStatus: DataFreshnessReport['overallStatus'] = 'fresh';
    if (summary.errorDatasets > 0) {
      overallStatus = 'error';
    } else if (summary.staleDatasets > 0 && summary.freshDatasets > 0) {
      overallStatus = 'mixed';
    } else if (summary.staleDatasets > 0) {
      overallStatus = 'stale';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, datasets);

    // Find last global refresh
    const lastGlobalRefresh = datasets
      .filter(d => d.lastUpdated)
      .reduce((latest, current) =>
        !latest || current.lastUpdated > latest ? current.lastUpdated : latest,
        null as Date | null
      ) || undefined;

    return {
      overallStatus,
      lastGlobalRefresh,
      datasets,
      summary,
      recommendations
    };
  }

  /**
   * Get data age in hours for a dataset
   */
  getDataAge(dataset: string): number | null {
    const freshness = this.getDatasetFreshness(dataset);
    if (!freshness || !freshness.lastUpdated) {
      return null;
    }

    const ageMs = Date.now() - freshness.lastUpdated.getTime();
    return Math.round(ageMs / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal place
  }

  /**
   * Get human-readable age string
   */
  getDataAgeString(dataset: string): string {
    const ageHours = this.getDataAge(dataset);
    if (ageHours === null) {
      return 'Unknown';
    }

    if (ageHours < 1) {
      const minutes = Math.round(ageHours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (ageHours < 24) {
      return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.round(ageHours / 24 * 10) / 10;
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Initialize with default healthcare datasets
   */
  initializeHealthcareDatasets(): void {
    const healthcareDatasets = [
      { name: 'census_variables', source: 'US Census Bureau', staleHours: 168 }, // 1 week
      { name: 'zip5_demographics', source: 'ACS 5-Year', staleHours: 24 }, // 1 day
      { name: 'block_group_demographics', source: 'ACS 5-Year', staleHours: 24 }, // 1 day
      { name: 'healthcare_patterns', source: 'CensusChat Analytics', staleHours: 12 }, // 12 hours
      { name: 'medicare_eligibility', source: 'Healthcare Analytics', staleHours: 6 }, // 6 hours
      { name: 'population_health', source: 'Healthcare Analytics', staleHours: 6 }  // 6 hours
    ];

    for (const dataset of healthcareDatasets) {
      if (!this.freshnessCache.has(dataset.name)) {
        // Initialize as stale to encourage initial refresh
        const freshness: DataFreshness = {
          dataset: dataset.name,
          lastUpdated: new Date(0), // Unix epoch - very old
          recordCount: 0,
          status: 'stale',
          dataSource: dataset.source,
          expiryThreshold: dataset.staleHours
        };
        this.freshnessCache.set(dataset.name, freshness);
      }
    }

    console.log(`🔄 Initialized freshness tracking for ${healthcareDatasets.length} healthcare datasets`);
  }

  /**
   * Clear all freshness data
   */
  clearAllFreshness(): void {
    this.freshnessCache.clear();
    console.log('🧹 Cleared all data freshness records');
  }

  /**
   * Update freshness status based on elapsed time
   */
  private updateFreshnessStatus(freshness: DataFreshness): DataFreshness {
    // Don't update if already in error or refreshing state
    if (freshness.status === 'error' || freshness.status === 'refreshing') {
      return freshness;
    }

    const ageHours = (Date.now() - freshness.lastUpdated.getTime()) / (1000 * 60 * 60);
    const threshold = freshness.expiryThreshold || this.DEFAULT_STALE_THRESHOLD;

    const updatedFreshness = { ...freshness };
    updatedFreshness.status = ageHours > threshold ? 'stale' : 'fresh';

    // Update the cache with new status
    this.freshnessCache.set(freshness.dataset, updatedFreshness);

    return updatedFreshness;
  }

  /**
   * Get stale threshold for a dataset type
   */
  private getStaleThreshold(dataset: string): number {
    const thresholds: Record<string, number> = {
      'census_variables': 168,    // 1 week - variables don't change often
      'zip5_demographics': 24,    // 1 day - demographic data changes slowly
      'block_group_demographics': 24,  // 1 day
      'healthcare_patterns': 12,  // 12 hours - analytics patterns can be updated more frequently
      'medicare_eligibility': 6,  // 6 hours - healthcare analytics should be fresh
      'population_health': 6,     // 6 hours
      'facility_adequacy': 12     // 12 hours
    };

    return thresholds[dataset] || this.DEFAULT_STALE_THRESHOLD;
  }

  /**
   * Generate recommendations based on freshness report
   */
  private generateRecommendations(
    summary: DataFreshnessReport['summary'],
    datasets: DataFreshness[]
  ): string[] {
    const recommendations: string[] = [];

    if (summary.errorDatasets > 0) {
      const errorDatasets = datasets.filter(d => d.status === 'error').map(d => d.dataset);
      recommendations.push(`Fix errors in: ${errorDatasets.join(', ')}`);
    }

    if (summary.staleDatasets > 0) {
      const staleDatasets = datasets.filter(d => d.status === 'stale').map(d => d.dataset);
      recommendations.push(`Refresh stale data: ${staleDatasets.join(', ')}`);
    }

    if (summary.refreshingDatasets > 0) {
      recommendations.push('Wait for ongoing refresh operations to complete');
    }

    if (summary.totalDatasets === 0) {
      recommendations.push('Initialize data tracking by running a data refresh');
    }

    // Healthcare-specific recommendations
    const healthcareDatasets = datasets.filter(d =>
      d.dataset.includes('healthcare') ||
      d.dataset.includes('medicare') ||
      d.dataset.includes('population_health')
    );

    if (healthcareDatasets.length > 0 && healthcareDatasets.every(d => d.status === 'stale')) {
      recommendations.push('Healthcare analytics may be impacted - refresh healthcare datasets immediately');
    }

    return recommendations;
  }
}

// Singleton instance
export const dataFreshnessTracker = new DataFreshnessTracker();
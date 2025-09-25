import { dataFreshnessTracker } from '../../utils/dataFreshnessTracker';

describe('DataFreshnessTracker', () => {
  beforeEach(() => {
    // Clear all freshness data before each test
    dataFreshnessTracker.clearAllFreshness();
  });

  describe('recordDataRefresh', () => {
    it('should record data refresh with correct information', () => {
      dataFreshnessTracker.recordDataRefresh(
        'test_dataset',
        100,
        'Test Data Source',
        'v1.0'
      );

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');

      expect(freshness).not.toBeNull();
      expect(freshness!.dataset).toBe('test_dataset');
      expect(freshness!.recordCount).toBe(100);
      expect(freshness!.dataSource).toBe('Test Data Source');
      expect(freshness!.version).toBe('v1.0');
      expect(freshness!.status).toBe('fresh');
    });

    it('should update existing dataset record', () => {
      // First record
      dataFreshnessTracker.recordDataRefresh('test_dataset', 50, 'Source A');

      // Update record
      dataFreshnessTracker.recordDataRefresh('test_dataset', 100, 'Source B', 'v2.0');

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');

      expect(freshness!.recordCount).toBe(100);
      expect(freshness!.dataSource).toBe('Source B');
      expect(freshness!.version).toBe('v2.0');
    });
  });

  describe('markDatasetAsRefreshing', () => {
    it('should mark dataset as refreshing', () => {
      dataFreshnessTracker.markDatasetAsRefreshing('test_dataset');

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');

      expect(freshness!.status).toBe('refreshing');
      expect(freshness!.dataSource).toBe('pending');
    });

    it('should update existing dataset to refreshing status', () => {
      dataFreshnessTracker.recordDataRefresh('test_dataset', 100, 'Test Source');
      dataFreshnessTracker.markDatasetAsRefreshing('test_dataset');

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');

      expect(freshness!.status).toBe('refreshing');
      expect(freshness!.recordCount).toBe(100); // Should retain original data
    });
  });

  describe('markDatasetAsError', () => {
    it('should mark dataset as error', () => {
      dataFreshnessTracker.markDatasetAsError('test_dataset', 'Connection failed');

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');

      expect(freshness!.status).toBe('error');
      expect(freshness!.dataSource).toBe('Error: Connection failed');
    });
  });

  describe('getDataAge', () => {
    it('should return null for non-existent dataset', () => {
      const age = dataFreshnessTracker.getDataAge('non_existent');
      expect(age).toBeNull();
    });

    it('should calculate age correctly for fresh dataset', () => {
      dataFreshnessTracker.recordDataRefresh('test_dataset', 100, 'Test Source');

      const age = dataFreshnessTracker.getDataAge('test_dataset');

      expect(age).not.toBeNull();
      expect(age!).toBeLessThan(1); // Should be less than 1 hour old
    });

    it('should return correct age string for recent data', () => {
      dataFreshnessTracker.recordDataRefresh('test_dataset', 100, 'Test Source');

      const ageString = dataFreshnessTracker.getDataAgeString('test_dataset');

      expect(ageString).toMatch(/\d+ minutes? ago/);
    });
  });

  describe('getDataFreshnessReport', () => {
    it('should return correct report for mixed dataset statuses', () => {
      // Create datasets with different statuses
      dataFreshnessTracker.recordDataRefresh('fresh_dataset', 100, 'Source A');
      dataFreshnessTracker.markDatasetAsError('error_dataset', 'Failed');
      dataFreshnessTracker.markDatasetAsRefreshing('refreshing_dataset');

      // Make one dataset stale by manually setting old timestamp
      const staleDataset = {
        dataset: 'stale_dataset',
        lastUpdated: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        recordCount: 50,
        status: 'stale' as const,
        dataSource: 'Old Source',
        expiryThreshold: 24
      };
      // Manually add to cache (this is a bit hacky but needed for testing)
      (dataFreshnessTracker as any).freshnessCache.set('stale_dataset', staleDataset);

      const report = dataFreshnessTracker.getDataFreshnessReport();

      expect(report.overallStatus).toBe('mixed'); // Mixed because we have fresh, stale, error, refreshing
      expect(report.summary.totalDatasets).toBe(4);
      expect(report.summary.freshDatasets).toBe(1);
      expect(report.summary.staleDatasets).toBe(1);
      expect(report.summary.errorDatasets).toBe(1);
      expect(report.summary.refreshingDatasets).toBe(1);
      expect(report.recommendations).toHaveLength(3); // Fix errors, refresh stale, wait for refreshing
    });

    it('should return fresh status when all datasets are fresh', () => {
      dataFreshnessTracker.recordDataRefresh('dataset1', 100, 'Source A');
      dataFreshnessTracker.recordDataRefresh('dataset2', 200, 'Source B');

      const report = dataFreshnessTracker.getDataFreshnessReport();

      expect(report.overallStatus).toBe('fresh');
      expect(report.summary.freshDatasets).toBe(2);
      expect(report.summary.staleDatasets).toBe(0);
      expect(report.recommendations).toHaveLength(0);
    });

    it('should return error status when any dataset has errors', () => {
      dataFreshnessTracker.recordDataRefresh('fresh_dataset', 100, 'Source A');
      dataFreshnessTracker.markDatasetAsError('error_dataset', 'Failed');

      const report = dataFreshnessTracker.getDataFreshnessReport();

      expect(report.overallStatus).toBe('error');
      expect(report.recommendations[0]).toContain('Fix errors in: error_dataset');
    });
  });

  describe('initializeHealthcareDatasets', () => {
    it('should initialize healthcare datasets with stale status', () => {
      dataFreshnessTracker.initializeHealthcareDatasets();

      const allFreshness = dataFreshnessTracker.getAllDatasetFreshness();
      const healthcareDatasets = allFreshness.filter(f =>
        ['census_variables', 'zip5_demographics', 'healthcare_patterns'].includes(f.dataset)
      );

      expect(healthcareDatasets.length).toBeGreaterThan(0);
      healthcareDatasets.forEach(dataset => {
        expect(dataset.status).toBe('stale'); // Should start as stale to encourage refresh
      });
    });

    it('should not overwrite existing dataset records', () => {
      // Record a fresh dataset first
      dataFreshnessTracker.recordDataRefresh('census_variables', 100, 'Fresh Source');

      // Initialize healthcare datasets
      dataFreshnessTracker.initializeHealthcareDatasets();

      const freshness = dataFreshnessTracker.getDatasetFreshness('census_variables');

      expect(freshness!.dataSource).toBe('Fresh Source'); // Should not be overwritten
      expect(freshness!.recordCount).toBe(100); // Should not be overwritten
    });
  });

  describe('clearAllFreshness', () => {
    it('should clear all freshness records', () => {
      dataFreshnessTracker.recordDataRefresh('test_dataset', 100, 'Test Source');
      dataFreshnessTracker.clearAllFreshness();

      const freshness = dataFreshnessTracker.getDatasetFreshness('test_dataset');
      const allFreshness = dataFreshnessTracker.getAllDatasetFreshness();

      expect(freshness).toBeNull();
      expect(allFreshness).toHaveLength(0);
    });
  });
});
import { DataRefreshService } from '../../services/dataRefreshService';

// Mock dependencies
jest.mock('../../utils/censusDataLoader');
jest.mock('../../modules/healthcare_analytics');
jest.mock('../../utils/dataFreshnessTracker');

describe('DataRefreshService', () => {
  let dataRefreshService: DataRefreshService;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    mockProgressCallback = jest.fn();
    dataRefreshService = new DataRefreshService(mockProgressCallback);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshHealthcareData', () => {
    it('should successfully refresh healthcare data', async () => {
      // Mock successful responses
      const mockHealthCheck = { healthy: true };
      const mockLoadResult = {
        success: true,
        recordsLoaded: 100,
        errors: [],
        duration: 1000
      };

      // Mock the healthcare module
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck),
        getAvailablePatterns: jest.fn().mockResolvedValue(['pattern1', 'pattern2'])
      };

      // Mock census data loader methods
      const mockCensusDataLoader = {
        loadVariableMetadata: jest.fn().mockResolvedValue(mockLoadResult),
        loadZip5TestData: jest.fn().mockResolvedValue(mockLoadResult),
        loadBlockGroupTestData: jest.fn().mockResolvedValue(mockLoadResult),
        showDataStats: jest.fn().mockResolvedValue(undefined)
      };

      // Mock the modules
      jest.doMock('../../modules/healthcare_analytics', () => ({
        getHealthcareAnalyticsModule: jest.fn().mockReturnValue(mockHealthcareModule)
      }));

      jest.doMock('../../utils/censusDataLoader', () => ({
        censusDataLoader: mockCensusDataLoader
      }));

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(300); // 100 * 3 datasets
      expect(result.datasetsRefreshed).toHaveLength(4); // variables, zip5, blockGroup, patterns
      expect(mockProgressCallback).toHaveBeenCalledTimes(6); // 6 progress updates
    });

    it('should handle healthcare module health check failure', async () => {
      const mockHealthCheck = { healthy: false };
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck)
      };

      jest.doMock('../../modules/healthcare_analytics', () => ({
        getHealthcareAnalyticsModule: jest.fn().mockReturnValue(mockHealthcareModule)
      }));

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Healthcare analytics module is not healthy');
    });

    it('should handle partial refresh failures gracefully', async () => {
      const mockHealthCheck = { healthy: true };
      const mockSuccessResult = {
        success: true,
        recordsLoaded: 100,
        errors: [],
        duration: 1000
      };
      const mockFailResult = {
        success: false,
        recordsLoaded: 0,
        errors: ['Mock error'],
        duration: 500
      };

      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck),
        getAvailablePatterns: jest.fn().mockResolvedValue(['pattern1'])
      };

      const mockCensusDataLoader = {
        loadVariableMetadata: jest.fn().mockResolvedValue(mockSuccessResult),
        loadZip5TestData: jest.fn().mockResolvedValue(mockFailResult), // This will fail
        loadBlockGroupTestData: jest.fn().mockResolvedValue(mockSuccessResult),
        showDataStats: jest.fn().mockResolvedValue(undefined)
      };

      jest.doMock('../../modules/healthcare_analytics', () => ({
        getHealthcareAnalyticsModule: jest.fn().mockReturnValue(mockHealthcareModule)
      }));

      jest.doMock('../../utils/censusDataLoader', () => ({
        censusDataLoader: mockCensusDataLoader
      }));

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(true); // Should still be true as some datasets succeeded
      expect(result.recordsUpdated).toBe(201); // 100 + 0 + 100 + 1 pattern
      expect(result.datasetsRefreshed).toContain('census_variables');
      expect(result.datasetsRefreshed).toContain('block_group_demographics');
      expect(result.datasetsRefreshed).not.toContain('zip5_demographics');
    });
  });

  describe('performIncrementalUpdate', () => {
    it('should perform incremental update for specified datasets', async () => {
      const mockLoadResult = {
        success: true,
        recordsLoaded: 50,
        errors: [],
        duration: 500
      };

      const mockCensusDataLoader = {
        loadVariableMetadata: jest.fn().mockResolvedValue(mockLoadResult)
      };

      jest.doMock('../../utils/censusDataLoader', () => ({
        censusDataLoader: mockCensusDataLoader
      }));

      const result = await dataRefreshService.performIncrementalUpdate(['census_variables']);

      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(50);
      expect(result.datasetsRefreshed).toEqual(['census_variables']);
    });

    it('should handle unknown dataset gracefully', async () => {
      const result = await dataRefreshService.performIncrementalUpdate(['unknown_dataset']);

      expect(result.success).toBe(false);
      expect(result.recordsUpdated).toBe(0);
      expect(result.datasetsRefreshed).toEqual([]);
    });
  });

  describe('getRefreshStatus', () => {
    it('should return healthy status when system is operational', async () => {
      const mockHealthCheck = { healthy: true };
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck)
      };

      jest.doMock('../../modules/healthcare_analytics', () => ({
        getHealthcareAnalyticsModule: jest.fn().mockReturnValue(mockHealthcareModule)
      }));

      const status = await dataRefreshService.getRefreshStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.availableDatasets).toHaveLength(4);
      expect(status.availableDatasets).toContain('census_variables');
      expect(status.availableDatasets).toContain('zip5_demographics');
    });

    it('should handle health check errors gracefully', async () => {
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockRejectedValue(new Error('Health check failed'))
      };

      jest.doMock('../../modules/healthcare_analytics', () => ({
        getHealthcareAnalyticsModule: jest.fn().mockReturnValue(mockHealthcareModule)
      }));

      const status = await dataRefreshService.getRefreshStatus();

      expect(status.isHealthy).toBe(false);
      expect(status.availableDatasets).toEqual([]);
      expect(status.recordCounts).toEqual({});
    });
  });

  describe('rollbackToLastKnownGood', () => {
    it('should successfully simulate rollback operation', async () => {
      const result = await dataRefreshService.rollbackToLastKnownGood();

      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(0);
      expect(result.datasetsRefreshed).toEqual(['rollback_completed']);
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
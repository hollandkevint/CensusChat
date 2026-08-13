import { DataRefreshService } from '../../services/dataRefreshService';
import { censusDataLoader } from '../../utils/censusDataLoader';
import { getHealthcareAnalyticsModule } from '../../modules/healthcare_analytics';

// Mock dependencies (hoisted auto-mocks). We configure them per-test via the
// typed handles below instead of jest.doMock, which does not affect the already
// imported DataRefreshService.
jest.mock('../../utils/censusDataLoader');
jest.mock('../../modules/healthcare_analytics');
jest.mock('../../utils/dataFreshnessTracker');

const mockCensusDataLoader = censusDataLoader as jest.Mocked<typeof censusDataLoader>;
const mockGetHealthcareAnalyticsModule = getHealthcareAnalyticsModule as jest.Mock;

describe('DataRefreshService', () => {
  let dataRefreshService: DataRefreshService;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressCallback = jest.fn();
    dataRefreshService = new DataRefreshService(mockProgressCallback);
  });

  describe('refreshHealthcareData', () => {
    it('should successfully refresh healthcare data', async () => {
      const mockLoadResult = {
        success: true,
        recordsLoaded: 100,
        errors: [],
        duration: 1000
      };

      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
        getAvailablePatterns: jest.fn().mockResolvedValue(['pattern1', 'pattern2']),
        validateQuery: jest.fn().mockResolvedValue({ isValid: true, errors: [] })
      };
      mockGetHealthcareAnalyticsModule.mockReturnValue(mockHealthcareModule);

      mockCensusDataLoader.loadVariableMetadata.mockResolvedValue(mockLoadResult);
      mockCensusDataLoader.loadZip5TestData.mockResolvedValue(mockLoadResult);
      mockCensusDataLoader.loadBlockGroupTestData.mockResolvedValue(mockLoadResult);
      mockCensusDataLoader.showDataStats.mockResolvedValue(undefined);

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(300); // 100 * 3 datasets
      expect(result.datasetsRefreshed).toHaveLength(4); // variables, zip5, blockGroup, patterns
      expect(mockProgressCallback).toHaveBeenCalledTimes(8); // 8 progress stages
    });

    it('should handle healthcare module health check failure', async () => {
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue({ healthy: false })
      };
      mockGetHealthcareAnalyticsModule.mockReturnValue(mockHealthcareModule);

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Healthcare analytics module is not healthy');
    });

    it('should handle partial refresh failures gracefully', async () => {
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
        healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
        getAvailablePatterns: jest.fn().mockResolvedValue(['pattern1']),
        validateQuery: jest.fn().mockResolvedValue({ isValid: true, errors: [] })
      };
      mockGetHealthcareAnalyticsModule.mockReturnValue(mockHealthcareModule);

      mockCensusDataLoader.loadVariableMetadata.mockResolvedValue(mockSuccessResult);
      mockCensusDataLoader.loadZip5TestData.mockResolvedValue(mockFailResult); // This will fail
      mockCensusDataLoader.loadBlockGroupTestData.mockResolvedValue(mockSuccessResult);
      mockCensusDataLoader.showDataStats.mockResolvedValue(undefined);

      const result = await dataRefreshService.refreshHealthcareData();

      expect(result.success).toBe(true); // Should still be true as some datasets succeeded
      expect(result.recordsUpdated).toBe(200); // 100 vars + 0 zip5 + 100 blockGroup (patterns are not counted as data records)
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

      mockCensusDataLoader.loadVariableMetadata.mockResolvedValue(mockLoadResult);

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
      const mockHealthcareModule = {
        healthCheck: jest.fn().mockResolvedValue({ healthy: true })
      };
      mockGetHealthcareAnalyticsModule.mockReturnValue(mockHealthcareModule);

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
      mockGetHealthcareAnalyticsModule.mockReturnValue(mockHealthcareModule);

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

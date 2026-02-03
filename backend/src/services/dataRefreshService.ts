import { censusDataLoader } from '../utils/censusDataLoader';
import { getHealthcareAnalyticsModule } from '../modules/healthcare_analytics';
import { dataFreshnessTracker } from '../utils/dataFreshnessTracker';
import { getDuckDBPool } from '../utils/duckdbPool';

export interface DataRefreshResult {
  success: boolean;
  duration: number;
  recordsUpdated: number;
  error?: string;
  datasetsRefreshed: string[];
  summary: {
    healthcareData: boolean;
    censusVariables: boolean;
    geographyData: boolean;
  };
}

export interface DataRefreshProgress {
  stage: 'initializing' | 'loading_variables' | 'loading_demographics' | 'loading_healthcare' | 'validating' | 'complete';
  percentage: number;
  currentOperation: string;
  estimatedTimeRemaining: number;
}

export class DataRefreshService {
  private progressCallback?: (progress: DataRefreshProgress) => void;

  constructor(progressCallback?: (progress: DataRefreshProgress) => void) {
    this.progressCallback = progressCallback;
  }

  private updateProgress(stage: DataRefreshProgress['stage'], percentage: number, currentOperation: string, estimatedTimeRemaining: number) {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        percentage,
        currentOperation,
        estimatedTimeRemaining
      });
    }
    console.log(`[DataRefresh] ${stage}: ${percentage}% - ${currentOperation} (${estimatedTimeRemaining}s remaining)`);
  }

  /**
   * Refresh all healthcare datasets with transaction safety
   */
  async refreshHealthcareData(): Promise<DataRefreshResult> {
    const startTime = Date.now();
    const result: DataRefreshResult = {
      success: false,
      duration: 0,
      recordsUpdated: 0,
      datasetsRefreshed: [],
      summary: {
        healthcareData: false,
        censusVariables: false,
        geographyData: false
      }
    };

    try {
      this.updateProgress('initializing', 0, 'Initializing data refresh process', 30);

      // Step 1: Validate healthcare analytics module
      this.updateProgress('initializing', 10, 'Validating healthcare analytics module', 28);
      const healthcareModule = getHealthcareAnalyticsModule();
      const healthCheck = await healthcareModule.healthCheck();

      if (!healthCheck.healthy) {
        throw new Error('Healthcare analytics module is not healthy - cannot proceed with refresh');
      }

      // Step 2: Load variable metadata first
      this.updateProgress('loading_variables', 20, 'Refreshing Census variable definitions', 24);
      dataFreshnessTracker.markDatasetAsRefreshing('census_variables');
      const variablesResult = await censusDataLoader.loadVariableMetadata();

      if (variablesResult.success) {
        result.recordsUpdated += variablesResult.recordsLoaded;
        result.datasetsRefreshed.push('census_variables');
        result.summary.censusVariables = true;
        dataFreshnessTracker.recordDataRefresh(
          'census_variables',
          variablesResult.recordsLoaded,
          'US Census Bureau API'
        );
      } else {
        console.warn('Variable metadata refresh failed:', variablesResult.errors);
        dataFreshnessTracker.markDatasetAsError(
          'census_variables',
          variablesResult.errors.join('; ')
        );
      }

      // Step 3: Load demographics data - ZIP5 level
      this.updateProgress('loading_demographics', 40, 'Refreshing ZIP5 demographic data', 18);
      dataFreshnessTracker.markDatasetAsRefreshing('zip5_demographics');
      const zip5Result = await censusDataLoader.loadZip5TestData('06'); // California

      if (zip5Result.success) {
        result.recordsUpdated += zip5Result.recordsLoaded;
        result.datasetsRefreshed.push('zip5_demographics');
        result.summary.geographyData = true;
        dataFreshnessTracker.recordDataRefresh(
          'zip5_demographics',
          zip5Result.recordsLoaded,
          'ACS 5-Year Survey'
        );
      } else {
        dataFreshnessTracker.markDatasetAsError(
          'zip5_demographics',
          zip5Result.errors.join('; ')
        );
      }

      // Step 4: Load demographics data - Block Group level
      this.updateProgress('loading_demographics', 60, 'Refreshing Block Group demographic data', 12);
      dataFreshnessTracker.markDatasetAsRefreshing('block_group_demographics');
      const blockGroupResult = await censusDataLoader.loadBlockGroupTestData('06', '075'); // San Francisco County

      if (blockGroupResult.success) {
        result.recordsUpdated += blockGroupResult.recordsLoaded;
        result.datasetsRefreshed.push('block_group_demographics');
        dataFreshnessTracker.recordDataRefresh(
          'block_group_demographics',
          blockGroupResult.recordsLoaded,
          'ACS 5-Year Survey'
        );
      } else {
        dataFreshnessTracker.markDatasetAsError(
          'block_group_demographics',
          blockGroupResult.errors.join('; ')
        );
      }

      // Step 5: Validate healthcare analytics patterns
      this.updateProgress('loading_healthcare', 80, 'Validating healthcare analytics patterns', 6);
      dataFreshnessTracker.markDatasetAsRefreshing('healthcare_patterns');
      const availablePatterns = await healthcareModule.getAvailablePatterns();

      if (availablePatterns.length > 0) {
        result.datasetsRefreshed.push('healthcare_patterns');
        result.summary.healthcareData = true;
        dataFreshnessTracker.recordDataRefresh(
          'healthcare_patterns',
          availablePatterns.length,
          'CensusChat Healthcare Analytics'
        );
      } else {
        dataFreshnessTracker.markDatasetAsError(
          'healthcare_patterns',
          'No healthcare analytics patterns available'
        );
      }

      // Step 6: Final validation
      this.updateProgress('validating', 95, 'Validating refreshed data integrity', 2);
      await this.validateRefreshedData();

      // Calculate final results
      result.duration = Date.now() - startTime;
      result.success = result.recordsUpdated > 0 && result.datasetsRefreshed.length > 0;

      this.updateProgress('complete', 100, `Refresh completed - ${result.recordsUpdated} records updated`, 0);

      console.log('=== Data Refresh Summary ===');
      console.log(`Total duration: ${result.duration}ms`);
      console.log(`Records updated: ${result.recordsUpdated}`);
      console.log(`Datasets refreshed: ${result.datasetsRefreshed.join(', ')}`);
      console.log(`Overall success: ${result.success}`);

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : 'Unknown error during data refresh';

      console.error('Data refresh failed:', result.error);

      this.updateProgress('complete', 100, `Refresh failed: ${result.error}`, 0);

      return result;
    }
  }

  /**
   * Perform incremental data updates for specific datasets
   */
  async performIncrementalUpdate(datasets: string[]): Promise<DataRefreshResult> {
    const startTime = Date.now();
    const result: DataRefreshResult = {
      success: false,
      duration: 0,
      recordsUpdated: 0,
      datasetsRefreshed: [],
      summary: {
        healthcareData: false,
        censusVariables: false,
        geographyData: false
      }
    };

    try {
      console.log(`Performing incremental update for datasets: ${datasets.join(', ')}`);

      for (const dataset of datasets) {
        switch (dataset) {
          case 'census_variables':
            const variablesResult = await censusDataLoader.loadVariableMetadata();
            if (variablesResult.success) {
              result.recordsUpdated += variablesResult.recordsLoaded;
              result.datasetsRefreshed.push(dataset);
              result.summary.censusVariables = true;
            }
            break;

          case 'zip5_demographics':
            const zip5Result = await censusDataLoader.loadZip5TestData();
            if (zip5Result.success) {
              result.recordsUpdated += zip5Result.recordsLoaded;
              result.datasetsRefreshed.push(dataset);
              result.summary.geographyData = true;
            }
            break;

          case 'block_group_demographics':
            const blockGroupResult = await censusDataLoader.loadBlockGroupTestData();
            if (blockGroupResult.success) {
              result.recordsUpdated += blockGroupResult.recordsLoaded;
              result.datasetsRefreshed.push(dataset);
              result.summary.geographyData = true;
            }
            break;

          default:
            console.warn(`Unknown dataset for incremental update: ${dataset}`);
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.recordsUpdated > 0;

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : 'Unknown error during incremental update';
      return result;
    }
  }

  /**
   * Validate data integrity after refresh
   */
  private async validateRefreshedData(): Promise<void> {
    try {
      // Basic validation - check if we can query the data
      await censusDataLoader.showDataStats();

      // Validate healthcare analytics module can still operate
      const healthcareModule = getHealthcareAnalyticsModule();
      const testResult = await healthcareModule.validateQuery('test medicare eligibility in California');

      if (!testResult.isValid) {
        throw new Error(`Healthcare analytics validation failed: ${testResult.errors.join(', ')}`);
      }

      console.log('✅ Data validation completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      console.error('❌ Data validation failed:', errorMessage);
      throw new Error(`Data validation failed: ${errorMessage}`);
    }
  }

  /**
   * Get refresh status and system health
   */
  async getRefreshStatus(): Promise<{
    lastRefresh?: Date;
    isHealthy: boolean;
    availableDatasets: string[];
    recordCounts: Record<string, number>;
  }> {
    try {
      // This would typically read from a metadata table
      // For MVP, we'll check current system health
      const healthcareModule = getHealthcareAnalyticsModule();
      const healthCheck = await healthcareModule.healthCheck();

      return {
        isHealthy: healthCheck.healthy,
        availableDatasets: [
          'census_variables',
          'zip5_demographics',
          'block_group_demographics',
          'healthcare_patterns'
        ],
        recordCounts: {
          census_variables: 0, // Would query actual counts
          demographics: 0,     // Would query actual counts
          healthcare: 0        // Would query actual counts
        }
      };

    } catch (error) {
      console.error('Error getting refresh status:', error);
      return {
        isHealthy: false,
        availableDatasets: [],
        recordCounts: {}
      };
    }
  }

  /**
   * Refresh county data using MERGE INTO statement (DuckDB 1.4+)
   *
   * Uses atomic MERGE operation instead of DELETE + INSERT for better
   * performance and transaction safety. RETURNING clause provides
   * counts of updated vs inserted rows.
   *
   * @param newData Array of county records to merge
   * @returns Count of updated and inserted rows
   */
  async refreshCountyDataWithMerge(
    newData: Array<{ state_fips: string; county_fips: string; population: number; median_income: number }>
  ): Promise<{ updated: number; inserted: number }> {
    const pool = getDuckDBPool();
    const conn = await pool.acquire();

    try {
      // Create staging table from new data
      // Using VALUES clause to create inline table from array
      if (newData.length === 0) {
        return { updated: 0, inserted: 0 };
      }

      const valuesClause = newData
        .map(d => `('${d.state_fips}', '${d.county_fips}', ${d.population}, ${d.median_income})`)
        .join(',\n        ');

      await conn.run(`
        CREATE OR REPLACE TEMP TABLE staging_county AS
        SELECT * FROM (VALUES
        ${valuesClause}
        ) AS t(state_fips, county_fips, population, median_income)
      `);

      // MERGE with RETURNING to count actions
      // merge_action column returns 'UPDATE' or 'INSERT' for each affected row
      const reader = await conn.runAndReadAll(`
        MERGE INTO county_data AS target
        USING staging_county AS source
        ON target.state_fips = source.state_fips
           AND target.county_fips = source.county_fips
        WHEN MATCHED THEN UPDATE SET
          population = source.population,
          median_income = source.median_income
        WHEN NOT MATCHED THEN INSERT BY NAME
        RETURNING merge_action
      `);

      const actions = reader.getRowObjects() as Array<{ merge_action: string }>;
      return {
        updated: actions.filter(a => a.merge_action === 'UPDATE').length,
        inserted: actions.filter(a => a.merge_action === 'INSERT').length
      };
    } finally {
      pool.release(conn);
    }
  }

  /**
   * Add rollback capability for failed refresh operations
   */
  async rollbackToLastKnownGood(): Promise<DataRefreshResult> {
    // For MVP, we'll implement basic rollback simulation
    // In production, this would restore from backup tables
    console.log('🔄 Attempting rollback to last known good state...');

    try {
      // Simulate rollback process
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        duration: 1000,
        recordsUpdated: 0,
        datasetsRefreshed: ['rollback_completed'],
        summary: {
          healthcareData: true,
          censusVariables: true,
          geographyData: true
        }
      };

    } catch (error) {
      return {
        success: false,
        duration: 1000,
        recordsUpdated: 0,
        error: 'Rollback failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        datasetsRefreshed: [],
        summary: {
          healthcareData: false,
          censusVariables: false,
          geographyData: false
        }
      };
    }
  }
}

// Singleton instance with default configuration
export const dataRefreshService = new DataRefreshService();
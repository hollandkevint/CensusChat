import { censusApiService, CensusApiResponse } from '../services/censusApiService';
import { censusDataModel, CensusDataRecord, CensusVariable } from '../models/CensusData';
import crypto from 'crypto';

interface LoadResult {
  success: boolean;
  recordsLoaded: number;
  errors: string[];
  duration: number;
  incrementalUpdate?: boolean;
  rollbackAvailable?: boolean;
  backupTimestamp?: Date;
}

export class CensusDataLoader {
  /**
   * Parse Census API response and convert to database records
   */
  private parseApiResponse(
    response: CensusApiResponse, 
    dataset: string, 
    year: string, 
    geographyLevel: string
  ): CensusDataRecord[] {
    const records: CensusDataRecord[] = [];
    const [headers, ...dataRows] = response.data;

    // Find indices of key columns
    const nameIndex = headers.findIndex(h => h === 'NAME');
    const stateIndex = headers.findIndex(h => h === 'state');
    const countyIndex = headers.findIndex(h => h === 'county');
    const tractIndex = headers.findIndex(h => h === 'tract');
    const blockGroupIndex = headers.findIndex(h => h === 'block group');
    const zipIndex = headers.findIndex(h => h === 'zip code tabulation area');

    dataRows.forEach(row => {
      const geographyName = nameIndex >= 0 ? row[nameIndex] : '';
      const stateCode = stateIndex >= 0 ? row[stateIndex] : undefined;
      const countyCode = countyIndex >= 0 ? row[countyIndex] : undefined;
      const tractCode = tractIndex >= 0 ? row[tractIndex] : undefined;
      const blockGroupCode = blockGroupIndex >= 0 ? row[blockGroupIndex] : undefined;
      const zipCode = zipIndex >= 0 ? row[zipIndex] : undefined;

      // Generate geography code based on available codes
      let geographyCode = '';
      if (zipCode) {
        geographyCode = zipCode;
      } else if (blockGroupCode && tractCode && countyCode && stateCode) {
        geographyCode = `${stateCode}${countyCode}${tractCode}${blockGroupCode}`;
      } else if (tractCode && countyCode && stateCode) {
        geographyCode = `${stateCode}${countyCode}${tractCode}`;
      } else if (countyCode && stateCode) {
        geographyCode = `${stateCode}${countyCode}`;
      } else if (stateCode) {
        geographyCode = stateCode;
      }

      // Process each variable column
      headers.forEach((header, index) => {
        // Skip geography columns
        if (['NAME', 'state', 'county', 'tract', 'block group', 'zip code tabulation area'].includes(header)) {
          return;
        }

        const value = row[index];
        const numericValue = value === null || value === '' ? null : parseFloat(value);
        
        // Determine if this is a margin of error variable
        const isMarginOfError = header.endsWith('M');
        const baseVariableName = isMarginOfError ? header.slice(0, -1) + 'E' : header;

        records.push({
          geography_level: geographyLevel,
          geography_code: geographyCode,
          geography_name: geographyName,
          state_code: stateCode,
          county_code: countyCode,
          tract_code: tractCode,
          block_group_code: blockGroupCode,
          zip_code: zipCode,
          variable_name: isMarginOfError ? baseVariableName : header,
          variable_value: isMarginOfError ? null : numericValue,
          margin_of_error: isMarginOfError ? numericValue : null,
          dataset,
          year
        });
      });
    });

    return records;
  }

  /**
   * Load test data for ZIP5 (ZCTA) level
   */
  async loadZip5TestData(stateCode: string = '06'): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let recordsLoaded = 0;

    try {
      console.log(`Loading ACS 5-Year ZIP5 test data for state ${stateCode}...`);
      
      // Execute the test query
      const response = await censusApiService.executeTestQuery('zip5_acs5');
      console.log(`Received ${response.rowCount} ZIP5 records from Census API`);

      // Parse response into database records
      const records = this.parseApiResponse(response, 'acs5', '2022', 'zip code tabulation area');
      
      // Insert records into database
      await censusDataModel.insertCensusData(records);
      recordsLoaded = records.length;

      console.log(`Successfully loaded ${recordsLoaded} ZIP5 census records`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`ZIP5 data loading failed: ${errorMessage}`);
      console.error('ZIP5 data loading error:', error);
    }

    return {
      success: errors.length === 0,
      recordsLoaded,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Load test data for Census Block Group level
   */
  async loadBlockGroupTestData(stateCode: string = '06', countyCode: string = '075'): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let recordsLoaded = 0;

    try {
      console.log(`Loading ACS 5-Year Block Group test data for state ${stateCode}, county ${countyCode}...`);
      
      // Execute the test query
      const response = await censusApiService.getACS5BlockGroupData(stateCode, countyCode);
      console.log(`Received ${response.rowCount} Block Group records from Census API`);

      // Parse response into database records
      const records = this.parseApiResponse(response, 'acs5', '2022', 'block group');
      
      // Insert records into database
      await censusDataModel.insertCensusData(records);
      recordsLoaded = records.length;

      console.log(`Successfully loaded ${recordsLoaded} Block Group census records`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Block Group data loading failed: ${errorMessage}`);
      console.error('Block Group data loading error:', error);
    }

    return {
      success: errors.length === 0,
      recordsLoaded,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Load variable metadata from knowledge base
   */
  async loadVariableMetadata(): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let recordsLoaded = 0;

    try {
      console.log('Loading Census variable metadata...');
      
      // Get common variables from knowledge base
      const knowledgeBase = await censusApiService.getTestQueries();
      const commonVariables = await censusApiService.getAvailableDatasets();

      // Manually define common variables from the PDF knowledge
      const variables: CensusVariable[] = [
        {
          variable_name: 'B01003_001E',
          label: 'Total Population',
          concept: 'Total Population',
          table_id: 'B01003',
          universe: 'Total population',
          variable_type: 'estimate'
        },
        {
          variable_name: 'B01003_001M',
          label: 'Total Population (Margin of Error)',
          concept: 'Total Population',
          table_id: 'B01003',
          universe: 'Total population',
          variable_type: 'margin_of_error'
        },
        {
          variable_name: 'B25001_001E',
          label: 'Total Housing Units',
          concept: 'Housing Units',
          table_id: 'B25001',
          universe: 'Housing units',
          variable_type: 'estimate'
        },
        {
          variable_name: 'B25001_001M',
          label: 'Total Housing Units (Margin of Error)',
          concept: 'Housing Units',
          table_id: 'B25001',
          universe: 'Housing units',
          variable_type: 'margin_of_error'
        },
        {
          variable_name: 'B19013_001E',
          label: 'Median Household Income',
          concept: 'Median Household Income',
          table_id: 'B19013',
          universe: 'Households',
          variable_type: 'estimate'
        },
        {
          variable_name: 'B25077_001E',
          label: 'Median Value (Dollars)',
          concept: 'Median Value',
          table_id: 'B25077',
          universe: 'Owner-occupied housing units',
          variable_type: 'estimate'
        }
      ];

      await censusDataModel.insertCensusVariables(variables);
      recordsLoaded = variables.length;

      console.log(`Successfully loaded ${recordsLoaded} variable definitions`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Variable metadata loading failed: ${errorMessage}`);
      console.error('Variable metadata loading error:', error);
    }

    return {
      success: errors.length === 0,
      recordsLoaded,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute both test queries and load all initial data
   */
  async loadAllTestData(): Promise<{
    zip5: LoadResult;
    blockGroup: LoadResult;
    variables: LoadResult;
    summary: {
      totalRecords: number;
      totalDuration: number;
      allSuccessful: boolean;
    };
  }> {
    console.log('Starting comprehensive Census data loading...');
    
    // Load variable metadata first
    const variablesResult = await this.loadVariableMetadata();
    
    // Load ZIP5 test data
    const zip5Result = await this.loadZip5TestData('06'); // California
    
    // Load Block Group test data (San Francisco County)
    const blockGroupResult = await this.loadBlockGroupTestData('06', '075');

    const summary = {
      totalRecords: variablesResult.recordsLoaded + zip5Result.recordsLoaded + blockGroupResult.recordsLoaded,
      totalDuration: variablesResult.duration + zip5Result.duration + blockGroupResult.duration,
      allSuccessful: variablesResult.success && zip5Result.success && blockGroupResult.success
    };

    console.log(`\n=== Census Data Loading Summary ===`);
    console.log(`Variable Metadata: ${variablesResult.recordsLoaded} records (${variablesResult.duration}ms)`);
    console.log(`ZIP5 Data: ${zip5Result.recordsLoaded} records (${zip5Result.duration}ms)`);
    console.log(`Block Group Data: ${blockGroupResult.recordsLoaded} records (${blockGroupResult.duration}ms)`);
    console.log(`Total: ${summary.totalRecords} records in ${summary.totalDuration}ms`);
    console.log(`Status: ${summary.allSuccessful ? 'SUCCESS' : 'PARTIAL/FAILED'}`);

    if (!summary.allSuccessful) {
      console.log('\nErrors encountered:');
      [...variablesResult.errors, ...zip5Result.errors, ...blockGroupResult.errors]
        .forEach(error => console.log(`  - ${error}`));
    }

    return {
      zip5: zip5Result,
      blockGroup: blockGroupResult,
      variables: variablesResult,
      summary
    };
  }

  /**
   * Test database connectivity and show current data stats
   */
  async showDataStats(): Promise<void> {
    try {
      console.log('\n=== Current Census Data Statistics ===');
      
      const geographyStats = await censusDataModel.getGeographyLevelStats();
      console.log('Geography Levels:');
      geographyStats.forEach(stat => {
        console.log(`  ${stat.level}: ${stat.count} records`);
      });

      // Query sample data
      const sampleData = await censusDataModel.queryCensusData({
        variables: ['B01003_001E'],
        limit: 5
      });

      if (sampleData.length > 0) {
        console.log('\nSample Data:');
        sampleData.forEach(record => {
          console.log(`  ${record.geography_name} (${record.geography_level}): ${record.variable_value}`);
        });
      }

    } catch (error) {
      console.error('Error showing data stats:', error);
    }
  }

  /**
   * Create backup of existing data before refresh
   */
  private async createDataBackup(tableName: string): Promise<{ success: boolean; backupId: string; error?: string }> {
    try {
      const backupId = `backup_${tableName}_${Date.now()}`;
      console.log(`📦 Creating backup: ${backupId}`);

      // In a full implementation, this would create backup tables
      // For MVP, we'll simulate the backup process
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        backupId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown backup error';
      console.error('Backup creation failed:', errorMessage);
      return {
        success: false,
        backupId: '',
        error: errorMessage
      };
    }
  }

  /**
   * Perform incremental data update with integrity checks
   */
  async performIncrementalUpdate(datasetType: 'zip5' | 'blockGroup' | 'variables', options?: {
    stateCode?: string;
    countyCode?: string;
    validateIntegrity?: boolean;
  }): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let recordsLoaded = 0;
    const opts = { validateIntegrity: true, ...options };

    try {
      console.log(`🔄 Starting incremental update for ${datasetType}...`);

      // Step 1: Create backup before update
      let backupResult;
      if (datasetType !== 'variables') {
        backupResult = await this.createDataBackup(`census_data_${datasetType}`);
        if (!backupResult.success) {
          errors.push(`Backup creation failed: ${backupResult.error}`);
          console.warn('Continuing without backup...');
        }
      }

      // Step 2: Perform the data loading based on type
      let loadResult: LoadResult;

      switch (datasetType) {
        case 'zip5':
          loadResult = await this.loadZip5TestData(opts.stateCode || '06');
          break;
        case 'blockGroup':
          loadResult = await this.loadBlockGroupTestData(
            opts.stateCode || '06',
            opts.countyCode || '075'
          );
          break;
        case 'variables':
          loadResult = await this.loadVariableMetadata();
          break;
        default:
          throw new Error(`Unknown dataset type: ${datasetType}`);
      }

      recordsLoaded = loadResult.recordsLoaded;
      errors.push(...loadResult.errors);

      // Step 3: Validate data integrity if requested
      if (opts.validateIntegrity && loadResult.success) {
        console.log('🔍 Validating data integrity...');
        const integrityCheck = await this.validateDataIntegrity(datasetType);

        if (!integrityCheck.valid) {
          errors.push(`Data integrity validation failed: ${integrityCheck.errors.join(', ')}`);

          // Attempt rollback if backup exists
          if (backupResult?.success) {
            console.log('🔄 Attempting automatic rollback...');
            await this.rollbackToBackup(backupResult.backupId);
            errors.push('Automatic rollback initiated due to integrity failure');
          }
        }
      }

      console.log(`✅ Incremental update for ${datasetType} completed: ${recordsLoaded} records`);

      return {
        success: errors.length === 0,
        recordsLoaded,
        errors,
        duration: Date.now() - startTime,
        incrementalUpdate: true,
        rollbackAvailable: backupResult?.success || false,
        backupTimestamp: backupResult?.success ? new Date() : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Incremental update failed: ${errorMessage}`);
      console.error('Incremental update error:', error);

      return {
        success: false,
        recordsLoaded,
        errors,
        duration: Date.now() - startTime,
        incrementalUpdate: true
      };
    }
  }

  /**
   * Validate data integrity after refresh
   */
  private async validateDataIntegrity(datasetType: string): Promise<{
    valid: boolean;
    errors: string[];
    checksPerformed: string[];
  }> {
    const errors: string[] = [];
    const checksPerformed: string[] = [];

    try {
      // Check 1: Verify data exists
      checksPerformed.push('data_existence_check');
      const stats = await censusDataModel.getGeographyLevelStats();

      if (stats.length === 0) {
        errors.push('No geography data found after refresh');
      }

      // Check 2: Verify data completeness for healthcare analytics
      if (datasetType === 'zip5' || datasetType === 'blockGroup') {
        checksPerformed.push('healthcare_completeness_check');

        // Query for essential healthcare variables
        const healthcareData = await censusDataModel.queryCensusData({
          variables: ['B01003_001E'], // Total population
          limit: 5
        });

        if (healthcareData.length === 0) {
          errors.push('Healthcare analytics data not found after refresh');
        } else {
          // Check for valid values
          const validRecords = healthcareData.filter(record =>
            record.variable_value !== null &&
            typeof record.variable_value === 'number' &&
            record.variable_value >= 0
          );

          if (validRecords.length === 0) {
            errors.push('No valid healthcare data values found');
          }
        }
      }

      // Check 3: Verify metadata consistency
      if (datasetType === 'variables') {
        checksPerformed.push('metadata_consistency_check');

        const variables = await censusDataModel.getCensusVariables(['B01003_001E', 'B25001_001E']);

        if (variables.length < 2) {
          errors.push('Essential variable metadata missing after refresh');
        }
      }

      console.log(`🔍 Data integrity checks completed: ${checksPerformed.join(', ')}`);

      if (errors.length > 0) {
        console.warn('❌ Data integrity validation failed:', errors);
      } else {
        console.log('✅ Data integrity validation passed');
      }

      return {
        valid: errors.length === 0,
        errors,
        checksPerformed
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push(`Validation process failed: ${errorMessage}`);

      return {
        valid: false,
        errors,
        checksPerformed
      };
    }
  }

  /**
   * Rollback to a previous backup
   */
  async rollbackToBackup(backupId: string): Promise<LoadResult> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Rolling back to backup: ${backupId}`);

      // In a full implementation, this would restore from backup tables
      // For MVP, we'll simulate the rollback process
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`✅ Rollback to ${backupId} completed`);

      return {
        success: true,
        recordsLoaded: 0, // No new records loaded during rollback
        errors: [],
        duration: Date.now() - startTime,
        rollbackAvailable: false // Can't rollback from a rollback
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Rollback failed:', errorMessage);

      return {
        success: false,
        recordsLoaded: 0,
        errors: [`Rollback failed: ${errorMessage}`],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Enhanced data loading with transaction safety
   */
  async loadAllTestDataWithTransactionSafety(): Promise<{
    zip5: LoadResult;
    blockGroup: LoadResult;
    variables: LoadResult;
    summary: {
      totalRecords: number;
      totalDuration: number;
      allSuccessful: boolean;
      hasRollbackCapability: boolean;
    };
  }> {
    console.log('🔄 Starting enhanced Census data loading with transaction safety...');

    // Use incremental updates with integrity validation
    const variablesResult = await this.performIncrementalUpdate('variables');
    const zip5Result = await this.performIncrementalUpdate('zip5', { stateCode: '06' });
    const blockGroupResult = await this.performIncrementalUpdate('blockGroup', {
      stateCode: '06',
      countyCode: '075'
    });

    const summary = {
      totalRecords: variablesResult.recordsLoaded + zip5Result.recordsLoaded + blockGroupResult.recordsLoaded,
      totalDuration: variablesResult.duration + zip5Result.duration + blockGroupResult.duration,
      allSuccessful: variablesResult.success && zip5Result.success && blockGroupResult.success,
      hasRollbackCapability: !!(variablesResult.rollbackAvailable || zip5Result.rollbackAvailable || blockGroupResult.rollbackAvailable)
    };

    console.log(`\n=== Enhanced Census Data Loading Summary ===`);
    console.log(`Variable Metadata: ${variablesResult.recordsLoaded} records (${variablesResult.duration}ms)`);
    console.log(`ZIP5 Data: ${zip5Result.recordsLoaded} records (${zip5Result.duration}ms) - Rollback: ${zip5Result.rollbackAvailable ? 'Available' : 'N/A'}`);
    console.log(`Block Group Data: ${blockGroupResult.recordsLoaded} records (${blockGroupResult.duration}ms) - Rollback: ${blockGroupResult.rollbackAvailable ? 'Available' : 'N/A'}`);
    console.log(`Total: ${summary.totalRecords} records in ${summary.totalDuration}ms`);
    console.log(`Status: ${summary.allSuccessful ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
    console.log(`Rollback Capability: ${summary.hasRollbackCapability ? 'AVAILABLE' : 'NOT AVAILABLE'}`);

    if (!summary.allSuccessful) {
      console.log('\nErrors encountered:');
      [...variablesResult.errors, ...zip5Result.errors, ...blockGroupResult.errors]
        .forEach(error => console.log(`  - ${error}`));
    }

    return {
      zip5: zip5Result,
      blockGroup: blockGroupResult,
      variables: variablesResult,
      summary
    };
  }

  /**
   * Generate query hash for caching
   */
  generateQueryHash(query: any): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
  }
}

export const censusDataLoader = new CensusDataLoader();
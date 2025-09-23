import { DataValidationService } from '../data-loading/validation/DataValidationService';
import { createTestConfig } from '../test/helpers/testUtils';
import { mockDataScenarios } from '../test/fixtures/censusApiResponses';

describe('DataValidationService', () => {
  let validationService: DataValidationService;
  let config: any;

  beforeEach(() => {
    config = createTestConfig({
      validation: {
        enabled: true,
        strictMode: false,
        qualityThresholds: {
          completeness: 0.95,
          accuracy: 0.98,
          consistency: 0.90
        }
      }
    });
    
    validationService = new DataValidationService(config);
  });

  describe('Record Validation', () => {
    test('should validate valid records successfully', () => {
      const validData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223,
          var_b25001_001e: 14421230,
          created_at: new Date().toISOString(),
          job_id: 'test_job_1'
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b01003_001e: 29145505,
          var_b25001_001e: 11688233,
          created_at: new Date().toISOString(),
          job_id: 'test_job_1'
        }
      ];

      const result = validationService.validateData(validData, 'state');

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.metrics.validRecords).toBe(2);
      expect(result.metrics.invalidRecords).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const invalidData = [
        {
          // Missing dataset, year, geography_level
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          // Missing name
          var_b01003_001e: 29145505
        }
      ];

      const result = validationService.validateData(invalidData, 'state');

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0); // All records have issues
      expect(result.metrics.invalidRecords).toBe(2);
      
      // Should have issues for missing required fields
      const missingDataIssues = result.issues.filter(issue => issue.type === 'missing_data');
      expect(missingDataIssues.length).toBeGreaterThan(0);
    });

    test('should validate geography code formats', () => {
      const invalidGeographyData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: 'INVALID', // Should be 2 digits for state
          name: 'Invalid State',
          var_b01003_001e: 1000000
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'county',
          geography_code: '123', // Should be 5 digits for county
          name: 'Invalid County',
          var_b01003_001e: 500000
        }
      ];

      const stateResults = validationService.validateData([invalidGeographyData[0]], 'state');
      const countyResults = validationService.validateData([invalidGeographyData[1]], 'county');

      expect(stateResults.passed).toBe(false);
      expect(countyResults.passed).toBe(false);
      
      const geoIssues = [...stateResults.issues, ...countyResults.issues]
        .filter(issue => issue.type === 'inconsistent_geography');
      expect(geoIssues.length).toBeGreaterThan(0);
    });

    test('should detect invalid numeric values', () => {
      const invalidNumericData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 'not_a_number', // Invalid numeric value
          var_b25001_001e: 14421230
        }
      ];

      const result = validationService.validateData(invalidNumericData, 'state');

      expect(result.passed).toBe(false);
      
      const numericIssues = result.issues.filter(issue => issue.type === 'invalid_range');
      expect(numericIssues.length).toBeGreaterThan(0);
    });

    test('should detect outliers in data ranges', () => {
      const outlierData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 999999999999, // Extreme outlier for population
          var_b25001_001e: 14421230
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b01003_001e: -1000, // Negative population (invalid)
          var_b25001_001e: 11688233
        }
      ];

      const result = validationService.validateData(outlierData, 'state');

      expect(result.passed).toBe(false);
      
      const outlierIssues = result.issues.filter(issue => issue.type === 'outlier');
      expect(outlierIssues.length).toBeGreaterThan(0);
      expect(result.metrics.outliers).toBeGreaterThan(0);
    });
  });

  describe('Data Quality Scoring', () => {
    test('should calculate quality score correctly', () => {
      const mixedData = [
        // Valid record
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223
        },
        // Invalid record (missing required fields)
        {
          geography_code: '48',
          var_b01003_001e: 29145505
        }
      ];

      const result = validationService.validateData(mixedData, 'state');

      expect(result.score).toBe(0.5); // 50% valid
      expect(result.metrics.validRecords).toBe(1);
      expect(result.metrics.invalidRecords).toBe(1);
    });

    test('should pass validation when score meets threshold', () => {
      const config = createTestConfig({
        validation: {
          enabled: true,
          strictMode: false,
          qualityThresholds: {
            completeness: 0.95,
            accuracy: 0.50, // Lower threshold for test
            consistency: 0.90
          }
        }
      });

      const service = new DataValidationService(config);
      const mixedData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223
        },
        {
          geography_code: '48' // Missing fields
        }
      ];

      const result = service.validateData(mixedData, 'state');

      expect(result.score).toBe(0.5);
      expect(result.passed).toBe(true); // Should pass with 50% threshold
    });

    test('should fail validation when score below threshold', () => {
      const mixedData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223
        },
        {
          geography_code: '48' // Missing fields
        }
      ];

      const result = validationService.validateData(mixedData, 'state');

      expect(result.score).toBe(0.5);
      expect(result.passed).toBe(false); // Should fail with 98% threshold
    });
  });

  describe('Issue Aggregation', () => {
    test('should aggregate similar issues', () => {
      const dataWithSimilarIssues = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          // Missing name
          var_b01003_001e: 39538223
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          // Missing name
          var_b01003_001e: 29145505
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '12',
          // Missing name
          var_b01003_001e: 21538187
        }
      ];

      const result = validationService.validateData(dataWithSimilarIssues, 'state');

      // Should aggregate the "missing name" issues
      const nameIssues = result.issues.filter(issue => 
        issue.type === 'missing_data' && issue.message.includes('name')
      );
      
      expect(nameIssues).toHaveLength(1); // Aggregated into single issue
      expect(nameIssues[0].recordCount).toBe(3); // Affecting 3 records
    });

    test('should sort issues by severity and count', () => {
      const dataWithVariousIssues = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: 'INVALID', // Error: invalid format
          // Missing name - Error
          var_b01003_001e: 999999999 // Warning: outlier
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b01003_001e: 'invalid' // Error: invalid number
        }
      ];

      const result = validationService.validateData(dataWithVariousIssues, 'state');

      // Issues should be sorted by severity (error > warning > info)
      const errorIssues = result.issues.filter(issue => issue.severity === 'error');
      const warningIssues = result.issues.filter(issue => issue.severity === 'warning');

      expect(errorIssues.length).toBeGreaterThan(0);
      
      // First issues should be errors
      if (result.issues.length > 0) {
        expect(result.issues[0].severity).toBe('error');
      }
    });
  });

  describe('Geography-Specific Validation', () => {
    test('should apply state-specific validation rules', () => {
      const stateData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06', // Valid state code
          name: 'California',
          var_b01003_001e: 39538223
        }
      ];

      const result = validationService.validateData(stateData, 'state');
      expect(result.passed).toBe(true);
    });

    test('should apply county-specific validation rules', () => {
      const countyData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'county',
          geography_code: '06075', // Valid county code (5 digits)
          name: 'San Francisco County, California',
          var_b01003_001e: 873965
        }
      ];

      const result = validationService.validateData(countyData, 'county');
      expect(result.passed).toBe(true);
    });

    test('should apply ZCTA-specific validation rules', () => {
      const zctaData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'zcta',
          geography_code: '94102', // Valid ZIP code
          var_b01003_001e: 52847
        }
      ];

      const result = validationService.validateData(zctaData, 'zcta');
      expect(result.passed).toBe(true);
    });

    test('should apply block group-specific validation rules', () => {
      const blockGroupData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'block_group',
          geography_code: '060750101001', // Valid block group code (12 digits)
          var_b01003_001e: 1234
        }
      ];

      const result = validationService.validateData(blockGroupData, 'block_group');
      expect(result.passed).toBe(true);
    });
  });

  describe('Data Range Validation', () => {
    test('should validate population data ranges', () => {
      const populationData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223 // Valid population
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b01003_001e: 15000000000 // Exceeds max population
        }
      ];

      const result = validationService.validateData(populationData, 'state');
      
      expect(result.passed).toBe(false);
      const outlierIssues = result.issues.filter(issue => issue.type === 'outlier');
      expect(outlierIssues.length).toBeGreaterThan(0);
    });

    test('should validate housing unit data ranges', () => {
      const housingData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b25001_001e: 14421230 // Valid housing units
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b25001_001e: -1000 // Invalid negative housing units
        }
      ];

      const result = validationService.validateData(housingData, 'state');
      
      expect(result.passed).toBe(false);
      const outlierIssues = result.issues.filter(issue => issue.type === 'outlier');
      expect(outlierIssues.length).toBeGreaterThan(0);
    });

    test('should validate income data ranges', () => {
      const incomeData = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b19013_001e: 84097 // Valid median income
        },
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '48',
          name: 'Texas',
          var_b19013_001e: 1000000 // Extremely high income (outlier)
        }
      ];

      const result = validationService.validateData(incomeData, 'state');
      
      expect(result.passed).toBe(false);
      const outlierIssues = result.issues.filter(issue => issue.type === 'outlier');
      expect(outlierIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Mock Data Scenario Validation', () => {
    test('should validate small mock dataset', () => {
      const transformedData = mockDataScenarios.small.data.slice(1).map(row => ({
        dataset: 'acs5',
        year: 2022,
        geography_level: 'state',
        geography_code: row[2],
        name: row[0],
        var_b01003_001e: parseInt(row[1]),
        created_at: new Date().toISOString(),
        job_id: 'test_job'
      }));

      const result = validationService.validateData(transformedData, 'state');
      
      expect(result.passed).toBe(true);
      expect(result.metrics.validRecords).toBe(3);
      expect(result.issues).toHaveLength(0);
    });

    test('should handle invalid mock data', () => {
      const transformedData = mockDataScenarios.invalidData.data.slice(1).map(row => ({
        dataset: 'acs5',
        year: 2022,
        geography_level: 'state',
        geography_code: row[3],
        name: row[0],
        var_b01003_001e: row[1] === 'invalid_number' ? NaN : parseInt(row[1]),
        var_b25001_001e: row[2] === '' ? null : parseInt(row[2]),
        created_at: new Date().toISOString(),
        job_id: 'test_job'
      }));

      const result = validationService.validateData(transformedData, 'state');
      
      expect(result.passed).toBe(false);
      expect(result.metrics.invalidRecords).toBeGreaterThan(0);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should handle empty dataset', () => {
      const result = validationService.validateData([], 'state');
      
      expect(result.passed).toBe(true); // Empty data passes validation
      expect(result.score).toBe(1.0);
      expect(result.metrics.totalRecords).toBe(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    test('should validate large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        dataset: 'acs5',
        year: 2022,
        geography_level: 'zcta',
        geography_code: String(10000 + i).padStart(5, '0'),
        name: `ZCTA5 ${10000 + i}`,
        var_b01003_001e: Math.floor(Math.random() * 50000),
        var_b25001_001e: Math.floor(Math.random() * 20000),
        created_at: new Date().toISOString(),
        job_id: 'test_job'
      }));

      const startTime = Date.now();
      const result = validationService.validateData(largeData, 'zcta');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metrics.totalRecords).toBe(1000);
    });
  });

  describe('Configuration Impact', () => {
    test('should respect strict mode setting', () => {
      const strictConfig = createTestConfig({
        validation: {
          enabled: true,
          strictMode: true,
          qualityThresholds: {
            completeness: 0.99,
            accuracy: 0.99,
            consistency: 0.99
          }
        }
      });

      const strictService = new DataValidationService(strictConfig);
      
      const dataWithMinorIssues = [
        {
          dataset: 'acs5',
          year: 2022,
          geography_level: 'state',
          geography_code: '06',
          name: 'California',
          var_b01003_001e: 39538223
        }
      ];

      const result = strictService.validateData(dataWithMinorIssues, 'state');
      
      // In strict mode, validation should be more demanding
      expect(result.passed).toBe(true); // This valid data should still pass
    });

    test('should handle disabled validation', () => {
      const disabledConfig = createTestConfig({
        validation: {
          enabled: false,
          strictMode: false,
          qualityThresholds: {
            completeness: 0.95,
            accuracy: 0.98,
            consistency: 0.90
          }
        }
      });

      const disabledService = new DataValidationService(disabledConfig);
      
      const invalidData = [
        {
          // Missing most required fields
          var_b01003_001e: 'not_a_number'
        }
      ];

      const result = disabledService.validateData(invalidData, 'state');
      
      // With validation disabled, should be more lenient or skip validation
      expect(result).toBeDefined();
    });
  });
});
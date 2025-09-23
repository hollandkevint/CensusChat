import { 
  ValidationResult, 
  ValidationIssue, 
  LoadingConfiguration 
} from '../utils/LoadingTypes';

export interface ValidationRules {
  requiredFields: string[];
  numericFields: string[];
  geographyRules: {
    [level: string]: {
      codeFormat: RegExp;
      namePattern?: RegExp;
      requiredFields: string[];
    };
  };
  dataRanges: {
    [field: string]: {
      min?: number;
      max?: number;
    };
  };
}

export class DataValidationService {
  private config: LoadingConfiguration;
  private rules: ValidationRules;

  constructor(config: LoadingConfiguration) {
    this.config = config;
    this.rules = this.getDefaultValidationRules();
  }

  /**
   * Validate a batch of census data records
   */
  validateData(data: any[], geography: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    let validRecords = 0;
    let invalidRecords = 0;
    let missingData = 0;
    let outliers = 0;

    for (const record of data) {
      const recordIssues = this.validateRecord(record, geography);
      
      if (recordIssues.length === 0) {
        validRecords++;
      } else {
        invalidRecords++;
        issues.push(...recordIssues);
        
        // Count specific issue types
        recordIssues.forEach(issue => {
          if (issue.type === 'missing_data') missingData++;
          if (issue.type === 'outlier') outliers++;
        });
      }
    }

    const totalRecords = data.length;
    const score = totalRecords > 0 ? validRecords / totalRecords : 1;
    const passed = score >= this.config.validation.qualityThresholds.accuracy;

    return {
      passed,
      score,
      issues: this.aggregateIssues(issues),
      metrics: {
        totalRecords,
        validRecords,
        invalidRecords,
        missingData,
        outliers
      }
    };
  }

  private validateRecord(record: any, geography: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check required fields
    for (const field of this.rules.requiredFields) {
      if (!record[field] || record[field] === null || record[field] === '') {
        issues.push({
          type: 'missing_data',
          severity: 'error',
          message: `Missing required field: ${field}`,
          recordCount: 1
        });
      }
    }

    // Validate geography-specific rules
    const geoRules = this.rules.geographyRules[geography];
    if (geoRules) {
      if (record.geography_code && !geoRules.codeFormat.test(record.geography_code)) {
        issues.push({
          type: 'inconsistent_geography',
          severity: 'error',
          message: `Invalid geography code format for ${geography}`,
          recordCount: 1
        });
      }
    }

    // Validate numeric fields
    for (const field of this.rules.numericFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = parseFloat(record[field]);
        if (isNaN(value)) {
          issues.push({
            type: 'invalid_range',
            severity: 'error',
            message: `Non-numeric value in field: ${field}`,
            recordCount: 1
          });
        } else {
          // Check data ranges
          const range = this.rules.dataRanges[field];
          if (range) {
            if (range.min !== undefined && value < range.min) {
              issues.push({
                type: 'outlier',
                severity: 'warning',
                message: `Value below expected range in ${field}: ${value}`,
                recordCount: 1
              });
            }
            if (range.max !== undefined && value > range.max) {
              issues.push({
                type: 'outlier',
                severity: 'warning',
                message: `Value above expected range in ${field}: ${value}`,
                recordCount: 1
              });
            }
          }
        }
      }
    }

    return issues;
  }

  private aggregateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const aggregated = new Map<string, ValidationIssue>();

    for (const issue of issues) {
      const key = `${issue.type}_${issue.message}`;
      
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.recordCount += issue.recordCount;
      } else {
        aggregated.set(key, { ...issue });
      }
    }

    return Array.from(aggregated.values())
      .sort((a, b) => {
        // Sort by severity, then by record count
        const severityOrder = { error: 3, warning: 2, info: 1 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.recordCount - a.recordCount;
      });
  }

  private getDefaultValidationRules(): ValidationRules {
    return {
      requiredFields: ['dataset', 'year', 'geography_level', 'geography_code', 'name'],
      numericFields: [], // Would be populated based on variable types
      geographyRules: {
        state: {
          codeFormat: /^\d{2}$/,
          namePattern: /^[A-Za-z\s]+$/,
          requiredFields: ['name', 'geography_code']
        },
        county: {
          codeFormat: /^\d{5}$/,
          requiredFields: ['name', 'geography_code']
        },
        zcta: {
          codeFormat: /^\d{5}$/,
          requiredFields: ['geography_code']
        },
        block_group: {
          codeFormat: /^\d{12}$/,
          requiredFields: ['geography_code']
        }
      },
      dataRanges: {
        var_b01003_001e: { min: 0, max: 10000000 }, // Total population
        var_b25001_001e: { min: 0, max: 5000000 },  // Housing units
        var_b19013_001e: { min: 0, max: 500000 }    // Median household income
      }
    };
  }
}
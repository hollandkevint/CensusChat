/**
 * SQL Security Policies for CensusChat
 * Defines allowed tables, columns, and security constraints
 */

export interface SecurityPolicy {
  allowedTables: string[];
  allowedColumns: Record<string, string[]>;
  maxRowLimit: number;
  allowedStatementTypes: string[];
  blockPatterns: RegExp[];
  requireWhereClause: boolean;
}

// CensusChat database schema
export const CENSUS_SCHEMA = {
  county_data: {
    columns: [
      'county_name',
      'state_name',
      'population',
      'median_income',
      'poverty_rate'
    ],
    primaryKey: ['state_name', 'county_name'],
    description: 'County-level demographics from US Census Bureau'
  },
  block_group_data: {
    columns: [
      'geoid', 'state_fips', 'county_fips', 'tract_fips', 'block_group',
      'state_name', 'county_name', 'population', 'median_age',
      'male_population', 'female_population', 'under_5', 'age_5_17',
      'age_18_64', 'age_65_plus', 'age_75_plus', 'white_alone',
      'black_alone', 'asian_alone', 'hispanic_latino',
      'median_household_income', 'per_capita_income', 'poverty_rate',
      'unemployment_rate', 'uninsured_rate', 'high_school_or_higher_pct',
      'bachelors_or_higher_pct', 'total_housing_units', 'median_home_value',
      'median_rent', 'renter_occupied_pct', 'disability_rate',
      'limited_english_pct', 'no_vehicle_pct', 'public_transit_pct'
    ],
    primaryKey: ['geoid'],
    description: 'Block group-level demographics from ACS 5-Year (239,741 neighborhoods)'
  },
  block_group_data_expanded: {
    columns: [
      // Geographic
      'geoid', 'state_fips', 'county_fips', 'tract_fips', 'block_group',
      'state_name', 'county_name',
      // Demographics
      'population', 'median_age', 'male_population', 'female_population',
      'under_5', 'age_5_17', 'age_18_64', 'age_65_plus', 'age_75_plus',
      'white_alone', 'black_alone', 'asian_alone', 'hispanic_latino',
      // Economics
      'median_household_income', 'per_capita_income',
      'income_less_10k', 'income_10_to_25k', 'income_25_to_50k',
      'income_50_to_75k', 'income_75_to_100k', 'income_100_to_150k',
      'income_150_to_200k', 'income_200k_plus',
      'public_assistance_income', 'snap_benefits', 'retirement_income',
      'self_employment_earnings', 'poverty_rate', 'unemployment_rate',
      // Education
      'some_high_school_pct', 'high_school_grad_pct', 'some_college_pct',
      'bachelors_plus_pct',
      // Housing
      'total_housing_units', 'vacant_units', 'median_home_value',
      'renter_occupied_pct', 'rent_burden_50pct', 'crowded_housing',
      'single_family_homes', 'mobile_homes', 'median_year_built',
      // Technology
      'with_computer_pct', 'with_broadband_pct', 'no_internet_pct',
      // Transportation
      'commute_under_10_min', 'commute_10_to_19_min', 'commute_20_to_29_min',
      'commute_30_to_44_min', 'commute_45_plus_min', 'work_from_home',
      'public_transit_pct', 'no_vehicle_transit_pct',
      // Occupation
      'management_occupations_pct', 'healthcare_occupations_pct', 'retail_sales_pct',
      // Healthcare
      'uninsured_rate', 'uninsured_under_19', 'uninsured_19_to_64',
      'uninsured_65_plus', 'disability_rate', 'ambulatory_difficulty_pct',
      'independent_living_difficulty_pct',
      // Language
      'limited_english_pct', 'spanish_limited_english_pct', 'asian_limited_english_pct',
      // Family
      'children_with_2_parents_pct', 'children_single_parent_pct',
      'single_person_households_pct', 'seniors_living_alone_pct',
      'grandparents_responsible_pct'
    ],
    primaryKey: ['geoid'],
    description: 'Expanded block group-level data with 84 variables (239,741 neighborhoods)'
  }
} as const;

// Security policy for production Census data
export const censusChatSecurityPolicy: SecurityPolicy = {
  // Allow county and block group tables (standard and expanded)
  allowedTables: ['county_data', 'block_group_data', 'block_group_data_expanded'],

  // Explicit column allowlist per table
  allowedColumns: {
    county_data: [
      'county_name',
      'state_name',
      'population',
      'median_income',
      'poverty_rate'
    ],
    block_group_data: [
      'geoid', 'state_fips', 'county_fips', 'tract_fips', 'block_group',
      'state_name', 'county_name', 'population', 'median_age',
      'male_population', 'female_population', 'under_5', 'age_5_17',
      'age_18_64', 'age_65_plus', 'age_75_plus', 'white_alone',
      'black_alone', 'asian_alone', 'hispanic_latino',
      'median_household_income', 'per_capita_income', 'poverty_rate',
      'unemployment_rate', 'uninsured_rate', 'high_school_or_higher_pct',
      'bachelors_or_higher_pct', 'total_housing_units', 'median_home_value',
      'median_rent', 'renter_occupied_pct', 'disability_rate',
      'limited_english_pct', 'no_vehicle_pct', 'public_transit_pct'
    ],
    block_group_data_expanded: [
      // Geographic
      'geoid', 'state_fips', 'county_fips', 'tract_fips', 'block_group',
      'state_name', 'county_name',
      // Demographics
      'population', 'median_age', 'male_population', 'female_population',
      'under_5', 'age_5_17', 'age_18_64', 'age_65_plus', 'age_75_plus',
      'white_alone', 'black_alone', 'asian_alone', 'hispanic_latino',
      // Economics
      'median_household_income', 'per_capita_income',
      'income_less_10k', 'income_10_to_25k', 'income_25_to_50k',
      'income_50_to_75k', 'income_75_to_100k', 'income_100_to_150k',
      'income_150_to_200k', 'income_200k_plus',
      'public_assistance_income', 'snap_benefits', 'retirement_income',
      'self_employment_earnings', 'poverty_rate', 'unemployment_rate',
      // Education
      'some_high_school_pct', 'high_school_grad_pct', 'some_college_pct',
      'bachelors_plus_pct',
      // Housing
      'total_housing_units', 'vacant_units', 'median_home_value',
      'renter_occupied_pct', 'rent_burden_50pct', 'crowded_housing',
      'single_family_homes', 'mobile_homes', 'median_year_built',
      // Technology
      'with_computer_pct', 'with_broadband_pct', 'no_internet_pct',
      // Transportation
      'commute_under_10_min', 'commute_10_to_19_min', 'commute_20_to_29_min',
      'commute_30_to_44_min', 'commute_45_plus_min', 'work_from_home',
      'public_transit_pct', 'no_vehicle_transit_pct',
      // Occupation
      'management_occupations_pct', 'healthcare_occupations_pct', 'retail_sales_pct',
      // Healthcare
      'uninsured_rate', 'uninsured_under_19', 'uninsured_19_to_64',
      'uninsured_65_plus', 'disability_rate', 'ambulatory_difficulty_pct',
      'independent_living_difficulty_pct',
      // Language
      'limited_english_pct', 'spanish_limited_english_pct', 'asian_limited_english_pct',
      // Family
      'children_with_2_parents_pct', 'children_single_parent_pct',
      'single_person_households_pct', 'seniors_living_alone_pct',
      'grandparents_responsible_pct'
    ]
  },

  // Maximum number of rows that can be returned
  maxRowLimit: 1000,

  // Only SELECT queries allowed (no INSERT, UPDATE, DELETE, DROP, etc.)
  allowedStatementTypes: ['SELECT'],

  // Patterns to block even in SELECT queries
  blockPatterns: [
    /\bDROP\b/i,
    /\bDELETE\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bALTER\b/i,
    /\bCREATE\b/i,
    /\bTRUNCATE\b/i,
    /\bEXEC\b/i,
    /\bEXECUTE\b/i,
    /;.*;/,  // Multiple statements
    /--/,     // SQL comments (potential injection)
    /\/\*/    // Block comments
  ],

  // Require WHERE clause to prevent full table scans
  requireWhereClause: false  // Set to false for now, can enable later
};

// Validation error types
export enum ValidationErrorType {
  INVALID_STATEMENT_TYPE = 'INVALID_STATEMENT_TYPE',
  UNAUTHORIZED_TABLE = 'UNAUTHORIZED_TABLE',
  UNAUTHORIZED_COLUMN = 'UNAUTHORIZED_COLUMN',
  BLOCKED_PATTERN = 'BLOCKED_PATTERN',
  ROW_LIMIT_EXCEEDED = 'ROW_LIMIT_EXCEEDED',
  MISSING_WHERE_CLAUSE = 'MISSING_WHERE_CLAUSE',
  SQL_PARSE_ERROR = 'SQL_PARSE_ERROR'
}

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  detail?: string;
}

/**
 * Sanitizes SQL by enforcing row limits
 */
export function sanitizeSQL(sql: string, maxRows: number): string {
  // Remove any existing LIMIT clause
  const limitPattern = /LIMIT\s+\d+/gi;
  let sanitized = sql.replace(limitPattern, '');

  // Add our enforced LIMIT
  if (!sanitized.trim().endsWith(';')) {
    sanitized = sanitized.trim();
  } else {
    sanitized = sanitized.trim().slice(0, -1); // Remove trailing semicolon
  }

  return `${sanitized} LIMIT ${maxRows}`;
}

/**
 * Checks if a table name is in the allowlist
 */
export function isTableAllowed(tableName: string, policy: SecurityPolicy): boolean {
  return policy.allowedTables.includes(tableName.toLowerCase());
}

/**
 * Checks if a column is allowed for a specific table
 */
export function isColumnAllowed(
  tableName: string,
  columnName: string,
  policy: SecurityPolicy
): boolean {
  const allowedColumns = policy.allowedColumns[tableName.toLowerCase()];
  if (!allowedColumns) {
    return false;
  }

  // Allow * for SELECT *
  if (columnName === '*') {
    return true;
  }

  return allowedColumns.includes(columnName.toLowerCase());
}

/**
 * Checks SQL for blocked patterns
 */
export function checkBlockedPatterns(sql: string, policy: SecurityPolicy): ValidationError | null {
  for (const pattern of policy.blockPatterns) {
    if (pattern.test(sql)) {
      return {
        type: ValidationErrorType.BLOCKED_PATTERN,
        message: `SQL contains blocked pattern: ${pattern.source}`,
        detail: 'This pattern is not allowed for security reasons'
      };
    }
  }
  return null;
}

console.log('🔒 Security policies loaded:', {
  allowedTables: censusChatSecurityPolicy.allowedTables,
  maxRowLimit: censusChatSecurityPolicy.maxRowLimit,
  allowedStatementTypes: censusChatSecurityPolicy.allowedStatementTypes
});

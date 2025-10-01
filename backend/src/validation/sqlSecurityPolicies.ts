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
  }
} as const;

// Security policy for production Census data
export const censusChatSecurityPolicy: SecurityPolicy = {
  // Only allow querying the county_data table
  allowedTables: ['county_data'],

  // Explicit column allowlist per table
  allowedColumns: {
    county_data: [
      'county_name',
      'state_name',
      'population',
      'median_income',
      'poverty_rate'
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

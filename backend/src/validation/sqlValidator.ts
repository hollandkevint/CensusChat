/**
 * SQL Validator for CensusChat
 * Validates SQL queries against security policies before execution
 * Similar to OMCP's SQLValidator architecture
 */

import { Parser, AST } from 'node-sql-parser';
import {
  SecurityPolicy,
  ValidationError,
  ValidationErrorType,
  censusChatSecurityPolicy,
  sanitizeSQL,
  isTableAllowed,
  isColumnAllowed,
  checkBlockedPatterns
} from './sqlSecurityPolicies';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitizedSQL?: string;
  tables?: string[];
  columns?: string[];
}

export class SQLValidator {
  private parser: Parser;
  private policy: SecurityPolicy;

  constructor(policy: SecurityPolicy = censusChatSecurityPolicy) {
    this.parser = new Parser();
    this.policy = policy;

    console.log('🔍 SQL Validator initialized with security policy');
  }

  /**
   * Validates SQL query against security policies
   * Returns validation result with errors or sanitized SQL
   */
  async validateSQL(sql: string): Promise<ValidationResult> {
    console.log('🔍 Validating SQL query:', sql.substring(0, 100) + '...');

    const errors: ValidationError[] = [];

    try {
      // Step 1: Check for blocked patterns first (before parsing)
      const blockedPatternError = checkBlockedPatterns(sql, this.policy);
      if (blockedPatternError) {
        errors.push(blockedPatternError);
        return {
          valid: false,
          errors
        };
      }

      // Step 2: Parse SQL using node-sql-parser
      // Note: Using 'postgresql' dialect because DuckDB is PostgreSQL-compatible
      let ast: AST | AST[];
      try {
        ast = this.parser.astify(sql, { database: 'postgresql' });
      } catch (parseError) {
        errors.push({
          type: ValidationErrorType.SQL_PARSE_ERROR,
          message: 'Failed to parse SQL query',
          detail: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        });
        return {
          valid: false,
          errors
        };
      }

      // Handle multiple statements (should be blocked)
      if (Array.isArray(ast)) {
        errors.push({
          type: ValidationErrorType.BLOCKED_PATTERN,
          message: 'Multiple SQL statements are not allowed',
          detail: 'Only single SELECT queries are permitted'
        });
        return {
          valid: false,
          errors
        };
      }

      // Step 3: Verify statement type (only SELECT allowed)
      if (ast.type !== 'select') {
        errors.push({
          type: ValidationErrorType.INVALID_STATEMENT_TYPE,
          message: `Statement type '${ast.type}' is not allowed`,
          detail: `Only SELECT statements are permitted. Found: ${ast.type.toUpperCase()}`
        });
        return {
          valid: false,
          errors
        };
      }

      // Step 4: Extract and validate tables
      const tables = this.extractTables(ast);
      console.log('📊 Extracted tables:', tables);

      for (const table of tables) {
        if (!isTableAllowed(table, this.policy)) {
          errors.push({
            type: ValidationErrorType.UNAUTHORIZED_TABLE,
            message: `Table '${table}' is not in the allowlist`,
            detail: `Allowed tables: ${this.policy.allowedTables.join(', ')}`
          });
        }
      }

      // Step 5: Extract and validate columns
      const columns = this.extractColumns(ast);
      console.log('📋 Extracted columns:', columns);

      for (const { table, column } of columns) {
        if (!isColumnAllowed(table || 'county_data', column, this.policy)) {
          errors.push({
            type: ValidationErrorType.UNAUTHORIZED_COLUMN,
            message: `Column '${column}' is not allowed for table '${table || 'county_data'}'`,
            detail: `Allowed columns: ${this.policy.allowedColumns[table || 'county_data']?.join(', ')}`
          });
        }
      }

      // Step 6: Check for WHERE clause if required
      if (this.policy.requireWhereClause && !ast.where) {
        errors.push({
          type: ValidationErrorType.MISSING_WHERE_CLAUSE,
          message: 'WHERE clause is required',
          detail: 'Queries must filter data to prevent full table scans'
        });
      }

      // Step 7: Validate LIMIT clause
      const limit = this.extractLimit(ast);
      if (limit && limit > this.policy.maxRowLimit) {
        errors.push({
          type: ValidationErrorType.ROW_LIMIT_EXCEEDED,
          message: `LIMIT ${limit} exceeds maximum allowed (${this.policy.maxRowLimit})`,
          detail: `Maximum row limit is ${this.policy.maxRowLimit}`
        });
      }

      // If validation failed, return errors
      if (errors.length > 0) {
        console.log('❌ SQL validation failed:', errors);
        return {
          valid: false,
          errors,
          tables,
          columns: columns.map(c => c.column)
        };
      }

      // Step 8: Sanitize SQL (add/enforce LIMIT)
      const sanitized = sanitizeSQL(sql, this.policy.maxRowLimit);
      console.log('✅ SQL validation passed, sanitized:', sanitized.substring(0, 100) + '...');

      return {
        valid: true,
        errors: [],
        sanitizedSQL: sanitized,
        tables,
        columns: columns.map(c => c.column)
      };

    } catch (error) {
      console.error('❌ SQL validation error:', error);
      errors.push({
        type: ValidationErrorType.SQL_PARSE_ERROR,
        message: 'Unexpected validation error',
        detail: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        valid: false,
        errors
      };
    }
  }

  /**
   * Extracts table names from AST
   */
  private extractTables(ast: any): string[] {
    const tables: string[] = [];

    // Handle single table
    if (ast.from) {
      for (const item of ast.from) {
        if (item.table) {
          tables.push(item.table.toLowerCase());
        }
      }
    }

    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Extracts column names from AST
   */
  private extractColumns(ast: any): Array<{ table: string | null; column: string }> {
    const columns: Array<{ table: string | null; column: string }> = [];

    if (ast.columns) {
      for (const col of ast.columns) {
        if (col.expr) {
          // Handle different column expression types
          if (col.expr.type === 'column_ref') {
            // column can be a string, an object with an 'expr' property, or null
            let columnName = '*';
            if (typeof col.expr.column === 'string') {
              columnName = col.expr.column;
            } else if (col.expr.column && typeof col.expr.column === 'object') {
              columnName = col.expr.column.expr || col.expr.column.value || '*';
            }

            // Ensure columnName is a string before toLowerCase
            const finalColumnName = typeof columnName === 'string' ? columnName.toLowerCase() : '*';

            columns.push({
              table: col.expr.table || null,
              column: finalColumnName
            });
          } else if (col.expr.type === 'aggr_func') {
            // Handle aggregate functions like COUNT(*)
            if (col.expr.args && col.expr.args.expr) {
              if (col.expr.args.expr.type === 'column_ref') {
                let columnName = '*';
                if (typeof col.expr.args.expr.column === 'string') {
                  columnName = col.expr.args.expr.column;
                } else if (col.expr.args.expr.column && typeof col.expr.args.expr.column === 'object') {
                  columnName = col.expr.args.expr.column.expr || col.expr.args.expr.column.value || '*';
                }

                const finalColumnName = typeof columnName === 'string' ? columnName.toLowerCase() : '*';

                columns.push({
                  table: col.expr.args.expr.table || null,
                  column: finalColumnName
                });
              }
            }
          }
        }
      }
    }

    // Handle SELECT *
    if (ast.columns === '*' || ast.columns?.[0] === '*') {
      columns.push({
        table: null,
        column: '*'
      });
    }

    return columns;
  }

  /**
   * Extracts LIMIT value from AST
   */
  private extractLimit(ast: any): number | null {
    if (ast.limit) {
      if (typeof ast.limit === 'object' && ast.limit.value) {
        return Array.isArray(ast.limit.value)
          ? ast.limit.value[0]?.value
          : ast.limit.value;
      }
      if (typeof ast.limit === 'number') {
        return ast.limit;
      }
    }
    return null;
  }

  /**
   * Get information schema (table and column metadata)
   */
  getInformationSchema(): any {
    return {
      tables: this.policy.allowedTables,
      columns: this.policy.allowedColumns,
      maxRowLimit: this.policy.maxRowLimit,
      allowedStatementTypes: this.policy.allowedStatementTypes
    };
  }
}

// Singleton instance
let validatorInstance: SQLValidator | null = null;

export function getSQLValidator(): SQLValidator {
  if (!validatorInstance) {
    validatorInstance = new SQLValidator();
  }
  return validatorInstance;
}

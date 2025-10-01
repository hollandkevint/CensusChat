/**
 * Audit Logger for SQL Query Execution
 * Logs all SQL queries with timestamps for compliance and debugging
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export interface AuditLogEntry {
  timestamp: string;
  requestId?: string;
  userId?: string;
  queryType: 'natural_language' | 'sql';
  originalQuery: string;
  generatedSQL?: string;
  validatedSQL?: string;
  validationPassed: boolean;
  validationErrors?: any[];
  executionTime?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
}

class AuditLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'sql-audit.log');

    // Ensure logs directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    console.log('📝 Audit Logger initialized:', this.logFile);
  }

  /**
   * Log a SQL query execution event
   */
  logQuery(entry: AuditLogEntry): void {
    try {
      const logLine = JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString()
      }) + '\n';

      appendFileSync(this.logFile, logLine, 'utf8');

      // Also log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('📝 Audit Log:', {
          timestamp: entry.timestamp,
          queryType: entry.queryType,
          validationPassed: entry.validationPassed,
          success: entry.success,
          rowCount: entry.rowCount
        });
      }

    } catch (error) {
      console.error('❌ Failed to write audit log:', error);
    }
  }

  /**
   * Log a validation failure
   */
  logValidationFailure(
    originalQuery: string,
    generatedSQL: string | undefined,
    validationErrors: any[]
  ): void {
    this.logQuery({
      timestamp: new Date().toISOString(),
      queryType: 'sql',
      originalQuery,
      generatedSQL,
      validationPassed: false,
      validationErrors,
      success: false
    });
  }

  /**
   * Log a successful execution
   */
  logSuccess(
    originalQuery: string,
    generatedSQL: string | undefined,
    validatedSQL: string,
    rowCount: number,
    executionTime: number
  ): void {
    this.logQuery({
      timestamp: new Date().toISOString(),
      queryType: 'natural_language',
      originalQuery,
      generatedSQL,
      validatedSQL,
      validationPassed: true,
      executionTime,
      rowCount,
      success: true
    });
  }

  /**
   * Log an execution error
   */
  logError(
    originalQuery: string,
    generatedSQL: string | undefined,
    error: string
  ): void {
    this.logQuery({
      timestamp: new Date().toISOString(),
      queryType: 'sql',
      originalQuery,
      generatedSQL,
      validationPassed: false,
      success: false,
      error
    });
  }
}

// Singleton instance
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

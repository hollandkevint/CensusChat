/**
 * MCP App Bridge - Shared utilities for MCP Apps
 * Wraps @modelcontextprotocol/ext-apps App class for CensusChat apps
 */

import { App, type AppMessage, type ResourceContents } from '@modelcontextprotocol/ext-apps';

/**
 * Tool result data passed to MCP Apps
 * Contains query results and metadata
 */
export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>[];
  metadata?: {
    rowCount: number;
    tables?: string[];
    columns?: string[];
  };
  error?: string;
  validationErrors?: Array<{ message: string }>;
}

/**
 * Drill-down request sent from app back to host
 * Used for interactive exploration
 */
export interface DrillDownParams {
  query?: string;
  filters?: Record<string, unknown>;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Messages sent from app to host
 */
export interface AppToHostMessage {
  type: 'ui/ready' | 'ui/message' | 'ui/drill-down' | 'ui/error';
  payload?: unknown;
}

/**
 * Messages received from host
 */
export interface HostToAppMessage {
  type: 'tool-result' | 'resource-contents';
  payload: ToolResult | ResourceContents;
}

/**
 * Create and connect an MCP App instance
 * Returns a connected App ready to receive tool results
 */
export async function createApp(): Promise<App> {
  const app = new App();

  // Connect to parent window
  await app.connect();

  console.log('[MCP App] Connected to host');

  return app;
}

/**
 * Type guard for ToolResult
 */
export function isToolResult(payload: unknown): payload is ToolResult {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    typeof (payload as ToolResult).success === 'boolean'
  );
}

/**
 * Extract table data from tool result
 * Returns empty array if no data or error
 */
export function extractTableData(result: ToolResult): Record<string, unknown>[] {
  if (!result.success || !result.data) {
    return [];
  }
  return result.data;
}

/**
 * Get column names from first row of data
 * Returns empty array if no data
 */
export function getColumnNames(data: Record<string, unknown>[]): string[] {
  if (data.length === 0) {
    return [];
  }
  return Object.keys(data[0]);
}

/**
 * Format cell value for display
 * Handles numbers, nulls, objects
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'number') {
    // Format numbers with locale-aware separators
    return value.toLocaleString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

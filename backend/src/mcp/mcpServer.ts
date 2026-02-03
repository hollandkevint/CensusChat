/**
 * MCP Server Implementation with HTTP Transport
 * Implements JSON-RPC 2.0 protocol for Model Context Protocol
 * Uses StreamableHTTPServerTransport for HTTP-based client connections
 * Supports MCP Apps for interactive UI rendering
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDuckDBPool } from '../utils/duckdbPool';
import { getSQLValidator } from '../validation/sqlValidator';
import { CENSUS_SCHEMA } from '../validation/sqlSecurityPolicies';
import { registerDocumentTools } from './documentTools';

/**
 * UI resource configuration for MCP Apps
 */
interface UIResource {
  name: string;
  uri: string;
  description: string;
}

/**
 * Available UI resources for MCP Apps
 * Built by vite in mcp-apps/ and output to this directory
 */
const UI_RESOURCES: UIResource[] = [
  {
    name: 'data-table.html',
    uri: 'ui://censuschat/data-table.html',
    description: 'Interactive data table with sorting and filtering',
  },
  {
    name: 'bar-chart.html',
    uri: 'ui://censuschat/bar-chart.html',
    description: 'Bar chart visualization for categorical data',
  },
  {
    name: 'line-chart.html',
    uri: 'ui://censuschat/line-chart.html',
    description: 'Line chart visualization for time series data',
  },
];

/**
 * Load UI resource HTML from disk
 * Returns null if file doesn't exist (graceful degradation)
 */
function loadUIResource(filename: string): string | null {
  const resourcePath = join(__dirname, 'mcpApps', filename);
  if (existsSync(resourcePath)) {
    return readFileSync(resourcePath, 'utf-8');
  }
  console.warn(`[MCP] UI resource not found: ${filename} (path: ${resourcePath})`);
  return null;
}

/**
 * JSON stringify replacer that handles BigInt values
 * Converts BigInt to number if safe, otherwise to string
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Convert to number if it's safe (within Number.MAX_SAFE_INTEGER)
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value);
    }
    // Otherwise convert to string to preserve precision
    return value.toString();
  }
  return value;
}

/**
 * Handle get_information_schema tool call
 * Returns database schema and security policy information
 */
async function handleGetInformationSchema(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const validator = getSQLValidator();
  const schema = validator.getInformationSchema();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            schema: CENSUS_SCHEMA,
            security_policy: schema,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handle validate_sql_query tool call
 * Validates SQL against security policies without execution
 */
async function handleValidateSQLQuery(query: string): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  if (!query) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              valid: false,
              errors: [{ message: 'Query parameter is required' }],
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const validator = getSQLValidator();
  const result = await validator.validateSQL(query);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: !result.valid,
  };
}

/**
 * Handle execute_query tool call
 * Validates and executes SQL against the census database
 * Includes pagination metadata for UI rendering
 */
async function handleExecuteQuery(query: string): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  if (!query) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Query parameter is required',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    // Step 1: Validate SQL
    const validator = getSQLValidator();
    const validationResult = await validator.validateSQL(query);

    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                validationErrors: validationResult.errors,
                message: 'SQL validation failed',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Step 2: Execute validated SQL
    const pool = getDuckDBPool();
    const data = await pool.query(validationResult.sanitizedSQL!);

    // Determine if there might be more rows (based on LIMIT in query)
    const limitMatch = query.match(/\bLIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;
    const hasMore = limit !== null && data.length >= limit;

    // Get cursor for pagination (last geoid if available)
    const lastRow = data[data.length - 1];
    const nextCursor = lastRow && (lastRow.geoid || lastRow.county_fips)
      ? String(lastRow.geoid || lastRow.county_fips)
      : undefined;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data,
              metadata: {
                rowCount: data.length,
                hasMore,
                nextCursor: hasMore ? nextCursor : undefined,
                tables: validationResult.tables,
                columns: validationResult.columns,
              },
            },
            jsonReplacer,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error('[MCP] Query execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle execute_drill_down_query tool call
 * Returns block groups within a specific county
 * Uses cursor-based pagination for efficient paging through results
 */
async function handleDrillDownQuery(
  countyFips: string,
  cursor?: string
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  if (!countyFips) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'countyFips parameter is required',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Validate FIPS code format (5 digits: 2 state + 3 county)
  if (!/^\d{5}$/.test(countyFips)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Invalid county FIPS code format. Expected 5 digits.',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    const pool = getDuckDBPool();

    // Build query for block groups within county
    // Fetch 101 rows to detect if there are more
    const cursorCondition = cursor ? `AND geoid > '${cursor}'` : '';
    const query = `
      SELECT
        geoid,
        name,
        total_population,
        median_household_income,
        pct_65_and_over,
        pct_with_health_insurance
      FROM block_group_data_expanded
      WHERE LEFT(geoid, 5) = '${countyFips}'
      ${cursorCondition}
      ORDER BY geoid
      LIMIT 101
    `;

    const data = await pool.query(query);

    // Check if there are more results
    const hasMore = data.length > 100;
    const results = hasMore ? data.slice(0, 100) : data;

    // Get next cursor from last returned row
    const lastRow = results[results.length - 1];
    const nextCursor = hasMore && lastRow ? String(lastRow.geoid) : undefined;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data: results,
              metadata: {
                rowCount: results.length,
                hasMore,
                nextCursor,
                countyFips,
                tables: ['block_group_data_expanded'],
                columns: [
                  'geoid',
                  'name',
                  'total_population',
                  'median_household_income',
                  'pct_65_and_over',
                  'pct_with_health_insurance',
                ],
              },
            },
            jsonReplacer,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error('[MCP] Drill-down query error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Create a new MCP server instance with all tools registered
 * Each session gets its own server instance
 */
export function createMcpServer(sessionId: string): McpServer {
  const server = new McpServer({
    name: 'censuschat-mcp-server',
    version: '1.0.0',
  });

  console.log(`[MCP] Creating server for session: ${sessionId}`);

  // Register get_information_schema tool
  server.tool(
    'get_information_schema',
    'Get database schema information including tables, columns, and security policies',
    {},
    async () => {
      return handleGetInformationSchema();
    }
  );

  // Register validate_sql_query tool
  server.tool(
    'validate_sql_query',
    'Validate a SQL query against security policies without executing it',
    {
      query: z.string().describe('SQL query to validate'),
    },
    async (args) => {
      return handleValidateSQLQuery(args.query);
    }
  );

  // Register execute_query tool with UI resource for interactive display
  // Uses registerAppTool to enable MCP Apps rendering
  registerAppTool(
    server,
    'execute_query',
    {
      description: 'Validate and execute a SQL query on the census database. Results can be displayed in an interactive data table.',
      inputSchema: {
        query: z.string().describe('SQL SELECT query to execute'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://censuschat/data-table.html',
          // Tool visible to both model and app (for drill-down)
          visibility: ['model', 'app'],
        },
      },
    },
    async (args) => {
      return handleExecuteQuery(args.query);
    }
  );

  // Register execute_drill_down_query tool for block group exploration
  // Enables drilling from county to block groups with cursor-based pagination
  registerAppTool(
    server,
    'execute_drill_down_query',
    {
      description: 'Execute a drill-down query to retrieve block groups within a county. Results are paginated using cursor-based navigation.',
      inputSchema: {
        countyFips: z.string().describe('County FIPS code (5 digits: 2 state + 3 county)'),
        cursor: z.string().optional().describe('Cursor for pagination (geoid of last row from previous page)'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://censuschat/data-table.html',
          visibility: ['model', 'app'],
        },
      },
    },
    async (args) => {
      return handleDrillDownQuery(args.countyFips, args.cursor);
    }
  );

  // Register execute_comparison_query tool for bar chart visualization
  // Wraps execute_query with bar chart UI resource
  registerAppTool(
    server,
    'execute_comparison_query',
    {
      description: 'Execute a SQL query for demographic comparison and display as a bar chart. Best for comparing categories (regions, demographics, etc.) with numeric values.',
      inputSchema: {
        query: z.string().describe('SQL SELECT query comparing categories with numeric values'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://censuschat/bar-chart.html',
          visibility: ['model', 'app'],
        },
      },
    },
    async (args) => {
      return handleExecuteQuery(args.query);
    }
  );

  // Register execute_trend_query tool for line chart visualization
  // Wraps execute_query with line chart UI resource
  registerAppTool(
    server,
    'execute_trend_query',
    {
      description: 'Execute a SQL query for trend analysis and display as a line chart. Best for time-series data (year, month, date columns) with numeric values.',
      inputSchema: {
        query: z.string().describe('SQL SELECT query with time-series data and numeric values'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://censuschat/line-chart.html',
          visibility: ['model', 'app'],
        },
      },
    },
    async (args) => {
      return handleExecuteQuery(args.query);
    }
  );

  // Register UI resources for MCP Apps
  registerUIResources(server);

  // Register document generation tools (Excel, CSV, PDF)
  registerDocumentTools(server);

  return server;
}

/**
 * Register UI resources for MCP Apps
 * These are single-file HTML bundles built by Vite
 * If resources don't exist yet, tools still work but return JSON only
 */
function registerUIResources(server: McpServer): void {
  for (const resource of UI_RESOURCES) {
    const html = loadUIResource(resource.name);

    if (html) {
      registerAppResource(
        server,
        resource.description,
        resource.uri,
        {
          description: resource.description,
          mimeType: RESOURCE_MIME_TYPE,
        },
        async () => ({
          contents: [
            {
              uri: resource.uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
            },
          ],
        })
      );
      console.log(`[MCP] Registered UI resource: ${resource.uri}`);
    } else {
      console.log(`[MCP] UI resource not available: ${resource.uri} (will use JSON fallback)`);
    }
  }
}

/**
 * Close all MCP sessions (for graceful shutdown)
 * Delegates to session manager for cleanup
 */
export async function closeCensusChat_MCPServer(): Promise<void> {
  // Import here to avoid circular dependency at module load time
  const { shutdownSessionManager } = await import('./mcpSessionManager');
  await shutdownSessionManager();
  console.log('[MCP] All sessions closed');
}

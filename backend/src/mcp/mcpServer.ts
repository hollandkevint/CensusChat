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

  // Register UI resources for MCP Apps
  registerUIResources(server);

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

/**
 * MCP Server Implementation with HTTP Transport
 * Implements JSON-RPC 2.0 protocol for Model Context Protocol
 * Uses StreamableHTTPServerTransport for HTTP-based client connections
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDuckDBPool } from '../utils/duckdbPool';
import { getSQLValidator } from '../validation/sqlValidator';
import { CENSUS_SCHEMA } from '../validation/sqlSecurityPolicies';

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

  // Register execute_query tool
  server.tool(
    'execute_query',
    'Validate and execute a SQL query on the census database',
    {
      query: z.string().describe('SQL SELECT query to execute'),
    },
    async (args) => {
      return handleExecuteQuery(args.query);
    }
  );

  return server;
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

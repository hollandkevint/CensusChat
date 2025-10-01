/**
 * True MCP Server Implementation
 * Implements JSON-RPC 2.0 protocol for Model Context Protocol
 * Exposes DuckDB data with SQL validation layer
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getDuckDBPool } from '../utils/duckdbPool';
import { getSQLValidator } from '../validation/sqlValidator';
import { CENSUS_SCHEMA } from '../validation/sqlSecurityPolicies';

export class CensusChat_MCPServer {
  private server: Server;
  private isRunning: boolean = false;

  constructor() {
    // Initialize MCP server with server info
    this.server = new Server(
      {
        name: 'censuschat-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.setupHandlers();
    console.log('🔧 CensusChat MCP Server initialized');
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_information_schema',
            description: 'Get database schema information (tables and columns)',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'validate_sql_query',
            description: 'Validate a SQL query against security policies without executing it',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL query to validate'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'execute_query',
            description: 'Validate and execute a SQL query on the census database',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL SELECT query to execute'
                }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'data://tables/county_data',
            name: 'County Demographics Data',
            description: 'US Census county-level demographic data including population, income, and poverty rates',
            mimeType: 'application/json'
          },
          {
            uri: 'data://schema',
            name: 'Database Schema',
            description: 'Census database schema with table and column information',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'data://schema') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(CENSUS_SCHEMA, null, 2)
            }
          ]
        };
      }

      if (uri === 'data://tables/county_data') {
        const pool = getDuckDBPool();
        const data = await pool.query('SELECT * FROM county_data LIMIT 100');

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown resource URI: ${uri}`);
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_information_schema':
          return await this.handleGetInformationSchema();

        case 'validate_sql_query':
          return await this.handleValidateSQLQuery(args?.query as string);

        case 'execute_query':
          return await this.handleExecuteQuery(args?.query as string);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Handle get_information_schema tool call
   */
  private async handleGetInformationSchema(): Promise<any> {
    const validator = getSQLValidator();
    const schema = validator.getInformationSchema();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            schema: CENSUS_SCHEMA,
            security_policy: schema
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Handle validate_sql_query tool call
   */
  private async handleValidateSQLQuery(query: string): Promise<any> {
    if (!query) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              valid: false,
              errors: [{ message: 'Query parameter is required' }]
            }, null, 2)
          }
        ],
        isError: true
      };
    }

    const validator = getSQLValidator();
    const result = await validator.validateSQL(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ],
      isError: !result.valid
    };
  }

  /**
   * Handle execute_query tool call
   */
  private async handleExecuteQuery(query: string): Promise<any> {
    if (!query) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Query parameter is required'
            }, null, 2)
          }
        ],
        isError: true
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
              text: JSON.stringify({
                success: false,
                validationErrors: validationResult.errors,
                message: 'SQL validation failed'
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Step 2: Execute validated SQL
      const pool = getDuckDBPool();
      const data = await pool.query(validationResult.sanitizedSQL!);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data,
              metadata: {
                rowCount: data.length,
                tables: validationResult.tables,
                columns: validationResult.columns
              }
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error('❌ Query execution error:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ MCP Server already running');
      return;
    }

    console.log('🚀 Starting CensusChat MCP Server...');

    try {
      // Initialize DuckDB pool
      const pool = getDuckDBPool();
      if (!pool.getStats().totalConnections) {
        await pool.initialize();
      }

      // Start server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.isRunning = true;
      console.log('✅ CensusChat MCP Server started successfully');
      console.log('   Tools: get_information_schema, validate_sql_query, execute_query');
      console.log('   Resources: data://tables/county_data, data://schema');

    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error);
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ MCP Server not running');
      return;
    }

    console.log('🔄 Stopping CensusChat MCP Server...');
    await this.server.close();
    this.isRunning = false;
    console.log('✅ CensusChat MCP Server stopped');
  }

  /**
   * Get server status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

// Singleton instance
let mcpServerInstance: CensusChat_MCPServer | null = null;

export function getCensusChat_MCPServer(): CensusChat_MCPServer {
  if (!mcpServerInstance) {
    mcpServerInstance = new CensusChat_MCPServer();
  }
  return mcpServerInstance;
}

export async function closeCensusChat_MCPServer(): Promise<void> {
  if (mcpServerInstance) {
    await mcpServerInstance.stop();
    mcpServerInstance = null;
  }
}

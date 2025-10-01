/**
 * MCP Client for CensusChat Backend
 * Connects to MCP server and provides tool call interface
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
  validationErrors?: any[];
}

export class CensusChat_MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client(
      {
        name: 'censuschat-backend-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    console.log('🔧 CensusChat MCP Client initialized');
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('⚠️ MCP Client already connected');
      return;
    }

    console.log('🔌 Connecting to MCP Server...');

    try {
      // For now, we'll use in-process connection
      // In production, this would connect via stdio to external server
      this.isConnected = true;
      console.log('✅ MCP Client connected');

    } catch (error) {
      console.error('❌ Failed to connect to MCP Server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      console.log('⚠️ MCP Client not connected');
      return;
    }

    console.log('🔌 Disconnecting from MCP Server...');

    if (this.transport) {
      await this.client.close();
      this.transport = null;
    }

    this.isConnected = false;
    console.log('✅ MCP Client disconnected');
  }

  /**
   * Call get_information_schema tool
   */
  async getInformationSchema(): Promise<MCPToolCallResult> {
    this.ensureConnected();

    try {
      console.log('🔍 Calling get_information_schema tool...');

      // Import and use the server directly for in-process calls
      const { getSQLValidator } = await import('../validation/sqlValidator');
      const { CENSUS_SCHEMA } = await import('../validation/sqlSecurityPolicies');

      const validator = getSQLValidator();
      const securityPolicy = validator.getInformationSchema();

      return {
        success: true,
        result: {
          schema: CENSUS_SCHEMA,
          security_policy: securityPolicy
        }
      };

    } catch (error) {
      console.error('❌ getInformationSchema error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Call validate_sql_query tool
   */
  async validateSQLQuery(query: string): Promise<MCPToolCallResult> {
    this.ensureConnected();

    try {
      console.log('🔍 Calling validate_sql_query tool...');
      console.log('   Query:', query.substring(0, 100) + '...');

      // Import and use the validator directly for in-process calls
      const { getSQLValidator } = await import('../validation/sqlValidator');
      const validator = getSQLValidator();

      const validationResult = await validator.validateSQL(query);

      if (!validationResult.valid) {
        return {
          success: false,
          validationErrors: validationResult.errors,
          error: 'SQL validation failed'
        };
      }

      return {
        success: true,
        result: validationResult
      };

    } catch (error) {
      console.error('❌ validateSQLQuery error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Call execute_query tool
   */
  async executeQuery(query: string): Promise<MCPToolCallResult> {
    this.ensureConnected();

    try {
      console.log('🔍 Calling execute_query tool...');
      console.log('   Query:', query.substring(0, 100) + '...');

      // Step 1: Validate SQL first
      const validationResult = await this.validateSQLQuery(query);

      if (!validationResult.success) {
        return validationResult;
      }

      // Step 2: Execute validated SQL
      const { getDuckDBPool } = await import('../utils/duckdbPool');
      const pool = getDuckDBPool();

      const sanitizedSQL = validationResult.result.sanitizedSQL;
      const data = await pool.query(sanitizedSQL);

      return {
        success: true,
        result: {
          data,
          metadata: {
            rowCount: data.length,
            tables: validationResult.result.tables,
            columns: validationResult.result.columns,
            sanitizedSQL
          }
        }
      };

    } catch (error) {
      console.error('❌ executeQuery error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generic tool call method
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolCallResult> {
    switch (toolName) {
      case 'get_information_schema':
        return await this.getInformationSchema();

      case 'validate_sql_query':
        return await this.validateSQLQuery(args.query);

      case 'execute_query':
        return await this.executeQuery(args.query);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  }

  /**
   * Get client status
   */
  getStatus(): { isConnected: boolean } {
    return { isConnected: this.isConnected };
  }

  /**
   * Ensure client is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('MCP Client is not connected. Call connect() first.');
    }
  }
}

// Singleton instance
let mcpClientInstance: CensusChat_MCPClient | null = null;

export function getCensusChat_MCPClient(): CensusChat_MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new CensusChat_MCPClient();
  }
  return mcpClientInstance;
}

export async function closeCensusChat_MCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}

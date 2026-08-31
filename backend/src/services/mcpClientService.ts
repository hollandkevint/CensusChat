import { EventEmitter } from 'events';
import { getDuckDBPool } from '../utils/duckdbPool';
import { mcpClientConfigs, MCPClientConfig } from '../config/mcpConfig';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { getMCPMonitoring } from '../utils/mcpMonitoring';

export interface MCPClientStatus {
  connectedClients: string[];
  connectionErrors: Record<string, string>;
  lastConnectAttempt?: Date;
  circuitBreakers?: Record<string, { state: string; failures: number; isHealthy: boolean }>;
  monitoring?: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageLatency: number;
    errorRate: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export interface MCPToolCall {
  client: string;
  tool: string;
  parameters: any;
  timeout?: number;
}

export class MCPClientService extends EventEmitter {
  private connectedClients: Set<string> = new Set();
  private connectionErrors: Map<string, string> = new Map();
  private lastConnectAttempt?: Date;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    super();
    console.log('🔧 MCP Client Service initialized');
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing MCP Client connections...');
    this.lastConnectAttempt = new Date();

    // Connect to enabled external MCP servers
    const enabledClients = Object.entries(mcpClientConfigs).filter(([_, config]) => config.enabled);

    if (enabledClients.length === 0) {
      console.log('ℹ️ No external MCP clients configured');
      return;
    }

    for (const [clientName, config] of enabledClients) {
      // Initialize circuit breaker for each client
      this.circuitBreakers.set(clientName, new CircuitBreaker(`mcp-client-${clientName}`, {
        threshold: 3,        // Lower threshold for external services
        timeout: 30000,      // 30 seconds before retry
        resetTimeout: 300000, // 5 minutes full reset
        monitorWindow: 60000  // 1 minute monitoring window
      }));

      try {
        await this.connectToMCPServer(clientName, config);
      } catch (error) {
        console.error(`❌ Failed to connect to MCP client ${clientName}:`, error);
        this.connectionErrors.set(clientName, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log(`✅ MCP Client initialization complete. Connected: ${this.connectedClients.size}/${enabledClients.length}`);
  }

  private async connectToMCPServer(clientName: string, config: MCPClientConfig): Promise<void> {
    const pool = getDuckDBPool();

    try {
      console.log(`🔗 Connecting to MCP server: ${clientName}`);

      // Use DuckDB MCP extension to connect to external server
      const connectQuery = `
        ATTACH '${config.endpoint}' AS ${clientName}_mcp (
          TYPE mcp,
          TRANSPORT 'https',
          TIMEOUT ${config.timeout}
        )
      `;

      await pool.query(connectQuery);
      this.connectedClients.add(clientName);
      this.connectionErrors.delete(clientName);

      console.log(`✅ Connected to MCP server: ${clientName}`);

    } catch (error) {
      // If ATTACH doesn't work, simulate connection for compatibility
      if (error instanceof Error && error.message.includes('ATTACH')) {
        console.warn(`⚠️ MCP ATTACH not available for ${clientName}, using compatibility mode`);
        this.connectedClients.add(clientName);
        this.connectionErrors.delete(clientName);
      } else {
        throw error;
      }
    }
  }

  async callTool(toolCall: MCPToolCall): Promise<any> {
    const { client, tool, parameters, timeout = 2000 } = toolCall;

    if (!this.connectedClients.has(client)) {
      throw new Error(`MCP client not connected: ${client}`);
    }

    // Get (or lazily create) the circuit breaker for this client
    let circuitBreaker = this.circuitBreakers.get(client);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(`mcp-client-${client}`, {
        threshold: 3,
        timeout: 30000,
        resetTimeout: 300000,
        monitorWindow: 60000
      });
      this.circuitBreakers.set(client, circuitBreaker);
    }

    const monitoring = getMCPMonitoring();
    const correlationId = monitoring.startOperation('tool_call', client, tool);

    try {
      console.log(`🔧 Calling MCP tool: ${client}.${tool}`);

      // Use circuit breaker to execute the operation
      const result = await circuitBreaker.execute(async () => {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('MCP tool call timeout')), timeout);
        });

        // Execute tool call
        const toolPromise = this.executeMCPTool(client, tool, parameters);

        // Race between tool execution and timeout
        return await Promise.race([toolPromise, timeoutPromise]);
      });

      monitoring.completeOperation(correlationId, true);
      console.log(`✅ MCP tool call successful: ${client}.${tool}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      monitoring.completeOperation(correlationId, false, errorMessage);
      console.error(`❌ MCP tool call failed: ${client}.${tool}:`, error);
      throw error;
    }
  }

  private async executeMCPTool(client: string, tool: string, parameters: any): Promise<any> {
    const pool = getDuckDBPool();

    try {
      // Try using DuckDB MCP extension first
      const mcpQuery = `
        SELECT mcp_call_tool('${client}', '${tool}', '${JSON.stringify(parameters)}')::TABLE as result
      `;

      return await pool.query(mcpQuery);

    } catch (error) {
      // Fallback to simulated tool execution for common tools
      if (error instanceof Error && error.message.includes('mcp_call_tool')) {
        console.warn(`⚠️ MCP tool function not available, using fallback for ${client}.${tool}`);
        return await this.simulateToolCall(client, tool, parameters);
      }

      throw error;
    }
  }

  private async simulateToolCall(client: string, tool: string, parameters: any): Promise<any> {
    // Simulate external data source calls with local data
    switch (client) {
      case 'census_api':
        return await this.simulateCensusAPICall(tool, parameters);

      case 'medicare_api':
        return await this.simulateMedicareAPICall(tool, parameters);

      default:
        throw new Error(`Unknown MCP client: ${client}`);
    }
  }

  private async simulateCensusAPICall(tool: string, parameters: any): Promise<any> {
    const pool = getDuckDBPool();

    switch (tool) {
      case 'get_demographics':
        const { geography_type, geography_codes } = parameters;
        let whereClause = '';

        if (geography_type === 'state') {
          whereClause = `WHERE state IN ('${geography_codes.join("','")}')`;
        } else if (geography_type === 'county') {
          whereClause = `WHERE county IN ('${geography_codes.join("','")}')`;
        }

        const query = `
          SELECT
            county,
            state,
            population_total,
            population_65_plus,
            median_household_income
          FROM demographics
          ${whereClause}
          ORDER BY population_total DESC
        `;

        return await pool.query(query);

      default:
        throw new Error(`Unknown Census API tool: ${tool}`);
    }
  }

  private async simulateMedicareAPICall(tool: string, _parameters: any): Promise<any> {
    const pool = getDuckDBPool();

    switch (tool) {
      case 'get_ma_penetration':
        // Simulate Medicare Advantage penetration data
        const query = `
          SELECT
            county,
            state,
            population_65_plus,
            ROUND(population_65_plus * 0.35, 0) as ma_enrollment_estimate,
            ROUND(35.0, 2) as ma_penetration_rate
          FROM demographics
          WHERE population_65_plus > 0
          ORDER BY population_65_plus DESC
        `;

        return await pool.query(query);

      default:
        throw new Error(`Unknown Medicare API tool: ${tool}`);
    }
  }

  // List available tools from connected MCP servers
  async listAvailableTools(client?: string): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};

    // Only list tools for connected clients. A specific client that is not
    // connected yields no entry (rather than a phantom empty-tools record).
    const clientsToCheck = client
      ? (this.connectedClients.has(client) ? [client] : [])
      : Array.from(this.connectedClients);

    for (const clientName of clientsToCheck) {
      try {
        const pool = getDuckDBPool();

        // Try to get tools list from MCP server
        try {
          const toolsQuery = `SELECT mcp_list_tools('${clientName}') as tools`;
          const result = await pool.query(toolsQuery);
          tools[clientName] = result[0]?.tools || [];

        } catch (error) {
          // Fallback to predefined tools for known clients
          tools[clientName] = this.getKnownToolsForClient(clientName);
        }

      } catch (error) {
        console.error(`❌ Failed to list tools for client ${clientName}:`, error);
        tools[clientName] = [];
      }
    }

    return tools;
  }

  private getKnownToolsForClient(clientName: string): string[] {
    switch (clientName) {
      case 'census_api':
        return ['get_demographics', 'get_geography', 'get_acs_data'];

      case 'medicare_api':
        return ['get_ma_penetration', 'get_provider_data', 'get_cost_data'];

      default:
        return [];
    }
  }

  async disconnect(clientName?: string): Promise<void> {
    const clientsToDisconnect = clientName ? [clientName] : Array.from(this.connectedClients);

    for (const client of clientsToDisconnect) {
      try {
        console.log(`🔌 Disconnecting MCP client: ${client}`);

        const pool = getDuckDBPool();

        // Try to detach MCP connection. Any failure is tolerated: the attachment
        // is unusable either way, and rethrowing here used to leave the client
        // in `connectedClients` forever (a stale-state leak).
        try {
          await pool.query(`DETACH ${client}_mcp`);
        } catch (error) {
          console.warn(`⚠️ Could not detach MCP client ${client}:`, error);
        }

        this.connectedClients.delete(client);
        console.log(`✅ Disconnected MCP client: ${client}`);

      } catch (error) {
        console.error(`❌ Error disconnecting MCP client ${client}:`, error);
      }
    }
  }

  getStatus(): MCPClientStatus {
    const circuitBreakersStatus: Record<string, { state: string; failures: number; isHealthy: boolean }> = {};

    for (const [clientName, breaker] of this.circuitBreakers) {
      const stats = breaker.getStats();
      circuitBreakersStatus[clientName] = {
        state: stats.state,
        failures: stats.failures,
        isHealthy: stats.isHealthy
      };
    }

    const monitoring = getMCPMonitoring();
    const aggregateMetrics = monitoring.getAggregateMetrics();
    const healthStatus = monitoring.getHealthStatus();

    return {
      connectedClients: Array.from(this.connectedClients),
      connectionErrors: Object.fromEntries(this.connectionErrors),
      lastConnectAttempt: this.lastConnectAttempt,
      circuitBreakers: circuitBreakersStatus,
      monitoring: {
        totalOperations: aggregateMetrics.totalOperations,
        successfulOperations: aggregateMetrics.successfulOperations,
        failedOperations: aggregateMetrics.failedOperations,
        averageLatency: aggregateMetrics.averageLatency,
        errorRate: aggregateMetrics.errorRate,
        healthStatus: healthStatus.status
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test connection to at least one client
      if (this.connectedClients.size === 0) {
        return true; // No clients configured is okay
      }

      const firstClient = Array.from(this.connectedClients)[0];

      // Probe the connection directly. Unlike listAvailableTools (which
      // deliberately falls back to a static tool list on error), a failed
      // probe here must surface as unhealthy.
      const pool = getDuckDBPool();
      await pool.query(`SELECT mcp_list_tools('${firstClient}') as tools`);
      return true;

    } catch (error) {
      console.error('❌ MCP Client health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let mcpClientInstance: MCPClientService | null = null;

export function getMCPClientService(): MCPClientService {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClientService();
  }
  return mcpClientInstance;
}

export async function closeMCPClientService(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}
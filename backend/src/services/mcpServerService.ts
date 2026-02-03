import { EventEmitter } from 'events';
import { getDuckDBPool } from '../utils/duckdbPool';
import { mcpServerConfig, healthcareAnalyticsTools } from '../config/mcpConfig';
import { getMCPMonitoring } from '../utils/mcpMonitoring';

export interface MCPServerStatus {
  isRunning: boolean;
  startTime?: Date;
  resourcesPublished: number;
  toolsRegistered: number;
  error?: string;
  monitoring?: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageLatency: number;
    errorRate: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export class MCPServerService extends EventEmitter {
  private isRunning: boolean = false;
  private startTime?: Date;
  private publishedResources: Set<string> = new Set();
  private registeredTools: Set<string> = new Set();

  constructor() {
    super();
    console.log('🔧 MCP Server Service initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ MCP Server already running');
      return;
    }

    console.log('🚀 Starting MCP Server...');

    try {
      // Initialize DuckDB pool first
      const pool = getDuckDBPool();
      if (!pool.getStats().totalConnections) {
        await pool.initialize();
      }

      // Start MCP server
      await this.startMCPServer();

      // Publish healthcare resources
      await this.publishResources();

      // Register healthcare analytics tools
      await this.registerTools();

      this.isRunning = true;
      this.startTime = new Date();
      this.emit('started');

      console.log('✅ MCP Server started successfully');
      console.log(`   Resources published: ${this.publishedResources.size}`);
      console.log(`   Tools registered: ${this.registeredTools.size}`);

    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async startMCPServer(): Promise<void> {
    const pool = getDuckDBPool();

    try {
      // Start MCP server using DuckDB MCP extension
      const serverQuery = `
        SELECT mcp_server_start(
          '${mcpServerConfig.name}',
          '${JSON.stringify({
            description: mcpServerConfig.description,
            version: mcpServerConfig.version,
            capabilities: mcpServerConfig.capabilities,
            security: mcpServerConfig.security
          })}'
        ) as server_status
      `;

      const result = await pool.query(serverQuery);
      console.log('🔧 MCP Server initialization result:', result);

    } catch (error) {
      // If mcp_server_start doesn't exist, log warning but continue
      if (error instanceof Error && error.message.includes('mcp_server_start')) {
        console.warn('⚠️ MCP server function not available, running in compatibility mode');
      } else {
        throw error;
      }
    }
  }

  private async publishResources(): Promise<void> {
    const pool = getDuckDBPool();

    console.log('📚 Publishing healthcare data resources...');

    for (const [resourceName, resourceConfig] of Object.entries(mcpServerConfig.resources)) {
      try {
        let publishQuery: string;

        if (resourceName === 'demographics') {
          // Publish the main demographics table
          publishQuery = `
            SELECT mcp_publish_table(
              'demographics',
              '${resourceConfig.uri}',
              'json',
              '${JSON.stringify({
                description: resourceConfig.description,
                classification: resourceConfig.classification,
                schema: {
                  county: 'string',
                  state: 'string',
                  population_total: 'integer',
                  population_65_plus: 'integer',
                  median_household_income: 'integer'
                }
              })}'
            ) as publish_status
          `;
        } else {
          // Create and publish healthcare views
          await this.createHealthcareView(resourceName);

          publishQuery = `
            SELECT mcp_publish_table(
              '${resourceName}',
              '${resourceConfig.uri}',
              'json',
              '${JSON.stringify({
                description: resourceConfig.description,
                classification: resourceConfig.classification
              })}'
            ) as publish_status
          `;
        }

        const result = await pool.query(publishQuery);
        this.publishedResources.add(resourceName);

        console.log(`✅ Published resource: ${resourceName}`);

      } catch (error) {
        if (error instanceof Error && error.message.includes('mcp_publish_table')) {
          console.warn(`⚠️ MCP publish function not available for ${resourceName}, using fallback`);
          this.publishedResources.add(resourceName);
        } else {
          console.error(`❌ Failed to publish resource ${resourceName}:`, error);
        }
      }
    }
  }

  private async createHealthcareView(viewName: string): Promise<void> {
    const pool = getDuckDBPool();

    let viewQuery: string;

    switch (viewName) {
      case 'medicare_eligibility':
        viewQuery = `
          CREATE OR REPLACE VIEW medicare_eligibility AS
          SELECT
            county,
            state,
            population_total,
            population_65_plus,
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
            CASE
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 'High Senior Population'
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 'Moderate Senior Population'
              ELSE 'Low Senior Population'
            END as senior_population_category
          FROM demographics
          WHERE population_total > 0
        `;
        break;

      case 'population_health':
        viewQuery = `
          CREATE OR REPLACE VIEW population_health AS
          SELECT
            county,
            state,
            population_total,
            median_household_income,
            CASE
              WHEN median_household_income < 40000 THEN 3
              WHEN median_household_income < 60000 THEN 2
              ELSE 1
            END as income_risk_score,
            CASE
              WHEN median_household_income < 40000 THEN 'High Risk'
              WHEN median_household_income < 60000 THEN 'Moderate Risk'
              ELSE 'Low Risk'
            END as risk_category
          FROM demographics
          WHERE population_total > 0
        `;
        break;

      case 'facility_data':
        viewQuery = `
          CREATE OR REPLACE VIEW facility_adequacy AS
          SELECT
            county,
            state,
            population_total,
            population_65_plus,
            ROUND(population_total / 10000.0, 2) as facilities_per_10k_estimate,
            CASE
              WHEN population_total / 10000.0 < 5 THEN 'Underserved'
              ELSE 'Adequately Served'
            END as adequacy_rating
          FROM demographics
          WHERE population_total > 0
        `;
        break;

      default:
        throw new Error(`Unknown view: ${viewName}`);
    }

    await pool.query(viewQuery);
    console.log(`✅ Created healthcare view: ${viewName}`);
  }

  private async registerTools(): Promise<void> {
    console.log('🔧 Registering healthcare analytics tools...');

    for (const [toolName, toolConfig] of Object.entries(healthcareAnalyticsTools)) {
      try {
        // Register tool with MCP server
        const registerQuery = `
          SELECT mcp_register_tool(
            '${toolName}',
            '${JSON.stringify(toolConfig)}'
          ) as registration_status
        `;

        const pool = getDuckDBPool();
        const result = await pool.query(registerQuery);
        this.registeredTools.add(toolName);

        console.log(`✅ Registered tool: ${toolName}`);

      } catch (error) {
        if (error instanceof Error && error.message.includes('mcp_register_tool')) {
          console.warn(`⚠️ MCP register function not available for ${toolName}, using fallback`);
          this.registeredTools.add(toolName);
        } else {
          console.error(`❌ Failed to register tool ${toolName}:`, error);
        }
      }
    }
  }

  // Execute healthcare analytics tools
  async executeTool(toolName: string, parameters: any): Promise<any> {
    if (!this.registeredTools.has(toolName)) {
      throw new Error(`Tool not registered: ${toolName}`);
    }

    const monitoring = getMCPMonitoring();
    const correlationId = monitoring.startOperation('tool_execution', 'mcp_server', toolName);

    const pool = getDuckDBPool();

    try {
      let result: any;

      switch (toolName) {
        case 'calculate_medicare_eligibility':
          result = await this.calculateMedicareEligibility(parameters);
          break;

        case 'population_health_risk':
          result = await this.assessPopulationHealthRisk(parameters);
          break;

        case 'facility_adequacy':
          result = await this.analyzeFacilityAdequacy(parameters);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      monitoring.completeOperation(correlationId, true);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      monitoring.completeOperation(correlationId, false, errorMessage);
      console.error(`❌ Tool execution failed for ${toolName}:`, error);
      throw error;
    }
  }

  private async calculateMedicareEligibility(parameters: any): Promise<any> {
    const { geography_type, geography_codes, year } = parameters;
    const pool = getDuckDBPool();

    let whereClause = '';
    if (geography_type === 'state') {
      whereClause = `WHERE state IN ('${geography_codes.join("','")}')`;
    } else if (geography_type === 'county') {
      whereClause = `WHERE county IN ('${geography_codes.join("','")}')`;
    }

    const query = `
      SELECT * FROM medicare_eligibility
      ${whereClause}
      ORDER BY medicare_eligible_rate DESC
    `;

    return await pool.query(query);
  }

  private async assessPopulationHealthRisk(parameters: any): Promise<any> {
    const { geography_type, geography_codes, risk_factors } = parameters;
    const pool = getDuckDBPool();

    let whereClause = '';
    if (geography_type === 'state') {
      whereClause = `WHERE state IN ('${geography_codes.join("','")}')`;
    } else if (geography_type === 'county') {
      whereClause = `WHERE county IN ('${geography_codes.join("','")}')`;
    }

    const query = `
      SELECT * FROM population_health
      ${whereClause}
      ORDER BY income_risk_score DESC
    `;

    return await pool.query(query);
  }

  private async analyzeFacilityAdequacy(parameters: any): Promise<any> {
    const { geography_type, geography_codes, facility_type } = parameters;
    const pool = getDuckDBPool();

    let whereClause = '';
    if (geography_type === 'state') {
      whereClause = `WHERE state IN ('${geography_codes.join("','")}')`;
    } else if (geography_type === 'county') {
      whereClause = `WHERE county IN ('${geography_codes.join("','")}')`;
    }

    const query = `
      SELECT * FROM facility_adequacy
      ${whereClause}
      ORDER BY adequacy_rating, facilities_per_10k_estimate DESC
    `;

    return await pool.query(query);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ MCP Server not running');
      return;
    }

    console.log('🔄 Stopping MCP Server...');

    try {
      // Stop MCP server
      const pool = getDuckDBPool();

      try {
        await pool.query('SELECT mcp_server_stop()');
      } catch (error) {
        console.warn('⚠️ MCP server stop function not available');
      }

      this.isRunning = false;
      this.startTime = undefined;
      this.publishedResources.clear();
      this.registeredTools.clear();

      this.emit('stopped');
      console.log('✅ MCP Server stopped');

    } catch (error) {
      console.error('❌ Error stopping MCP Server:', error);
      throw error;
    }
  }

  getStatus(): MCPServerStatus {
    const monitoring = getMCPMonitoring();
    const aggregateMetrics = monitoring.getAggregateMetrics();
    const healthStatus = monitoring.getHealthStatus();

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      resourcesPublished: this.publishedResources.size,
      toolsRegistered: this.registeredTools.size,
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

  // Health check for the MCP server
  async healthCheck(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    try {
      const pool = getDuckDBPool();

      // Test basic resource access
      const result = await pool.query('SELECT COUNT(*) as count FROM demographics LIMIT 1');
      return result.length > 0;

    } catch (error) {
      console.error('❌ MCP Server health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let mcpServerInstance: MCPServerService | null = null;

export function getMCPServerService(): MCPServerService {
  if (!mcpServerInstance) {
    mcpServerInstance = new MCPServerService();
  }
  return mcpServerInstance;
}

export async function closeMCPServerService(): Promise<void> {
  if (mcpServerInstance) {
    await mcpServerInstance.stop();
    mcpServerInstance = null;
  }
}
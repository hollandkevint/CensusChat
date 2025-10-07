/**
 * MCP Connector
 * Protocol-based external system integration for healthcare analytics
 */

import {
  MCPHealthcareTools,
  GeographicParams,
  AnalysisResult,
  RiskAnalysis,
  RiskFactorParams,
  AdequacyMetrics,
  FacilityParams,
  QueryTranslationPattern
} from '../types/HealthcareAnalyticsTypes';

import { getMCPServerService } from '../../../services/mcpServerService';
import { getMCPMonitoring } from '../../../utils/mcpMonitoring';

export interface MCPToolExport {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export interface MCPResponseFormat {
  version: string;
  timestamp: Date;
  tool: string;
  result: any;
  metadata: {
    executionTime: number;
    dataSource: string;
    correlationId: string;
  };
}

export class MCPConnector {
  private tools: Map<string, MCPToolExport> = new Map();
  private monitoring = getMCPMonitoring();

  constructor() {
    console.log('🔗 Initializing MCP Connector for healthcare analytics');
    this.initializeHealthcareTools();
  }

  async exposeAnalyticsTools(): Promise<MCPHealthcareTools> {
    console.log('📡 Exposing healthcare analytics as MCP tools');

    return {
      medicare_eligibility_analysis: async (params: GeographicParams) => {
        return await this.executeMCPTool('medicare_eligibility_analysis', params);
      },

      population_health_assessment: async (params: RiskFactorParams) => {
        return await this.executeMCPTool('population_health_assessment', params);
      },

      facility_adequacy_calculator: async (params: FacilityParams) => {
        return await this.executeMCPTool('facility_adequacy_calculator', params);
      }
    };
  }

  async executeMCPTool(toolName: string, params: any): Promise<any> {
    const correlationId = this.monitoring.startOperation('mcp_tool_execution', 'healthcare_analytics', toolName);

    try {
      console.log(`🔧 Executing MCP tool: ${toolName} with params:`, params);

      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`MCP tool not found: ${toolName}`);
      }

      const startTime = Date.now();
      const result = await tool.handler(params);
      const executionTime = Date.now() - startTime;

      const mcpResponse: MCPResponseFormat = {
        version: '1.0.0',
        timestamp: new Date(),
        tool: toolName,
        result,
        metadata: {
          executionTime,
          dataSource: 'CensusChat Healthcare Analytics',
          correlationId
        }
      };

      this.monitoring.completeOperation(correlationId, true);
      console.log(`✅ MCP tool execution successful: ${toolName} (${executionTime}ms)`);

      return mcpResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.monitoring.completeOperation(correlationId, false, errorMessage);
      console.error(`❌ MCP tool execution failed: ${toolName}:`, error);
      throw error;
    }
  }

  formatMCPResponse(toolName: string, data: any, executionTime: number, correlationId: string): MCPResponseFormat {
    return {
      version: '1.0.0',
      timestamp: new Date(),
      tool: toolName,
      result: data,
      metadata: {
        executionTime,
        dataSource: 'CensusChat Healthcare Analytics',
        correlationId
      }
    };
  }

  async registerExternalTool(toolName: string, description: string, handler: (params: any) => Promise<any>): Promise<void> {
    console.log(`📋 Registering external MCP tool: ${toolName}`);

    const toolExport: MCPToolExport = {
      name: toolName,
      description,
      parameters: {}, // Will be inferred from handler
      handler
    };

    this.tools.set(toolName, toolExport);

    // Register with MCP server if available
    try {
      const mcpServer = getMCPServerService();
      // The MCP server will handle the tool registration through its existing mechanism
      console.log(`✅ External MCP tool registered: ${toolName}`);
    } catch (error) {
      console.warn(`⚠️ Could not register with MCP server: ${toolName}`, error);
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolDefinition(toolName: string): MCPToolExport | undefined {
    return this.tools.get(toolName);
  }

  private initializeHealthcareTools(): void {
    // Medicare Eligibility Analysis Tool
    this.tools.set('medicare_eligibility_analysis', {
      name: 'Medicare Eligibility Analysis',
      description: 'Analyze Medicare eligibility rates and senior population demographics by geography',
      parameters: {
        geography_type: { type: 'string', enum: ['state', 'county'], required: true },
        geography_codes: { type: 'array', items: { type: 'string' }, required: true },
        year: { type: 'string', required: false }
      },
      handler: async (params: GeographicParams): Promise<AnalysisResult> => {
        const mcpServer = getMCPServerService();
        const data = await mcpServer.executeTool('calculate_medicare_eligibility', params);

        return {
          data,
          metadata: {
            recordCount: data.length,
            executionTime: Date.now(), // This will be properly calculated by the caller
            dataSource: 'CensusChat Demographics with Medicare Analysis',
            confidenceLevel: 0.95,
            queryPattern: 'medicare_eligibility_pattern'
          }
        };
      }
    });

    // Population Health Assessment Tool
    this.tools.set('population_health_assessment', {
      name: 'Population Health Risk Assessment',
      description: 'Assess population health risks based on demographic and socioeconomic factors',
      parameters: {
        geography_type: { type: 'string', enum: ['state', 'county'], required: true },
        geography_codes: { type: 'array', items: { type: 'string' }, required: true },
        risk_factors: { type: 'array', items: { type: 'string' }, required: true }
      },
      handler: async (params: RiskFactorParams): Promise<RiskAnalysis[]> => {
        const mcpServer = getMCPServerService();
        const data = await mcpServer.executeTool('population_health_risk', params);

        // Transform data to RiskAnalysis format
        return data.map((row: any) => ({
          geography: `${row.county}, ${row.state}`,
          state: row.state,
          county: row.county,
          composite_risk_score: row.composite_risk_score || 0,
          risk_category: row.risk_category || 'Low Risk',
          risk_factors: {
            income_risk_score: row.income_risk_score || 1,
            insurance_risk_score: row.insurance_risk_score || 1,
            age_risk_score: row.age_risk_score || 1,
            education_risk_score: row.education_risk_score || 1
          }
        }));
      }
    });

    // Facility Adequacy Calculator Tool
    this.tools.set('facility_adequacy_calculator', {
      name: 'Healthcare Facility Adequacy Calculator',
      description: 'Calculate healthcare facility adequacy ratios and identify underserved areas',
      parameters: {
        geography_type: { type: 'string', enum: ['state', 'county'], required: true },
        geography_codes: { type: 'array', items: { type: 'string' }, required: true },
        facility_type: { type: 'string', enum: ['hospital', 'clinic', 'specialty', 'all'], required: false }
      },
      handler: async (params: FacilityParams): Promise<AdequacyMetrics[]> => {
        const mcpServer = getMCPServerService();
        const data = await mcpServer.executeTool('facility_adequacy', params);

        // Transform data to AdequacyMetrics format
        return data.map((row: any) => ({
          geography: `${row.county}, ${row.state}`,
          state: row.state,
          county: row.county,
          population_total: row.population_total || 0,
          population_65_plus: row.population_65_plus || 0,
          facilities_count: row.facilities_count || 0,
          facilities_per_10k: row.facilities_per_10k || 0,
          adequacy_rating: row.adequacy_rating || 'Adequately Served'
        }));
      }
    });

    console.log(`✅ Initialized ${this.tools.size} healthcare MCP tools`);
  }

  async validateMCPProtocol(toolName: string, params: any): Promise<{ isValid: boolean; errors: string[] }> {
    const tool = this.tools.get(toolName);
    const errors: string[] = [];

    if (!tool) {
      errors.push(`Tool not found: ${toolName}`);
      return { isValid: false, errors };
    }

    // Validate required parameters based on tool definition
    const toolParams = tool.parameters;

    Object.entries(toolParams).forEach(([paramName, paramDef]: [string, any]) => {
      if (paramDef.required && !params[paramName]) {
        errors.push(`Required parameter missing: ${paramName}`);
      }

      if (paramDef.enum && params[paramName] && !paramDef.enum.includes(params[paramName])) {
        errors.push(`Invalid value for ${paramName}. Expected one of: ${paramDef.enum.join(', ')}`);
      }

      if (paramDef.type === 'array' && params[paramName] && !Array.isArray(params[paramName])) {
        errors.push(`Parameter ${paramName} must be an array`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  async healthCheck(): Promise<{ healthy: boolean; tools: Record<string, boolean> }> {
    const toolHealth: Record<string, boolean> = {};

    for (const [toolName, tool] of this.tools) {
      try {
        // Simple health check with minimal parameters
        const testParams = this.generateTestParams(toolName);
        await tool.handler(testParams);
        toolHealth[toolName] = true;
      } catch (error) {
        console.error(`Health check failed for tool ${toolName}:`, error);
        toolHealth[toolName] = false;
      }
    }

    const healthyTools = Object.values(toolHealth).filter(h => h).length;
    const totalTools = Object.keys(toolHealth).length;

    return {
      healthy: healthyTools === totalTools,
      tools: toolHealth
    };
  }

  private generateTestParams(toolName: string): any {
    // Generate minimal test parameters for health checks
    switch (toolName) {
      case 'medicare_eligibility_analysis':
        return {
          geography_type: 'state',
          geography_codes: ['Florida']
        };

      case 'population_health_assessment':
        return {
          geography_type: 'state',
          geography_codes: ['Florida'],
          risk_factors: ['income']
        };

      case 'facility_adequacy_calculator':
        return {
          geography_type: 'state',
          geography_codes: ['Florida']
        };

      default:
        return {};
    }
  }
}
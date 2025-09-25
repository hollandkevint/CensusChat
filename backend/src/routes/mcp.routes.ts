import { Router } from 'express';
import { getMCPHealthcareService } from '../services/mcpHealthcareService';
import { authenticateMCPRequest, authorizeMCPTool, MCPPermission } from '../middleware/mcpAuth';
import { createErrorResponse, MCPErrorCode } from '../utils/mcpResponseFormatter';

const router = Router();

// Get MCP service instance
const mcpService = getMCPHealthcareService();

// Protocol Information
router.get('/info', async (req, res) => {
  try {
    const protocolInfo = mcpService.getProtocolInfo();
    res.json(protocolInfo);
  } catch (error) {
    console.error('❌ MCP protocol info error:', error);
    res.status(500).json(createErrorResponse(
      'protocol_info',
      MCPErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve protocol information'
    ));
  }
});

// Health Check
router.get('/health', async (req, res) => {
  try {
    const health = await mcpService.getHealthStatus();
    res.json(health);
  } catch (error) {
    console.error('❌ MCP health check error:', error);
    res.status(500).json(createErrorResponse(
      'health_check',
      MCPErrorCode.SERVICE_UNAVAILABLE,
      'Health check failed'
    ));
  }
});

// Available Tools
router.get('/tools', authenticateMCPRequest, async (req, res) => {
  try {
    const tools = mcpService.getAvailableTools();
    res.json({
      success: true,
      tools: Array.from(tools.entries()).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.inputSchema,
        permissions: tool.requiredPermission
      }))
    });
  } catch (error) {
    console.error('❌ MCP tools listing error:', error);
    res.status(500).json(createErrorResponse(
      'tools_list',
      MCPErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve available tools'
    ));
  }
});

// Execute Medicare Eligibility Analysis
router.post('/tools/medicare_eligibility_analysis',
  authenticateMCPRequest,
  authorizeMCPTool(MCPPermission.ANALYZE_MEDICARE),
  async (req, res) => {
    try {
      const result = await mcpService.executeTool('medicare_eligibility_analysis', req.body);
      res.json(result);
    } catch (error) {
      console.error('❌ Medicare eligibility analysis error:', error);
      res.status(500).json(createErrorResponse(
        'medicare_eligibility_analysis',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        'Medicare eligibility analysis failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
);

// Execute Population Health Assessment
router.post('/tools/population_health_assessment',
  authenticateMCPRequest,
  authorizeMCPTool(MCPPermission.ANALYZE_HEALTH_RISKS),
  async (req, res) => {
    try {
      const result = await mcpService.executeTool('population_health_assessment', req.body);
      res.json(result);
    } catch (error) {
      console.error('❌ Population health assessment error:', error);
      res.status(500).json(createErrorResponse(
        'population_health_assessment',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        'Population health assessment failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
);

// Execute Facility Adequacy Calculator
router.post('/tools/facility_adequacy_calculator',
  authenticateMCPRequest,
  authorizeMCPTool(MCPPermission.ANALYZE_FACILITIES),
  async (req, res) => {
    try {
      const result = await mcpService.executeTool('facility_adequacy_calculator', req.body);
      res.json(result);
    } catch (error) {
      console.error('❌ Facility adequacy calculator error:', error);
      res.status(500).json(createErrorResponse(
        'facility_adequacy_calculator',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        'Facility adequacy calculator failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
);

// Execute Healthcare Dashboard Composite
router.post('/tools/healthcare_dashboard_composite',
  authenticateMCPRequest,
  authorizeMCPTool(MCPPermission.ANALYZE_COMPREHENSIVE),
  async (req, res) => {
    try {
      const result = await mcpService.executeTool('healthcare_dashboard_composite', req.body);
      res.json(result);
    } catch (error) {
      console.error('❌ Healthcare dashboard composite error:', error);
      res.status(500).json(createErrorResponse(
        'healthcare_dashboard_composite',
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        'Healthcare dashboard composite failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
);

// Generic tool execution endpoint
router.post('/tools/:toolName',
  authenticateMCPRequest,
  authorizeMCPTool(),
  async (req, res) => {
    try {
      const { toolName } = req.params;
      const result = await mcpService.executeTool(toolName, req.body);
      res.json(result);
    } catch (error) {
      console.error(`❌ Tool execution error for ${req.params.toolName}:`, error);
      res.status(500).json(createErrorResponse(
        req.params.toolName,
        MCPErrorCode.INTERNAL_SERVER_ERROR,
        `Tool execution failed: ${req.params.toolName}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
);

export { router as mcpRoutes };
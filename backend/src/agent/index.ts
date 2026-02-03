/**
 * Agent module barrel export
 *
 * Exports both AgentService (base SDK) and AgentSdkService (Agent SDK)
 * Use USE_AGENT_SDK env flag to choose between them in routes
 */

// Base SDK agent service (existing)
export {
  AgentService,
  queryWithSchema,
  queryCensus,
  queryComparison,
  isComparisonQuery,
  ComparisonResponseSchema,
  type ComparisonResponse,
  type AgentQueryOptions,
  type AgentQueryResult,
  // Re-exports from agentService
  regionAnalyzerConfig,
  RegionAnalysisResultSchema,
  getMcpConfig,
  CENSUS_TOOLS,
} from "./agentService";

// Agent SDK service (new - gap closure)
export {
  AgentSdkService,
  queryWithAgentSdk,
  buildMcpServersForAgentSdk,
  getAllowedToolsForAgentSdk,
  type AgentSdkOptions,
  type AgentSdkResult,
  type AgentSdkMessage,
} from "./agentSdkService";

// Schemas
export * from "./schemas";

// Agents (subagent definitions)
export * from "./agents";

// Session manager
export { getSessionManager, AgentSessionManager } from "./sessionManager";

// MCP config
export { type McpServerConfig, type McpServersConfig } from "./mcpConfig";

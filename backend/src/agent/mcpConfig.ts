/**
 * MCP Server Configuration for Agent SDK
 * Centralized config for connecting to CensusChat MCP server
 */

export interface McpServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export interface McpServersConfig {
  censuschat: McpServerConfig;
}

/**
 * Get MCP server configuration
 * Uses environment variable or defaults to localhost
 */
export function getMcpConfig(): McpServersConfig {
  const baseUrl = process.env.MCP_SERVER_URL || "http://localhost:3001";

  return {
    censuschat: {
      type: "http",
      url: `${baseUrl}/mcp`,
    },
  };
}

/**
 * List of allowed MCP tools for census queries
 */
export const CENSUS_TOOLS = [
  "mcp__censuschat__execute_query",
  "mcp__censuschat__get_information_schema",
  "mcp__censuschat__validate_sql_query",
] as const;

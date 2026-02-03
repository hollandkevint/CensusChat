/**
 * Agent SDK Service - Claude Agent SDK wrapper for CensusChat
 * Uses @anthropic-ai/claude-agent-sdk with MCP HTTP connection
 *
 * This is a PARALLEL service to agentService.ts, selected via USE_AGENT_SDK env flag.
 * The Agent SDK provides:
 * - Built-in agentic loop with automatic tool orchestration
 * - Session management for multi-turn conversations
 * - MCP server integration via HTTP transport
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getMcpConfig, CENSUS_TOOLS, McpServersConfig } from "./mcpConfig";
import { getSessionManager } from "./sessionManager";

/**
 * Options for Agent SDK queries
 */
export interface AgentSdkOptions {
  model?: string;
  maxThinkingTokens?: number;
  maxTurns?: number;
  systemPrompt?: string;
  resume?: string; // Session ID for continuation
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
}

/**
 * Result from Agent SDK query
 */
export interface AgentSdkResult {
  success: boolean;
  result?: string;
  sessionId?: string;
  error?: string;
  messages?: AgentSdkMessage[];
}

/**
 * Message from Agent SDK stream
 */
export interface AgentSdkMessage {
  type: string;
  subtype?: string;
  content?: unknown;
  timestamp: string;
}

/**
 * Build MCP servers config for Agent SDK
 * Transforms our McpServersConfig to the format expected by Agent SDK
 */
export function buildMcpServersForAgentSdk(
  mcpConfig: McpServersConfig
): Record<string, { type: "http"; url: string; headers?: Record<string, string> }> {
  return {
    censuschat: {
      type: "http",
      url: mcpConfig.censuschat.url,
      headers: {
        "Content-Type": "application/json",
      },
    },
  };
}

/**
 * Get allowed tools list for Agent SDK
 * Prefixes MCP tools with mcp__servername__ format
 */
export function getAllowedToolsForAgentSdk(): string[] {
  // CENSUS_TOOLS already has the full MCP tool names like "mcp__censuschat__execute_query"
  return [...CENSUS_TOOLS];
}

/**
 * Query using Agent SDK with MCP connection
 *
 * Uses the Agent SDK's streaming query() function which handles:
 * - Tool orchestration loop
 * - MCP server communication
 * - Session management
 *
 * @param prompt - Natural language query
 * @param options - Query options (model, resume session, etc.)
 * @returns AgentSdkResult with result string and session ID
 */
export async function queryWithAgentSdk(
  prompt: string,
  options: AgentSdkOptions = {}
): Promise<AgentSdkResult> {
  const mcpConfig = getMcpConfig();
  const mcpServers = buildMcpServersForAgentSdk(mcpConfig);
  const allowedTools = getAllowedToolsForAgentSdk();

  let sessionId: string | undefined;
  let result: string | undefined;
  const messages: AgentSdkMessage[] = [];

  try {
    for await (const message of query({
      prompt,
      options: {
        model: options.model || "claude-sonnet-4-20250514",
        maxThinkingTokens: options.maxThinkingTokens,
        maxTurns: options.maxTurns || 20,
        resume: options.resume,
        mcpServers,
        allowedTools,
        permissionMode: options.permissionMode || "acceptEdits",
      },
    })) {
      // Track all messages for debugging
      messages.push({
        type: message.type,
        subtype: "subtype" in message ? (message.subtype as string) : undefined,
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Capture session ID from init message
      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        sessionId = (message as { session_id?: string }).session_id;
      }

      // Capture result from success message
      if (message.type === "result" && "subtype" in message && message.subtype === "success") {
        result = (message as { result?: string }).result;
      }

      // Handle error results (error_during_execution, error_max_turns, error_max_budget_usd, error_max_structured_output_retries)
      if (
        message.type === "result" &&
        "subtype" in message &&
        typeof message.subtype === "string" &&
        message.subtype.startsWith("error_")
      ) {
        const errorMsg = message as { error?: string; subtype: string };
        return {
          success: false,
          error: errorMsg.error || `Agent SDK error: ${errorMsg.subtype}`,
          sessionId,
          messages,
        };
      }
    }

    return {
      success: true,
      result,
      sessionId,
      messages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error in Agent SDK query",
      messages,
    };
  }
}

/**
 * Comparison response structure for parallel region comparison
 */
export interface ComparisonResponse {
  success: boolean;
  comparison: {
    regions: Array<{
      region_name: string;
      total_population?: number;
      seniors_65_plus?: number;
      median_income?: number;
      key_metrics?: Record<string, unknown>;
      result?: string;
    }>;
    summary: string;
    differences: string[];
  };
  explanation: string;
}

/**
 * Extract regions from a comparison query prompt
 * Matches patterns like "Tampa Bay vs Phoenix" or "compare Dallas and Houston"
 */
export function extractRegions(prompt: string): string[] {
  // Match "A vs B" or "A versus B" patterns
  const vsMatch = prompt.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+for|$)/i);
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()];
  }

  // Match "compare A and B" or "compare A, B" patterns
  const compareMatch = prompt.match(/compare\s+(.+?)\s+(?:and|,)\s+(.+?)(?:\s+for|$)/i);
  if (compareMatch) {
    return [compareMatch[1].trim(), compareMatch[2].trim()];
  }

  // Match "difference between A and B" pattern
  const diffMatch = prompt.match(/difference\s+between\s+(.+?)\s+and\s+(.+?)(?:\s+for|$)/i);
  if (diffMatch) {
    return [diffMatch[1].trim(), diffMatch[2].trim()];
  }

  return [];
}

/**
 * Combine results from parallel region queries into a comparison response
 */
function combineRegionResults(
  results: AgentSdkResult[],
  regionNames: string[]
): ComparisonResponse {
  const successfulResults = results.filter((r) => r.success);

  return {
    success: successfulResults.length > 0,
    comparison: {
      regions: results.map((r, i) => ({
        region_name: regionNames[i],
        result: r.result,
        // Additional metrics would be extracted from result parsing
      })),
      summary: `Parallel comparison of ${regionNames.join(" vs ")}`,
      differences: [],
    },
    explanation: `Compared ${regionNames.length} regions in parallel. ${successfulResults.length}/${results.length} queries succeeded.`,
  };
}

/**
 * Query comparison using parallel execution with Promise.all
 *
 * For queries like "Compare Tampa Bay vs Phoenix for Medicare eligible population",
 * this extracts the regions and runs queries for each in parallel.
 */
export async function queryComparisonParallel(
  prompt: string,
  options: AgentSdkOptions = {}
): Promise<ComparisonResponse> {
  // Extract regions from prompt
  const extractedRegions = extractRegions(prompt);

  if (extractedRegions.length < 2) {
    // Fall back to single query for non-comparison prompts
    const result = await queryWithAgentSdk(prompt, options);
    return {
      success: result.success,
      comparison: {
        regions: [],
        summary: "",
        differences: [],
      },
      explanation: result.result?.toString() || result.error || "",
    };
  }

  // Run region queries in parallel using Promise.all
  const regionPromises = extractedRegions.map((region) =>
    queryWithAgentSdk(`Analyze demographic data for ${region}: ${prompt}`, options)
  );

  const results = await Promise.all(regionPromises);

  // Combine results into comparison format
  return combineRegionResults(results, extractedRegions);
}

/**
 * AgentSdkService class for stateful usage with session management
 *
 * Wraps queryWithAgentSdk with user-scoped session tracking.
 * Sessions enable follow-up queries like "Now filter to income > $75K"
 * that reference prior context.
 */
export class AgentSdkService {
  private model: string;
  private systemPrompt?: string;
  private userId: string;
  private currentSessionId?: string;
  private sessionManager = getSessionManager();

  constructor(options?: { model?: string; systemPrompt?: string; userId?: string }) {
    this.model = options?.model || "claude-sonnet-4-20250514";
    this.systemPrompt = options?.systemPrompt;
    this.userId = options?.userId || `anonymous-${Date.now()}`;
  }

  /**
   * Execute a query using Agent SDK
   *
   * Automatically resumes previous session for conversational context
   */
  async query(prompt: string): Promise<AgentSdkResult> {
    const result = await queryWithAgentSdk(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      resume: this.currentSessionId, // Resume if we have a session
    });

    // Track session for follow-up queries
    if (result.success && result.sessionId) {
      this.currentSessionId = result.sessionId;

      // Store in session manager for cross-service access
      this.sessionManager.storeSession(this.userId, result.sessionId, prompt, result.result);
    }

    return result;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Clear session (for logout or session reset)
   */
  clearSession(): void {
    this.currentSessionId = undefined;
    this.sessionManager.clearUserSessions(this.userId);
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.userId;
  }
}

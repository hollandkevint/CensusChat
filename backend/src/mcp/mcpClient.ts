/**
 * MCP HTTP Client for CensusChat Backend
 * Uses HTTP transport to communicate with MCP server endpoints
 * Replaces in-process calls with HTTP fetch to /mcp endpoint
 */

export interface MCPToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
  validationErrors?: any[];
}

export class MCPHttpClient {
  private sessionId: string | null = null;
  private baseUrl: string;
  private requestId: number = 0;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001';
  }

  /**
   * Initialize MCP session
   * Sends initialize request and stores session ID from response header
   */
  async initialize(): Promise<void> {
    if (this.sessionId) {
      console.log('[MCP Client] Already initialized with session:', this.sessionId);
      return;
    }

    console.log('[MCP Client] Initializing session...');

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          clientInfo: { name: 'censuschat-backend', version: '1.0.0' },
          capabilities: {},
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Initialize failed: ${response.status} - ${errorText}`);
    }

    this.sessionId = response.headers.get('Mcp-Session-Id');
    if (!this.sessionId) {
      throw new Error('No session ID in initialize response');
    }

    console.log('[MCP Client] Session initialized:', this.sessionId);
  }

  /**
   * Call an MCP tool by name
   * Auto-initializes session if not already connected
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    if (!this.sessionId) {
      await this.initialize();
    }

    console.log(`[MCP Client] Calling tool: ${name}`);

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': this.sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tool call failed: ${response.status} - ${errorText}`);
    }

    const result = await this.parseResponse(response);
    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    return result.result;
  }

  /**
   * Parse response - handles both JSON and SSE formats
   * MCP SDK returns SSE format: "event: message\ndata: {...}\n\n"
   */
  private async parseResponse(response: Response): Promise<{ error?: { message?: string }; result?: unknown }> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Handle SSE format
    if (contentType.includes('text/event-stream')) {
      return this.parseSSE(text);
    }

    // Handle JSON format
    return JSON.parse(text);
  }

  /**
   * Parse SSE format response
   * Format: "event: message\ndata: {...JSON...}\n\n"
   */
  private parseSSE(text: string): { error?: { message?: string }; result?: unknown } {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6); // Remove "data: " prefix
        return JSON.parse(jsonStr);
      }
    }
    throw new Error('No data field in SSE response');
  }

  /**
   * Disconnect from MCP server
   * Sends DELETE request to terminate session
   */
  async disconnect(): Promise<void> {
    if (!this.sessionId) {
      console.log('[MCP Client] Not connected, nothing to disconnect');
      return;
    }

    console.log('[MCP Client] Disconnecting session:', this.sessionId);

    try {
      await fetch(`${this.baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { 'Mcp-Session-Id': this.sessionId },
      });
    } catch (error) {
      console.error('[MCP Client] Disconnect error (ignored):', error);
    }

    this.sessionId = null;
    console.log('[MCP Client] Disconnected');
  }

  /**
   * Get client connection status
   */
  getStatus(): { isConnected: boolean; sessionId: string | null } {
    return { isConnected: !!this.sessionId, sessionId: this.sessionId };
  }

  // ============================================================
  // Convenience methods matching existing interface
  // ============================================================

  /**
   * Get database schema information
   */
  async getInformationSchema(): Promise<MCPToolCallResult> {
    try {
      const toolResult = await this.callTool('get_information_schema');
      return this.parseToolResult(toolResult);
    } catch (error) {
      console.error('[MCP Client] getInformationSchema error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate SQL query against security policies
   */
  async validateSQLQuery(query: string): Promise<MCPToolCallResult> {
    try {
      const toolResult = await this.callTool('validate_sql_query', { query });
      return this.parseToolResult(toolResult);
    } catch (error) {
      console.error('[MCP Client] validateSQLQuery error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute validated SQL query
   */
  async executeQuery(query: string): Promise<MCPToolCallResult> {
    try {
      const toolResult = await this.callTool('execute_query', { query });
      return this.parseToolResult(toolResult);
    } catch (error) {
      console.error('[MCP Client] executeQuery error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse MCP tool result content to MCPToolCallResult format
   */
  private parseToolResult(toolResult: any): MCPToolCallResult {
    // MCP tool results have content array with text items
    if (!toolResult?.content || !Array.isArray(toolResult.content)) {
      return { success: false, error: 'Invalid tool result format' };
    }

    // Find text content item
    const textContent = toolResult.content.find((c: any) => c.type === 'text');
    if (!textContent?.text) {
      return { success: false, error: 'No text content in tool result' };
    }

    // Parse JSON from text content
    try {
      const parsed = JSON.parse(textContent.text);

      // Check if result indicates error (string error field)
      if (parsed.error && typeof parsed.error === 'string') {
        return {
          success: false,
          error: parsed.error,
          validationErrors: parsed.validationErrors,
        };
      }

      // Check validation result format (valid: false)
      if (parsed.valid === false) {
        return {
          success: false,
          error: 'SQL validation failed',
          validationErrors: parsed.errors,
        };
      }

      // Check execute_query error format (success: false with message)
      if (parsed.success === false) {
        return {
          success: false,
          error: parsed.message || 'Operation failed',
          validationErrors: parsed.validationErrors,
        };
      }

      return { success: true, result: parsed };
    } catch {
      // If not JSON, return as plain text result
      return { success: true, result: { text: textContent.text } };
    }
  }

  /**
   * Generate incrementing request ID
   */
  private nextRequestId(): number {
    return ++this.requestId;
  }
}

// ============================================================
// Singleton management
// ============================================================

let mcpClientInstance: MCPHttpClient | null = null;

/**
 * Get singleton MCP HTTP client instance
 */
export function getMcpClient(): MCPHttpClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPHttpClient();
  }
  return mcpClientInstance;
}

/**
 * Close and reset the MCP client singleton
 */
export async function closeMcpClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}

// ============================================================
// Legacy exports for backwards compatibility
// ============================================================

/**
 * @deprecated Use getMcpClient() instead
 */
export const getCensusChat_MCPClient = getMcpClient;

/**
 * @deprecated Use closeMcpClient() instead
 */
export const closeCensusChat_MCPClient = closeMcpClient;

/**
 * @deprecated Use MCPHttpClient instead
 */
export const CensusChat_MCPClient = MCPHttpClient;

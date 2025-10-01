/**
 * MCP Protocol Types
 * JSON-RPC 2.0 types for Model Context Protocol
 */

// JSON-RPC 2.0 Request
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

// JSON-RPC 2.0 Response
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JSONRPCError;
}

// JSON-RPC 2.0 Error
export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// MCP Resource Definition
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// MCP Tool Call Request
export interface MCPToolCallRequest {
  tool: string;
  arguments: Record<string, any>;
}

// MCP Tool Call Response
export interface MCPToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// MCP Server Capabilities
export interface MCPServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
}

// MCP Server Info
export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPServerCapabilities;
}

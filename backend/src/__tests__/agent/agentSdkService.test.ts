/**
 * Unit tests for Agent SDK Service
 *
 * Tests verify service configuration, MCP setup, and session tracking.
 * Uses mocks since actual Agent SDK requires Claude Code runtime.
 */

// Mock the Agent SDK before imports
jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  AgentSdkService,
  queryWithAgentSdk,
  buildMcpServersForAgentSdk,
  getAllowedToolsForAgentSdk,
} from "../../agent/agentSdkService";
import { getMcpConfig } from "../../agent/mcpConfig";

const mockQuery = query as jest.MockedFunction<typeof query>;

describe("agentSdkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.MCP_SERVER_URL;
  });

  describe("buildMcpServersForAgentSdk", () => {
    it("should build MCP server config with default localhost URL", () => {
      const mcpConfig = getMcpConfig();
      const result = buildMcpServersForAgentSdk(mcpConfig);

      expect(result).toEqual({
        censuschat: {
          type: "http",
          url: "http://localhost:3001/mcp",
          headers: {
            "Content-Type": "application/json",
          },
        },
      });
    });

    it("should use MCP_SERVER_URL environment variable when set", () => {
      process.env.MCP_SERVER_URL = "https://api.example.com";
      const mcpConfig = getMcpConfig();
      const result = buildMcpServersForAgentSdk(mcpConfig);

      expect(result.censuschat.url).toBe("https://api.example.com/mcp");
    });
  });

  describe("getAllowedToolsForAgentSdk", () => {
    it("should return census MCP tools", () => {
      const tools = getAllowedToolsForAgentSdk();

      expect(tools).toContain("mcp__censuschat__execute_query");
      expect(tools).toContain("mcp__censuschat__get_information_schema");
      expect(tools).toContain("mcp__censuschat__validate_sql_query");
    });

    it("should include document generation tools", () => {
      const tools = getAllowedToolsForAgentSdk();

      expect(tools).toContain("mcp__censuschat__generate_excel_report");
      expect(tools).toContain("mcp__censuschat__generate_csv_report");
      expect(tools).toContain("mcp__censuschat__generate_pdf_report");
    });
  });

  describe("queryWithAgentSdk", () => {
    it("should call Agent SDK query with correct options", async () => {
      // Create async generator mock that yields init and success messages
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "test-session-123" },
        { type: "result", subtype: "success", result: "Query completed" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Show seniors in Tampa Bay");

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0][0];

      expect(callArgs.prompt).toBe("Show seniors in Tampa Bay");
      expect(callArgs.options.model).toBe("claude-sonnet-4-20250514");
      expect(callArgs.options.mcpServers).toHaveProperty("censuschat");
      expect(callArgs.options.mcpServers.censuschat.type).toBe("http");
      expect(callArgs.options.allowedTools).toContain("mcp__censuschat__execute_query");
      expect(callArgs.options.permissionMode).toBe("acceptEdits");
    });

    it("should capture session ID from init message", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "captured-session-456" },
        { type: "result", subtype: "success", result: "Done" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Test query");

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("captured-session-456");
    });

    it("should return result from success message", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "session-1" },
        { type: "result", subtype: "success", result: "Found 42 seniors with income > $75K" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Count seniors with income > $75K");

      expect(result.success).toBe(true);
      expect(result.result).toBe("Found 42 seniors with income > $75K");
    });

    it("should handle error_during_execution", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "session-err" },
        {
          type: "result",
          subtype: "error_during_execution",
          error: "MCP server connection failed",
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Failing query");

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP server connection failed");
      expect(result.sessionId).toBe("session-err");
    });

    it("should handle error_max_turns", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "session-max" },
        { type: "result", subtype: "error_max_turns" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Complex query");

      expect(result.success).toBe(false);
      expect(result.error).toContain("error_max_turns");
    });

    it("should handle exceptions from query()", async () => {
      mockQuery.mockImplementation(async function* () {
        throw new Error("Network timeout");
      });

      const result = await queryWithAgentSdk("Query that throws");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });

    it("should track all messages for debugging", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "s1" },
        { type: "assistant", content: "Processing..." },
        { type: "result", subtype: "success", result: "Done" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await queryWithAgentSdk("Test");

      expect(result.messages).toHaveLength(3);
      expect(result.messages?.[0].type).toBe("system");
      expect(result.messages?.[1].type).toBe("assistant");
      expect(result.messages?.[2].type).toBe("result");
    });

    it("should pass resume option for session continuation", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "continued-session" },
        { type: "result", subtype: "success", result: "Continued" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await queryWithAgentSdk("Follow-up query", { resume: "previous-session-id" });

      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options.resume).toBe("previous-session-id");
    });
  });

  describe("AgentSdkService", () => {
    it("should create instance with default options", () => {
      const service = new AgentSdkService();

      expect(service.getSessionId()).toBeUndefined();
      expect(service.getUserId()).toMatch(/^anonymous-\d+$/);
    });

    it("should create instance with custom options", () => {
      const service = new AgentSdkService({
        model: "claude-opus-4-20250514",
        userId: "user-123",
      });

      expect(service.getUserId()).toBe("user-123");
    });

    it("should track session ID after successful query", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "tracked-session" },
        { type: "result", subtype: "success", result: "OK" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const service = new AgentSdkService({ userId: "test-user" });
      await service.query("Test query");

      expect(service.getSessionId()).toBe("tracked-session");
    });

    it("should resume session on subsequent queries", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "session-to-resume" },
        { type: "result", subtype: "success", result: "OK" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const service = new AgentSdkService();

      // First query
      await service.query("First query");

      // Second query should resume
      await service.query("Follow-up query");

      // Check second call used resume option
      const secondCallArgs = mockQuery.mock.calls[1][0];
      expect(secondCallArgs.options.resume).toBe("session-to-resume");
    });

    it("should clear session", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "session-to-clear" },
        { type: "result", subtype: "success", result: "OK" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const service = new AgentSdkService();
      await service.query("Query");

      expect(service.getSessionId()).toBe("session-to-clear");

      service.clearSession();

      expect(service.getSessionId()).toBeUndefined();
    });

    it("should not track session on failed query", async () => {
      const mockMessages = [
        { type: "system", subtype: "init", session_id: "failed-session" },
        { type: "result", subtype: "error_during_execution", error: "Failed" },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const service = new AgentSdkService();
      const result = await service.query("Failing query");

      expect(result.success).toBe(false);
      // Session should still not be tracked for follow-up since query failed
      expect(service.getSessionId()).toBeUndefined();
    });
  });
});

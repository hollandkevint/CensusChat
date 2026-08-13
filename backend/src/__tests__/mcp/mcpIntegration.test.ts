/**
 * MCP HTTP Transport Integration Tests
 * Tests the complete MCP flow: session management, tool execution, error handling
 */

// @modelcontextprotocol/ext-apps ships as ESM that Jest's ts-jest transform does
// not process; it is pulled in by mcp/mcpServer.ts purely to attach interactive
// UI-resource metadata to a few tools. That UI layer is orthogonal to the HTTP
// transport behavior under test here, so stub it: registerAppTool still registers
// a working tool on the server (so execute_query et al. remain callable), just
// without the UI decoration. The rest of the MCP SDK is CommonJS and loads for
// real. (The core @modelcontextprotocol/sdk is not mocked.)
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape } from 'zod';

jest.mock('@modelcontextprotocol/ext-apps/server', () => ({
  registerAppTool: (
    server: McpServer,
    name: string,
    config: { description: string; inputSchema: ZodRawShape },
    handler: Parameters<McpServer['tool']>[3]
  ) => server.tool(name, config.description, config.inputSchema, handler),
  registerAppResource: () => {},
  RESOURCE_MIME_TYPE: 'text/html+skybridge',
}));

import express, { Application } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { mcpTransportRouter } from '../../mcp/mcpRoutes';
import { MCPHttpClient } from '../../mcp/mcpClient';
import { getSessionManager, McpSessionManager } from '../../mcp/mcpSessionManager';
import { getDuckDBPool } from '../../utils/duckdbPool';

describe('MCP HTTP Transport Integration', () => {
  let app: Application;
  let server: Server;
  let baseUrl: string;
  let client: MCPHttpClient;
  let sessionManager: McpSessionManager;

  beforeAll(async () => {
    // Create test Express server
    app = express();
    app.use(express.json());
    app.use('/mcp', mcpTransportRouter);

    // Start on random available port
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;

    sessionManager = getSessionManager();

    // Ensure county_data exists with a couple rows so the execute-query tests run
    // hermetically in CI, where the real census.duckdb (gitignored, ~161MB) is
    // absent. Seed only when empty, so a local DB loaded with real data is untouched.
    const pool = getDuckDBPool();
    await pool.initialize();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS county_data (
        state VARCHAR, county VARCHAR, state_name VARCHAR, county_name VARCHAR,
        population INTEGER, median_income INTEGER, poverty_rate DOUBLE,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (state, county)
      )
    `);
    const countRows = await pool.query('SELECT COUNT(*) AS c FROM county_data');
    if (Number(countRows[0].c) === 0) {
      await pool.query(`
        INSERT INTO county_data (state, county, state_name, county_name, population, median_income, poverty_rate)
        VALUES ('12','086','Florida','Miami-Dade County',2716940,68000,15.0),
               ('06','037','California','Los Angeles County',9808667,90112,13.0)
      `);
    }
  });

  beforeEach(() => {
    client = new MCPHttpClient(baseUrl);
  });

  afterEach(async () => {
    // Clean up client session
    await client.disconnect();
  });

  afterAll(async () => {
    // Shutdown session manager to clean all sessions
    await sessionManager.shutdown();

    // Close server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('Session Management', () => {
    it('should create session on initialize', async () => {
      await client.initialize();

      const status = client.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.sessionId).toBeTruthy();
      expect(typeof status.sessionId).toBe('string');
    });

    it('should track session across multiple tool calls', async () => {
      await client.initialize();
      const sessionIdBefore = client.getStatus().sessionId;

      // Make a tool call
      await client.getInformationSchema();

      // Session should remain the same
      const sessionIdAfter = client.getStatus().sessionId;
      expect(sessionIdAfter).toBe(sessionIdBefore);
    });

    it('should allow multiple independent clients', async () => {
      const client1 = new MCPHttpClient(baseUrl);
      const client2 = new MCPHttpClient(baseUrl);

      await client1.initialize();
      await client2.initialize();

      const sessionId1 = client1.getStatus().sessionId;
      const sessionId2 = client2.getStatus().sessionId;

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionManager.getSessionCount()).toBeGreaterThanOrEqual(2);

      await client1.disconnect();
      await client2.disconnect();
    });

    it('should terminate session on disconnect', async () => {
      await client.initialize();
      const sessionId = client.getStatus().sessionId;

      // Verify session exists in manager
      expect(sessionManager.getSession(sessionId!)).toBeTruthy();

      // Disconnect
      await client.disconnect();

      // Verify session removed
      expect(sessionManager.getSession(sessionId!)).toBeUndefined();
      expect(client.getStatus().isConnected).toBe(false);
    });

    it('should not error when disconnecting already disconnected client', async () => {
      // Never initialized - should not throw
      await expect(client.disconnect()).resolves.not.toThrow();

      // Initialize then disconnect twice
      await client.initialize();
      await client.disconnect();
      await expect(client.disconnect()).resolves.not.toThrow();
    });

    it('should auto-initialize on first tool call', async () => {
      // Don't call initialize explicitly
      expect(client.getStatus().isConnected).toBe(false);

      // Make a tool call - should auto-initialize
      await client.getInformationSchema();

      expect(client.getStatus().isConnected).toBe(true);
      expect(client.getStatus().sessionId).toBeTruthy();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should execute get_information_schema tool', async () => {
      const result = await client.getInformationSchema();

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      // Schema should have tables and columns info
      expect(result.result).toHaveProperty('schema');
    });

    it('should validate valid SQL query', async () => {
      const result = await client.validateSQLQuery(
        'SELECT name, state FROM county_data LIMIT 10'
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('valid', true);
      expect(result.result).toHaveProperty('sanitizedSQL');
    });

    it('should reject invalid SQL - DROP statement', async () => {
      const result = await client.validateSQLQuery('DROP TABLE county_data');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid SQL - DELETE statement', async () => {
      const result = await client.validateSQLQuery(
        'DELETE FROM county_data WHERE 1=1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid SQL - INSERT statement', async () => {
      const result = await client.validateSQLQuery(
        "INSERT INTO county_data (name) VALUES ('test')"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should execute valid query', async () => {
      const result = await client.executeQuery(
        'SELECT COUNT(*) as county_count FROM county_data'
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('data');
      expect(Array.isArray(result.result.data)).toBe(true);
    });

    it('should execute query with WHERE clause', async () => {
      const result = await client.executeQuery(
        "SELECT county_name, state_name FROM county_data WHERE state_name = 'Florida' LIMIT 5"
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('data');
      expect(Array.isArray(result.result.data)).toBe(true);
      // All results should be from Florida
      if (result.result.data.length > 0) {
        result.result.data.forEach((row: any) => {
          expect(row.state_name).toBe('Florida');
        });
      }
    });

    it('should reject execute for invalid SQL', async () => {
      const result = await client.executeQuery('DROP TABLE county_data');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid session ID on tool call', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Mcp-Session-Id': 'invalid-session-id-12345',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_information_schema', arguments: {} },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('session');
    });

    it('should return 404 for DELETE with unknown session', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { 'Mcp-Session-Id': 'unknown-session-id' },
      });

      expect(response.status).toBe(404);
    });

    it('should return 400 for DELETE without session ID', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
    });

    it('should return error for non-initialize POST without session', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_information_schema', arguments: {} },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('session');
    });

    it('should return 400 for GET without session ID', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('JSON-RPC Protocol', () => {
    it('should return valid JSON-RPC response for initialize', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 42,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            clientInfo: { name: 'test-client', version: '1.0.0' },
            capabilities: {},
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Mcp-Session-Id')).toBeTruthy();

      // Response is SSE format: "event: message\ndata: {...}\n\n"
      const text = await response.text();
      const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
      expect(dataLine).toBeTruthy();

      const data = JSON.parse(dataLine!.substring(6));
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(42);
      expect(data.result).toBeDefined();
    });

    it('should return session ID in header on initialize', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            clientInfo: { name: 'test-client', version: '1.0.0' },
            capabilities: {},
          },
        }),
      });

      const sessionId = response.headers.get('Mcp-Session-Id');
      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
      // UUID format check
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });
});

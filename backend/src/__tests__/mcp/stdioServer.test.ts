/**
 * End-to-end tests for the stdio MCP transport.
 *
 * These spawn src/mcp/stdioServer.ts as a real MCP client would and talk to it
 * over stdin/stdout. That is deliberate: the failure this guards against is
 * stray stdout logging corrupting the JSON-RPC stream, which only a real
 * handshake can catch. An in-process transport would pass while the shipped
 * binary is unusable.
 *
 * No census data is required — each run builds its own small DuckDB fixture,
 * so this runs in CI where data/ is gitignored.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DuckDBInstance } from '@duckdb/node-api';
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const BACKEND_DIR = path.resolve(__dirname, '../../..');
const ENTRY_POINT = path.join(BACKEND_DIR, 'src', 'mcp', 'stdioServer.ts');
const TS_NODE = path.join(BACKEND_DIR, 'node_modules', '.bin', 'ts-node');

// ts-node compiles the whole import graph on every spawn; well past the 30s default.
const SPAWN_TIMEOUT_MS = 180_000;

let tmpDir: string;
let fixturePath: string;
let auditDir: string;
let client: Client;

async function createFixture(dbPath: string): Promise<void> {
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();
  await connection.run(
    `CREATE OR REPLACE TABLE county_data (
       county_name VARCHAR, state_name VARCHAR,
       population BIGINT, median_income BIGINT, poverty_rate DOUBLE
     )`
  );
  await connection.run(
    `INSERT INTO county_data VALUES
       ('Hillsborough', 'Florida', 1478759, 68000, 12.5),
       ('Pinellas', 'Florida', 959107, 62000, 11.1),
       ('Pasco', 'Florida', 584602, 60000, 10.4)`
  );
  connection.disconnectSync();
  // Close the instance too: without it the rows stay in the WAL and the spawned
  // server opens a file that has the table but none of the data.
  instance.closeSync();
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content;
  return content?.[0]?.text ?? '';
}

describe('MCP stdio transport', () => {
  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'censuschat-mcp-'));
    fixturePath = path.join(tmpDir, 'fixture.duckdb');
    auditDir = path.join(tmpDir, 'logs');
    await createFixture(fixturePath);

    client = new Client({ name: 'stdio-server-test', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: TS_NODE,
        args: [ENTRY_POINT],
        cwd: BACKEND_DIR,
        env: {
          ...process.env,
          DUCKDB_PATH: fixturePath,
          AUDIT_LOG_DIR: auditDir,
        } as Record<string, string>,
      })
    );
  }, SPAWN_TIMEOUT_MS);

  afterAll(async () => {
    await client?.close().catch(() => undefined);
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('completes the MCP handshake and exposes the census tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining(['get_information_schema', 'validate_sql_query', 'execute_query'])
    );
  });

  it('returns real rows for a SELECT through execute_query', async () => {
    const result = await client.callTool({
      name: 'execute_query',
      arguments: { query: 'SELECT county_name, population FROM county_data ORDER BY population DESC' },
    });

    const payload = JSON.parse(textOf(result));
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(3);
    expect(payload.data[0].county_name).toBe('Hillsborough');
  });

  it('rejects a write statement through the same SQL validator as the HTTP transport', async () => {
    const result = await client.callTool({
      name: 'execute_query',
      arguments: { query: 'DELETE FROM county_data' },
    });

    const payload = JSON.parse(textOf(result));
    expect(payload.success).toBe(false);
    expect(payload.validationErrors[0].type).toBe('BLOCKED_PATTERN');

    // The rejection must be a rejection, not a silent no-op.
    const after = await client.callTool({
      name: 'execute_query',
      arguments: { query: 'SELECT county_name FROM county_data' },
    });
    expect(JSON.parse(textOf(after)).data).toHaveLength(3);
  });

  it('rejects an injecting drill-down cursor without running a query', async () => {
    // The cursor is interpolated straight into SQL that never reaches the SQL
    // validator, so this guard is the only thing standing between a caller and
    // arbitrary SQL. Without it the tool would run and return rows.
    const result = await client.callTool({
      name: 'execute_drill_down_query',
      arguments: { countyFips: '12057', cursor: "120570001001' OR '1'='1" },
    });

    expect((result as { isError?: boolean }).isError).toBe(true);
    const payload = JSON.parse(textOf(result));
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/cursor/i);
    expect(payload.data).toBeUndefined();
  });

  it('accepts a well-formed drill-down cursor', async () => {
    // Guards the guard: a real 12-digit geoid must still get through, so the
    // rejection above is the pattern check and not a blanket failure.
    const result = await client.callTool({
      name: 'execute_drill_down_query',
      arguments: { countyFips: '12057', cursor: '120570001001' },
    });

    const payload = JSON.parse(textOf(result));
    // The fixture has no block_group_data_expanded table, so the query fails at
    // execution — past the cursor guard, which is what this asserts.
    expect(payload.error ?? '').not.toMatch(/cursor/i);
  });

  it('writes every query to the audit log', async () => {
    await client.callTool({
      name: 'execute_query',
      arguments: { query: 'SELECT county_name FROM county_data' },
    });
    await client.callTool({
      name: 'execute_query',
      arguments: { query: 'DROP TABLE county_data' },
    });

    const entries = readFileSync(path.join(auditDir, 'sql-audit.log'), 'utf-8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    expect(entries.some((e) => e.success === true && e.rowCount === 3)).toBe(true);
    expect(entries.some((e) => e.success === false && e.validationPassed === false)).toBe(true);
  });

  it(
    'writes only JSON-RPC frames to stdout',
    async () => {
      // The entry point's whole reason to exist is that the DuckDB pool, the MCP
      // server, and the SQL validator all log with console.log, and on stdio
      // stdout is the protocol channel. Drive a real query and read stdout raw:
      // this is the assertion that fails if the stderr redirect is removed.
      const child = spawn(TS_NODE, [ENTRY_POINT], {
        cwd: BACKEND_DIR,
        env: { ...process.env, DUCKDB_PATH: fixturePath },
      });

      let stdout = '';
      child.stdout.on('data', (chunk) => (stdout += String(chunk)));

      const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + '\n');

      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw-stdout-test', version: '1.0.0' },
        },
      });
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'execute_query',
          arguments: { query: 'SELECT county_name FROM county_data' },
        },
      });

      // Wait for the tools/call response, which is the last stdout write.
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error(`no response; stdout=${stdout}`)), 60_000);
        const check = () => {
          if (!stdout.includes('"id":2')) return;
          clearTimeout(deadline);
          resolve();
        };
        child.stdout.on('data', check);
        check();
      });
      child.kill();

      const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
        expect(JSON.parse(line).jsonrpc).toBe('2.0');
      }
    },
    SPAWN_TIMEOUT_MS
  );

  it(
    'exits non-zero when the census database is missing',
    async () => {
      const missing = path.join(tmpDir, 'does-not-exist.duckdb');
      const child = spawn(TS_NODE, [ENTRY_POINT], {
        cwd: BACKEND_DIR,
        env: { ...process.env, DUCKDB_PATH: missing },
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => (stderr += String(chunk)));

      const code = await new Promise<number | null>((resolve) => child.on('close', resolve));

      expect(code).toBe(1);
      expect(stderr).toContain(missing);
    },
    SPAWN_TIMEOUT_MS
  );
});

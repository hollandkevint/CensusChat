/**
 * Manual end-to-end check of the stdio MCP server.
 *
 * Spawns src/mcp/stdioServer.ts as a real MCP client would, lists the tools,
 * runs a real SELECT, and confirms a write statement is rejected by the SQL
 * validator. Prints a transcript.
 *
 * Usage:
 *   DUCKDB_PATH=/abs/path/to/census.duckdb npx ts-node scripts/verify-mcp-stdio.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

// Filter in the WHERE clause, not with LIMIT: the validator replaces a user
// LIMIT with the 1,000-row policy maximum rather than capping it.
const SELECT_QUERY =
  'SELECT county_name, state_name, population, median_income ' +
  "FROM county_data WHERE state_name = 'Florida' AND population > 900000 " +
  'ORDER BY population DESC';
const WRITE_QUERY = 'DELETE FROM county_data';

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content;
  return content?.[0]?.text ?? '';
}

async function run(): Promise<void> {
  const backendDir = path.resolve(__dirname, '..');
  const dbPath = process.env.DUCKDB_PATH || path.join(backendDir, 'data', 'census.duckdb');

  const transport = new StdioClientTransport({
    command: path.join(backendDir, 'node_modules', '.bin', 'ts-node'),
    args: [path.join(backendDir, 'src', 'mcp', 'stdioServer.ts')],
    cwd: backendDir,
    env: { ...process.env, DUCKDB_PATH: dbPath } as Record<string, string>,
  });

  const client = new Client({ name: 'verify-mcp-stdio', version: '1.0.0' });
  await client.connect(transport);

  console.log(`DUCKDB_PATH=${dbPath}\n`);

  const { tools } = await client.listTools();
  console.log(`tools/list -> ${tools.length} tools`);
  for (const tool of tools) console.log(`  - ${tool.name}`);

  console.log(`\nexecute_query -> ${SELECT_QUERY}`);
  console.log(textOf(await client.callTool({ name: 'execute_query', arguments: { query: SELECT_QUERY } })));

  console.log(`\nexecute_query -> ${WRITE_QUERY}   (must be rejected)`);
  console.log(textOf(await client.callTool({ name: 'execute_query', arguments: { query: WRITE_QUERY } })));

  await client.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

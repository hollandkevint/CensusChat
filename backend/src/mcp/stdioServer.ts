#!/usr/bin/env node
/**
 * MCP Server Entry Point — stdio transport
 *
 * Runs the same MCP server the HTTP transport serves, over stdin/stdout, so a
 * desktop MCP client (Claude Desktop) can talk to it without the Express app,
 * Docker, Postgres, or Redis.
 *
 * Every tool, SQL validation control, and audit behavior comes from
 * createMcpServer() unchanged. This file adds only transport and preflight.
 *
 * Usage:
 *   npm run mcp:stdio                     # from source
 *   node dist/mcp/stdioServer.js          # after npm run build
 *
 * See docs/guides/MCP_STDIO_SETUP.md
 */

// MUST stay first: redirects stdout logging to stderr before any module that
// logs at import time is loaded. See stdioLogRedirect.ts.
import './stdioLogRedirect';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'fs';
import path from 'path';
import { createMcpServer } from './mcpServer';
import { closeDuckDBPool } from '../utils/duckdbPool';

/** Same resolution order as DuckDBPool, so the preflight checks the real file. */
export function resolveDbPath(): string {
  return process.env.DUCKDB_PATH || path.join(process.cwd(), 'data', 'census.duckdb');
}

/**
 * DuckDB creates a database file when it is missing, so a wrong DUCKDB_PATH
 * would otherwise produce a server whose every query fails with "table not
 * found". Fail loudly at startup instead.
 */
function preflight(dbPath: string): void {
  if (existsSync(dbPath)) return;

  process.stderr.write(
    [
      `[censuschat-mcp] Census database not found: ${dbPath}`,
      '',
      'Set DUCKDB_PATH to an existing census.duckdb, or build one:',
      '  cd backend && npm run load-blockgroups-expanded',
      '',
      'See docs/guides/MCP_STDIO_SETUP.md',
      '',
    ].join('\n')
  );
  process.exit(1);
}

export async function main(): Promise<void> {
  preflight(resolveDbPath());

  const server = createMcpServer('stdio');
  await server.connect(new StdioServerTransport());

  console.error('[censuschat-mcp] Ready on stdio');

  const shutdown = async () => {
    await closeDuckDBPool().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[censuschat-mcp] Fatal: ${String(error)}\n`);
    process.exit(1);
  });
}

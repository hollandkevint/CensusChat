/**
 * Side-effecting module: sends informational console output to stderr.
 *
 * On the stdio MCP transport, stdout IS the JSON-RPC channel. The DuckDB pool,
 * the MCP server, and the SQL validator all log with console.log, and
 * src/validation/sqlSecurityPolicies.ts logs at module scope — so this must run
 * before those modules are imported, which is why it lives in its own file and
 * is the first import in stdioServer.ts.
 *
 * A single stray stdout line corrupts the stream and the client drops the
 * connection. Covered by the "writes only JSON-RPC frames to stdout" test.
 */

console.log = console.error;
console.info = console.error;
console.debug = console.error;
console.warn = console.error;

export {};

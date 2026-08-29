---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
title: Standalone MCP distribution for Claude Desktop
date: 2026-08-29
---

# Standalone MCP distribution for Claude Desktop

## Goal Capsule

**Objective:** A healthcare analyst can query US Census demographics from Claude
Desktop, with no web app, no Docker stack, and no browser.

**Means:** Add a stdio transport entry point that reuses the existing
`createMcpServer()` tool registry, and document the Claude Desktop config block
(KTD1, KTD2).

**Authority hierarchy:** settled decisions in this plan > repo conventions in
`CLAUDE.md` > implementer judgment.

**Stop conditions:**
- Stop if the stdio path would need its own SQL execution route that bypasses
  `backend/src/validation/`.
- Stop if making stdio work requires changing the HTTP transport contract in
  `backend/src/mcp/mcpRoutes.ts` or `backend/src/routes/mcp.routes.ts`.

**Execution profile:** small, single-component. Five files, one new module.

**Tail ownership:** LFG owns commit, PR, and CI.

## Product Contract

### Summary

Add `backend/src/mcp/stdioServer.ts`. It creates the existing MCP server and
connects it to a stdio transport. Expose it as an npm `bin` and an npm script.
Ship a setup guide with a copy-pasteable Claude Desktop config block, honest
prerequisites, and the failure behavior when the DuckDB file is absent.

### Problem Frame

The MCP server exists but only speaks Streamable HTTP. Reaching it means running
the Express app, which means Docker, Postgres, and Redis. Claude Desktop's
primary local integration path is stdio. An analyst who wants census data today
must operate a web stack they do not need.

### Key Decisions

- **Reuse `createMcpServer()` unchanged.** Every tool, security control, and UI
  resource comes along for free. Governs R1, R3.
  `session-settled: user-directed` — rejected: a slimmer stdio-only tool set;
  reason: divergence between transports is a security and support liability.
- **Repo-local distribution, not npm publish.** Governs R4.
  Rejected: publishing `censuschat-mcp` to the npm registry; reason: the server
  is useless without a 170 MB local DuckDB file the user builds themselves, so
  a registry install would not shorten setup.
- **No authentication.** Governs R6.
  `session-settled: user-directed` — rejected: gating MCP behind auth; reason:
  `backend/src/routes/auth.routes.ts` is stubs and out of scope.

### Requirements

- **R1** — Running the stdio entry point starts an MCP server exposing the same
  tools `createMcpServer()` registers today.
- **R2** — The entry point writes no non-protocol bytes to stdout; all logging
  goes to stderr.
- **R3** — `execute_query` on the stdio transport runs through
  `getSQLValidator()` before touching DuckDB, exactly as the HTTP transport does.
- **R4** — `npm run mcp:stdio` (source) and the `censuschat-mcp` bin (built)
  both start the server.
- **R5** — When the DuckDB file named by `DUCKDB_PATH` does not exist, the
  entry point exits non-zero with a message naming the missing path and the
  data-loading command, instead of silently serving an empty database.
- **R6** — The stdio path requires no account, token, or `ANTHROPIC_API_KEY`.
- **R7** — A setup guide documents the Claude Desktop config block, the
  prerequisites, the tool list, and the missing-data-file behavior.
- **R8** — `README.md` links the guide from its MCP section.
- **R9** — The existing HTTP transport, its routes, and its tests keep working
  unchanged.

### Scope Boundaries

In scope: stdio entry point, packaging hooks, docs, tests, one manual
verification script.

Out of scope: authentication, billing, npm publish, remote/SSE hosting,
changes to the tool set, changes to `backend/src/utils/censusDataLoader.ts` or
`backend/src/services/censusApiService.ts` (open PR #54 edits those).

### Acceptance Examples

- **AE1** — Given a DuckDB file with `county_data`, when the client calls
  `execute_query` with `SELECT county_name, population_total FROM county_data
  LIMIT 5`, then the response contains `success: true` and five rows.
- **AE2** — Given the same server, when the client calls `execute_query` with
  `DELETE FROM county_data`, then the response is an error naming a validation
  failure and no rows are deleted.
- **AE3** — Given `DUCKDB_PATH` points at a nonexistent file, when the entry
  point starts, then the process exits non-zero and stderr names the path.

## Planning Contract

### Key Technical Decisions

- **KTD1 — Use `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.**
  The SDK is already a dependency. One `server.connect(transport)` call is the
  whole transport layer.
- **KTD2 — Redirect `console.log`/`info`/`debug` to stderr inside the entry
  point, before importing anything that logs.** `backend/src/utils/duckdbPool.ts`
  (21 calls), `backend/src/mcp/mcpServer.ts` (7), and
  `backend/src/validation/sqlValidator.ts` (7) all log to stdout. On stdio,
  stdout is the JSON-RPC channel. Unredirected, the first pool log corrupts the
  stream and Claude Desktop drops the connection. This is the single
  highest-risk detail in the change.
- **KTD3 — Preflight the DuckDB file with `fs.existsSync` before connecting.**
  DuckDB creates a database file when it is missing, so without this check a
  wrong `DUCKDB_PATH` yields a server whose every query fails with
  "table not found". R5 exists because of this.
- **KTD4 — Do not add a `files`/publish config to `backend/package.json`.**
  Adding `bin` alone is inert for consumers and sufficient for `npm link` and
  for the documented `node dist/mcp/stdioServer.js` invocation.

### Assumptions

- `@modelcontextprotocol/sdk` v1.25.3 exports `StdioServerTransport` at
  `@modelcontextprotocol/sdk/server/stdio.js`. Verify at implementation time;
  the SDK is not installed in this worktree.
- Claude Desktop's config file is `~/Library/Application Support/Claude/claude_desktop_config.json`
  on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

### Sequencing

U1 → U2 → U3 → U4. U3 (docs) needs U1's exact invocation. U4 (verification)
needs U1.

### Sources

- `backend/src/mcp/mcpServer.ts:398` — `createMcpServer(sessionId)` returns a
  fully-registered `McpServer`; nothing in it is HTTP-specific.
- `backend/src/utils/duckdbPool.ts:52-63` — `DUCKDB_PATH` resolution and the
  first stdout log.
- `.github/workflows/ci.yml` — backend job runs lint, typecheck, test, build.
  `npm test` runs before `npm run build`, so any test must run from TypeScript
  source.
- `.gitignore:70,73` — `data/` and `*.duckdb` are ignored; CI has no census
  database, so no CI test may depend on real census data.

## Implementation Units

### U1. stdio entry point

**Goal:** `backend/src/mcp/stdioServer.ts` starts the MCP server over stdio.

**Requirements:** R1, R2, R3, R5, R6.

**Files:** `backend/src/mcp/stdioServer.ts` (new).

**Approach:**
1. First statements in the module: reassign `console.log`, `console.info`,
   `console.debug`, and `console.warn` to `console.error` (KTD2). Do this before
   the imports that log, using a top-of-file side-effecting statement or a tiny
   local helper module imported first.
2. Resolve `dbPath` from `process.env.DUCKDB_PATH`, defaulting to the same
   `path.join(process.cwd(), 'data', 'census.duckdb')` the pool uses.
3. If `!existsSync(dbPath)`, write a stderr message naming the path and
   `npm run load-blockgroups-expanded`, then `process.exit(1)` (KTD3, R5).
4. `const server = createMcpServer('stdio')`.
5. `await server.connect(new StdioServerTransport())` (KTD1).
6. On `SIGINT`/`SIGTERM`, close the DuckDB pool and exit 0.
7. Guard the bootstrap behind `if (require.main === module)` and export a
   `main()` so tests can import without starting.

**Test scenarios:** AE1, AE2, AE3.

**Verification:** `npx ts-node src/mcp/stdioServer.ts` with a valid
`DUCKDB_PATH` stays alive and emits nothing on stdout until a request arrives.

### U2. Packaging hooks

**Goal:** documented, stable invocations for source and built use.

**Requirements:** R4.

**Files:** `backend/package.json`.

**Approach:** add `"mcp:stdio": "ts-node src/mcp/stdioServer.ts"` to `scripts`
and `"bin": { "censuschat-mcp": "dist/mcp/stdioServer.js" }`. Add no `files`
key (KTD4). Change no existing script.

**Test scenarios:** `npm run mcp:stdio` starts; `npm run build` then
`node dist/mcp/stdioServer.js` starts.

**Verification:** `npm run typecheck && npm run build` in `backend/`.

### U3. Setup guide and README link

**Goal:** an analyst can set this up from the docs alone.

**Requirements:** R7, R8.

**Files:** `docs/guides/MCP_STDIO_SETUP.md` (new), `README.md`.

**Approach:** the guide carries, in order: what this is and what it is not;
prerequisites (Node 20+, repo cloned, `npm ci` in `backend/`, a built
`census.duckdb`); the exact Claude Desktop config JSON with absolute-path
placeholders and both macOS and Windows config-file locations; the tool list;
a worked example query; and a troubleshooting section covering the missing-data
error, the "server disconnected" symptom, and the fact that no API key is
needed for this path. State plainly that `ANTHROPIC_API_KEY` and
`CENSUS_API_KEY` are web-app and data-loading concerns, not stdio-MCP ones.
Add one link from the README's MCP section (R8).

**Test scenarios:** none automated. Reviewer follows the guide.

**Verification:** the config block in the guide is byte-identical to the one
used in U4's verification run.

### U4. Verification

**Goal:** prove the whole path with a real client, and keep a regression test
that runs in CI without census data.

**Requirements:** R1, R2, R3, R5.

**Files:** `backend/src/__tests__/mcp/stdioServer.test.ts` (new),
`backend/scripts/verify-mcp-stdio.ts` (new).

**Approach:**
- The Jest test builds a temporary DuckDB fixture with a small `county_data`
  table using `@duckdb/node-api`, spawns the entry point through
  `StdioClientTransport` with `DUCKDB_PATH` pointed at the fixture, then asserts
  AE1 (rows return), AE2 (a `DELETE` is rejected by the validator), and AE3
  (a missing path exits non-zero). AE1 passing at all also proves R2, because a
  polluted stdout breaks the client handshake. Use `ts-node` as the spawn
  command so it runs before `npm run build` in CI.
- `scripts/verify-mcp-stdio.ts` is the manual end-to-end script: same client,
  pointed at the real `census.duckdb`, printing the tool list and real county
  rows. Its output is the PR-body transcript.

**Test scenarios:** AE1, AE2, AE3.

**Verification:** `npm test -- stdioServer` passes; the manual script prints
real rows from the real database.

## Verification Contract

From `backend/`:

- `npm run lint` — must pass.
- `npm run typecheck` — must pass.
- `npm test` — full suite, no new failures.
- `npm run build` — must pass; `dist/mcp/stdioServer.js` must exist.
- `DUCKDB_PATH=<real census.duckdb> npx ts-node scripts/verify-mcp-stdio.ts` —
  run manually; capture the transcript.

Gate: if the real `census.duckdb` is not reachable, the manual run is skipped
and the PR body says so explicitly. It does not claim success.

## Definition of Done

Global:
- All four Verification Contract commands pass.
- The manual end-to-end run is either captured in the PR body or its absence is
  stated there.
- The Claude Desktop config block appears verbatim in both the guide and the PR
  body.
- No file under `backend/src/validation/` is modified.
- `backend/src/utils/censusDataLoader.ts` and
  `backend/src/services/censusApiService.ts` are untouched.
- No experimental or dead-end code remains in the diff.

Per unit:
- U1 — entry point exists, exits non-zero on a missing database, keeps stdout
  clean.
- U2 — both invocations start the server; no existing script changed.
- U3 — guide exists and is linked from `README.md`.
- U4 — Jest test passes in CI without census data; manual script exists.

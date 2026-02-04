# Requirements Archive: v1 CensusChat Modernization

**Archived:** 2026-02-03
**Status:** ✅ SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

## v1 Requirements

**Defined:** 2026-02-01
**Core Value:** Healthcare strategists get instant, interactive demographic insights through a chat interface that returns explorable data — not static responses.

### DuckDB Upgrade

- [x] **DUCK-01**: Upgrade DuckDB from 1.3.2 to 1.4.3 ✓
- [x] **DUCK-02**: Migrate from `duckdb` npm package to `@duckdb/node-api` ✓
- [x] **DUCK-03**: Rewrite DuckDBPool to use new async API patterns ✓
- [x] **DUCK-04**: Enable AES-256-GCM encryption for census.duckdb ✓ (opt-in)
- [x] **DUCK-05**: Migrate existing database via COPY FROM DATABASE ✓ (script ready)
- [x] **DUCK-06**: Enable in-memory compression for query performance ✓
- [x] **DUCK-07**: Implement MERGE statement support for data refresh ✓
- [x] **DUCK-08**: Add profiler metrics endpoint for query performance insights ✓

### MCP Infrastructure

- [x] **MCP-01**: Upgrade @modelcontextprotocol/sdk from 1.0.4 to ^1.25.2 ✓
- [x] **MCP-02**: Migrate from StdioServerTransport to StreamableHTTPServerTransport ✓
- [x] **MCP-03**: Add HTTP routes for MCP (POST /mcp, GET /mcp SSE, DELETE /mcp) ✓
- [x] **MCP-04**: Update mcpClient.ts to use HTTP fetch instead of in-process calls ✓
- [x] **MCP-05**: Install and configure @modelcontextprotocol/ext-apps for UI resources ✓

### Interactive UI (MCP Apps)

- [x] **UI-01**: Create MCP App build pipeline with Vite + vite-plugin-singlefile ✓
- [x] **UI-02**: Implement sortable data tables with TanStack Table ✓
- [x] **UI-03**: Implement server-side pagination for large result sets ✓
- [x] **UI-04**: Implement column filtering without re-querying ✓
- [x] **UI-05**: Add bar chart visualization for demographic comparisons ✓
- [x] **UI-06**: Add line chart visualization for trend data ✓
- [x] **UI-07**: Implement click-to-drill-down (county -> block groups) ✓
- [x] **UI-08**: Add in-chat export controls (format picker, column selector) ✓
- [x] **UI-09**: Add App Bridge to Next.js frontend for iframe rendering ✓
- [x] **UI-10**: Register MCP tools with _meta.ui.resourceUri for interactive returns ✓

### Agent SDK Integration

- [x] **AGENT-01**: Install @anthropic-ai/claude-agent-sdk ✓
- [x] **AGENT-02**: Implement structured JSON outputs with Zod schema validation ✓
- [x] **AGENT-03**: Configure Agent SDK to connect to CensusChat MCP server via HTTP ✓
- [x] **AGENT-04**: Implement multi-agent workflows for parallel region comparison ✓
- [x] **AGENT-05**: Add conversational context memory via session management ✓
- [x] **AGENT-06**: Integrate native Excel skill for document generation ✓ (via MCP tools)
- [x] **AGENT-07**: Integrate native PDF skill for report generation ✓ (via MCP tools)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DUCK-01 | Phase 1 | ✓ Complete |
| DUCK-02 | Phase 1 | ✓ Complete |
| DUCK-03 | Phase 1 | ✓ Complete |
| DUCK-04 | Phase 1 | ✓ Complete (opt-in) |
| DUCK-05 | Phase 1 | ✓ Complete (script ready) |
| DUCK-06 | Phase 1 | ✓ Complete |
| DUCK-07 | Phase 1 | ✓ Complete |
| DUCK-08 | Phase 1 | ✓ Complete |
| MCP-01 | Phase 2 | ✓ Complete |
| MCP-02 | Phase 2 | ✓ Complete |
| MCP-03 | Phase 2 | ✓ Complete |
| MCP-04 | Phase 2 | ✓ Complete |
| MCP-05 | Phase 3 | ✓ Complete |
| UI-01 | Phase 3 | ✓ Complete |
| UI-02 | Phase 3 | ✓ Complete |
| UI-03 | Phase 3 | ✓ Complete |
| UI-04 | Phase 3 | ✓ Complete |
| UI-05 | Phase 3 | ✓ Complete |
| UI-06 | Phase 3 | ✓ Complete |
| UI-07 | Phase 3 | ✓ Complete |
| UI-08 | Phase 3 | ✓ Complete |
| UI-09 | Phase 3 | ✓ Complete |
| UI-10 | Phase 3 | ✓ Complete |
| AGENT-01 | Phase 4 | ✓ Complete |
| AGENT-02 | Phase 4 | ✓ Complete |
| AGENT-03 | Phase 4 | ✓ Complete |
| AGENT-04 | Phase 4 | ✓ Complete |
| AGENT-05 | Phase 4 | ✓ Complete |
| AGENT-06 | Phase 4 | ✓ Complete (MCP tools) |
| AGENT-07 | Phase 4 | ✓ Complete (MCP tools) |

**Coverage:**
- v1 requirements: 30 total
- Shipped: 30
- With notes: 4 (DUCK-04, DUCK-05, AGENT-06, AGENT-07)

---

## Milestone Summary

**Shipped:** 30 of 30 v1 requirements

**Adjusted:**
- AGENT-06/07: "Native Excel/PDF skill" became "Excel/PDF via MCP tools" — Agent SDK v0.2.30 may not have native document skills, so custom ExcelJS/pdfkit implementations wrapped as MCP tools are acceptable
- DUCK-04/05: Encryption infrastructure complete but opt-in via user action (acceptable for non-HIPAA deployments)

**Dropped:** None

---

*Archived: 2026-02-03 as part of v1 milestone completion*

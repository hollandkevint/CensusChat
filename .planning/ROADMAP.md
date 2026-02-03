# Roadmap: CensusChat Modernization

## Overview

This modernization transforms CensusChat from a static query interface into an interactive data exploration tool. The path follows strict dependency order: upgrade DuckDB for encryption and performance (Phase 1), migrate MCP to HTTP transport enabling external connections (Phase 2), layer interactive UI via MCP Apps framework (Phase 3), and add advanced agent capabilities for multi-query orchestration (Phase 4). Each phase delivers independent value while unlocking the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: DuckDB 1.4 Upgrade** - Migrate database layer to 1.4.x with encryption and new API
- [x] **Phase 2: MCP Transport Migration** - Upgrade SDK and switch to HTTP transport
- [x] **Phase 3: Interactive UI Layer** - Add MCP Apps for tables, charts, and drill-down
- [ ] **Phase 4: Agent SDK Integration** - Enable structured outputs and multi-agent workflows

## Phase Details

### Phase 1: DuckDB 1.4 Upgrade
**Goal**: Database layer supports encryption, compression, and MERGE operations with the new async API
**Depends on**: Nothing (first phase)
**Requirements**: DUCK-01, DUCK-02, DUCK-03, DUCK-04, DUCK-05, DUCK-06, DUCK-07, DUCK-08
**Success Criteria** (what must be TRUE):
  1. Application starts and runs queries against encrypted census.duckdb (AES-256-GCM)
  2. All existing tests pass with `@duckdb/node-api` replacing deprecated `duckdb` package
  3. Data refresh workflow uses MERGE statement instead of delete/insert pattern
  4. Query performance metrics appear in logs via profiler integration
  5. Row counts match between original and migrated encrypted database
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md - Package upgrade and DuckDBPool rewrite (Wave 1)
- [x] 01-02-PLAN.md - Encryption migration and MERGE implementation (Wave 2)
- [x] 01-03-PLAN.md - Profiler integration and performance validation (Wave 2)

### Phase 2: MCP Transport Migration
**Goal**: MCP server communicates over HTTP (Streamable HTTP transport) enabling external client connections
**Depends on**: Phase 1
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria** (what must be TRUE):
  1. MCP endpoints respond at POST /mcp, GET /mcp (SSE), DELETE /mcp
  2. mcpClient.ts successfully executes queries via HTTP fetch instead of in-process
  3. External MCP clients (Claude Desktop, Postman) can connect to the server
  4. Session management persists context across multiple requests
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md - SDK upgrade, session manager, and HTTP transport server (Wave 1)
- [x] 02-02-PLAN.md - HTTP client refactor and integration verification (Wave 2)

### Phase 3: Interactive UI Layer
**Goal**: Query results render as interactive components (sortable tables, charts, drill-down navigation) inside chat
**Depends on**: Phase 2
**Requirements**: MCP-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. Data tables sort by any column when user clicks column header
  2. User can filter table rows without re-running the query
  3. Bar and line charts render for demographic comparison queries
  4. Clicking a county in results shows block groups within that county (drill-down)
  5. Export controls in chat allow selecting format (CSV/Excel) and columns
**Plans**: 3 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md - MCP Apps infrastructure, build pipeline, and App Bridge (Wave 1)
- [x] 03-02-PLAN.md - Data table MCP App with sorting, filtering, and drill-down (Wave 2)
- [x] 03-03-PLAN.md - Chart MCP Apps (bar/line) and export controls (Wave 2)

### Phase 4: Agent SDK Integration
**Goal**: Claude responses use structured outputs with schema validation and support multi-query orchestration
**Depends on**: Phase 3
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07
**Success Criteria** (what must be TRUE):
  1. Query responses return validated JSON matching defined Zod schemas
  2. User can say "Compare Tampa Bay vs Phoenix" and get parallel results for both regions
  3. Conversational context persists ("Now filter to income > $75K" references prior query)
  4. Agent can generate Excel reports without custom ExcelJS code (native skill)
  5. Agent can generate PDF reports without custom pdfkit code (native skill)
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 04-01-PLAN.md - Agent SDK installation and Zod structured outputs (Wave 1)
- [ ] 04-02-PLAN.md - MCP integration and multi-region comparison subagents (Wave 2)
- [ ] 04-03-PLAN.md - Session memory and document generation MCP tools (Wave 2)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
(Decimal phases like 2.1 execute between 2 and 3)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. DuckDB 1.4 Upgrade | 3/3 | Complete | 2026-02-02 |
| 2. MCP Transport Migration | 2/2 | Complete | 2026-02-02 |
| 3. Interactive UI Layer | 3/3 | Complete | 2026-02-03 |
| 4. Agent SDK Integration | 0/3 | Planned | - |

---
*Roadmap created: 2026-02-02*
*Last updated: 2026-02-03 - Phase 4 planned*

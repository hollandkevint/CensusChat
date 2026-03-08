# Nao Frontend Integration Plan

## Overview

Replace CensusChat's Next.js 15 frontend with [Nao](https://github.com/getnao/nao) — an open-source analytics agent framework (Apache 2.0, YC-backed) that provides a production-grade chat UI with built-in data visualization, SQL transparency, and feedback loops.

**Why Nao?** CensusChat's current frontend is ~1,643 lines across 12 files with basic chat, tables, and export. Nao provides a mature analytics UI with streaming, Monaco SQL editor, Recharts visualization, TanStack Table, rich text (Tiptap), auth (better-auth), and agent feedback — all out of the box.

**Key architectural advantage:** CensusChat already has an MCP server (`POST /mcp` with JSON-RPC 2.0 + SSE). Nao is built to consume MCP servers natively. The integration is primarily configuration, not code.

---

## Architecture: Before & After

### Current Architecture

```
User → Next.js Frontend (port 3000)
         → POST /api/v1/queries → Express Backend (port 3001)
              → anthropicService.ts (Claude Sonnet 4)
              → MCP Client → MCP Server → SQL Validator → DuckDB
         → POST /api/v1/export/* → excelExportService.ts
         → GET /api/v1/mcp/resources → HTML apps (AppBridge iframe)
```

### Target Architecture

```
User → Nao Frontend (Vite + React 19, port 5005)
         → tRPC → Nao Backend (Fastify, port 5005)
              → Nao Agent (Claude Sonnet 4, via nao-core context)
              → MCP Client → CensusChat MCP Server (port 3001)
                   → SQL Validator → DuckDB
         → Custom tRPC routes for Census-specific features:
              → Export (Excel/CSV)
              → Data Refresh
              → Healthcare Analytics Tools
```

### What Gets Kept

| Component | Status | Reason |
|-----------|--------|--------|
| Express backend MCP server | **Keep** | Nao connects to it via MCP protocol |
| DuckDB census database | **Keep** | Core data layer, unchanged |
| SQL validation layer | **Keep** | Security enforcement stays server-side |
| Export service (Excel/CSV) | **Keep** | Expose as MCP tool or REST endpoint |
| Rate limiting middleware | **Keep** | Security layer stays |
| PostgreSQL (sessions) | **Keep** | Nao also uses PostgreSQL |
| Redis (caching) | **Keep** | Still used for backend caching |

### What Gets Replaced

| Component | Replaced By | Notes |
|-----------|-------------|-------|
| Next.js frontend | Nao frontend (Vite + React 19) | Full replacement |
| `anthropicService.ts` | Nao's LLM orchestration | Nao manages LLM calls |
| `POST /api/v1/queries` route | Nao's chat → MCP pipeline | NL→SQL handled by Nao agent |
| AppBridge.tsx (iframe MCP apps) | Nao's native data viz | Recharts + TanStack Table built in |
| ChatInterface.tsx | Nao's chat component | Streaming, markdown, code blocks |
| `next-auth` (unused) | `better-auth` (Nao built-in) | Actually functional auth |

### What Gets Removed

| Component | Reason |
|-----------|--------|
| `frontend/` directory | Replaced entirely by Nao |
| `backend/src/services/anthropicService.ts` | Nao handles LLM orchestration |
| `backend/src/mcp/mcpApps/` HTML files | Nao has native visualization |
| `POST /api/v1/queries` route handler | Nao's agent replaces this flow |

---

## Implementation Phases

### Phase 1: Nao Project Setup & DuckDB Connection

**Goal:** Get Nao running locally and connected to CensusChat's DuckDB.

**Steps:**

1. **Install nao-core CLI**
   ```bash
   pip install nao-core
   ```

2. **Initialize Nao project in repo root**
   ```bash
   cd /home/user/CensusChat
   nao init
   # Project name: CensusChat
   # Database: DuckDB → path: ./backend/data/census.duckdb
   # LLM: Anthropic → key: ${ANTHROPIC_API_KEY}
   # Skip: Slack, Notion, Git repos
   ```

3. **Configure `nao_config.yaml`**
   ```yaml
   name: CensusChat
   description: Natural language interface for US Census healthcare demographics

   database:
     type: duckdb
     path: ./backend/data/census.duckdb

   llm:
     provider: anthropic
     model: claude-sonnet-4-20250514
     api_key: ${ANTHROPIC_API_KEY}

   mcp:
     servers:
       - name: censuschat-mcp
         url: http://localhost:3001/mcp
         description: Census data query execution with SQL validation
   ```

4. **Write `RULES.md` for Nao's agent context** (maps from existing `sqlSecurityPolicies.ts`)
   ```markdown
   # CensusChat Query Rules

   ## SQL Constraints
   - Only SELECT statements are allowed
   - Maximum 1,000 rows per query
   - No comments (-- or /* */) in SQL
   - No multi-statement queries

   ## Allowed Tables
   - county_data (3,144 US counties)
   - block_group_data (239,741 block groups, 28 columns)
   - block_group_data_expanded (239,741 block groups, 84 columns)

   ## Data Context
   - All data is from the US Census Bureau American Community Survey
   - Medicare eligible = age 65 and over
   - Geography hierarchy: State → County → Block Group
   - GEOID format: State(2) + County(3) + Tract(6) + Block Group(1)
   ```

5. **Sync and validate**
   ```bash
   nao sync
   nao debug
   nao chat  # Verify UI launches at localhost:5005
   ```

**Deliverables:** Nao running locally, querying DuckDB census data through its chat UI.

**Risk:** DuckDB support in nao-core. The CLI supports DuckDB as a database option, but if the connector has issues, we may need to route all queries through the MCP server instead of direct DuckDB access.

---

### Phase 2: MCP Server Integration

**Goal:** Connect Nao to CensusChat's existing MCP server for validated query execution.

**Steps:**

1. **Register CensusChat MCP server in Nao config**

   The MCP server at `POST /mcp` exposes these tools:
   - `get_information_schema` — Database schema + security policies
   - `validate_sql_query` — SQL validation without execution
   - `execute_query` — Validated SQL execution against DuckDB
   - `execute_drill_down_query` — Block group pagination within county
   - `execute_comparison_query` — Multi-region comparison with bar chart
   - `execute_trend_query` — Trend analysis with line chart

   Nao's MCP integration in `nao_config.yaml`:
   ```yaml
   mcp:
     servers:
       - name: censuschat
         transport: http
         url: http://localhost:3001/mcp
         tools:
           - get_information_schema
           - validate_sql_query
           - execute_query
           - execute_drill_down_query
           - execute_comparison_query
           - execute_trend_query
   ```

2. **Add context metadata for MCP tools**

   Create `context/tools.md` describing each tool's purpose so Nao's agent knows when to use which:
   ```markdown
   ## Available MCP Tools

   ### execute_query
   Use for all standard census data queries. Input: SQL string.
   Always validate with validate_sql_query first.

   ### execute_drill_down_query
   Use when a user wants to see block-group-level detail within a county.
   Input: countyFips (string), optional cursor for pagination.

   ### execute_comparison_query
   Use when comparing metrics across multiple regions.
   Input: SQL string that returns region-labeled rows.

   ### execute_trend_query
   Use for time-series or trend analysis queries.
   ```

3. **Ensure MCP session management works with Nao**

   CensusChat's MCP server uses `Mcp-Session-Id` headers. Nao's MCP client should handle session lifecycle:
   - `POST /mcp` with `initialize` request → receives session ID
   - Subsequent requests include `Mcp-Session-Id` header
   - `DELETE /mcp` to terminate session

   If Nao doesn't handle this automatically, we'll need a thin adapter in the CensusChat backend that accepts sessionless MCP requests.

4. **Update CORS on CensusChat backend**

   Currently `CORS_ORIGIN=http://localhost:3000` (Next.js). Update to:
   ```env
   CORS_ORIGIN=http://localhost:5005
   ```

**Deliverables:** Nao's chat executing census queries through CensusChat's MCP server with full SQL validation.

---

### Phase 3: Census-Specific Features

**Goal:** Restore CensusChat-specific features that Nao doesn't provide out of the box.

#### 3A: Export Functionality

The existing export service (`backend/src/services/excelExportService.ts`) supports:
- Excel (.xlsx) with metadata sheets, formatting, auto-column-width
- CSV as fallback
- Progress tracking for large datasets
- Streaming for >10K rows

**Approach:** Expose export as an MCP tool so Nao's agent can offer "Export to Excel" after showing results.

```typescript
// New MCP tool in mcpServer.ts
server.tool(
  'export_to_excel',
  'Export query results to Excel format',
  {
    queryResult: z.object({
      data: z.array(z.record(z.any())),
      metadata: z.record(z.any())
    }),
    queryText: z.string()
  },
  async ({ queryResult, queryText }) => {
    const result = await excelExportService.exportToExcel(queryResult, queryText);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          downloadUrl: `/api/v1/export/download/${result.exportId}`,
          filename: result.filename
        })
      }]
    };
  }
);
```

The download URL will still be served by the Express backend. Nao's chat can render a download link.

#### 3B: Data Refresh

Expose data refresh status and triggering as MCP tools:

```typescript
server.tool('check_data_freshness', ...);  // GET /api/data/refresh/status
server.tool('refresh_census_data', ...);   // POST /api/data/refresh
```

#### 3C: Healthcare Analytics Tools

The existing MCP healthcare tools (Medicare eligibility, population health, facility adequacy) are already registered on the MCP server. They'll be available to Nao's agent automatically once the MCP connection is established.

#### 3D: Drill-Down UX

Nao's chat renders data tables via TanStack Table. We need to make county rows clickable for drill-down:

**Option A (Preferred):** The Nao agent detects county-level results and proactively suggests "Click any county to see block group details" — the user types the follow-up and the agent calls `execute_drill_down_query`.

**Option B:** Custom Nao frontend component that intercepts table row clicks and auto-sends a drill-down query. This requires forking Nao's frontend.

---

### Phase 4: Frontend Customization & Branding

**Goal:** CensusChat branding and UX polish on Nao's frontend.

1. **Branding**
   - App title: "CensusChat"
   - Subtitle: "Natural Language Healthcare Demographics & Analytics"
   - Logo/favicon
   - Color scheme: Healthcare blues/greens (via Tailwind CSS theme)

2. **Welcome message / system prompt**
   Configure in `RULES.md` or Nao's system prompt:
   ```
   You are CensusChat, a healthcare demographics assistant.
   You help users query US Census data for healthcare strategy.
   Always cite the data source (US Census Bureau ACS).
   When showing demographic data, include confidence levels and margins of error.
   ```

3. **Example queries** (onboarding)
   - "Show me Medicare eligible seniors in Tampa Bay with household income over $75K"
   - "Compare poverty rates across Florida counties"
   - "Which block groups in Miami-Dade have the highest uninsured rate?"

4. **Feedback loop**
   Nao has built-in thumbs up/down. Configure to log feedback to CensusChat's PostgreSQL for query improvement tracking.

---

### Phase 5: Docker Compose & Deployment

**Goal:** Single `docker-compose up` brings up the full stack.

```yaml
# docker-compose.yml (updated)
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    # Shared by both CensusChat backend and Nao

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  censuschat-backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      - DUCKDB_PATH=/app/data/census.duckdb
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
    depends_on: [postgres, redis]
    # Serves: MCP server, export endpoints, data refresh

  nao:
    image: getnao/nao:latest
    ports: ["5005:5005"]
    volumes:
      - ./nao-project:/app/project  # Nao config, context, rules
      - ./backend/data:/app/data:ro # Read-only DuckDB access
    environment:
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NAO_DEFAULT_PROJECT_PATH=/app/project
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    depends_on: [postgres, censuschat-backend]
```

**Key decisions:**
- Nao gets read-only access to DuckDB (query execution goes through MCP server for validation)
- PostgreSQL is shared (Nao uses it for auth/sessions, CensusChat for its own data)
- CensusChat backend runs purely as an MCP server + export/refresh service
- Redis continues serving the backend's rate limiting and caching

---

### Phase 6: Cleanup & Migration

**Goal:** Remove replaced code, update documentation.

1. **Archive** `frontend/` directory (git rm, but preserve in git history)
2. **Remove** unused backend code:
   - `backend/src/services/anthropicService.ts` (Nao handles LLM)
   - `POST /api/v1/queries` route (Nao handles NL→SQL)
   - `backend/src/mcp/mcpApps/` HTML files (Nao has native viz)
3. **Keep** as standalone services:
   - `POST /api/v1/export/*` routes (still needed for file downloads)
   - `POST /api/data/refresh/*` routes (still needed for data management)
   - `/health` routes (monitoring)
4. **Update** `demo-setup.sh` to launch Nao instead of Next.js
5. **Update** `CLAUDE.md` and `README.md` with new architecture
6. **Update** `.env.example` with Nao-specific variables

---

## File Structure: After Integration

```
CensusChat/
├── nao-project/                 # NEW: Nao analytics agent config
│   ├── nao_config.yaml          # Database, LLM, MCP configuration
│   ├── RULES.md                 # SQL security rules + query guidelines
│   ├── context/                 # Census data context for the agent
│   │   ├── schema.md            # Table/column descriptions
│   │   ├── tools.md             # MCP tool descriptions
│   │   ├── healthcare.md        # Healthcare analytics patterns
│   │   └── geography.md         # Census geography hierarchy
│   └── tests/                   # Agent test cases
│       └── census_queries.yaml  # Expected SQL for common queries
├── backend/                     # Slimmed Express server (MCP + Export + Refresh)
│   ├── src/
│   │   ├── mcp/                 # MCP server (unchanged)
│   │   ├── validation/          # SQL validation (unchanged)
│   │   ├── routes/
│   │   │   ├── export.routes.ts # Kept
│   │   │   ├── dataRefresh.routes.ts # Kept
│   │   │   ├── health.routes.ts # Kept
│   │   │   └── mcp.routes.ts    # Kept (healthcare analytics)
│   │   ├── services/
│   │   │   ├── excelExportService.ts # Kept
│   │   │   └── dataRefreshService.ts # Kept
│   │   └── utils/               # DuckDB pool, circuit breaker
│   └── data/
│       └── census.duckdb        # Census data (unchanged)
├── frontend/                    # REMOVED (archived in git history)
├── docker-compose.yml           # Updated with Nao service
└── docs/
    └── NAO_FRONTEND_INTEGRATION_PLAN.md  # This document
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Nao DuckDB connector issues | Medium | High | Route all queries through MCP server (validated path) |
| Nao MCP session handling | Low | Medium | Add sessionless adapter if needed |
| Breaking changes in Nao (v0.0.54) | High | Medium | Pin version, fork if necessary |
| Export UX regression | Medium | Medium | Keep Express export routes, link from Nao chat |
| AppBridge iframe features lost | Low | Low | Nao's native viz is better |
| Auth model mismatch | Low | Low | Nao's better-auth is more complete than unused next-auth |
| Performance regression | Low | Medium | Nao adds Fastify layer; benchmark before/after |

---

## Success Criteria

1. `nao chat` launches and connects to CensusChat's MCP server
2. Natural language census queries return validated results with visualization
3. Export to Excel/CSV works from Nao's chat interface
4. Data refresh can be triggered from the UI
5. Healthcare analytics tools (Medicare, population health) are accessible
6. `docker-compose up` brings up the full stack
7. Query response time stays under 2 seconds (existing SLA)

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Nao Setup + DuckDB | 2-4 hours | nao-core install, DuckDB connector |
| Phase 2: MCP Integration | 4-8 hours | MCP session compatibility |
| Phase 3: Census Features | 8-16 hours | Export MCP tool, drill-down UX |
| Phase 4: Branding | 2-4 hours | Tailwind theme, system prompt |
| Phase 5: Docker | 2-4 hours | Docker Compose config |
| Phase 6: Cleanup | 2-4 hours | Code removal, docs |
| **Total** | **20-40 hours** | |

---

## Next Steps

1. Install `nao-core` and run `nao init` with CensusChat's DuckDB
2. Validate that Nao can query census tables directly
3. Connect Nao to the existing MCP server endpoint
4. Add export as an MCP tool
5. Configure branding and system prompt
6. Update Docker Compose
7. Archive Next.js frontend

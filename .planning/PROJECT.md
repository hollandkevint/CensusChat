# CensusChat

## What This Is

A natural language interface for US Census data, designed for healthcare strategy teams. Transforms complex demographic queries into validated SQL using Claude Sonnet and the Model Context Protocol (MCP). Now with interactive data exploration, parallel comparison queries, and conversational follow-up.

## Core Value

Healthcare strategists get instant, interactive demographic insights through a chat interface that returns explorable data — not static responses.

## Current State (v1 Shipped)

**Architecture:**
- Three-tier: Next.js 15 frontend → Express 5 API → MCP HTTP → DuckDB 1.4
- MCP SDK 1.25.3 with StreamableHTTPServerTransport
- DuckDB 1.4.3 with @duckdb/node-api (encryption-ready, MERGE, profiler)
- Claude Agent SDK 0.2.30 for structured outputs and parallel execution

**Codebase:**
- 102 files, ~600K lines TypeScript
- MCP Apps: data-table, bar-chart, line-chart (Vite + vite-plugin-singlefile)
- 80%+ test coverage target (Jest 30 + Supertest)

## Requirements

### Validated

- ✓ Natural language query → SQL translation via Claude Sonnet — existing
- ✓ MCP-secured query execution against DuckDB — existing
- ✓ SQL validation with allowlists and row limits — existing
- ✓ Excel/CSV export functionality — existing
- ✓ Redis caching for repeated queries — existing
- ✓ Healthcare analytics patterns (Medicare, population health) — existing
- ✓ Block group and county level data (239K+ records) — existing
- ✓ React chat interface with Next.js 15 — existing
- ✓ DuckDB 1.4 with new async API — v1
- ✓ AES-256-GCM encryption support (opt-in) — v1
- ✓ MERGE statement for data refresh — v1
- ✓ Profiler metrics endpoint — v1
- ✓ MCP HTTP transport with session management — v1
- ✓ Interactive data tables (TanStack Table) — v1
- ✓ Bar and line chart visualizations (Recharts) — v1
- ✓ Drill-down navigation (county → block groups) — v1
- ✓ In-chat export controls — v1
- ✓ Zod schema validation on query responses — v1
- ✓ Parallel region comparison queries — v1
- ✓ Conversational context memory — v1
- ✓ Document generation MCP tools (Excel/PDF) — v1

### Active

(None — define in next milestone)

### Out of Scope

- Mobile app — web-first, defer to future milestone
- Real-time collaboration — single-user focus
- OAuth/SSO integration — existing JWT auth sufficient
- Video/audio inputs — text queries only
- Third-party data source integrations — Census data focus
- Custom SQL editor — defeats NL purpose, security risk
- Infinite scroll for large datasets — use pagination
- Full dashboard customization — predefined chart types sufficient

## Constraints

- **Tech stack**: TypeScript/Node.js backend, Next.js frontend
- **Data**: Census data stays in DuckDB (no warehouse migration)
- **Compatibility**: Existing API endpoints must remain functional
- **Security**: HIPAA-ready patterns (encryption at rest, audit logging)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full adoption of DuckDB 1.4, MCP Apps, Agent SDK | User requested comprehensive modernization | ✓ Delivered v1 |
| Interactive UI via MCP Apps iframe | Direct in-chat data exploration | ✓ Good |
| DuckDB encryption opt-in | Infrastructure ready, user enables when needed | ✓ Good |
| Custom document tools via MCP | Agent SDK may not have native skills | ✓ Acceptable |
| Parallel comparison via Promise.all | Faster than sequential Claude calls | ✓ Good |
| Session context injection | Enables conversational follow-up | ✓ Good |

## Tech Debt

- Database encryption not enabled (opt-in user action)
- Breadcrumb back navigation TODO in data-table
- Custom ExcelJS/pdfkit for documents (Agent SDK native skills may not exist)
- Jest ESM compatibility issues with MCP SDK packages

---
*Last updated: 2026-02-03 after v1 milestone*

# CensusChat Modernization

## What This Is

A full modernization of CensusChat to adopt the latest features from MCP (Apps UI framework), DuckDB 1.4 (encryption, compression, MERGE), and the Claude Agent SDK (structured outputs, multi-agent workflows, native skills). The existing natural language Census query interface becomes interactive, faster, and more capable.

## Core Value

Healthcare strategists get instant, interactive demographic insights through a chat interface that returns explorable data — not static responses.

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

### Active

- [ ] Upgrade MCP SDK to support Apps UI framework
- [ ] MCP tools return interactive data tables (sortable, filterable)
- [ ] MCP tools return charts/visualizations (demographic breakdowns, maps)
- [ ] In-chat export controls (format picker, column selector)
- [ ] Query refinement via click interactions (drill-down, filter adjustment)
- [ ] Upgrade DuckDB from 1.3.2 to 1.4.x
- [ ] Enable AES-256-GCM database encryption for census.duckdb
- [ ] Enable in-memory compression (5-10× perf improvement)
- [ ] Implement MERGE statement for data refresh workflows
- [ ] Add profiler metrics for query performance insights
- [ ] Integrate Claude Agent SDK for structured outputs
- [ ] Guaranteed JSON schema validation on query responses
- [ ] Multi-agent workflows for complex queries (parallel region comparison)
- [ ] Native Excel/PDF generation via Anthropic's built-in skills

### Out of Scope

- Mobile app — web-first, defer to future milestone
- Real-time collaboration — single-user focus for v1
- OAuth/SSO integration — existing JWT auth sufficient
- Video/audio inputs — text queries only
- Third-party data source integrations — Census data focus

## Context

**Existing Architecture:**
- Three-tier: Next.js frontend → Express API → MCP → DuckDB
- MCP SDK 1.0.4 with JSON-RPC 2.0 stdio transport
- DuckDB 1.3.2 with connection pooling (2-10 connections)
- Anthropic SDK 0.64.0 for Claude Sonnet integration

**Upgrade Targets:**
- MCP: Adopt November 2025 spec + January 2026 Apps UI framework
- DuckDB: Upgrade to 1.4.3 (encryption, compression, MERGE, profiler)
- Agent SDK: Add @anthropic-ai/claude-agent-sdk for structured outputs and skills

**Codebase State:**
- 7 codebase documents in `.planning/codebase/`
- Known tech debt: 97+ `any` types, untyped SQL parser AST, missing audit logging
- Test coverage: 80%+ target, Jest 30 + Supertest

## Constraints

- **Tech stack**: Must remain TypeScript/Node.js backend, Next.js frontend
- **Data**: Census data stays in DuckDB (no warehouse migration)
- **Compatibility**: Existing API endpoints must remain functional
- **Security**: HIPAA-ready patterns (encryption at rest, audit logging)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full adoption of all three upgrades | User requested comprehensive modernization | — Pending |
| Interactive UI via MCP Apps | Direct in-chat data exploration vs. static responses | — Pending |
| DuckDB encryption enabled by default | HIPAA readiness for healthcare use case | — Pending |
| Agent SDK for document generation | Replace custom ExcelJS with native skills | — Pending |

---
*Last updated: 2026-02-01 after initialization*

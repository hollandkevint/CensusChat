# Project Research Summary

**Project:** CensusChat 2026 Modernization
**Domain:** Natural language census data query interface with MCP Apps interactive UI
**Researched:** 2026-02-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

CensusChat requires upgrades across three dimensions: MCP Apps for interactive UI (replacing static tables), DuckDB 1.4 encryption for healthcare compliance, and Claude Agent SDK for multi-query orchestration. The existing system is well-architected with MCP 1.0.4, DuckDB 1.3.2, and Express 5, but needs modernization to deliver competitive features like sortable tables, charts, and drill-down navigation.

The recommended approach is incremental migration in dependency order: DuckDB 1.4 upgrade first (isolated testing), then MCP transport upgrade to StreamableHTTP (enables MCP Apps), then MCP Apps UI layer (delivers interactive dashboards), and finally Agent SDK for advanced multi-query patterns. Each component can be adopted independently, minimizing risk. The most disruptive change is the mandatory migration from `duckdb` npm package to `@duckdb/node-api` — the old package is deprecated with no DuckDB 1.5+ support planned.

Critical risks: DuckDB encryption requires full database copy (not in-place), 239K block groups will need significant migration time. MCP SDK v2 expected Q1 2026 may require second migration mid-project. Agent SDK default behavior completely changed in v0.1.0, breaking existing prompt patterns. Security model for MCP Apps has multiple layers that are easy to skip, creating compliance concerns for healthcare-adjacent data.

## Key Findings

### Recommended Stack

Current CensusChat uses outdated packages across the board: `@modelcontextprotocol/sdk: 1.0.4` (latest: 1.25.2), `duckdb: 1.3.2` (deprecated, should use `@duckdb/node-api: 1.4.4`), `@anthropic-ai/sdk: 0.64.0` (works but separate from Agent SDK). Migration path is clear but requires significant code changes, particularly for DuckDB connection pool rewrite.

**Core technologies:**
- **@modelcontextprotocol/sdk ^1.25.2**: Current stable MCP server/client. Upgrade now for spec compliance, but v2 expected Q1 2026. Use Streamable HTTP transport (not stdio).
- **@modelcontextprotocol/ext-apps ^1.0.1**: Official MCP Apps extension for interactive UI in chat. Enables dashboards, forms, charts rendered in sandboxed iframes.
- **@duckdb/node-api ^1.4.4**: New official DuckDB client with native Promises. Old `duckdb` package deprecated. Complete API rewrite required.
- **DuckDB 1.4.3**: LTS through Sept 2026. Adds AES-256-GCM encryption, MERGE statement, compression. No in-place encryption conversion — requires COPY FROM DATABASE.
- **@anthropic-ai/claude-agent-sdk ^0.2.29**: Multi-agent workflows with structured outputs. Additive, not replacement for base SDK. Default behavior changed in v0.1.0.

**Critical version requirement:** DuckDB 1.4.2+ fixes CVE-2025-64429 encryption vulnerability. Always load httpfs extension for OpenSSL hardware acceleration (5-10x performance vs mbedtls).

### Expected Features

Research shows modern NL data interfaces have clear expectations: sortable/filterable tables, pagination, charts, and structured JSON outputs are table stakes. CensusChat currently shows static tables with no sort, 10-row hardcoded limit. Users expect every data tool to have these capabilities.

**Must have (table stakes):**
- Sortable/filterable data tables — every data tool does this, users need to reorder by any column
- Pagination controls — 239K block group records cannot render at once
- Basic charts (bar/line) — demographic data begs for visual comparison
- Structured JSON responses — programmatic use requires schema guarantee (Agent SDK outputFormat)
- DuckDB 1.4 encryption — HIPAA readiness for healthcare context

**Should have (differentiators):**
- Click-to-drill-down — click county in results to see block groups within it (signature CensusChat feature)
- In-chat maps — geography data demands spatial visualization (high complexity, post-MVP)
- Conversational context memory — "Now filter to income > $75K" references prior query (Agent SDK sessions)
- Parallel agent comparison — "Compare Tampa Bay vs Phoenix" spawns two subagents
- Smart chart suggestions — AI recommends bar vs line based on data shape (modern BI standard)

**Defer (v2+):**
- Real-time collaboration — out of scope per PROJECT.md, single-user focus
- Full customizable dashboards — scope creep, takes months to build well
- Maps — high complexity, significant frontend work, not blocking value delivery
- Predictive forecasting — census data is historical, not time series

**Anti-features (do NOT build):**
- Infinite scroll for 200K+ rows — performance disaster, browser crash
- Custom SQL editor — defeats NL purpose, security risk
- Embedded Jupyter notebooks — overkill for healthcare strategists
- Voice input — out of scope, focus on text NL parsing

### Architecture Approach

CensusChat currently uses in-process MCP with StdioServerTransport. Target architecture moves to StreamableHTTPServerTransport with MCP Apps extension. The key shift: tools return data with `_meta.ui.resourceUri` pointing to bundled HTML UIs, which hosts render in sandboxed iframes. Bidirectional communication via postMessage (handled by App class). This enables same tool to power text responses OR interactive dashboards depending on host capabilities.

**Major components:**
1. **MCP Server with Apps Extension** — Registers tools with `_meta.ui.resourceUri`, serves bundled UIs via `ui://` resources, validates SQL before DuckDB execution
2. **DuckDB 1.4 Pool** — Connection management with encryption support (AES-256-GCM), MERGE statement for data refresh, new sorting engine for performance
3. **MCP App Iframes** — React/Tailwind UI components in sandboxed iframes, postMessage-only communication with host, can call server tools via `app.callServerTool()`
4. **Agent SDK Orchestration Layer (optional)** — Multi-query orchestration, subagents for parallel analytics, session management across queries, structured JSON outputs

**Critical architectural constraint:** MCP Apps must run in sandboxed iframes with proper CSP. No access to parent DOM, cookies, or storage. Communication only via postMessage. Host controls which tools apps can call. Research shows 5.5% of MCP servers have tool poisoning vulnerabilities.

**Migration order matters:** DuckDB upgrade first (isolated), then transport upgrade (enables Apps), then Apps layer (delivers UI), then Agent SDK (advanced patterns). Each phase has dependencies on prior.

### Critical Pitfalls

1. **DuckDB encryption requires full database copy** — No in-place conversion. Must create new encrypted database and COPY FROM DATABASE. With 239K+ block groups, this takes significant time. Plan migration window with read-only mode, test copy duration first, validate row counts match. Storage requirements double temporarily.

2. **Node.js DuckDB package deprecated** — `duckdb` npm package receives no updates for DuckDB 1.5.x (early 2026). Must migrate to `@duckdb/node-api` as part of 1.4 upgrade. API is completely different (not drop-in): SQLite-style callbacks → native Promises, `duckdb-async` wrapper no longer needed. September 2025 npm supply chain attack already affected DuckDB packages.

3. **Agent SDK default behavior completely changed** — Migrating from `@anthropic-ai/sdk` to Agent SDK, system prompt and settings behavior changes. Claude Code system prompt no longer included by default, filesystem settings (CLAUDE.md) no longer loaded by default. Must explicitly configure `systemPrompt` and `settingSources` or agent behavior is completely different.

4. **MCP Apps security model incomplete** — Implementing UI without proper iframe sandboxing leads to vulnerabilities in healthcare-adjacent app. Security model has multiple layers: iframe sandboxing (mandatory), pre-declared templates, user consent requirements, CSP configuration. Never bypass sandbox restrictions, audit all MCP servers before connecting.

5. **MCP SDK v2 coming Q1 2026** — Building against v1.x, v2 ships with potential breaking changes mid-project. Pin exact versions not ranges. v1.x continues receiving bug fixes for 6 months after v2. Monitor changelog for migration requirements.

## Implications for Roadmap

Based on research, suggested four-phase structure with clear dependency chain:

### Phase 1: Foundation Upgrade
**Rationale:** DuckDB 1.4 upgrade is prerequisite for encryption and has no external dependencies. Test internally before MCP changes. Package deprecation forces migration regardless of encryption needs.

**Delivers:**
- DuckDB 1.4.4 with encryption enabled (AES-256-GCM)
- `@duckdb/node-api` replacing deprecated `duckdb` package
- DuckDBPool rewritten for new API (native Promises)
- MERGE statement support for data refresh workflows
- Migration scripts with row count validation

**Addresses pitfalls:**
- Pitfall #1 (encryption copy) — dedicated migration window with timing tests
- Pitfall #2 (package deprecation) — complete before forced by lack of updates
- Pitfall #5 (encryption performance) — always load httpfs for OpenSSL acceleration

**Research needs:** Deep dive on DuckDB pool rewrite patterns, encryption key management for production.

### Phase 2: MCP Transport + SDK Upgrade
**Rationale:** Streamable HTTP transport required for MCP Apps. Must be stable before adding Apps layer. MCP SDK 1.25.2 provides spec compliance and bug fixes. Simpler than Apps extension.

**Delivers:**
- @modelcontextprotocol/sdk upgraded to 1.25.2
- StreamableHTTPServerTransport replacing StdioServerTransport
- Express routes for MCP: POST /mcp, GET /mcp (SSE), DELETE /mcp
- mcpClient.ts using HTTP fetch instead of in-process calls
- Session management foundation

**Uses:** DuckDB 1.4 pool from Phase 1

**Addresses pitfalls:**
- Pitfall #7 (JSON-RPC batching) — audit for removed batching feature
- Pitfall #6 (MCP v2) — pin exact versions, monitor Q1 2026 timeline

**Research needs:** Standard patterns. Streamable HTTP well-documented, skip research-phase.

### Phase 3: MCP Apps UI Layer
**Rationale:** Depends on HTTP transport being stable. Delivers competitive table stakes features (sortable tables, charts, pagination). Additive — doesn't modify existing tools.

**Delivers:**
- @modelcontextprotocol/ext-apps integration
- Vite build pipeline for UI resources (vite-plugin-singlefile)
- First three MCP Apps: census-dashboard (bar/line charts), data-explorer (sortable tables with pagination), export-wizard (CSV/Excel export)
- App Bridge in Next.js frontend with sandbox enforcement
- Click-to-drill-down navigation (county → block groups)

**Implements:** Table stakes features from FEATURES.md (sortable tables, charts, pagination, structured outputs)

**Addresses pitfalls:**
- Pitfall #4 (security model) — implement all sandbox layers, CSP headers, user consent
- Pitfall #10 (framework lock-in) — use existing React/Tailwind expertise

**Research needs:** MCP Apps UI patterns, postMessage communication flows, CSP configuration for healthcare compliance.

### Phase 4: Agent SDK Advanced Patterns
**Rationale:** Optional enhancement, existing system works without it. Enables differentiators like parallel analytics and conversational memory. Additive — keeps @anthropic-ai/sdk for simple completions.

**Delivers:**
- @anthropic-ai/claude-agent-sdk integration
- Structured outputs with JSON Schema + Zod validation
- Session management for conversational context ("Now filter to...")
- Subagent orchestration for parallel analytics ("Compare Tampa vs Phoenix")
- Smart chart suggestions via prompt engineering

**Implements:** Differentiator features from FEATURES.md (parallel comparison, session memory, chart suggestions)

**Addresses pitfalls:**
- Pitfall #3 (default behavior) — explicit systemPrompt and settingSources config
- Pitfall #9 (skills migration) — keep ExcelJS for programmatic exports, skills for agent-driven only
- Pitfall #12 (package naming) — use @anthropic-ai/claude-agent-sdk for Node.js

**Research needs:** Agent orchestration patterns for census analytics, subagent performance characteristics, session state management.

### Phase Ordering Rationale

- **Database first, UI last**: DuckDB upgrade isolated from frontend changes. Test encryption migration independently before exposing to UI layer.
- **Transport enables Apps**: StreamableHTTP is prerequisite for MCP Apps. No reason to upgrade transport without Apps, so combine in adjacent phases.
- **Apps deliver value, SDK enhances**: Phase 3 delivers competitive table stakes (sortable tables, charts). Phase 4 adds differentiators but isn't blocking.
- **Incremental risk**: Each phase independently valuable. Can pause after any phase without stranded work.
- **Avoid pitfall cascade**: DuckDB package deprecation (Pitfall #2) forces Phase 1 regardless. Transport upgrade required for Apps. Agent SDK fully optional.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (DuckDB upgrade):** Connection pool rewrite with new `@duckdb/node-api` — API is completely different, needs architecture spike for async patterns
- **Phase 3 (MCP Apps):** Security model implementation — multiple CSP layers, healthcare compliance requirements, sandboxing patterns
- **Phase 4 (Agent SDK):** Subagent orchestration — new capability, sparse production examples, needs performance testing

Phases with standard patterns (skip research-phase):
- **Phase 2 (MCP transport):** Well-documented Streamable HTTP patterns, official examples exist, straightforward migration

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations from official docs (MCP SDK, DuckDB, Agent SDK). Version numbers verified. Breaking changes documented. |
| Features | HIGH | Table stakes derived from modern BI tool analysis (ThoughtSpot, Holistics, Power BI). MCP Apps examples show implementation patterns. |
| Architecture | MEDIUM-HIGH | MCP Apps architecture well-documented. DuckDB pool rewrite has less guidance (new API). Agent SDK orchestration patterns emerging. |
| Pitfalls | HIGH | Critical pitfalls verified via official docs and changelogs. DuckDB encryption migration, package deprecation, Agent SDK defaults all documented. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **MCP SDK v2 breaking changes unknown:** Q1 2026 release may require second migration. Pin versions, monitor changelog during implementation, design for migration flexibility.

- **@duckdb/node-api completeness:** Docs mention MAP/UNION binding incomplete. Test with CensusChat's actual schema before committing to migration. Fallback: stay on 1.4.x until 1.5 stabilizes.

- **Agent SDK licensing unclear:** Proprietary license, not MIT. Verify commercial use terms before Phase 4. Skills are "demonstration purposes only" — don't build dependencies on them.

- **MCP Apps client support:** Verified for Claude, VS Code Insiders, Goose, Postman. ChatGPT support unconfirmed. Test host compatibility before production deployment.

- **DuckDB encryption NIST compliance:** Not yet NIST compliant (issue #20162). Document limitation for compliance teams. CVE-2025-64429 fixed in 1.4.2+, ensure using 1.4.2 minimum.

- **Encryption migration timing:** With 239K block groups, COPY FROM DATABASE duration unknown. Run spike during Phase 1 planning to establish downtime window requirements.

## Sources

### Primary (HIGH confidence)
- [MCP Apps Blog Post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — UI capabilities, security model, @modelcontextprotocol/ext-apps API
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — v1.25.2 breaking changes, Streamable HTTP transport
- [DuckDB 1.4.3 Release](https://duckdb.org/2025/12/09/announcing-duckdb-143) — Encryption, MERGE, compression features
- [DuckDB Encryption Blog](https://duckdb.org/2025/11/19/encryption-in-duckdb) — AES-256-GCM implementation, OpenSSL acceleration, migration patterns
- [DuckDB Node Neo Client](https://duckdb.org/docs/stable/clients/node_neo/overview) — @duckdb/node-api API reference, deprecation notice for `duckdb` package
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Built-in tools, subagents, sessions, MCP integration
- [Agent SDK Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) — JSON Schema support, Zod patterns
- [Agent SDK Migration Guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide) — Default behavior changes in v0.1.0

### Secondary (MEDIUM confidence)
- [MCP Apps GitHub Examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples) — Implementation patterns for dashboards, threejs, maps
- [MCP Key Changes Changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog) — JSON-RPC batching removal, spec evolution
- [MCP Security Risks Analysis](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls) — Tool poisoning (5.5%), network access vulnerabilities
- [TanStack Table Guide](https://www.contentful.com/blog/tanstack-table-react-table/) — React table best practices for sortable/filterable tables
- [AI-Powered BI Tools Comparison 2026](https://www.holistics.io/bi-tools/ai-powered/) — Market expectations for NL interfaces, chart suggestions

### Tertiary (LOW confidence)
- DuckDB MERGE/VARIANT type specifics for CensusChat use cases — needs validation during implementation
- Agent SDK subagent performance at scale — sparse production examples, needs testing
- MCP Apps client support matrix — ChatGPT unconfirmed, test during Phase 3

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*

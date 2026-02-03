# Requirements: CensusChat Modernization

**Defined:** 2026-02-01
**Core Value:** Healthcare strategists get instant, interactive demographic insights through a chat interface that returns explorable data — not static responses.

## v1 Requirements

Requirements for this modernization milestone. Each maps to roadmap phases.

### DuckDB Upgrade

- [ ] **DUCK-01**: Upgrade DuckDB from 1.3.2 to 1.4.3
- [ ] **DUCK-02**: Migrate from `duckdb` npm package to `@duckdb/node-api`
- [ ] **DUCK-03**: Rewrite DuckDBPool to use new async API patterns
- [ ] **DUCK-04**: Enable AES-256-GCM encryption for census.duckdb
- [ ] **DUCK-05**: Migrate existing database via COPY FROM DATABASE
- [ ] **DUCK-06**: Enable in-memory compression for query performance
- [ ] **DUCK-07**: Implement MERGE statement support for data refresh
- [ ] **DUCK-08**: Add profiler metrics endpoint for query performance insights

### MCP Infrastructure

- [ ] **MCP-01**: Upgrade @modelcontextprotocol/sdk from 1.0.4 to ^1.25.2
- [ ] **MCP-02**: Migrate from StdioServerTransport to StreamableHTTPServerTransport
- [ ] **MCP-03**: Add HTTP routes for MCP (POST /mcp, GET /mcp SSE, DELETE /mcp)
- [ ] **MCP-04**: Update mcpClient.ts to use HTTP fetch instead of in-process calls
- [ ] **MCP-05**: Install and configure @modelcontextprotocol/ext-apps for UI resources

### Interactive UI (MCP Apps)

- [ ] **UI-01**: Create MCP App build pipeline with Vite + vite-plugin-singlefile
- [ ] **UI-02**: Implement sortable data tables with TanStack Table
- [ ] **UI-03**: Implement server-side pagination for large result sets
- [ ] **UI-04**: Implement column filtering without re-querying
- [ ] **UI-05**: Add bar chart visualization for demographic comparisons
- [ ] **UI-06**: Add line chart visualization for trend data
- [ ] **UI-07**: Implement click-to-drill-down (county -> block groups)
- [ ] **UI-08**: Add in-chat export controls (format picker, column selector)
- [ ] **UI-09**: Add App Bridge to Next.js frontend for iframe rendering
- [ ] **UI-10**: Register MCP tools with _meta.ui.resourceUri for interactive returns

### Agent SDK Integration

- [ ] **AGENT-01**: Install @anthropic-ai/claude-agent-sdk
- [ ] **AGENT-02**: Implement structured JSON outputs with Zod schema validation
- [ ] **AGENT-03**: Configure Agent SDK to connect to CensusChat MCP server via HTTP
- [ ] **AGENT-04**: Implement multi-agent workflows for parallel region comparison
- [ ] **AGENT-05**: Add conversational context memory via session management
- [ ] **AGENT-06**: Integrate native Excel skill for document generation
- [ ] **AGENT-07**: Integrate native PDF skill for report generation

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Visualization

- **VIZ-01**: Geographic maps with Mapbox/Leaflet integration
- **VIZ-02**: Smart chart suggestions (AI recommends chart type based on data shape)
- **VIZ-03**: Anomaly flagging ("This value is 2 standard deviations above average")

### Enhanced Analytics

- **ANLYT-01**: Query performance dashboard with historical trends
- **ANLYT-02**: Custom saved query templates
- **ANLYT-03**: Scheduled report generation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, defer to future milestone |
| Real-time collaboration | Single-user focus for v1 |
| OAuth/SSO integration | Existing JWT auth sufficient |
| Video/audio inputs | Text queries only |
| Third-party data sources | Census data focus |
| Custom SQL editor | Defeats NL purpose, security risk |
| Infinite scroll for large datasets | Performance disaster, use pagination |
| Full dashboard customization | Scope creep, predefined chart types sufficient |

## Traceability

Which phases cover which requirements. Validated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DUCK-01 | Phase 1 | Pending |
| DUCK-02 | Phase 1 | Pending |
| DUCK-03 | Phase 1 | Pending |
| DUCK-04 | Phase 1 | Pending |
| DUCK-05 | Phase 1 | Pending |
| DUCK-06 | Phase 1 | Pending |
| DUCK-07 | Phase 1 | Pending |
| DUCK-08 | Phase 1 | Pending |
| MCP-01 | Phase 2 | Pending |
| MCP-02 | Phase 2 | Pending |
| MCP-03 | Phase 2 | Pending |
| MCP-04 | Phase 2 | Pending |
| MCP-05 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| UI-10 | Phase 3 | Pending |
| AGENT-01 | Phase 4 | Pending |
| AGENT-02 | Phase 4 | Pending |
| AGENT-03 | Phase 4 | Pending |
| AGENT-04 | Phase 4 | Pending |
| AGENT-05 | Phase 4 | Pending |
| AGENT-06 | Phase 4 | Pending |
| AGENT-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-02 after roadmap validation*

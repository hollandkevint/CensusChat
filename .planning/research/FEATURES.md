# Feature Landscape: MCP Apps + Agent SDK for CensusChat

**Domain:** Interactive natural language data query interface for healthcare demographics
**Researched:** 2026-02-01
**Confidence:** HIGH (verified via official docs for MCP Apps, Agent SDK, DuckDB 1.4)

## Table Stakes

Features users expect in modern NL data interfaces. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Sortable data tables** | Every data tool does this; users need to reorder by any column | Low | MCP Apps UI | Current ChatInterface.tsx shows static tables with no sort |
| **Column filtering** | Users expect to narrow results without re-querying | Medium | MCP Apps UI, state management | "Show only counties with pop > 100K" must work via click |
| **Pagination controls** | 239K block group records cannot render at once | Low | MCP Apps UI | Current limit is 10 rows hardcoded |
| **CSV/Excel export** | Already exists, must migrate to MCP Apps pattern | Low | Agent SDK native skills | Replace custom ExcelJS with `@modelcontextprotocol/ext-apps` |
| **Query loading states** | Users need feedback during 2-5s query execution | Low | MCP Apps UI | Currently shows "Analyzing your query..." text |
| **Basic charts (bar/line)** | Demographic data begs for visual comparison | Medium | MCP Apps + charting lib | "Compare Florida vs Texas Medicare population" needs bar chart |
| **Structured JSON responses** | Programmatic use of results requires schema guarantee | Medium | Agent SDK structured outputs | Current responses are free-form text + untyped data array |
| **Error messaging with suggestions** | Users need guidance when queries fail | Low | Already exists | ChatInterface already shows suggestions on error |
| **Data source attribution** | Healthcare users need provenance for compliance | Low | Already exists | Shows "Data source: US Census Bureau" |

## Differentiators

Features that set CensusChat apart. Not expected from typical tools, but highly valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Click-to-drill-down** | Click a county in results to see block groups within it | High | MCP Apps UI-to-host messaging | Differentiates from static BI tools; requires `app.updateContext()` |
| **Parallel agent comparison** | "Compare Medicare eligible in Tampa Bay vs Phoenix" spawns two subagents | High | Agent SDK subagents | Real advantage over single-threaded competitors |
| **In-chat maps** | Geography data demands spatial visualization | High | MCP Apps + Mapbox/Leaflet | threejs-server and map-server examples exist in MCP Apps ecosystem |
| **Conversational context memory** | "Now filter to income > $75K" references prior query | Medium | Agent SDK sessions | ThoughtSpot-level UX; requires `resume: sessionId` pattern |
| **Smart chart suggestions** | AI recommends bar vs line vs pie based on data shape | Medium | Agent SDK + prompt engineering | Modern BI tools (Holistics, Power BI Copilot) do this |
| **Query performance insights** | Show DuckDB profiler metrics to power users | Medium | DuckDB 1.4 profiler | Appeals to technical healthcare analysts |
| **Anomaly flagging** | "This Medicare % is 2 standard deviations above state average" | Medium | Agent SDK + statistical analysis | Proactive insight generation differentiates from reactive querying |
| **Real-time data refresh indication** | Show when Census data was last updated with freshness badge | Low | Already partially exists | Expand `dataFreshness` metadata in current implementation |
| **Natural language filter adjustment** | "Actually, make that $100K" modifies prior filter | Medium | Agent SDK sessions + context | Context-awareness via LLM conversational memory |
| **Row selection for batch operations** | Select 5 counties, export just those | Low | MCP Apps UI state | Standard table UX pattern |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Infinite scroll for 200K+ rows** | Performance disaster; browser will crash | Pagination with server-side filtering; max 100 rows per page |
| **Full customizable dashboards** | Scope creep; takes months to build well | Predefined chart types; let users ask for what they want in NL |
| **Real-time collaboration** | Out of scope per PROJECT.md; single-user focus | Defer to future milestone |
| **Custom SQL editor** | Defeats NL purpose; security risk | Keep SQL hidden; surface only in error debugging mode |
| **Multi-format chart theming** | Users don't need 50 color schemes | Single healthcare-appropriate color palette |
| **Predictive forecasting** | Census data is historical; forecasting needs time series | Clear documentation that data is point-in-time snapshots |
| **Embedded Jupyter notebooks** | Overkill for target user (healthcare strategists, not data scientists) | Export to CSV for users who want to do their own analysis |
| **Voice input** | Out of scope per PROJECT.md; text queries only | Focus on excellent text NL parsing |
| **Auto-refresh dashboards** | Census data updates annually; unnecessary overhead | Manual refresh button with last-update timestamp |
| **PDF report builder** | Complex layout engine for minimal value add | Excel export with metadata; PDF via native Agent SDK skills if needed |

## Feature Dependencies

```
MCP Apps Framework
├── Sortable Tables → requires @modelcontextprotocol/ext-apps
├── Column Filtering → requires table component + state
├── Pagination → requires server-side support
├── Charts → requires MCP Apps + chart library (Recharts recommended)
├── Maps → requires MCP Apps + Mapbox/Leaflet
└── Click-to-Drill-Down → requires app.callServerTool() + app.updateContext()

Agent SDK
├── Structured Outputs → requires outputFormat with JSON Schema
├── Parallel Queries → requires subagents via Task tool
├── Session Memory → requires resume: sessionId
└── Native Skills → replaces custom ExcelJS export

DuckDB 1.4
├── Encryption → AES-256-GCM, must be enabled on database creation
├── Compression → in-memory checkpointing, automatic
├── MERGE Statement → for data refresh workflows
└── Profiler → opt-in metrics for query performance
```

## Implementation Order (Recommended)

### Phase 1: Foundation (Table Stakes)
1. **Structured outputs** - Agent SDK outputFormat with JSON Schema
2. **Sortable/filterable tables** - MCP Apps UI with TanStack Table
3. **Pagination** - Server-side with row limit controls
4. **DuckDB 1.4 upgrade** - Encryption + compression enabled

### Phase 2: Visualization (Differentiators)
5. **Bar/line charts** - Recharts within MCP Apps iframe
6. **Click-to-drill-down** - County → block group navigation
7. **Session memory** - "Now filter to..." context awareness

### Phase 3: Advanced (Differentiators)
8. **Parallel agent comparison** - Subagent workflows
9. **Maps** - Geographic visualization
10. **Smart chart suggestions** - AI-recommended visualizations

## MVP Recommendation

For this modernization milestone, prioritize:

1. **Sortable tables with pagination** (table stakes) - Baseline expectation
2. **Structured JSON responses** (table stakes) - Required for reliable UI binding
3. **Basic bar charts** (table stakes → differentiator) - Visual comparison is expected
4. **Click-to-drill-down** (differentiator) - Signature CensusChat feature
5. **DuckDB 1.4 encryption** (table stakes for healthcare) - HIPAA readiness

Defer to post-MVP:
- **Maps**: High complexity, requires significant frontend work
- **Parallel agent comparison**: Cool but not blocking value delivery
- **Smart chart suggestions**: Nice-to-have polish

## Sources

**HIGH Confidence (Official Docs):**
- [MCP Apps Blog Post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - UI component capabilities, security model, `@modelcontextprotocol/ext-apps` API
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Built-in tools, subagents, sessions, MCP integration
- [Agent SDK Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) - JSON Schema support, Zod/Pydantic patterns
- [DuckDB 1.4 Announcement](https://duckdb.org/2025/09/16/announcing-duckdb-140) - Encryption, MERGE, compression features

**MEDIUM Confidence (Verified with Multiple Sources):**
- [AI-Powered BI Tools Comparison 2026](https://www.holistics.io/bi-tools/ai-powered/) - Market expectations for NL interfaces
- [TanStack Table Guide](https://www.contentful.com/blog/tanstack-table-react-table/) - React table best practices
- [Data Visualization Trends 2026](https://techlooker.com/top-15-data-visualization-trends-2026/) - User expectations for AI visualization tools

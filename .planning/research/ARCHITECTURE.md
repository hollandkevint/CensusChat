# Architecture Patterns: MCP Apps + Agent SDK Integration

**Project:** CensusChat Modernization
**Researched:** 2026-02-01
**Focus:** MCP Apps, DuckDB 1.4, Claude Agent SDK integration with existing Express + MCP stack

## Current Architecture (Baseline)

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│  Next.js 15     │     │              Express 5 Backend          │
│  React 19       │────▶│  /api/v1/queries                        │
│  Frontend       │     │  /api/v1/mcp                            │
└─────────────────┘     └──────────────┬──────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────────────┐
                        │     MCP Server (StdioServerTransport)    │
                        │     @modelcontextprotocol/sdk 1.0.4      │
                        │                                          │
                        │  Tools:                                  │
                        │  - get_information_schema                │
                        │  - validate_sql_query                    │
                        │  - execute_query                         │
                        │                                          │
                        │  Resources:                              │
                        │  - data://tables/county_data             │
                        │  - data://schema                         │
                        └──────────────┬───────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────────────┐
                        │  SQL Validator (node-sql-parser)         │
                        │  Security Policy Enforcement             │
                        └──────────────┬───────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────────────┐
                        │  DuckDB 1.3.2 Connection Pool            │
                        │  - 2-10 connections                      │
                        │  - Healthcare-optimized settings         │
                        │  - httpfs, spatial extensions            │
                        └──────────────────────────────────────────┘
```

**Key observations from current codebase:**
- MCP Client is in-process (not using stdio transport to external process)
- Tools return JSON text blobs, no UI capability
- Connection pool is singleton pattern with EventEmitter
- SQL validation happens before DuckDB execution

---

## Target Architecture: MCP Apps + Agent SDK

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 15 Frontend                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  MCP App Iframe (sandboxed)                               │  │
│  │  - @modelcontextprotocol/ext-apps                         │  │
│  │  - React/Tailwind UI components                           │  │
│  │  - postMessage ↔ Host communication                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ▲                                                        │
│         │ JSON-RPC over postMessage                              │
│         ▼                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  App Bridge / Host Integration                            │  │
│  │  - Renders ui:// resources in iframe                      │  │
│  │  - Proxies tool calls to MCP server                       │  │
│  │  - Manages app lifecycle                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ HTTP(S)
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              Express 5 + MCP Apps Server                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  StreamableHTTPServerTransport                            │  │
│  │  POST /mcp - Client requests                              │  │
│  │  GET /mcp - SSE notifications                             │  │
│  │  DELETE /mcp - Session termination                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │  MCP Server with Apps Extension                           │  │
│  │  Tools + _meta.ui.resourceUri                             │  │
│  │                                                           │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐ │  │
│  │  │ execute_query       │  │ ui://census-dashboard.html  │ │  │
│  │  │ validate_sql_query  │  │ ui://data-explorer.html     │ │  │
│  │  │ get_info_schema     │  │ ui://export-wizard.html     │ │  │
│  │  └─────────────────────┘  └─────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │  SQL Validator (unchanged)                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │  DuckDB 1.4 Pool                                          │  │
│  │  - MERGE statement support                                │  │
│  │  - VARIANT type for flexible schema                       │  │
│  │  - New sorting engine (performance)                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   │ (optional orchestration)
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              Claude Agent SDK Orchestration Layer                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Agent Query Interface                                    │  │
│  │  - query() with MCP server config                         │  │
│  │  - Subagents for parallel analytics                       │  │
│  │  - Session management across queries                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │  MCP Connection to CensusChat Server                      │  │
│  │  type: "http"                                             │  │
│  │  url: "http://localhost:3001/mcp"                         │  │
│  │  allowedTools: ["mcp__censuschat__*"]                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Confidence |
|-----------|----------------|-------------------|------------|
| **Next.js Host** | Renders MCP App iframes, manages chat UI | App Bridge, Express backend | HIGH |
| **App Bridge** | Sandboxes apps, proxies tool calls, enforces CSP | MCP Apps, MCP Server | HIGH |
| **MCP App (iframe)** | Interactive UI (charts, forms, dashboards) | Host via postMessage only | HIGH |
| **Express Server** | HTTP routing, authentication, session mgmt | MCP Server, DuckDB Pool | HIGH |
| **MCP Server** | Tool registration, resource serving, Apps metadata | SQL Validator, DuckDB | HIGH |
| **SQL Validator** | Query parsing, allowlist enforcement | MCP Server | HIGH |
| **DuckDB Pool** | Connection management, query execution | SQL Validator | HIGH |
| **Agent SDK (optional)** | Multi-query orchestration, subagent spawning | MCP Server via HTTP | MEDIUM |

---

## Data Flow: Interactive UI Query

**Scenario:** User asks "Show me Medicare-eligible population by county"

```
1. User prompt → Claude (Agent SDK or direct API)
2. Claude calls mcp__censuschat__execute_query
   └── Tool has _meta.ui.resourceUri: "ui://census-dashboard.html"
3. Host preloads UI resource from MCP server
4. Tool executes: validate SQL → DuckDB query → results
5. Host renders UI in sandboxed iframe
6. Tool result pushed to app via app.ontoolresult
7. App renders interactive chart
8. User clicks county → app calls app.callServerTool({name: "execute_query", ...})
9. Loop continues with fresh data
```

**Key insight:** Tool results and UI are decoupled. The tool returns data; the app decides how to render it. This allows the same tool to power text responses OR interactive dashboards.

---

## Integration Points

### 1. Transport Upgrade (Critical)

**Current:** StdioServerTransport (in-process, synchronous)
**Target:** StreamableHTTPServerTransport (HTTP, async, session-aware)

```typescript
// Before (mcpServer.ts line 311-313)
const transport = new StdioServerTransport();
await this.server.connect(transport);

// After
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless for now
    enableJsonResponse: true
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

**Breaking change:** Existing in-process MCP Client becomes HTTP client.

### 2. MCP Apps Extension (Additive)

**Required packages:**
```bash
npm install @modelcontextprotocol/ext-apps vite vite-plugin-singlefile
```

**Tool registration with UI:**
```typescript
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const resourceUri = "ui://census-dashboard/dashboard.html";

registerAppTool(server, "show_census_dashboard", {
  title: "Census Dashboard",
  description: "Interactive visualization of census data",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" }
    }
  },
  _meta: { ui: { resourceUri } }
}, async (args) => {
  // Execute query, return data
  const result = await executeQuery(args.query);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

registerAppResource(server, resourceUri, resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile("./dist/dashboard.html", "utf-8");
    return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  }
);
```

### 3. DuckDB 1.4 Upgrade (Moderate)

**Migration concerns:**
- CTE materialization is now default (was inlining). Test query plans.
- Storage format changes. Run validation before production upgrade.
- VARIANT type available but not required.

**Pool changes:**
```typescript
// New DuckDB 1.4 features to enable
const newSettings = [
  // MERGE for upserts (future use)
  // VARIANT for flexible schema (future use)
  // Existing settings unchanged
];
```

### 4. Agent SDK Integration (Optional, Additive)

**Connects to existing MCP server:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: userQuery,
  options: {
    mcpServers: {
      "censuschat": {
        type: "http",
        url: "http://localhost:3001/mcp"
      }
    },
    allowedTools: ["mcp__censuschat__*"]
  }
})) {
  // Handle messages
}
```

**Subagent pattern for parallel analytics:**
```typescript
options: {
  agents: {
    "county-analyzer": {
      description: "Analyzes county-level demographics",
      prompt: "Analyze demographics for the given counties",
      tools: ["mcp__censuschat__execute_query"]
    },
    "trend-analyzer": {
      description: "Identifies trends across time periods",
      prompt: "Identify trends in the demographic data",
      tools: ["mcp__censuschat__execute_query"]
    }
  }
}
```

---

## Patterns to Follow

### Pattern 1: Tool-First UI Design

**What:** Design MCP tools to return data, then layer UI on top.
**When:** Building any interactive feature.

```typescript
// Tool returns structured data
async function handleExecuteQuery(query: string) {
  const result = await pool.query(validatedSQL);
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        data: result,
        metadata: { rowCount: result.length, columns: extractedColumns }
      })
    }]
  };
}

// UI resource renders that data
app.ontoolresult = (result) => {
  const { data, metadata } = JSON.parse(result.content[0].text);
  renderChart(data, metadata);
};
```

### Pattern 2: Progressive Enhancement

**What:** MCP Apps are optional. Text responses still work.
**When:** Designing tool responses.

```
Without App support: Claude formats data as markdown table
With App support: Interactive chart renders in iframe
```

Hosts that don't support MCP Apps still get useful text output.

### Pattern 3: Session Isolation for Multi-tenant

**What:** Use session IDs to isolate tenant queries.
**When:** Production deployment with multiple users.

```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Business Logic in UI

**What:** Putting SQL generation or validation in the MCP App.
**Why bad:** Bypasses security policies, duplicates server logic.
**Instead:** Apps call tools; tools do validation.

### Anti-Pattern 2: Mixing Transport Protocols

**What:** Keeping stdio for some tools, HTTP for others.
**Why bad:** Session management nightmare, inconsistent behavior.
**Instead:** Migrate entire MCP server to StreamableHTTP.

### Anti-Pattern 3: Synchronous Pool Operations in HTTP Handler

**What:** Blocking HTTP response while waiting for DuckDB.
**Why bad:** Thread starvation under load.
**Instead:** Already using async/await. Maintain this pattern.

---

## Build Order (Dependencies)

Phase order matters because each upgrade has dependencies.

### Phase 1: DuckDB 1.4 Upgrade

**Why first:** No external dependencies. Test internally before exposing to MCP changes.

**Tasks:**
1. Upgrade duckdb package: `npm install duckdb@1.4.4`
2. Run existing test suite
3. Validate CTE-heavy queries (CTE materialization default changed)
4. Test connection pool behavior unchanged

**Verify:** `npm test` passes, existing queries produce same results.

### Phase 2: Transport Upgrade (stdio → Streamable HTTP)

**Why second:** Required for MCP Apps. Simpler than Apps extension.

**Tasks:**
1. Add StreamableHTTPServerTransport to mcpServer.ts
2. Add Express routes: POST /mcp, GET /mcp (SSE), DELETE /mcp
3. Update mcpClient.ts to use HTTP fetch instead of in-process calls
4. Deprecate StdioServerTransport path

**Verify:** Existing MCP tools work via HTTP. Test with curl.

### Phase 3: MCP Apps Extension

**Why third:** Depends on HTTP transport being stable.

**Tasks:**
1. Install `@modelcontextprotocol/ext-apps`
2. Add Vite build for UI resources
3. Convert one tool to use `_meta.ui.resourceUri`
4. Build first UI app (likely: data explorer)
5. Add App Bridge to Next.js frontend

**Verify:** Interactive UI renders in conversation.

### Phase 4: Agent SDK Orchestration (Optional)

**Why last:** Additive capability. Existing system works without it.

**Tasks:**
1. Install `@anthropic-ai/claude-agent-sdk`
2. Create orchestration layer for complex multi-query workflows
3. Add subagent definitions for parallel analytics
4. Integrate with existing Express routes

**Verify:** Complex queries use multiple tool calls orchestrated by Agent SDK.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **DuckDB connections** | Pool (2-10) | Pool + read replicas | Distributed query layer |
| **MCP sessions** | In-memory | Redis session store | Stateless + external state |
| **UI resources** | Bundled HTML | CDN-served bundles | Edge caching |
| **Agent SDK** | N/A (direct API) | Subagents per request | Queue-based orchestration |

---

## Migration Risk Assessment

| Component | Risk Level | Mitigation |
|-----------|------------|------------|
| DuckDB 1.4 | MEDIUM | Test CTE queries, validate storage |
| Transport upgrade | HIGH | Run parallel transports during migration |
| MCP Apps | LOW | Additive, doesn't break existing |
| Agent SDK | LOW | Optional, existing flow unchanged |

---

## Sources

**HIGH Confidence (Official Docs):**
- [MCP Apps Documentation](https://modelcontextprotocol.io/docs/extensions/apps) - Full specification and examples
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Official SDK documentation
- [Agent SDK MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp) - MCP connection patterns
- [DuckDB 1.4.1 Release](https://duckdb.org/2025/10/07/announcing-duckdb-141) - Patch release notes

**MEDIUM Confidence (Verified with Multiple Sources):**
- [MCP Apps GitHub](https://github.com/modelcontextprotocol/ext-apps) - Implementation examples
- [Streamable HTTP Tutorial](https://mcp.holt.courses/lessons/sses-and-streaming-html/streamable-http) - Transport patterns
- [Agent Design Patterns](https://rlancemartin.github.io/2026/01/09/agent_design/) - Subagent architecture

**LOW Confidence (Needs Validation):**
- DuckDB MERGE/VARIANT type specifics for CensusChat use cases
- Agent SDK subagent performance at scale

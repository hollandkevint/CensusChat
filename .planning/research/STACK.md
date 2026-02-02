# Technology Stack: CensusChat Modernization

**Project:** CensusChat 2026 Stack Upgrade
**Researched:** 2026-02-01
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

CensusChat requires upgrades across three dimensions: interactive UI returns (MCP Apps), database encryption (DuckDB 1.4.3), and multi-agent workflows (Claude Agent SDK). The upgrade path is incremental - each component can be adopted independently. The most disruptive change is the DuckDB Node.js client replacement (`duckdb` -> `@duckdb/node-api`), which requires significant code refactoring but provides better async support.

---

## Current Stack (Baseline)

| Component | Current Version | Status |
|-----------|-----------------|--------|
| @modelcontextprotocol/sdk | 1.0.4 | Outdated - v1.25.2 available |
| duckdb | 1.3.2 | Outdated - 1.4.3 LTS available |
| @anthropic-ai/sdk | 0.64.0 | Functional but separate from Agent SDK |
| Node.js | 20 | Keep - LTS until April 2026 |
| TypeScript | 5.8.3 | Keep - current |

---

## Recommended Stack

### Core MCP Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/sdk | ^1.25.2 | MCP server/client | Current stable, v2 expected Q1 2026. Upgrade now for bug fixes and spec compliance (2025-11-25). | HIGH |
| @modelcontextprotocol/ext-apps | ^1.0.1 | Interactive UI in chat | Official MCP Apps extension (Jan 2026). Enables dashboards, forms, visualizations in Claude/ChatGPT. | HIGH |

**Breaking Changes from 1.0.4:**
- SSE priming events disabled in 1.23.x+ for backwards compatibility
- Streamable HTTP transport recommended over HTTP+SSE (2024-11-05)
- Import paths changed: use `/server/mcp.js` not `/server/index.js`

**Migration Path:**
```typescript
// OLD (current)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// NEW (recommended)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

**Sources:**
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Apps Official Docs](https://modelcontextprotocol.io/docs/extensions/apps)
- [MCP Apps Blog Announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)

---

### Database Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @duckdb/node-api | ^1.4.4 | DuckDB client | New official client with native Promises. Old `duckdb` package deprecated, no 1.5.x support planned. | HIGH |
| DuckDB | 1.4.3 | Analytics engine | LTS through Sept 2026. Adds encryption, MERGE, compression, security fixes. | HIGH |

**DO NOT USE:**
- `duckdb` npm package - Deprecated, final release for 1.4.x only
- `duckdb-async` - No longer needed, `@duckdb/node-api` has native Promise support

**Breaking Changes from duckdb 1.3.2:**

1. **Package replacement required** - Cannot upgrade in place
2. **API completely different** - Not SQLite-based anymore
3. **BIGINT returns BigInt type** - Was `number`, now `bigint`
4. **No callback patterns** - Pure async/await

**Migration Path:**
```typescript
// OLD (current duckdb package)
import duckdb from 'duckdb';
const db = new duckdb.Database(':memory:');
db.all('SELECT * FROM foo', (err, result) => {});

// NEW (@duckdb/node-api)
import { DuckDBInstance } from '@duckdb/node-api';
const instance = await DuckDBInstance.create(':memory:');
const connection = await instance.connect();
const result = await connection.run('SELECT * FROM foo');
```

**Encryption Configuration (new in 1.4):**
```sql
-- Create encrypted database
ATTACH 'census_encrypted.duckdb' AS census_db (
    ENCRYPTION_KEY 'your-32-byte-base64-key',
    ENCRYPTION_CIPHER 'GCM'  -- AES-256-GCM, recommended
);

-- Query encryption status
SELECT * FROM duckdb_databases();
```

**Performance Impact:** AES-256-GCM adds 5-10% overhead. Uses hardware AES-NI instructions when available.

**Sources:**
- [DuckDB 1.4.3 Release](https://duckdb.org/2025/12/09/announcing-duckdb-143)
- [DuckDB Node.js Neo Client](https://duckdb.org/docs/stable/clients/node_neo/overview)
- [DuckDB Encryption Blog](https://duckdb.org/2025/11/19/encryption-in-duckdb)

---

### AI/Agent Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/claude-agent-sdk | ^0.2.29 | Multi-agent workflows | Claude Code capabilities: file editing, bash, autonomous execution. Structured outputs built-in. | HIGH |
| @anthropic-ai/sdk | ^0.64.0 | Direct API calls | Keep for simple completions. Agent SDK is additive, not replacement. | MEDIUM |

**Key Features of Agent SDK:**
- Structured outputs via `outputFormat` option with JSON Schema
- Type-safe with Zod integration (`z.toJSONSchema()`)
- Native skills support via `.claude/skills/` directories
- Multi-turn tool use with validated JSON returns

**Structured Output Example:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const CensusQueryResult = z.object({
  summary: z.string(),
  data_points: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    geography: z.string()
  })),
  sql_used: z.string()
});

for await (const message of query({
  prompt: 'What is the median household income in Tampa Bay?',
  options: {
    outputFormat: {
      type: 'json_schema',
      schema: z.toJSONSchema(CensusQueryResult)
    }
  }
})) {
  if (message.type === 'result' && message.structured_output) {
    const result = CensusQueryResult.parse(message.structured_output);
    // Fully typed: result.summary, result.data_points, result.sql_used
  }
}
```

**Agent Skills Integration:**
Skills are filesystem-based directories that Claude loads dynamically. Pre-built skills available for Excel, PowerPoint, Word, PDF.

```
.claude/skills/
  census-query/
    SKILL.md          # Instructions + metadata
    REFERENCE.md      # Schema documentation
    scripts/
      validate.py     # Utility scripts
```

**Sources:**
- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [Agent Skills Overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Claude Agent SDK npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

---

### MCP Apps UI Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/ext-apps | ^1.0.1 | MCP Apps server SDK | Register tools with UI resources, serve bundled HTML | HIGH |
| @modelcontextprotocol/ext-apps/react | ^1.0.1 | React hooks for Apps | Client-side App class wrapper for React components | HIGH |
| vite | ^6.x | UI bundling | Single-file HTML output for MCP Apps resources | MEDIUM |
| vite-plugin-singlefile | ^2.x | Bundle optimization | Required for MCP Apps pattern | MEDIUM |

**MCP Apps Architecture:**

MCP Apps extend tools to return interactive UIs rendered in chat. The pattern:

1. **Server declares UI resource** with `ui://` URI scheme
2. **Tool references resource** via `_meta.ui.resourceUri`
3. **Host renders sandboxed iframe** with the bundled HTML
4. **Bidirectional communication** via postMessage (handled by App class)

**Server Integration (add to existing mcpServer.ts):**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE
} from '@modelcontextprotocol/ext-apps/server';

const resourceUri = 'ui://census-dashboard/app.html';

// Register tool that returns interactive dashboard
registerAppTool(
  server,
  'show_census_dashboard',
  {
    title: 'Census Dashboard',
    description: 'Display interactive census data visualization',
    inputSchema: {
      type: 'object',
      properties: {
        geography: { type: 'string' },
        metrics: { type: 'array', items: { type: 'string' } }
      }
    },
    _meta: { ui: { resourceUri } }
  },
  async (args) => {
    // Return data that the UI will render
    const data = await fetchCensusData(args.geography, args.metrics);
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  }
);

// Serve the bundled UI
registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({
    contents: [{
      uri: resourceUri,
      mimeType: RESOURCE_MIME_TYPE,
      text: await fs.readFile('dist/census-dashboard.html', 'utf-8')
    }]
  })
);
```

**Client-side App (React component):**
```typescript
// src/apps/CensusDashboard.tsx
import { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useState } from 'react';

export function CensusDashboard() {
  const [data, setData] = useState(null);
  const app = new App({ name: 'Census Dashboard', version: '1.0.0' });

  useEffect(() => {
    app.connect();
    app.ontoolresult = (result) => {
      const parsed = JSON.parse(result.content?.[0]?.text || '{}');
      setData(parsed);
    };
  }, []);

  const refreshData = async () => {
    const result = await app.callServerTool({
      name: 'execute_query',
      arguments: { query: 'SELECT * FROM county_data LIMIT 100' }
    });
    setData(JSON.parse(result.content?.[0]?.text || '{}'));
  };

  return (
    <div>
      <button onClick={refreshData}>Refresh</button>
      {data && <DataVisualization data={data} />}
    </div>
  );
}
```

**Sources:**
- [MCP Apps Specification](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Apps Examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples)

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.24.1 | Schema validation | Required peer dep for Agent SDK structured outputs |
| recharts | ^3.x | Data visualization | MCP Apps dashboards (already in frontend) |
| express | ^5.x | HTTP server | Keep for API routes |
| tsx | ^4.x | TypeScript execution | Dev server for MCP Apps |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| DuckDB client | @duckdb/node-api | duckdb + duckdb-async | Deprecated, no 1.5.x support |
| MCP Apps UI | ext-apps official | @mcp-ui/client | ext-apps is official, backed by spec |
| Agent SDK | claude-agent-sdk | Custom agent loop | SDK provides file ops, bash, structured output |
| Encryption | DuckDB native | Application-layer encryption | Native is faster (AES-NI), simpler |

---

## Installation

```bash
# Remove deprecated packages
npm uninstall duckdb duckdb-async

# Core MCP upgrades
npm install @modelcontextprotocol/sdk@^1.25.2
npm install @modelcontextprotocol/ext-apps@^1.0.1

# DuckDB replacement
npm install @duckdb/node-api@^1.4.4

# Agent SDK (new)
npm install @anthropic-ai/claude-agent-sdk@^0.2.29

# Peer dependencies
npm install zod@^3.24.1

# Dev dependencies for MCP Apps
npm install -D vite@^6.0.0 vite-plugin-singlefile@^2.0.0 tsx@^4.0.0
```

---

## Migration Priority

| Phase | Component | Effort | Risk | Rationale |
|-------|-----------|--------|------|-----------|
| 1 | @modelcontextprotocol/sdk 1.25 | Low | Low | Drop-in upgrade, minimal API changes |
| 2 | @duckdb/node-api | High | Medium | Requires DuckDBPool rewrite, different API |
| 3 | DuckDB encryption | Medium | Low | Additive feature, no breaking changes |
| 4 | MCP Apps | Medium | Low | Additive - new tools, doesn't modify existing |
| 5 | Claude Agent SDK | Medium | Low | Additive for new workflows, keep @anthropic-ai/sdk |

---

## Version Compatibility Matrix

| Component | Min Node | TypeScript | Notes |
|-----------|----------|------------|-------|
| @modelcontextprotocol/sdk 1.25 | 18+ | 5.0+ | Zod 3.25+ compatible |
| @duckdb/node-api 1.4.4 | 18+ | 5.0+ | Native ESM only |
| @anthropic-ai/claude-agent-sdk | 18+ | 5.0+ | Requires zod ^3.24.1 |
| @modelcontextprotocol/ext-apps | 18+ | 5.0+ | Requires vite for bundling |

---

## Security Considerations

### DuckDB Encryption
- Use AES-256-GCM (default), not CTR
- Upgrade to 1.4.2+ to fix encryption vulnerabilities
- Store encryption keys in environment variables, not code
- Key derivation uses secure KDF with random salt

### MCP Apps
- Apps run in sandboxed iframes
- No access to parent DOM, cookies, or storage
- Communication only via postMessage
- Host controls which tools apps can call

### Agent SDK
- API key via `ANTHROPIC_API_KEY` env var
- Usage data collected but not used for training
- Audit skill directories before use

---

## Gaps and Open Questions

1. **MCP SDK v2 timeline** - Q1 2026 expected, may require another migration. v1.x supported 6 months post-v2.
2. **@duckdb/node-api completeness** - MAP/UNION binding incomplete per docs
3. **Agent SDK licensing** - Proprietary license, not MIT
4. **MCP Apps client support** - Currently Claude, VS Code Insiders, Goose, Postman. ChatGPT support unconfirmed.

---

## Sources Summary

| Source | Type | Confidence |
|--------|------|------------|
| [MCP Apps Docs](https://modelcontextprotocol.io/docs/extensions/apps) | Official | HIGH |
| [DuckDB 1.4.3 Release](https://duckdb.org/2025/12/09/announcing-duckdb-143) | Official | HIGH |
| [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) | Official | HIGH |
| [DuckDB Node Neo Client](https://duckdb.org/docs/stable/clients/node_neo/overview) | Official | HIGH |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Official | HIGH |
| [Agent Skills Overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | Official | HIGH |
| [DuckDB Encryption](https://duckdb.org/2025/11/19/encryption-in-duckdb) | Official | HIGH |

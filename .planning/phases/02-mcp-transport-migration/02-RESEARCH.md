# Phase 2: MCP Transport Migration - Research

**Researched:** 2026-02-02
**Domain:** Model Context Protocol (MCP) SDK, HTTP Transport, Express Integration
**Confidence:** HIGH

## Summary

MCP Transport Migration requires upgrading `@modelcontextprotocol/sdk` from 1.0.4 to 1.25.x and switching from `StdioServerTransport` to `StreamableHTTPServerTransport`. The current codebase has two parallel implementations: (1) `mcpServer.ts` / `mcpClient.ts` using the SDK's Server/Client classes with stdio transport, and (2) `mcpServerService.ts` / `mcpClientService.ts` operating as DuckDB-backed services with no actual MCP protocol involvement. The migration consolidates these into a single HTTP-based MCP implementation.

The MCP SDK v1.25.x provides `StreamableHTTPServerTransport` for handling HTTP transport with session management via the `Mcp-Session-Id` header. This transport replaces the deprecated HTTP+SSE transport from protocol version 2024-11-05. The SDK also offers an optional `@modelcontextprotocol/express` middleware package for Express integration with DNS rebinding protection.

**Primary recommendation:** Upgrade to `@modelcontextprotocol/sdk@1.25.3`, implement `StreamableHTTPServerTransport` with Express routes at `/mcp` (POST/GET/DELETE), and refactor `mcpClient.ts` to use HTTP fetch with session ID tracking.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.25.3 | MCP server/client implementation | Official SDK, v2 coming Q1 2026 |
| @modelcontextprotocol/express | latest | Express middleware with DNS protection | Official helper, auto-configures security |
| zod | ^3.25.0 | Schema validation (peer dependency) | Required by SDK for input validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/ext-apps | 1.0.1 | UI resources for interactive results | Phase 3 (deferred) |
| uuid | ^13.0.0 | Session ID generation | Already installed, use for session IDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @modelcontextprotocol/express | Raw Express handlers | More control but must implement DNS rebinding protection manually |
| uuid session IDs | JWT session IDs | JWT provides authentication but overkill for session tracking |
| In-memory session storage | Redis session storage | Redis needed only for horizontal scaling (not current requirement) |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk@1.25.3 @modelcontextprotocol/express
# Note: zod ^3.25.0 should already be satisfied or update if needed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── mcp/
│   ├── mcpServer.ts              # StreamableHTTPServerTransport server (rewrite)
│   ├── mcpClient.ts              # HTTP fetch client (rewrite)
│   ├── mcpRoutes.ts              # Express routes for /mcp endpoints (new)
│   ├── mcpSessionManager.ts      # Session tracking (new)
│   └── mcpToolHandlers.ts        # Tool implementations (refactor from existing)
├── services/
│   ├── mcpServerService.ts       # Remove or merge into mcpServer.ts
│   └── mcpClientService.ts       # Remove or merge into mcpClient.ts
└── routes/
    └── mcp.routes.ts             # Keep for /api/v1/mcp/* healthcare tools
```

### Pattern 1: StreamableHTTPServerTransport with Express
**What:** Single MCP endpoint handling POST (requests), GET (SSE), DELETE (session termination)
**When to use:** All external MCP client connections
**Example:**
```typescript
// Source: MCP TypeScript SDK docs
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

// Session storage (in-memory for single instance)
const transports: Map<string, StreamableHTTPServerTransport> = new Map();
const mcpServers: Map<string, McpServer> = new Map();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Existing session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (!sessionId && isInitializeRequest(req.body)) {
    // New session initialization
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    const server = new McpServer({
      name: 'censuschat-mcp-server',
      version: '1.0.0',
    });

    // Register tools...

    await server.connect(transport);
    transports.set(newSessionId, transport);
    mcpServers.set(newSessionId, server);

    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: 'Bad Request: Missing session ID' });
});
```

### Pattern 2: HTTP Client with Session Management
**What:** MCP client using fetch API with session ID tracking
**When to use:** Internal calls from query routes to MCP server
**Example:**
```typescript
// Source: MCP specification 2025-03-26
export class MCPHttpClient {
  private sessionId: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async initialize(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          clientInfo: { name: 'censuschat-backend', version: '1.0.0' },
          capabilities: {},
        },
      }),
    });

    this.sessionId = response.headers.get('Mcp-Session-Id');
    return response.json();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    if (!this.sessionId) {
      await this.initialize();
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': this.sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });

    return response.json();
  }
}
```

### Anti-Patterns to Avoid
- **Creating transport per request:** Reuse transports by session ID, don't create new ones for each POST
- **Ignoring session cleanup:** Implement DELETE handler and cleanup abandoned sessions
- **Mixing transport types:** Don't use stdio and HTTP simultaneously in production
- **Session ID in query params:** Always use `Mcp-Session-Id` header, never URL params

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DNS rebinding protection | Custom Origin validation | `@modelcontextprotocol/express` | Edge cases around localhost, IPv6, reverse proxies |
| Session ID generation | Simple counter/timestamp | `crypto.randomUUID()` | Cryptographically secure, collision-resistant |
| JSON-RPC message parsing | Manual JSON validation | SDK's `isInitializeRequest`, type guards | Proper protocol compliance |
| SSE formatting | Manual `res.write()` calls | Transport's `handleRequest()` | Handles streaming, buffering, keepalive |
| Request timeout handling | Simple `setTimeout` | SDK's built-in timeout support | Integrates with circuit breakers |

**Key insight:** The SDK's transport classes handle the complex bidirectional communication protocol. Hand-rolling HTTP+SSE is error-prone and breaks on edge cases like proxy buffering, connection drops, and message ordering.

## Common Pitfalls

### Pitfall 1: Missing Mcp-Session-Id Header After Initialization
**What goes wrong:** Client connects, gets session ID, subsequent requests fail with 400
**Why it happens:** Session ID header name is case-sensitive in application code (lowercase in Node headers object)
**How to avoid:** Always read as `req.headers['mcp-session-id']` (lowercase), set as `Mcp-Session-Id` (mixed case)
**Warning signs:** 400 Bad Request errors after successful initialization

### Pitfall 2: SSE Proxy Buffering
**What goes wrong:** SSE stream appears stuck, messages batch instead of streaming
**Why it happens:** Nginx/reverse proxies buffer responses by default
**How to avoid:** Set `X-Accel-Buffering: no` header, configure `proxy_buffering off` in Nginx
**Warning signs:** Long delays before seeing any SSE events, then burst of messages

### Pitfall 3: Session Leak on Disconnect
**What goes wrong:** Memory grows over time, transport map never shrinks
**Why it happens:** No cleanup on client disconnect or session expiration
**How to avoid:** Implement `transport.onClose()` handler, add session TTL with periodic cleanup
**Warning signs:** Growing memory usage, stale entries in transport map

### Pitfall 4: Zod Version Mismatch
**What goes wrong:** `keyValidator.parse is not a function` runtime errors
**Why it happens:** SDK uses Zod v4 internals, project has incompatible Zod version
**How to avoid:** Ensure zod@^3.25.0 or later, check no duplicate zod versions in node_modules
**Warning signs:** Schema validation errors that don't match expected Zod behavior

### Pitfall 5: Accept Header Validation (SDK 1.25.x)
**What goes wrong:** HTTP 406 Not Acceptable errors on valid requests
**Why it happens:** SDK 1.25.x introduced stricter Accept header validation
**How to avoid:** Client must send `Accept: application/json, text/event-stream`
**Warning signs:** Requests work in older SDK versions but fail after upgrade

## Code Examples

Verified patterns from official sources:

### Complete POST Handler
```typescript
// Source: MCP TypeScript SDK + specification 2025-03-26
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

// Session storage
const transports = new Map<string, StreamableHTTPServerTransport>();
const servers = new Map<string, McpServer>();

export async function handleMcpPost(req: Request, res: Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Existing session
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New initialization
  if (!sessionId && isInitializeRequest(req.body)) {
    const newSessionId = randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    const server = new McpServer({
      name: 'censuschat-mcp-server',
      version: '1.0.0',
    });

    // Register tools
    server.tool('get_information_schema', 'Get database schema', {}, async () => {
      // Implementation
    });

    server.tool('execute_query', 'Execute validated SQL', { query: 'string' }, async (args) => {
      // Implementation
    });

    // Cleanup on disconnect
    transport.onClose = () => {
      transports.delete(newSessionId);
      servers.delete(newSessionId);
    };

    await server.connect(transport);
    transports.set(newSessionId, transport);
    servers.set(newSessionId, server);

    await transport.handleRequest(req, res, req.body);
    return;
  }

  // Invalid request
  res.status(400).json({
    jsonrpc: '2.0',
    error: { code: -32600, message: 'Bad Request: Missing or invalid session' },
    id: null,
  });
}
```

### GET Handler for SSE Stream
```typescript
// Source: MCP specification 2025-03-26
export async function handleMcpGet(req: Request, res: Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Missing or invalid session ID' });
    return;
  }

  const transport = transports.get(sessionId)!;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx buffering

  await transport.handleSseConnection(req, res);
}
```

### DELETE Handler for Session Termination
```typescript
// Source: MCP specification 2025-03-26
export async function handleMcpDelete(req: Request, res: Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing session ID' });
    return;
  }

  if (!transports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const transport = transports.get(sessionId)!;
  const server = servers.get(sessionId);

  await server?.close();
  transports.delete(sessionId);
  servers.delete(sessionId);

  res.status(204).send();
}
```

### Express Router Setup
```typescript
// Source: @modelcontextprotocol/express
import { Router } from 'express';
import { handleMcpPost, handleMcpGet, handleMcpDelete } from './mcpHandlers';

const mcpRouter = Router();

// MCP Streamable HTTP endpoints
mcpRouter.post('/', handleMcpPost);
mcpRouter.get('/', handleMcpGet);
mcpRouter.delete('/', handleMcpDelete);

export { mcpRouter };

// In routes/index.ts
app.use('/mcp', mcpRouter);  // NOT /api/v1/mcp - MCP clients expect /mcp
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| StdioServerTransport | StreamableHTTPServerTransport | SDK 1.10+ | Enables remote clients, multi-client |
| HTTP+SSE transport | Streamable HTTP | Spec 2025-03-26 | Bidirectional via single endpoint |
| In-process tool calls | HTTP JSON-RPC | SDK 1.x | Proper protocol compliance |
| duckdb npm package | @duckdb/node-api | Phase 1 complete | Required for async API |

**Deprecated/outdated:**
- `StdioServerTransport`: Still supported but only for CLI tools, not web servers
- HTTP+SSE transport (2024-11-05 spec): Replaced by Streamable HTTP, maintained for backwards compat
- `SSEServerTransport`: Deprecated, use `StreamableHTTPServerTransport` instead

## Open Questions

Things that couldn't be fully resolved:

1. **@modelcontextprotocol/ext-apps integration timing**
   - What we know: v1.0.1 released, requires UI resources setup
   - What's unclear: Should it be part of Phase 2 or Phase 3?
   - Recommendation: Defer to Phase 3 per REQUIREMENTS.md (MCP-05 vs UI-* split)

2. **Existing mcpServerService.ts vs mcpServer.ts consolidation**
   - What we know: Two parallel implementations exist
   - What's unclear: Which healthcare tool patterns to preserve
   - Recommendation: Keep healthcare tools in `mcp.routes.ts`, migrate core MCP to new HTTP transport

3. **MCP SDK v2 migration path**
   - What we know: v2 expected Q1 2026, 6-month support window for v1.x
   - What's unclear: Breaking changes in v2
   - Recommendation: Pin to `1.25.3`, plan v2 migration as separate phase if needed

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - v1.25.3 release, Express integration
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) - Streamable HTTP protocol details
- [MCP SDK npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - Version history, dependencies

### Secondary (MEDIUM confidence)
- [Koyeb MCP Tutorial](https://www.koyeb.com/tutorials/deploy-remote-mcp-servers-to-koyeb-using-streamable-http-transport) - Production deployment patterns
- [Complete Intro to MCP](https://mcp.holt.courses/lessons/sses-and-streaming-html/streamable-http) - Express implementation walkthrough
- [MCPcat Production Guide](https://mcpcat.io/guides/building-streamablehttp-mcp-server/) - Session management patterns

### Tertiary (LOW confidence)
- [Medium: MCP Security Considerations](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19) - Security best practices
- [Auth0: MCP Security](https://auth0.com/blog/mcp-streamable-http/) - DNS rebinding explanation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK documentation, npm registry
- Architecture: HIGH - MCP specification, TypeScript SDK examples
- Pitfalls: MEDIUM - Mix of official docs and community reports

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable SDK version)

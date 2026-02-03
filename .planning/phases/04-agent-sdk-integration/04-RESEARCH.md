# Phase 4: Agent SDK Integration - Research

**Researched:** 2026-02-03
**Domain:** Claude Agent SDK, Structured Outputs, Multi-Agent Orchestration
**Confidence:** MEDIUM (Agent SDK is new; some features need runtime validation)

## Summary

The Claude Agent SDK (@anthropic-ai/claude-agent-sdk v0.2.30) provides a production-ready framework for building autonomous AI agents with Claude. It wraps Claude Code's capabilities as a library, enabling programmatic agent creation with built-in tools, MCP integration, session management, and structured outputs.

The SDK supports connecting to external MCP servers via HTTP/SSE transport, which aligns with CensusChat's existing MCP HTTP server implementation. Structured outputs use JSON Schema (with Zod integration) to guarantee schema-compliant responses. Multi-agent workflows are supported through subagents defined via the `agents` parameter and invoked through the Task tool.

**Primary recommendation:** Install the Agent SDK, configure it to connect to the existing CensusChat MCP server via HTTP transport, and use Zod schemas for type-safe structured outputs. For document generation, the Agent SDK's Write tool can create files, but native Excel/PDF generation requires custom MCP tools since the SDK doesn't include native spreadsheet/PDF skills.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | 0.2.30 | Agent framework | Official Anthropic SDK, production-ready |
| zod | 3.x | Schema validation | Official integration with Agent SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.64.0 | Direct Claude API | Already installed; SDK uses internally |
| exceljs | ^4.4.0 | Excel generation | Already in project for Excel exports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent SDK | Direct Claude API + custom tool loop | More control, but must implement all orchestration manually |
| Zod schemas | Raw JSON Schema | Zod provides TypeScript type inference |
| Subagents | Parallel Claude API calls | Subagents share context and tools automatically |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── agent/                    # Agent SDK integration
│   ├── agentService.ts       # Main agent query wrapper
│   ├── schemas/              # Zod schemas for structured outputs
│   │   ├── queryResponse.ts  # Query result schema
│   │   └── comparison.ts     # Region comparison schema
│   ├── agents/               # Custom subagent definitions
│   │   └── regionAnalyzer.ts # Parallel region comparison agent
│   └── mcpConfig.ts          # MCP server connection config
├── mcp/                      # Existing MCP server (unchanged)
└── services/
    └── anthropicService.ts   # Existing service (refactor or replace)
```

### Pattern 1: Agent SDK with MCP HTTP Connection
**What:** Connect Agent SDK to existing CensusChat MCP server via HTTP transport
**When to use:** All agent queries requiring census data access
**Example:**
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/mcp
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Query the census database for Medicare eligible seniors in Tampa Bay",
  options: {
    mcpServers: {
      "censuschat": {
        type: "http",
        url: "http://localhost:3001/mcp",
        headers: {
          "Content-Type": "application/json"
        }
      }
    },
    allowedTools: ["mcp__censuschat__*"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

### Pattern 2: Structured Outputs with Zod
**What:** Define response schemas with Zod for type-safe structured outputs
**When to use:** All query responses that need programmatic processing
**Example:**
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/structured-outputs
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const QueryResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.record(z.string(), z.unknown())),
  metadata: z.object({
    rowCount: z.number(),
    hasMore: z.boolean(),
    tables: z.array(z.string()),
    columns: z.array(z.string())
  }),
  explanation: z.string()
});

type QueryResponse = z.infer<typeof QueryResponseSchema>;

for await (const message of query({
  prompt: "Show Medicare eligible seniors in Tampa Bay with income over $75K",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: z.toJSONSchema(QueryResponseSchema)
    },
    mcpServers: { /* ... */ }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    const parsed = QueryResponseSchema.safeParse(message.structured_output);
    if (parsed.success) {
      // Type-safe access to parsed.data
    }
  }
}
```

### Pattern 3: Multi-Region Comparison with Subagents
**What:** Define specialized subagents for parallel region analysis
**When to use:** "Compare Tampa Bay vs Phoenix" type queries
**Example:**
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/subagents
import { query, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

const regionAnalyzer: AgentDefinition = {
  description: "Analyzes demographic data for a specific region",
  prompt: `You are a census data analyst specializing in regional demographics.
    When given a region, query the census database and return key metrics.`,
  tools: ["mcp__censuschat__execute_query"],
  model: "sonnet"
};

for await (const message of query({
  prompt: "Compare Tampa Bay vs Phoenix for Medicare eligible population",
  options: {
    allowedTools: ["mcp__censuschat__*", "Task"],
    agents: {
      "region-analyzer": regionAnalyzer
    }
  }
})) {
  // Claude spawns parallel subagents for each region
}
```

### Pattern 4: Session Resumption for Conversational Context
**What:** Capture session ID and resume for follow-up queries
**When to use:** Multi-turn conversations like "Now filter to income > $75K"
**Example:**
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/sessions
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

// First query
for await (const message of query({
  prompt: "Show seniors in Tampa Bay",
  options: { /* ... */ }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Follow-up with context
for await (const message of query({
  prompt: "Now filter to income > $75K",
  options: {
    resume: sessionId  // Maintains full context
  }
})) {
  // Previous query context available
}
```

### Anti-Patterns to Avoid
- **Creating new sessions for each query:** Wastes context; use session resumption for related queries
- **Not awaiting message stream:** Agent SDK uses async generators; must iterate to completion
- **Including Task in subagent tools:** Subagents cannot spawn their own subagents
- **Using bypassPermissions without validation:** Dangerous in production; always validate agent actions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool execution loop | Custom while loop checking stop_reason | Agent SDK query() | Handles retries, context management, tool orchestration |
| Session management | Custom session store | Agent SDK sessions with resume | Built-in transcript persistence, 30-day retention |
| Schema validation | Manual JSON.parse checks | Zod + outputFormat | Constrained decoding guarantees valid JSON |
| Parallel agent execution | Promise.all with multiple API calls | Subagents via Task tool | Automatic coordination, shared context |

**Key insight:** The Agent SDK handles the agentic loop, context management, and tool execution. Don't reimplement what's built-in.

## Common Pitfalls

### Pitfall 1: MCP Tool Permission Not Granted
**What goes wrong:** Claude sees MCP tools but won't use them
**Why it happens:** MCP tools require explicit permission via allowedTools
**How to avoid:** Always include `allowedTools: ["mcp__servername__*"]` or specific tool names
**Warning signs:** Agent says "I can see tools are available but cannot access them"

### Pitfall 2: Structured Output Schema Too Complex
**What goes wrong:** Agent fails to produce valid output after multiple retries
**Why it happens:** Deeply nested schemas with many required fields are hard to satisfy
**How to avoid:** Keep schemas focused, make optional fields truly optional, match schema to task
**Warning signs:** `error_max_structured_output_retries` in result message

### Pitfall 3: Session Context Loss
**What goes wrong:** Follow-up queries don't reference prior context
**Why it happens:** New session created instead of resuming existing one
**How to avoid:** Capture session_id from init message, pass via `resume` option
**Warning signs:** Agent asks for context that was already provided

### Pitfall 4: Agent SDK Requires Claude Code Runtime
**What goes wrong:** SDK fails with "Claude Code not found"
**Why it happens:** Agent SDK uses Claude Code as its runtime, not just the API
**How to avoid:** Install Claude Code CLI before using SDK: `curl -fsSL https://claude.ai/install.sh | bash`
**Warning signs:** Error on first query()

### Pitfall 5: Excel/PDF Generation Expectations
**What goes wrong:** Expecting native Excel/PDF skills that don't exist
**Why it happens:** Requirements mention "native skill" but Agent SDK Write tool only creates text files
**How to avoid:** Create custom MCP tools wrapping ExcelJS/pdfkit, or use existing excelExportService
**Warning signs:** Agent says it cannot generate Excel files directly

## Code Examples

Verified patterns from official sources:

### Basic Agent Query with MCP
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/quickstart
import { query } from "@anthropic-ai/claude-agent-sdk";

async function queryCensus(prompt: string): Promise<string> {
  let result = "";

  for await (const message of query({
    prompt,
    options: {
      mcpServers: {
        "censuschat": {
          type: "http",
          url: process.env.MCP_SERVER_URL || "http://localhost:3001/mcp"
        }
      },
      allowedTools: ["mcp__censuschat__execute_query", "mcp__censuschat__get_information_schema"],
      permissionMode: "acceptEdits"  // Auto-approve in trusted environment
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      result = message.result;
    }
  }

  return result;
}
```

### Detecting Subagent Invocation
```typescript
// Source: platform.claude.com/docs/en/agent-sdk/subagents
for await (const message of query({
  prompt: "Use the region-analyzer to compare two markets",
  options: { /* ... */ }
})) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if (block.type === "tool_use" && block.name === "Task") {
        console.log(`Subagent invoked: ${block.input.subagent_type}`);
      }
    }
  }

  // Messages from subagents have parent_tool_use_id
  if ("parent_tool_use_id" in message && message.parent_tool_use_id) {
    console.log("(running inside subagent)");
  }
}
```

### Excel Generation via Custom MCP Tool
```typescript
// Not a native Agent SDK skill - requires custom MCP tool
// Register in mcpServer.ts alongside existing tools

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

registerAppTool(
  server,
  "generate_excel_report",
  {
    description: "Generate an Excel report from query results",
    inputSchema: {
      data: z.array(z.record(z.string(), z.unknown())),
      filename: z.string().optional(),
      includeMetadata: z.boolean().optional()
    }
  },
  async (args) => {
    const excelService = new ExcelExportService();
    const result = await excelService.exportToExcel(
      { success: true, data: args.data, metadata: { /* ... */ } },
      { options: { includeMetadata: args.includeMetadata ?? true, maxRows: 100000 } }
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Code SDK | Claude Agent SDK | Jan 2026 | Renamed, broader agent focus |
| Direct API tool loops | Agent SDK query() | 2025-2026 | Automatic orchestration |
| Manual JSON parsing | Structured outputs | Nov 2025 | Constrained decoding guarantees |
| Custom session storage | SDK sessions | 2025 | 30-day transcript persistence |

**Deprecated/outdated:**
- `@anthropic-ai/claude-code-sdk`: Renamed to `@anthropic-ai/claude-agent-sdk`
- Manual tool execution loops: SDK handles this natively
- Beta header for structured outputs: No longer required as of GA release

## Open Questions

Things that couldn't be fully resolved:

1. **Native Excel/PDF Skills**
   - What we know: Agent SDK has Write tool for text files; no native spreadsheet/PDF
   - What's unclear: Whether future versions will add these skills
   - Recommendation: Create custom MCP tools wrapping existing ExcelJS/pdfkit services

2. **Agent SDK Runtime Requirement**
   - What we know: Requires Claude Code CLI installed as runtime
   - What's unclear: Impact on Docker deployment, whether standalone mode exists
   - Recommendation: Test in Docker during implementation; may need Claude Code in image

3. **Parallel Subagent Limits**
   - What we know: Max 10 concurrent Tasks/subagents; context loads ~20K tokens per subagent
   - What's unclear: Optimal parallelization for region comparisons
   - Recommendation: Start with 2-3 parallel regions, measure token usage

4. **Commercial Licensing Clarity**
   - What we know: Governed by Anthropic Commercial Terms of Service
   - What's unclear: Specific pricing implications for SDK vs raw API usage
   - Recommendation: Review Anthropic ToS before production deployment (noted as blocker in STATE.md)

## Sources

### Primary (HIGH confidence)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Architecture, capabilities, installation
- [Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) - Basic usage patterns
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) - Full API documentation
- [Structured Outputs (Agent)](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) - Zod integration, outputFormat
- [Structured Outputs (API)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) - JSON schema constraints
- [MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp) - HTTP/SSE transport, tool permissions
- [Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents) - Multi-agent patterns, Task tool
- [Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) - Resume, fork, context persistence

### Secondary (MEDIUM confidence)
- [GitHub TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript) - Version 0.2.30 confirmed
- npm registry - Version 0.2.30 verified via `npm view`

### Tertiary (LOW confidence)
- WebSearch results about multi-agent patterns - Community patterns, not official docs
- "Native skills" terminology - May be marketing; no official Excel/PDF skill documentation found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Anthropic SDK with active development
- Architecture: MEDIUM - Patterns from official docs, but integration with existing CensusChat MCP untested
- Pitfalls: MEDIUM - Derived from documentation warnings and community patterns

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - SDK is fast-moving; check for updates)

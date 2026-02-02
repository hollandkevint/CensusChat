# Migration Pitfalls: CensusChat Modernization

**Domain:** MCP Apps + DuckDB 1.4 Encryption + Agent SDK Migration
**Researched:** 2026-02-01
**Overall confidence:** MEDIUM-HIGH (verified against official documentation)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or extended downtime.

### Pitfall 1: DuckDB Encryption Requires Full Database Copy

**What goes wrong:** Teams assume they can "enable encryption" on an existing database. DuckDB 1.4 has no in-place encryption conversion. You must create a new encrypted database and copy all data.

**Why it happens:** Documentation says "encryption is supported" without emphasizing the migration path. Developers discover this late when planning production cutover.

**Consequences:**
- With 239K+ block groups (CensusChat's dataset), `COPY FROM DATABASE` takes significant time
- Downtime window larger than expected
- Potential data inconsistency if source changes during copy
- Storage requirements double temporarily (old + new database)

**Prevention:**
1. Plan explicit migration window with read-only mode for source database
2. Test copy duration with production data size first
3. Script the migration:
   ```sql
   LOAD httpfs;  -- Critical for OpenSSL hardware acceleration
   ATTACH 'new_encrypted.duckdb' AS encrypted (ENCRYPTION_KEY 'your-key');
   ATTACH 'census.duckdb' AS unencrypted;
   USE unencrypted;
   COPY FROM DATABASE unencrypted TO encrypted;
   ```
4. Validate row counts match after copy

**Detection:** Migration scripts that don't include `COPY FROM DATABASE` or assume ALTER TABLE operations

**Phase mapping:** Should be Phase 1 focus with dedicated spike for timing

**Confidence:** HIGH (verified via [DuckDB 1.4 encryption docs](https://duckdb.org/2025/11/19/encryption-in-duckdb))

---

### Pitfall 2: Node.js DuckDB Package Deprecation

**What goes wrong:** Teams stay on `duckdb` npm package and discover it's deprecated with no updates after DuckDB 1.4.x series. Project stuck on old DuckDB version or faces emergency migration.

**Why it happens:** The deprecation timeline is aggressive. `duckdb` package receives no updates for DuckDB 1.5.x (early 2026). CensusChat currently uses `duckdb: ^1.3.2`.

**Consequences:**
- Security vulnerabilities unfixed (September 2025 npm supply chain attack already affected DuckDB packages)
- Can't use DuckDB 1.5+ features
- Eventually: no bug fixes
- Forced migration under pressure

**Prevention:**
1. Migrate from `duckdb` to `@duckdb/node-api` as part of 1.4 upgrade
2. API is completely different (not a drop-in replacement):
   - Old: SQLite-style callback API with `duckdb-async` wrapper
   - New: Native Promise support, DuckDB-specific API
3. Update all query code patterns:
   ```typescript
   // OLD (current CensusChat pattern)
   const db = new duckdb.Database('census.duckdb');
   const data = await db.all('SELECT * FROM county_data');

   // NEW (@duckdb/node-api)
   const instance = await DuckDBInstance.create('census.duckdb');
   const connection = await instance.connect();
   const result = await connection.run('SELECT * FROM county_data');
   const data = result.getRowsJson();
   ```
4. Complex types require explicit constructors (`listValue()`, `dateValue()`)

**Detection:** `package.json` still shows `"duckdb"` dependency instead of `"@duckdb/node-api"`

**Phase mapping:** Must happen alongside or before encryption migration

**Confidence:** HIGH (verified via [DuckDB Node Neo docs](https://duckdb.org/docs/stable/clients/node_neo/overview) and [npm deprecation notice](https://www.npmjs.com/package/duckdb))

---

### Pitfall 3: Agent SDK Default Behavior Change Breaks Existing Prompts

**What goes wrong:** Migrating from `@anthropic-ai/sdk` query patterns to Agent SDK, the system prompt and settings behavior completely changes. Existing prompts produce different results.

**Why it happens:** Agent SDK v0.1.0 introduced breaking changes:
- Claude Code system prompt is **no longer included by default**
- Filesystem settings (`CLAUDE.md`, `settings.json`) **no longer loaded by default**
- `custom_system_prompt` and `append_system_prompt` merged into single `system_prompt`

**Consequences:**
- Agent behavior completely different without explicit configuration
- CensusChat's anthropicService.ts prompt engineering may not transfer
- CLAUDE.md project instructions ignored unless explicitly loaded
- CI/CD environments behave differently than local development

**Prevention:**
1. Explicitly configure system prompt when migrating:
   ```typescript
   // To restore Claude Code behavior:
   const result = query({
     prompt: userQuery,
     options: {
       systemPrompt: { type: "preset", preset: "claude_code" },
       settingSources: ["user", "project", "local"]  // Restore filesystem settings
     }
   });
   ```
2. Or migrate to custom system prompt:
   ```typescript
   const result = query({
     prompt: userQuery,
     options: {
       systemPrompt: "You are a census data analyst. Generate SQL queries..."
     }
   });
   ```
3. Audit all `anthropicService.ts` prompt logic before migration
4. Create parallel test suite comparing old vs new SDK outputs

**Detection:** Agent responses suddenly generic or missing context that worked before

**Phase mapping:** Agent SDK migration should be separate phase from MCP Apps

**Confidence:** HIGH (verified via [official migration guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide))

---

### Pitfall 4: MCP Apps Security Model Incomplete

**What goes wrong:** Implementing MCP Apps UI without proper iframe sandboxing, leading to security vulnerabilities in a healthcare-adjacent application.

**Why it happens:** MCP Apps is new (January 2026). Security model has multiple layers that are easy to skip:
- Iframe sandboxing (mandatory)
- Pre-declared templates
- User consent requirements
- CSP configuration

Research shows 5.5% of MCP servers have tool poisoning vulnerabilities and 33% allow unrestricted network access.

**Consequences:**
- UI code can escape sandbox if improperly configured
- External resources blocked by default (images, fonts, scripts)
- HIPAA/security compliance concerns for healthcare data
- Anthropic's July/August 2025 filesystem MCP vulnerabilities demonstrate real risk

**Prevention:**
1. Never bypass iframe sandbox restrictions
2. Configure CSP headers properly:
   ```javascript
   // Host must whitelist MCP Apps domain
   Content-Security-Policy: frame-src 'self' https://mcp-apps-origin.com;
   ```
3. Implement user consent for tool invocations returning UI
4. Audit all MCP servers before connecting (read the source code)
5. Block external resources unless explicitly required

**Detection:** UI renders without proper `sandbox` attribute on iframe, or CSP violations in browser console

**Phase mapping:** MCP Apps should be Phase 3+ after core migration stabilizes

**Confidence:** MEDIUM-HIGH (verified via [MCP Apps spec](https://modelcontextprotocol.io/docs/extensions/apps) and [security research](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls))

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or partial functionality.

### Pitfall 5: DuckDB Encryption Performance Without OpenSSL

**What goes wrong:** Encryption runs 5-10x slower than expected because mbedtls is used instead of OpenSSL.

**Why it happens:** DuckDB can use built-in mbedtls or OpenSSL via httpfs extension. OpenSSL provides hardware acceleration (AES-NI). Without loading httpfs, performance degrades significantly.

**Prevention:**
1. Always load httpfs before encryption operations:
   ```sql
   LOAD httpfs;  -- Enables OpenSSL hardware acceleration
   ATTACH 'encrypted.duckdb' (ENCRYPTION_KEY 'key');
   ```
2. Benchmark with production query patterns
3. AES-GCM-256 is more secure but slower than AES-CTR-256

**Detection:** Query latency significantly increases after encryption enabled

**Phase mapping:** Part of encryption migration testing

**Confidence:** HIGH (verified via [DuckDB encryption docs](https://duckdb.org/2025/11/19/encryption-in-duckdb))

---

### Pitfall 6: MCP SDK v2 Coming Q1 2026

**What goes wrong:** Building against MCP SDK v1.x, then discovering v2 ships with breaking changes mid-project.

**Why it happens:** Both TypeScript and Python MCP SDKs anticipate stable v2 release in Q1 2026. Current CensusChat uses `@modelcontextprotocol/sdk: ^1.0.4`.

**Consequences:**
- Potential second migration if v2 has breaking changes
- v1.x continues receiving bug fixes for 6 months after v2 ships
- MCP Apps may require v2 features

**Prevention:**
1. Pin exact versions, not ranges: `"@modelcontextprotocol/sdk": "1.0.4"` not `"^1.0.4"`
2. Monitor [MCP changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog) for v2 details
3. Design migration with v2 compatibility in mind
4. Transport changes are architectural but SDKs aim to minimize breaking changes

**Detection:** Using semver ranges (`^1.x`) that could auto-upgrade

**Phase mapping:** Consider timing roadmap around Q1 2026 MCP v2 release

**Confidence:** MEDIUM (based on [official blog](https://blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update/))

---

### Pitfall 7: MCP JSON-RPC Batching Removed

**What goes wrong:** Code relies on JSON-RPC batching for performance, which was removed in MCP 2025-06-18 specification.

**Why it happens:** MCP spec evolution. Batching was introduced in 2025-03-26 but removed in 2025-06-18 for simplification.

**Prevention:**
1. Audit mcpServer.ts for batched request handling
2. Refactor to individual requests if batching was used
3. Use concurrent individual requests for similar performance

**Detection:** MCP protocol errors when upgrading SDK

**Phase mapping:** Check during MCP SDK upgrade

**Confidence:** HIGH (verified via [MCP changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog))

---

### Pitfall 8: DuckDB 1.4 CTE Materialization Change

**What goes wrong:** Query performance characteristics change because CTEs now materialize by default.

**Why it happens:** DuckDB 1.4 changed CTE behavior. Queries that relied on CTE inlining for optimization may perform differently.

**Prevention:**
1. Run full test suite after upgrade
2. Review queries with CTEs in validation layer
3. Use explicit `MATERIALIZED` or `NOT MATERIALIZED` hints if needed:
   ```sql
   WITH cte AS MATERIALIZED (SELECT ...)
   -- or
   WITH cte AS NOT MATERIALIZED (SELECT ...)
   ```

**Detection:** Query performance regression in specific patterns

**Phase mapping:** Part of DuckDB upgrade testing

**Confidence:** MEDIUM (mentioned in multiple sources, not deeply documented)

---

### Pitfall 9: Agent SDK Skills Migration from ExcelJS

**What goes wrong:** Attempting to migrate ExcelJS export functionality to Agent SDK skills, but skills aren't designed as library replacements.

**Why it happens:** Agent SDK skills (xlsx, pdf, pptx, docx) are source-available but "provided for demonstration and educational purposes only." They're not a drop-in ExcelJS replacement.

**Prevention:**
1. Skills are for agent-driven document creation, not programmatic generation
2. Keep ExcelJS for API-driven exports
3. Use skills only when Claude is generating documents autonomously
4. Don't mix paradigms: exports triggered by API stay library-based

**Detection:** Trying to call skill APIs from service code instead of agent context

**Phase mapping:** Skills are optional enhancement, not core migration

**Confidence:** MEDIUM (skills are new, documentation sparse, source-available but not open source)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 10: MCP Apps Framework Lock-in Confusion

**What goes wrong:** Choosing a UI framework for MCP Apps that doesn't match team expertise, thinking it's locked in.

**Reality:** MCP Apps supports React, Vue, Svelte, Preact, Solid, and Vanilla JS. Same app can be built with different frameworks. Pick what you know.

**Prevention:** Use team's existing React expertise since CensusChat frontend is already React/Next.js

**Phase mapping:** Decision point when starting MCP Apps phase

**Confidence:** HIGH (verified via official docs)

---

### Pitfall 11: DuckDB Encryption Not Yet NIST Compliant

**What goes wrong:** Promising NIST-compliant encryption to stakeholders when DuckDB encryption doesn't meet official NIST requirements yet.

**Prevention:**
1. Track [issue #20162](https://github.com/duckdb/duckdb/issues/20162) for NIST compliance progress
2. Document limitation for compliance teams
3. CVE-2025-64429 was addressed in 1.4.2 - ensure using 1.4.2+

**Phase mapping:** Documentation/communication during planning

**Confidence:** HIGH (explicitly stated in DuckDB docs)

---

### Pitfall 12: Agent SDK Package Name Confusion

**What goes wrong:** Installing wrong package. Multiple names in ecosystem:
- `@anthropic-ai/claude-agent-sdk` (correct for Node.js)
- `claude-agent-sdk` (correct for Python)
- `@anthropic-ai/claude-code` (deprecated)
- `@anthropic-ai/sdk` (base SDK, different purpose)

**Prevention:** Use correct package for language, verify in official docs

**Phase mapping:** N/A - setup step

**Confidence:** HIGH (verified via official docs)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DuckDB 1.4 Upgrade | Package deprecation (#2) | Migrate to @duckdb/node-api simultaneously |
| DuckDB Encryption | No in-place conversion (#1) | Plan COPY FROM DATABASE with downtime window |
| DuckDB Encryption | Performance regression (#5) | Always LOAD httpfs for OpenSSL acceleration |
| MCP SDK Upgrade | JSON-RPC batching removed (#7) | Audit for batch usage before upgrade |
| MCP Apps | Security model gaps (#4) | Implement all sandbox layers, audit servers |
| Agent SDK | Default behavior change (#3) | Explicitly configure systemPrompt and settingSources |
| Agent SDK | Skills misconception (#9) | Keep ExcelJS for programmatic exports |
| Timeline | MCP v2 release (#6) | Pin versions, monitor changelog |

---

## Sources

**DuckDB:**
- [DuckDB 1.4.0 Announcement](https://duckdb.org/2025/09/16/announcing-duckdb-140)
- [Data-at-Rest Encryption](https://duckdb.org/2025/11/19/encryption-in-duckdb)
- [Node.js Client Neo](https://duckdb.org/docs/stable/clients/node_neo/overview)
- [npm Security Advisory GHSA-w62p-hx95-gf2c](https://github.com/duckdb/duckdb-node/security/advisories/GHSA-w62p-hx95-gf2c)

**MCP:**
- [MCP Key Changes Changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog)
- [MCP Apps Blog Post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [MCP Apps Extension Repo](https://github.com/modelcontextprotocol/ext-apps)
- [January 2026 Core Maintainer Update](https://blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update/)
- [MCP Security Risks Analysis](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)

**Agent SDK:**
- [Migration Guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent Skills Documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

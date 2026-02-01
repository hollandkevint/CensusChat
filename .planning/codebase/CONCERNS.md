# Codebase Concerns

**Analysis Date:** 2026-02-01

## Tech Debt

**Type Safety - Widespread `any` Types:**
- Issue: 97+ instances of `as any`, `any[]`, and untyped parameters across backend. Undermines TypeScript type checking for complex data transformations.
- Files: `backend/src/validation/sqlValidator.ts` (lines 188, 206, 267), `backend/src/services/anthropicService.ts` (line 38, 225), `backend/src/services/mcpServerService.ts` (lines 275, 286, 316), `backend/src/services/mcpHealthcareService.ts` (lines 38, 454, 566, 594), `backend/src/data-loading/validation/DataValidationService.ts` (line 37)
- Impact: Increases risk of runtime errors, makes refactoring difficult, complicates code review. The AST manipulation in sqlValidator especially vulnerable to type mismatches.
- Fix approach: Incrementally create proper types for parser AST objects, MCP tool parameters, and API responses. Start with critical paths: SQL validation and query execution.

**SQL Parser Dependency on Untyped AST:**
- Issue: `node-sql-parser` library AST is cast as `any` throughout validation layer. Complex property extraction (lines 210-260 in sqlValidator) relies on duck typing.
- Files: `backend/src/validation/sqlValidator.ts` (extractTables, extractColumns, extractLimit methods)
- Impact: Parser version upgrades or schema changes could silently break validation without compile errors. Column extraction handles deeply nested object structures without type guards.
- Fix approach: Create explicit interfaces matching parser's actual AST structure. Add runtime assertions before property access. Test against parser version changes.

**Missing Connection Pool TODO:**
- Issue: DataLoadingOrchestrator has placeholder comment `// TODO: Get from database manager` (line 346)
- Files: `backend/src/data-loading/orchestration/DataLoadingOrchestrator.ts` (line 346)
- Impact: Hardcoded empty array may mask connection state issues during data loading operations.
- Fix approach: Wire up actual connection pool stats from ConcurrentDuckDBManager.

**Frontend Authentication Gap:**
- Issue: JWT authentication header marked TODO (line 36 in queryApi.ts)
- Files: `frontend/src/lib/api/queryApi.ts` (line 36)
- Impact: All frontend queries sent unauthenticated. Current validation only on backend. If frontend validation is added before auth, creates security inconsistency.
- Fix approach: Implement JWT token acquisition (via auth service) and include in all API calls. Establish clear auth flow documentation.

---

## Known Bugs

**Anthropic Response Parsing Fragility:**
- Symptoms: JSON extraction from Claude responses uses regex fallback (line 159 in anthropicService.ts). If response contains unrelated JSON or malformed structure, parsing can succeed with wrong data.
- Files: `backend/src/services/anthropicService.ts` (lines 152-162)
- Trigger: Run query that results in Claude response with multiple JSON objects or nested structures. The regex `\{[\s\S]*\}` will match the first `{` to last `}`.
- Workaround: Wrap entire response in outer JSON object in prompt. Validate response schema before returning.
- Root cause: Relying on unstructured text parsing instead of structured tool use or JSON mode.

**Census API Response Parsing Index Fragility:**
- Symptoms: Column index detection assumes header presence (lines 29-34 in censusDataLoader.ts). Missing headers return -1, causing wrong data extraction.
- Files: `backend/src/utils/censusDataLoader.ts` (lines 19-90)
- Trigger: Change Census API response format, add/remove columns, or call different endpoint with different schema.
- Workaround: Log headers and validate indices before row processing. Add strict assertions for required columns.
- Root cause: Sequential index detection without schema validation or defensive checks.

**Cache Timeout Race Condition:**
- Symptoms: Cache timeouts (1-2 seconds) in cacheService can reject valid operations if Redis is slow. Multiple setTimeout() calls at different intervals.
- Files: `backend/src/services/cacheService.ts` (lines 140, 166, 210)
- Trigger: High load on Redis, slow network, or many concurrent cache operations.
- Workaround: Increase timeout values, but masks underlying performance issue.
- Root cause: Fixed timeout without adaptive backoff or health-based adjustment.

---

## Security Considerations

**SQL Injection in Fallback Validation Path:**
- Risk: sqlValidator.validateSQL() can return invalid=true but still include extracted tables/columns. If downstream code uses these without re-validating, risk of bypass.
- Files: `backend/src/validation/sqlValidator.ts` (lines 149-156)
- Current mitigation: MCP server re-validates before execution. SQL is not executed if validation fails.
- Recommendations:
  1. Mark tables/columns as nullable when validation fails
  2. Add explicit validation gate before query execution
  3. Document validation layers clearly for future developers

**Console Logging of Sensitive Data:**
- Risk: Extensive console.log statements throughout MCP and query services log partial SQL, parameters, and API responses. Could leak data in production logs.
- Files: `backend/src/mcp/mcpClient.ts` (30+ console.log calls), `backend/src/mcp/mcpServer.ts`, `backend/src/services/anthropicService.ts` (line 30 logs query)
- Current mitigation: Logging level controlled by environment. Logs truncated to 100 chars.
- Recommendations:
  1. Use proper logging framework (winston, pino) with levels (error, warn, info, debug)
  2. Never log raw SQL or user queries in production
  3. Sanitize Anthropic responses before logging (remove data samples)
  4. Document what is safe to log at each level

**Null Safety in MCP Tool Parameter Validation:**
- Risk: mcpHealthcareService.validateToolParameters() (lines 566-587) checks required params but doesn't validate param types. Tool calls with wrong types proceed through.
- Files: `backend/src/services/mcpHealthcareService.ts` (lines 566-587)
- Current mitigation: Tools reject invalid params at execution time.
- Recommendations:
  1. Add type checking for each parameter (string, number, array, object)
  2. Validate array/object contents match schema
  3. Add examples to tool definitions for validation reference

**Incomplete Environment Variable Validation:**
- Risk: Anthropic service checks for placeholder API key but other services don't. Missing POSTGRES_HOST, REDIS_HOST, DUCKDB_PATH silently use defaults.
- Files: `backend/src/services/anthropicService.ts` (lines 36-40)
- Current mitigation: Demo mode gracefully degrades. Defaults may work locally but fail in production.
- Recommendations:
  1. Create config validation on startup (Zod schema matching all env vars)
  2. Fail fast with clear error messages for missing production vars
  3. Distinguish between required (prod), optional, and demo-mode vars

---

## Performance Bottlenecks

**Large File Exports to Memory:**
- Problem: excelExportService reads entire result set into ExcelJS workbook in memory before writing file (line 519 in excelExportService.ts).
- Files: `backend/src/services/excelExportService.ts` (lines 400-530)
- Cause: ExcelJS requires all rows loaded before file creation. No streaming option used.
- Impact: Queries returning 50K+ rows (block group data) could OOM or timeout. Excel test notes "memory pressure" (test line 243).
- Improvement path:
  1. Batch write to CSV instead of Excel for large datasets (>10K rows)
  2. Stream Excel file creation row-by-row using xlsx-stream
  3. Add data size check: warn user if >20K rows, block if >100K rows
  4. Implement pagination in export UI

**DuckDB Connection Pool Initialization Sequential:**
- Problem: ConcurrentDuckDBManager creates 70% readers + 30% writers sequentially in a loop (lines 87-96). Each awaits independently.
- Files: `backend/src/data-loading/database/ConcurrentDuckDBManager.ts` (lines 80-100)
- Cause: Using for loop with await instead of Promise.all()
- Impact: Startup time scales linearly with connection count. 10 connections = 10 sequential DB opens.
- Improvement path:
  1. Use Promise.all() for reader and writer pool initialization
  2. Measure actual startup time vs. pool size
  3. Consider lazy initialization for less-used writer connections

**Healthcare Module Template Generation File I/O:**
- Problem: ModuleTemplateGenerator writes generated code files synchronously without batching (lines 98, 104, 110, 116 in ModuleTemplateGenerator.ts). Each file write is individual fs.promises.writeFile call.
- Files: `backend/src/modules/healthcare_analytics/core/ModuleTemplateGenerator.ts` (lines 89-145)
- Cause: Sequential file writes in loops across multiple directories.
- Impact: Generating new analytics modules (10+ files, 10+ directories) could block event loop for seconds.
- Improvement path:
  1. Batch file writes with Promise.all()
  2. Add progress tracking for code generation
  3. Consider template compilation to reduce per-file work

**Unindexed History Array in Query Times:**
- Problem: queryTimes array in ConcurrentDuckDBManager grows unbounded (line 61), only capped at maxQueryTimeHistory=1000 when calculating stats.
- Files: `backend/src/data-loading/database/ConcurrentDuckDBManager.ts` (lines 61-62)
- Cause: Array.push() for every query without memory-aware limiting.
- Impact: Long-running servers accumulate 1000+ entries. Calculating averageQueryTime is O(n) scan.
- Improvement path:
  1. Implement sliding window: only keep last 1000 entries, discard oldest
  2. Use circular buffer for O(1) insertion
  3. Consider exponential moving average instead of mean (more responsive to current conditions)

---

## Fragile Areas

**SQL Validation Against Unknown Parser Versions:**
- Files: `backend/src/validation/sqlValidator.ts` (entire file)
- Why fragile: Tightly coupled to node-sql-parser's AST structure. Column extraction code (lines 208-261) makes assumptions about nested object shapes that aren't documented in type definitions.
- Safe modification:
  1. Add unit tests for each parser version used
  2. Test against real SQL patterns from CLAUDE.md examples
  3. Document AST structure assumptions in comments
- Test coverage: sqlValidator has integration tests but AST handling logic needs additional unit tests for edge cases (aggregate functions with nested selects, CTEs).

**Anthropic Service Fallback Mode Global State:**
- Files: `backend/src/services/anthropicService.ts` (entire class)
- Why fragile: Single anthropicService instance. If API key is missing, falls back to mock responses. No way to know at runtime if production mode is active. Tests that use fallback may not catch real API failures.
- Safe modification:
  1. Separate demo mode detection into explicit flag
  2. Add warnings when running in demo mode (log once on startup)
  3. Fail tests explicitly if Anthropic key is missing (don't silently fall back)
- Test coverage: generateFollowUpQuestions() silently returns hardcoded array in demo mode.

**Census Data Loading with Incomplete Validation:**
- Files: `backend/src/utils/censusDataLoader.ts`, `backend/src/data-loading/validation/DataValidationService.ts`
- Why fragile: parseApiResponse() assumes specific column ordering and names (lines 29-34). DataValidationService has untyped `any[]` parameter (line 37). If Census API adds columns or changes format, silent data corruption is possible.
- Safe modification:
  1. Add strict schema validation before any processing
  2. Log discrepancies (missing/extra columns) with record samples
  3. Add test cases for API response variations
- Test coverage: No tests for API format changes or missing columns.

**MCP Healthcare Service Tool Execution without Type Checking:**
- Files: `backend/src/services/mcpHealthcareService.ts` (entire service)
- Why fragile: executeTool() accepts string tool name and any parameters (line 454). If tool name is misspelled or parameters wrong shape, caught at execution time, not earlier.
- Safe modification:
  1. Create strict types for each tool name (discriminated union)
  2. Create parameter schemas for each tool
  3. Validate parameters match tool definition before handler execution
- Test coverage: Has some parameter validation tests but doesn't verify all tools' parameter schemas.

**Frontend API Error Handling Oversimplified:**
- Files: `frontend/src/lib/api/queryApi.ts` (entire file)
- Why fragile: Catches fetch errors and returns generic NETWORK_ERROR. Doesn't distinguish between timeout, DNS failure, connection refused, etc. Client can't determine if retry is appropriate.
- Safe modification:
  1. Distinguish between retryable (timeout, 5xx, transient network) and non-retryable errors (4xx, auth)
  2. Add exponential backoff for retries
  3. Document retry behavior in API error type
- Test coverage: No tests for various error conditions.

---

## Scaling Limits

**DuckDB Single Process per Node:**
- Current capacity: Single DuckDB instance per backend pod. Block group dataset (239K rows) fits in memory but concurrent queries can compete for I/O.
- Limit: Performance degrades significantly with >5 concurrent analytics queries. No horizontal scaling of query execution.
- Scaling path:
  1. Evaluate read replicas (DuckDB supports read-only connections)
  2. Consider columnar data warehouse (Clickhouse, Databricks) for datasets >10GB
  3. Implement query result caching more aggressively (Redis caching of common queries)

**Redis Cache Without Eviction Policy:**
- Current capacity: Cache grows unbounded. No TTL set on default keys.
- Limit: Redis memory fills up, LRU eviction kicks in, unpredictable cache hit rates.
- Scaling path:
  1. Set explicit TTL on all cache keys (e.g., 1 hour for demographics queries)
  2. Implement cache eviction policy (ALLKEYS_LRU)
  3. Monitor cache stats - log when evictions exceed 5% of operations

**File Export Temporary Storage:**
- Current capacity: Exported Excel/PDF files stored in `/tmp` with scheduled cleanup.
- Limit: Concurrent exports of large datasets could fill disk. scheduleFileCleanup (line 473) deletes after delay, but race conditions possible if cleanup interval is long.
- Scaling path:
  1. Use streaming exports or cloud storage (S3) for large files
  2. Add cleanup scheduled job that runs every 5 minutes, not per-file
  3. Monitor `/tmp` disk usage, alert if >80% full

**API Rate Limiting Not Visible in Code:**
- Current capacity: No explicit rate limiting on query endpoint. Relies on infrastructure level.
- Limit: Single user can DOS the system with rapid queries.
- Scaling path:
  1. Implement token bucket rate limiting per API key (e.g., 10 queries/minute)
  2. Add rate limit headers to responses
  3. Document rate limits in API docs

---

## Dependencies at Risk

**node-sql-parser - No Community Maintenance:**
- Risk: Package has infrequent updates. Last commit 6 months ago. AST structure not guaranteed stable.
- Impact: SQL validation could break if parser has bugs or if application needs to support new SQL syntax.
- Migration plan:
  1. Monitor issue tracker and consider switching to pgsql-parser (more actively maintained, PostgreSQL-compatible)
  2. Add comprehensive tests for all SQL patterns used
  3. Consider building minimal custom validator for SELECT-only restriction (10% of complexity, 100% of coverage)

**Anthropic SDK Version Pinning:**
- Risk: SDK version ^0.64.0 allows patch updates. Breaking changes could be introduced in minor versions.
- Impact: Response format changes, new required fields, or deprecated methods could break service.
- Mitigation plan:
  1. Pin to exact version (0.64.0) until major version bump
  2. Test SDK upgrades in staging before applying to production
  3. Create compatibility layer if API changes occur

**DuckDB Native Binding:**
- Risk: DuckDB npm package (1.3.2) requires native compilation. Platform-specific binary required.
- Impact: Docker image builds could fail on different architectures. Dev machine (Apple Silicon) vs. CI (AMD64) mismatch.
- Mitigation plan:
  1. Use multi-stage Docker build with explicit platform specification
  2. Test database operations in CI on exact target architecture
  3. Document platform requirements in README

---

## Missing Critical Features

**Audit Logging for Queries:**
- Problem: No comprehensive audit trail of what queries users run or what data was accessed. Logs are console-based only.
- Blocks: Compliance audits, security incident investigation, usage analytics.
- Current state: SQL audit log mentioned in CLAUDE.md but not implemented (`backend/logs/sql-audit.log`).
- Implementation path:
  1. Create audit log table in PostgreSQL with timestamps, user_id, query, result_count, execution_time
  2. Log all successful queries before returning results
  3. Implement retention policy (30 days default)

**Query Execution Tracing:**
- Problem: No distributed tracing across MCP server, DuckDB, and API response. Can't correlate slow queries to root cause.
- Blocks: Performance debugging, SLA monitoring, capacity planning.
- Current state: Basic timing exists but no context propagation across services.
- Implementation path:
  1. Add OpenTelemetry spans for query validation, execution, export
  2. Use correlation IDs to link logs
  3. Export spans to Jaeger or cloud tracing service

**User Preferences and Saved Queries:**
- Problem: No way for users to save common queries or set preferences (default format, preferred geographies).
- Blocks: Improving UX, building analytics on usage patterns.
- Current state: Only demo mode, no persistence of user state.
- Implementation path:
  1. Create users table with auth integration (currently no user context)
  2. Add saved_queries table linking queries to users
  3. Implement query templates/favorites UI

---

## Test Coverage Gaps

**SQL Validation Edge Cases Untested:**
- What's not tested: Complex CTEs, window functions, CASE statements, aggregate nesting, JOIN variations
- Files: `backend/src/validation/sqlValidator.ts`
- Risk: Security bypass by using SQL features that parser doesn't handle correctly
- Priority: High - affects security layer
- Test approach:
  1. Generate test suite from OWASP SQL injection patterns
  2. Test each allowed column with WHERE conditions
  3. Test parsing edge cases: trailing semicolons, comments, unicode

**Excel Export Large Dataset Handling:**
- What's not tested: Exports >10K rows to actual file, memory usage under load
- Files: `backend/src/services/excelExportService.ts`
- Risk: OOM errors in production, silent export truncation
- Priority: High - affects data integrity
- Test approach:
  1. Add test with 50K row dataset, measure memory
  2. Test file integrity (verify cell values, formula evaluation)
  3. Test concurrent exports

**MCP Server Connection Failures:**
- What's not tested: MCP server unavailable, slow responses, partial failures
- Files: `backend/src/mcp/mcpServer.ts`, `backend/src/services/mcpServerService.ts`
- Risk: Hanging requests, unclear error messages to user
- Priority: Medium - affects availability
- Test approach:
  1. Mock MCP server with various response latencies
  2. Test connection timeouts
  3. Test graceful fallback to direct query execution

**Frontend Query Result Display with Large Numbers:**
- What's not tested: Rendering 50K+ rows in React table, pagination/virtualization
- Files: `frontend/src/components/ChatInterface.tsx` (320 lines, complex UI logic)
- Risk: Browser slowdown, data loss on scroll
- Priority: Medium - affects usability
- Test approach:
  1. Render 100K row dataset, measure frame rate
  2. Test filtering/sorting with large result set
  3. Test virtualization (only render visible rows)

**Data Loading Error Recovery:**
- What's not tested: Partial failures during data load (e.g., block group load succeeds but tract load fails), state consistency
- Files: `backend/src/data-loading/orchestration/DataLoadingOrchestrator.ts`
- Risk: Incomplete data in production, silent failures
- Priority: High - affects data integrity
- Test approach:
  1. Simulate API failure mid-dataset load
  2. Verify database state is consistent (no partial records)
  3. Test resume/retry behavior

---

*Concerns audit: 2026-02-01*

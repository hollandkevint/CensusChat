# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Three-tier distributed system with Model Context Protocol (MCP) security layer

**Key Characteristics:**
- Natural language query → Claude Sonnet analysis → SQL generation → MCP validation → DuckDB execution
- Federated healthcare data access through MCP tools and adapters
- Separation of concerns: API layer, service layer, validation layer, analytics modules
- Singleton services for MCP server/client, DuckDB pool, and healthcare analytics

## Layers

**API Layer:**
- Purpose: HTTP endpoints for query execution, data export, health checks, MCP management
- Location: `backend/src/routes/`
- Contains: Route handlers for queries, exports, census data, MCP, data refresh
- Depends on: Service layer, validation layer, models
- Used by: Frontend, external API consumers

**Service Layer:**
- Purpose: Business logic for queries, Claude integration, export, caching, MCP communication
- Location: `backend/src/services/`
- Contains: AnthropicService, ExcelExportService, MCPClientService, MCPServerService, CensusApiService, FallbackService, DataRefreshService, GeoRoutingService, CacheService
- Depends on: Utils (DuckDB pool, audit logger), models, validation
- Used by: Routes, healthcare analytics module

**Validation Layer:**
- Purpose: SQL security enforcement, query validation against policies
- Location: `backend/src/validation/`
- Contains: SQLValidator (syntax/structure checks), SQLSecurityPolicies (allowlists, row limits, pattern blocking)
- Depends on: Models for schema definitions
- Used by: MCP server, routes

**Healthcare Analytics Module:**
- Purpose: Domain-specific query patterns for Medicare, population health, facility adequacy
- Location: `backend/src/modules/healthcare_analytics/`
- Contains: Query router, MCP connector, dataset adapters, pattern library, type definitions
- Depends on: Validation, MCP services, data freshness tracker
- Used by: Routes, query handlers

**MCP Infrastructure:**
- Purpose: Model Context Protocol server/client for secure database access
- Location: `backend/src/mcp/`
- Contains: MCPServer (JSON-RPC 2.0 stdio transport), MCPClient (tool calling interface), types
- Depends on: DuckDB pool, validation layer
- Used by: Services, routes

**Data Access Layer:**
- Purpose: Database connectivity and query execution
- Location: `backend/src/utils/duckdbPool.ts`
- Contains: Connection pooling, health checks, query execution
- Depends on: Config
- Used by: MCP server, validation layer, direct queries

**Frontend Layer:**
- Purpose: React-based chat interface for healthcare demographics queries
- Location: `frontend/src/`
- Contains: ChatInterface component, API clients, hooks, types
- Depends on: Backend API
- Used by: End users

## Data Flow

**Natural Language Query to Results:**

1. User submits query in `ChatInterface` component
2. Frontend calls `queryApi.executeQuery()` → `/api/v1/queries` POST
3. Backend route handler receives query, calls `anthropicService.analyzeQuery()`
4. Claude Sonnet translates to structured analysis with SQL
5. Route validates SQL against security policies using `sqlValidator`
6. Valid SQL executed through `MCPClient.executeQuery()` tool
7. MCP Server receives tool call, validates with `sqlValidator` again
8. Validated query executes on DuckDB pool connection
9. Results returned through MCP response envelope
10. Backend formats response, frontend displays in chat

**Healthcare Analytics Query Path:**

1. Natural language query arrives at route handler
2. `getHealthcareAnalyticsModule()` initializes if needed
3. `HealthcareAnalyticsModule.executeQuery()` called with QueryRequest
4. `NaturalLanguageQueryRouter` translates query to `QueryTranslationPattern`
5. Pattern intent determines analysis type (Medicare, population health, facility adequacy)
6. `MCPConnector` invokes appropriate MCP tool (healthcare_analysis, dataset_federation, etc.)
7. Result enriched with data freshness metadata from `dataFreshnessTracker`
8. Federated sources tracked and returned in metadata

**Export Flow:**

1. User clicks export in ChatInterface
2. `useExport` hook collects query results and format
3. POST `/api/v1/export` with ExportRequest
4. `ExcelExportService` formats data with styling
5. File generated in `temp/exports/`
6. URL returned to frontend for download

## State Management

**Service Singletons:**
- `anthropicService`: Maintains Anthropic client instance
- `getMCPServerService()`: Singleton MCP server with status tracking
- `getMCPClientService()`: Singleton MCP client for tool calls
- `getDuckDBPool()`: Singleton connection pool with queue management
- `getHealthcareAnalyticsModule()`: Singleton healthcare module instance

**Data Freshness:**
- `dataFreshnessTracker`: Tracks when each dataset was last refreshed
- Timestamps updated by `dataRefreshService` on data loads
- Metadata included in query responses

**Caching:**
- `cacheService`: Redis-backed cache for query results and Census API responses
- TTL: 3600s default for Census data
- Enables sub-second response for repeated queries

## Key Abstractions

**QueryAnalysis:**
- Purpose: Structured representation of user intent extracted by Claude
- Examples: `backend/src/services/anthropicService.ts`
- Pattern: Interface with intent, entities (locations, demographics, age groups), filters, output format, confidence

**QueryTranslationPattern:**
- Purpose: SQL-ready representation of a natural language query
- Examples: `backend/src/modules/healthcare_analytics/types/HealthcareAnalyticsTypes.ts`
- Pattern: Contains intent, SQL pattern, entities (geography, metrics), parameters, validation rules

**MCPToolCall:**
- Purpose: Wrapper for tool invocation through MCP protocol
- Examples: `backend/src/services/mcpClientService.ts`
- Pattern: Includes tool name, input parameters, execution context

**PublicDatasetAdapter:**
- Purpose: Abstract interface for different data sources (Census, CMS, etc.)
- Examples: `backend/src/modules/healthcare_analytics/adapters/CensusBureauAdapter.ts`, `CMSDataAdapter.ts`
- Pattern: Implements common query/transform interface for heterogeneous datasets

**DuckDBPool:**
- Purpose: Connection pooling with queue management
- Examples: `backend/src/utils/duckdbPool.ts`
- Pattern: Singleton with min/max connections, timeout handling, health checks

## Entry Points

**Server Start:**
- Location: `backend/src/index.ts`
- Triggers: `npm run dev` or `npm start`
- Responsibilities: Load env, create Express app, setup middleware, initialize MCP services, graceful shutdown

**API Query Endpoint:**
- Location: `backend/src/routes/query.routes.ts`
- Triggers: POST `/api/v1/queries`
- Responsibilities: Validate request, call Anthropic analysis, execute validated SQL, format response

**API Export Endpoint:**
- Location: `backend/src/routes/export.routes.ts`
- Triggers: POST `/api/v1/export`
- Responsibilities: Format data to Excel/CSV/PDF, manage temporary file, return download URL

**MCP Tool Execution:**
- Location: `backend/src/mcp/mcpServer.ts` → `setupHandlers()`
- Triggers: Tool call from MCPClient or external MCP client
- Responsibilities: Route to appropriate handler (get_information_schema, validate_sql_query, execute_query)

**Frontend Page Load:**
- Location: `frontend/src/app/page.tsx`
- Triggers: User navigates to root URL
- Responsibilities: Render header, mount ChatInterface component

**Chat Message Send:**
- Location: `frontend/src/components/ChatInterface.tsx` → `handleSendMessage()`
- Triggers: User clicks send in chat
- Responsibilities: Collect input, call queryApi, handle response/errors, update message history

## Error Handling

**Strategy:** Layered error handling with graceful degradation and fallback services

**Patterns:**

*Validation Errors:*
- SQL validation failures return structured error with reasons
- Enforced at MCP layer before execution
- Client receives suggestion array for query refinement

*API Errors:*
- Express error handler middleware catches unhandled errors
- Returns standardized error JSON with status code, message, error code
- Logs to console and audit logger

*Service Failures:*
- Anthropic API unavailable → FallbackService provides demo responses
- Census API rate limited → Cached results returned
- MCP server startup fails → Server continues with reduced functionality warning
- DuckDB pool exhausted → Requests queue with timeout

*External API Errors:*
- Census API errors caught in `censusApiService`
- HTTP error responses mapped to `CensusApiErrorType`
- Rate limits tracked in `cacheService`

## Cross-Cutting Concerns

**Logging:**
- Approach: Console logging with emoji prefixes for log levels (✅, ❌, ⚠️, 🔧)
- Audit logging: SQL queries logged to `backend/logs/sql-audit.log` via `auditLogger`
- MCP monitoring: Request/response logging with timing via `mcpMonitoring`
- Services log initialization, health checks, feature flags

**Validation:**
- SQL validation: `sqlValidator` checks syntax, security policies, row limits
- Security policies: `sqlSecurityPolicies.ts` defines table/column allowlists
- Pattern enforcement: Blocks comments, multiple statements, data modification
- Healthcare analytics: Query router validates against known patterns

**Authentication:**
- Approach: JWT tokens (configured but not enforced in current routes)
- Config location: `backend/src/config/index.ts`
- MCP auth: `mcpAuth.ts` middleware (registered but routes disabled)
- Future: Enable auth routes in `backend/src/routes/index.ts` line 19

**Rate Limiting:**
- Query endpoint: `queryRateLimit` middleware in `query.routes.ts`
- Census API: `censusApiUserRateLimit` per user/hour limit
- Configuration: `config.rateLimits.census.requestsPerHour` (default 400)
- Implementation: Express rate-limiter with Redis store

**Caching:**
- Query results: Cached for repeated identical queries
- Census API responses: TTL-based caching to reduce API calls
- Redis connection: Configured via env vars (REDIS_HOST, REDIS_PORT)
- Cache busting: Manual refresh via `/api/data/refresh` endpoint

---

*Architecture analysis: 2026-02-01*

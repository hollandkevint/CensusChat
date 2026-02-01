# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
CensusChat/
├── backend/                     # Express.js API server
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── config/             # Configuration and validation
│   │   ├── middleware/         # Express middleware (auth, rate limiting, error handling)
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic services
│   │   ├── models/             # TypeScript data models
│   │   ├── mcp/                # MCP server/client implementation
│   │   ├── validation/         # SQL validation and security policies
│   │   ├── modules/            # Healthcare analytics module (FDB-MCP)
│   │   ├── utils/              # Utilities (DuckDB pool, audit logger, etc.)
│   │   ├── data-loading/       # Data loading orchestration (for setup)
│   │   ├── __tests__/          # Jest test suites
│   │   └── test/               # Test fixtures and helpers
│   ├── data/                   # DuckDB database file
│   ├── logs/                   # SQL audit logs
│   ├── dist/                   # Compiled JavaScript (generated)
│   ├── coverage/               # Jest coverage reports (generated)
│   ├── scripts/                # Data loading and utility scripts
│   └── package.json
│
├── frontend/                    # Next.js 15 React application
│   ├── src/
│   │   ├── app/                # App router pages (layout, page root)
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility libraries and API clients
│   │   └── types/              # TypeScript type definitions
│   ├── public/                 # Static assets
│   ├── .next/                  # Next.js build output (generated)
│   └── package.json
│
├── docs/                        # Project documentation
│   ├── api/                    # API endpoint documentation
│   ├── architecture/           # Architecture diagrams and detailed docs
│   ├── guides/                 # Setup and deployment guides
│   ├── references/             # DuckDB, MCP, and data references
│   └── testing/                # Testing guides
│
├── test-data/                   # Test fixtures and data
│   ├── duckdb/                 # DuckDB test database
│   ├── postgres-init/          # Postgres initialization scripts
│   ├── seed-scripts/           # Test data seeds
│   └── wiremock/               # API mocking configuration
│
├── bmad-project/                # BMAD methodology documentation
├── .planning/                   # GSD planning documents
├── docker-compose.yml           # Development infrastructure
├── package.json                 # Monorepo root package
└── CLAUDE.md                    # Development instructions
```

## Directory Purposes

**backend/src/:**
- Purpose: TypeScript source code for Express API server
- Contains: Routes, services, models, middleware, MCP implementation, healthcare analytics
- Key files: `index.ts` (server entry), `routes/index.ts` (route setup)

**backend/src/routes/:**
- Purpose: HTTP endpoint handlers organized by feature
- Contains: query, export, census, mcp, health, auth, user, data refresh, manual data load routes
- Key files: `query.routes.ts` (NL query handling), `export.routes.ts` (export processing)

**backend/src/services/:**
- Purpose: Business logic and external service integration
- Contains: Anthropic API, Excel export, MCP client/server, Census API, data refresh, caching
- Singleton instances exported for application-wide use

**backend/src/mcp/:**
- Purpose: Model Context Protocol server and client implementation
- Contains: MCP server with JSON-RPC 2.0 stdio transport, client for tool calling
- Key files: `mcpServer.ts` (exposes DuckDB via tools), `mcpClient.ts` (calls MCP tools)

**backend/src/validation/:**
- Purpose: SQL security enforcement and validation
- Contains: SQL validator (syntax/structure), security policies (allowlists, row limits, pattern blocks)
- Key files: `sqlValidator.ts`, `sqlSecurityPolicies.ts`

**backend/src/modules/healthcare_analytics/:**
- Purpose: Healthcare-specific query patterns and dataset federation
- Contains: Query router, MCP connector, adapters (Census, CMS), patterns (Medicare, population health, facility)
- Subdirectories: core/, types/, patterns/, adapters/, testing/

**backend/src/utils/:**
- Purpose: Shared utility functions and infrastructure
- Contains: DuckDB pool (connection pooling), audit logger, Excel formatting, circuit breaker, data freshness tracker
- Key files: `duckdbPool.ts` (connection management)

**backend/src/config/:**
- Purpose: Configuration management and validation
- Contains: Config object with database, API, cache, rate limit settings
- Key files: `index.ts` (config export), `validation.ts` (env var validation)

**backend/src/middleware/:**
- Purpose: Express middleware for cross-cutting concerns
- Contains: Error handler, 404 handler, rate limiting, MCP authentication
- Key files: `errorHandler.ts`, `rateLimiting.ts`

**backend/src/models/:**
- Purpose: TypeScript data model definitions
- Contains: Census data models, query request/response models, export models
- Key files: `query.models.ts`, `export.models.ts`, `CensusData.ts`

**backend/src/__tests__/:**
- Purpose: Jest test suite for backend services, routes, utilities
- Contains: Unit tests, integration tests, e2e tests, test fixtures
- Organized: Mirror src/ structure with `.test.ts` suffix

**backend/data/:**
- Purpose: DuckDB database storage location
- Contains: `census.duckdb` database file with Census and ACS data
- Generated: By data loading scripts during setup

**backend/logs/:**
- Purpose: Audit and operational logs
- Contains: `sql-audit.log` (all SQL queries executed), debug logs
- Retention: Logs kept for compliance and debugging

**frontend/src/app/:**
- Purpose: Next.js app router pages
- Contains: Root layout, home page
- Key files: `layout.tsx` (metadata, fonts), `page.tsx` (home page with ChatInterface)

**frontend/src/components/:**
- Purpose: Reusable React components
- Contains: ChatInterface, ExportButton, DataRefreshButton, ExportProgress
- Testing: Colocated test files (`__tests__/`)

**frontend/src/lib/:**
- Purpose: Utility libraries and API clients
- Contains: API client for query execution, export functionality
- Key files: `api/queryApi.ts`, `api/exportApi.ts`

**frontend/src/hooks/:**
- Purpose: Custom React hooks
- Contains: `useExport` hook for export functionality
- Pattern: Encapsulates export state and logic

**frontend/src/types/:**
- Purpose: TypeScript type definitions for frontend
- Contains: Query types, export types, response shapes
- Key files: `query.types.ts`, `export.types.ts`

**test-data/:**
- Purpose: Fixtures and test data for development and testing
- Contains: DuckDB test databases, Postgres initialization, API mocks (WireMock)
- Usage: Docker Compose loads test data containers

**docs/:**
- Purpose: Project documentation
- Contains: Architecture diagrams, API specs, setup guides, testing guides
- Audience: Developers, operations, integrators

## Key File Locations

**Entry Points:**

- `backend/src/index.ts`: Express server initialization, MCP service startup, graceful shutdown
- `frontend/src/app/page.tsx`: Root page, renders ChatInterface component
- `frontend/src/app/layout.tsx`: Root layout, sets metadata and fonts

**Configuration:**

- `backend/src/config/index.ts`: Configuration object with all settings
- `backend/.env`: Environment variables (ANTHROPIC_API_KEY, CENSUS_API_KEY, database credentials)
- `frontend/.env.local`: Frontend environment (API base URL, optional)

**Core Logic:**

- `backend/src/routes/query.routes.ts`: Natural language query processing pipeline
- `backend/src/services/anthropicService.ts`: Claude Sonnet integration for query analysis
- `backend/src/mcp/mcpServer.ts`: MCP server exposing DuckDB via get_information_schema, validate_sql_query, execute_query tools
- `backend/src/validation/sqlValidator.ts`: SQL validation and security enforcement
- `backend/src/modules/healthcare_analytics/`: Healthcare-specific patterns and analysis

**Testing:**

- `backend/src/__tests__/`: Jest test suites (unit, integration, e2e)
- `frontend/src/components/__tests__/`: React component tests
- `test-data/`: Test databases and fixtures

**API Routes:**

- `backend/src/routes/query.routes.ts`: POST `/api/v1/queries` - execute natural language queries
- `backend/src/routes/export.routes.ts`: POST `/api/v1/export` - export query results
- `backend/src/routes/mcp.routes.ts`: GET/POST `/api/v1/mcp/*` - MCP protocol endpoints
- `backend/src/routes/census.routes.ts`: GET `/api/v1/census/*` - Census data endpoints (disabled)
- `backend/src/routes/health.routes.ts`: GET `/health` - Health check

## Naming Conventions

**Files:**

- Route files: `{feature}.routes.ts` (e.g., `query.routes.ts`, `export.routes.ts`)
- Service files: `{feature}Service.ts` (e.g., `anthropicService.ts`, `excelExportService.ts`)
- Utility files: `{feature}.ts` (e.g., `duckdbPool.ts`, `auditLogger.ts`)
- Test files: `{module}.test.ts` or `{module}.spec.ts`
- Model files: `{Entity}.ts` or `{feature}.models.ts`

**Directories:**

- Feature groupings: lowercase with dashes (e.g., `data-loading`, `healthcare_analytics`)
- Subdirectories within modules: lowercase descriptive (e.g., `core/`, `patterns/`, `adapters/`, `types/`)

**TypeScript:**

- Interfaces: `PascalCase` prefix with capital (e.g., `QueryAnalysis`, `MCPToolCall`)
- Types: `PascalCase` (e.g., `GeoLevel`, `QueryIntent`)
- Classes: `PascalCase` (e.g., `DuckDBPool`, `CensusChat_MCPServer`)
- Enums: `PascalCase` (e.g., `CensusApiErrorType`)
- Functions/variables: `camelCase` (e.g., `analyzeQuery`, `executeSqlQuery`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MCP_HEALTHCARE_PROTOCOL_VERSION`)

## Where to Add New Code

**New Query Route/Feature:**
- Route: `backend/src/routes/{feature}.routes.ts`
- Service: `backend/src/services/{feature}Service.ts`
- Models: `backend/src/models/{feature}.models.ts`
- Tests: `backend/src/__tests__/{feature}.test.ts`
- Validation: Update `backend/src/validation/` if SQL rules needed

**New Healthcare Analytics Pattern:**
- Pattern file: `backend/src/modules/healthcare_analytics/patterns/{PatternName}Patterns.ts`
- Export from: `backend/src/modules/healthcare_analytics/index.ts`
- Types: Add to `backend/src/modules/healthcare_analytics/types/HealthcareAnalyticsTypes.ts`
- Tests: `backend/src/__tests__/modules/healthcare_analytics/`

**New Frontend Component:**
- Component: `frontend/src/components/{ComponentName}.tsx`
- Tests: `frontend/src/components/__tests__/{ComponentName}.test.tsx`
- Types: `frontend/src/types/{feature}.types.ts` if needed
- Hooks: `frontend/src/hooks/use{Feature}.ts` if state/logic needed

**New Utility/Helper:**
- General: `backend/src/utils/{feature}.ts`
- Library: `frontend/src/lib/{subdir}/{feature}.ts`
- Export from index or use directly

**New Database Feature:**
- Data loading: `backend/src/data-loading/{feature}/`
- Scripts: `backend/scripts/{feature}.ts`
- Fixtures: `test-data/{category}/`

## Special Directories

**backend/data/:**
- Purpose: DuckDB database file storage
- Generated: Yes (by data loading scripts)
- Committed: No (Git ignored, too large)
- Location: `backend/data/census.duckdb`

**backend/logs/:**
- Purpose: Audit and operational logs
- Generated: Yes (created at runtime)
- Committed: No (Git ignored)
- Contents: `sql-audit.log`, debug logs

**backend/dist/:**
- Purpose: Compiled JavaScript from TypeScript
- Generated: Yes (npm run build)
- Committed: No (Git ignored)
- Created by: TypeScript compiler

**backend/coverage/:**
- Purpose: Jest test coverage reports
- Generated: Yes (npm run test -- --coverage)
- Committed: No (Git ignored)

**frontend/.next/:**
- Purpose: Next.js build output
- Generated: Yes (next build)
- Committed: No (Git ignored)

**temp/exports/:**
- Purpose: Temporary export files (Excel, CSV, PDF)
- Generated: Yes (by ExcelExportService)
- Committed: No (Git ignored)
- Location: `backend/temp/exports/`

---

*Structure analysis: 2026-02-01*

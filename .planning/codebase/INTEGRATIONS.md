# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**Anthropic Claude:**
- Service: Claude Sonnet 4 API
- What it's used for: Natural language query processing - converts healthcare demographic questions into SQL
- SDK/Client: `@anthropic-ai/sdk` 0.64.0
- Auth: `ANTHROPIC_API_KEY` (environment variable)
- Location: `backend/src/services/anthropicService.ts`
- API Version: Latest (0.64.0)

**US Census Bureau:**
- Service: Census Bureau API (ACS - American Community Survey)
- What it's used for: Live demographic data fetching for cache/validation
- SDK/Client: `axios` 1.12.2 (HTTP client)
- Auth: `CENSUS_API_KEY` (environment variable)
- Base URL: Configurable via `CENSUS_API_URL` (default: `https://api.census.gov`)
- Location: `backend/src/services/censusApiService.ts`
- Rate Limits: 500 requests/day without API key, unlimited with key
- Live Mode: Toggle via `USE_LIVE_CENSUS_API` environment variable

**Model Context Protocol (MCP):**
- Service: MCP server implementation for secure SQL execution
- What it's used for: Validates SQL queries before execution, enforces security policies
- SDK/Client: `@modelcontextprotocol/sdk` 1.0.4
- Protocol: JSON-RPC 2.0 over stdio
- Location: `backend/src/mcp/mcpServer.ts` (server), `backend/src/mcp/mcpClient.ts` (client)
- Configuration: `backend/src/config/mcpConfig.ts`
- Tools exposed:
  - `get_information_schema` - Database schema introspection
  - `validate_sql_query` - Security validation without execution
  - `execute_query` - Execute validated SELECT queries

## Data Storage

**Databases:**
- PostgreSQL 15
  - Connection: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - Client: `pg` 8.16.3
  - Purpose: User authentication, session management, audit logs
  - Container: `censuschat-postgres` (in docker-compose)
  - Port: 5432

- DuckDB 1.3.2
  - Connection: File-based (`DUCKDB_PATH` - default `./data/census.duckdb`)
  - Client: `duckdb` 1.3.2 (embedded)
  - Purpose: Census demographic data storage and analytics queries
  - Pool: Connection pooling via `backend/src/utils/duckdbPool.ts`
  - Configuration: Min 2, Max 10 connections, 4GB memory, 4 threads
  - Location: `backend/src/utils/duckdbPool.ts`
  - Primary Tables:
    - `county_data` - 3,144 counties with demographics
    - `block_group_data_expanded` - 239,741 block groups with 84 variables

**File Storage:**
- Local filesystem only (no cloud storage)
- DuckDB files: `backend/data/census.duckdb`
- Export cache: In-memory buffers (via `stream-buffers` library)

**Caching:**
- Redis 7
  - Connection: `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`
  - Client: `ioredis` 5.7.0
  - Purpose: Query result caching, rate limit tracking
  - Container: `censuschat-redis` (in docker-compose)
  - Port: 6379
  - Configuration:
    - 3 max retries per request
    - 2000ms connection timeout
    - 5000ms command timeout
    - 2-second key prefix: `census_cache:`
    - Retry backoff: exponential (100ms * retries, max 2000ms)
  - Service: `backend/src/services/cacheService.ts`
  - Cache TTL: Configurable via `CENSUS_CACHE_TTL` (default 3600 seconds)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
- Implementation: `jsonwebtoken` 9.0.2 library
- Token signing: `JWT_SECRET` environment variable
- Token expiration: `JWT_EXPIRES_IN` (default 24h), `JWT_REFRESH_EXPIRES_IN` (default 7d)
- Password hashing: `bcryptjs` 3.0.2
- Location: `backend/src/config/index.ts` (JWT config)
- Status: Partially integrated - next-auth included but not fully utilized
- Note: JWT authentication header prep noted in `frontend/src/lib/api/queryApi.ts` as future work

## Monitoring & Observability

**Error Tracking:**
- Not integrated (no Sentry, Rollbar, or similar detected)
- Console logging for errors and warnings

**Logs:**
- HTTP request logging: `morgan` 1.10.1 middleware
- SQL audit logging: `backend/logs/sql-audit.log` (all database queries logged)
- Application logs: Console (stderr/stdout via Docker)
- Location: `backend/src/index.ts` (middleware setup)

**Health Checks:**
- Endpoint: `GET /api/v1/health`
- Docker container health: Curl-based checks in docker-compose
- Interval: 30s, timeout 10s, 3 retries
- Services checked: PostgreSQL, Redis (via service dependencies)

## CI/CD & Deployment

**Hosting:**
- Docker containerization
- Docker Compose orchestration (development and demo)
- Deployment platform: Not yet deployed (MVP stage)
- Container images:
  - Backend: `node:20-alpine` base, multi-stage build
  - Frontend: `node:20-alpine` base, multi-stage build
  - PostgreSQL: `postgres:15-alpine`
  - Redis: `redis:7-alpine`

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, or similar)
- Secret scanning hook in place: `npm run secret-scan` (pre-commit hook via Husky)
- Git hook: Husky 9.1.7 for pre-commit checks

**Deployment Process:**
- `./demo-setup.sh` - One-command setup script
- `docker-compose up -d` - Start all services
- No auto-deployment pipeline configured

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Claude API authentication (critical)
- `CENSUS_API_KEY` - Census Bureau API key (required for live mode)
- `JWT_SECRET` - JWT signing secret (required)
- `POSTGRES_*` - Database connection (critical)
- `REDIS_*` - Cache connection (optional, graceful degradation)
- `NODE_ENV` - Environment mode
- `PORT` - API server port

**Secrets location:**
- Local development: `backend/.env` (git-ignored)
- Docker Compose: Environment variables in docker-compose.yml, sourced from .env
- Production: Would require external secrets management (not configured)
- Validation: `backend/src/config/validation.ts` validates required vars on startup

**Secret scanning:**
- Pre-commit hook: `npm run secret-scan`
- Pattern matching: Detects Anthropic API key format (`sk-ant-api03-*`) and git SHAs
- Execution: Via Husky git hook

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (Census and Anthropic are request-response integrations only)

## Frontend-Backend Communication

**API Base URLs:**
- Client-side: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)
- Server-side/SSR: `INTERNAL_API_URL` (default `http://backend:3001`)
- Location: `frontend/src/lib/api/queryApi.ts`

**HTTP Client:**
- Frontend: `fetch` API (native, no axios in frontend code)
- Backend to Census: `axios` 1.12.2

**Request Headers:**
- Content-Type: application/json
- CORS: Handled via Helmet and cors middleware
- Future: JWT Authorization header (noted as TODO)

## Validation & Security

**SQL Security:**
- Layer: Model Context Protocol (MCP)
- Enforcement: `backend/src/validation/sqlValidator.ts`
- Policies: `backend/src/validation/sqlSecurityPolicies.ts`
- Allowed: SELECT statements only
- Blocked: Comments, multi-statements, DML (INSERT/UPDATE/DELETE)
- Table allowlist: Maintained in CENSUS_SCHEMA
- Result limit: 1,000 rows maximum per query
- Audit: All queries logged to `backend/logs/sql-audit.log`

**Data Validation:**
- Schema: `joi` 17.13.3
- Location: `backend/src/validation/` directory

---

*Integration audit: 2026-02-01*

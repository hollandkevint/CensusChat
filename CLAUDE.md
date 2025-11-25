# CLAUDE.md - CensusChat Development Guide

## Project Overview

CensusChat is a natural language interface for US Census data, designed for healthcare strategy teams. It transforms complex demographic queries (like "Show me Medicare eligible seniors in Tampa Bay with household income over $75K") into validated SQL using Claude Sonnet 4 and the Model Context Protocol (MCP).

**Core Value Proposition:** Transform 6-week $50K demographic consulting into 6-second queries

## Tech Stack

- **Backend:** Node.js 20 + TypeScript + Express 5
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS 4
- **Databases:**
  - PostgreSQL 15 - User data and sessions
  - Redis 7 - Caching and rate limiting
  - DuckDB 1.3.2 - Census data analytics
- **AI:** Claude Sonnet 4 + Model Context Protocol (@modelcontextprotocol/sdk)
- **Testing:** Jest 30 + Supertest + React Testing Library
- **Deployment:** Docker + Docker Compose

## Project Structure

```
CensusChat/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── config/         # Configuration and validation
│   │   ├── data-loading/   # Census data loading orchestration
│   │   ├── mcp/            # MCP server and client
│   │   ├── middleware/     # Express middleware (auth, rate limiting)
│   │   ├── models/         # Data models
│   │   ├── modules/        # Healthcare analytics modules
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic services
│   │   ├── utils/          # Utilities (DuckDB pool, circuit breaker)
│   │   ├── validation/     # SQL validation layer
│   │   └── __tests__/      # Test suites
│   ├── scripts/            # Data loading scripts
│   └── data/               # DuckDB database files
├── frontend/               # Next.js application
│   └── src/
│       ├── app/            # Next.js app router pages
│       └── components/     # React components
├── docs/                   # Documentation
│   ├── architecture/       # System architecture docs
│   ├── guides/            # Setup and deployment guides
│   └── references/        # DuckDB and MCP references
└── bmad-project/          # BMAD methodology docs
```

## Quick Commands

### Development

```bash
# Start entire stack with Docker
./demo-setup.sh

# Or manually with Docker Compose
docker-compose up -d

# Backend development (from backend/)
npm run dev          # Start with nodemon
npm run build        # TypeScript compilation
npm run start        # Run production build

# Frontend development (from frontend/)
npm run dev          # Next.js dev server
npm run build        # Production build
```

### Testing

```bash
# Backend tests (from backend/)
npm run test              # Run all tests
npm run test -- --watch   # Watch mode
npm run test -- --coverage

# Frontend tests (from frontend/)
npm run test
```

### Code Quality

```bash
# Backend (from backend/)
npm run lint        # ESLint
npm run typecheck   # TypeScript check

# Frontend (from frontend/)
npm run lint        # Next.js lint
npm run typecheck   # TypeScript check

# Security scan before commits
npm run secret-scan
```

### Data Loading

```bash
# From backend/ - one-time setup
./scripts/setup-database.sh         # Full database setup (2-3 hours)
npm run load-blockgroups-expanded   # Load block group data
npm run load-all-geography          # Load all geography levels
```

## Architecture Highlights

### MCP Implementation

The project uses Model Context Protocol for secure SQL execution:

1. **Natural language** → Claude Sonnet 4 translates to SQL
2. **MCP Validation** → Security layer validates SQL
3. **DuckDB** → Executes validated queries
4. **Results** → Returned to user

**MCP Tools:**
- `get_information_schema` - Get database schema
- `validate_sql_query` - Validate SQL against security policies
- `execute_query` - Execute validated queries

**Key Files:**
- `backend/src/mcp/mcpServer.ts` - MCP server implementation
- `backend/src/mcp/mcpClient.ts` - MCP client
- `backend/src/validation/` - SQL validation layer

### SQL Security

- Only SELECT statements allowed
- Table/column allowlist enforcement
- 1,000 row limit per query
- Pattern blocking (no comments, multi-statements)
- Complete audit logging to `backend/logs/sql-audit.log`

### Key Services

- `anthropicService.ts` - Claude API integration
- `excelExportService.ts` - Excel/PDF export
- `cacheService.ts` - Redis caching
- `dataRefreshService.ts` - Data freshness management

## Environment Variables

Required in `backend/.env`:

```bash
# AI (Required)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Census Data (Required)
CENSUS_API_KEY=your-census-key

# Security
JWT_SECRET=your-jwt-secret

# Database
POSTGRES_HOST=localhost
POSTGRES_DB=censuschat
POSTGRES_USER=censuschat_user
POSTGRES_PASSWORD=...
DUCKDB_PATH=./data/census.duckdb

# Redis
REDIS_HOST=localhost
```

## Coding Standards

### Commit Messages

Use conventional commits: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(api): add census data filtering`
- `fix(query): handle malformed natural language input`
- `security: add SQL injection protection`

### Code Style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- JSDoc comments for public APIs
- 82%+ test coverage target
- Sub-2s query response time goal

### Security Requirements

- Never commit API keys or secrets
- Use environment variables for all credentials
- Run `npm run secret-scan` before committing
- Follow HIPAA-ready practices (no PHI storage)
- Audit all database queries

## Testing Strategy

### Backend Tests

Located in `backend/src/__tests__/`:
- Unit tests for services and utilities
- Integration tests for API routes
- MCP protocol tests
- DuckDB connection pool tests

### Key Test Files

- `query.routes.mcp.test.ts` - MCP integration
- `mcpServerService.test.ts` - MCP server tests
- `duckdbPool.test.ts` - Connection pooling
- `excelExportService.test.ts` - Export functionality

## API Endpoints

Base URL: `http://localhost:3001/api/v1`

- `GET /health` - Health check
- `POST /query` - Natural language query
- `POST /export` - Export results (Excel/CSV/PDF)
- `GET /mcp/*` - MCP protocol endpoints
- `GET /census/*` - Census data endpoints

## Data Model

### Primary Tables

- `county_data` - 3,144 US counties
- `block_group_data_expanded` - 239,741 block groups with 84 variables

### Demographics Available

- Age distributions (Medicare eligible 65+)
- Income levels
- Education attainment
- Housing characteristics
- Healthcare access indicators
- Technology adoption

## Common Tasks

### Adding a New API Route

1. Create route file in `backend/src/routes/`
2. Add route models in `backend/src/models/`
3. Register in `backend/src/routes/index.ts`
4. Add tests in `backend/src/__tests__/routes/`

### Adding a Healthcare Analytics Pattern

1. Add pattern file in `backend/src/modules/healthcare_analytics/patterns/`
2. Export from `backend/src/modules/healthcare_analytics/index.ts`
3. Add tests in `backend/src/__tests__/`

### Modifying SQL Validation

1. Update allowlists in `backend/src/validation/`
2. Update MCP tool handlers in `backend/src/mcp/mcpServer.ts`
3. Add validation tests

## Troubleshooting

### DuckDB Connection Issues

```bash
# Check DuckDB file exists
ls -la backend/data/census.duckdb

# Test connection
cd backend && npm run duckdb
```

### Redis Connection Failed

```bash
# Check Redis is running
docker-compose ps redis
redis-cli ping
```

### API Key Issues

- Verify keys in `backend/.env`
- Check Anthropic key format: `sk-ant-api03-...`
- Census API key: alphanumeric string

## Resources

- [API Key Setup](API_KEY_SETUP.md)
- [Quick Start Guide](QUICK_START.md)
- [Architecture Docs](docs/architecture/)
- [MCP Implementation](docs/MCP_IMPLEMENTATION_SUMMARY.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Security Policy](SECURITY.md)

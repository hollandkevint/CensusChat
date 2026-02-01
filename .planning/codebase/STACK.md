# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.8.3 - Used in both backend and frontend for type safety
- JavaScript - Generated at runtime via TypeScript compilation
- SQL - Used for database queries (DuckDB, PostgreSQL)

**Secondary:**
- Bash - Shell scripts for data loading and setup

## Runtime

**Environment:**
- Node.js 20.0.0+ (required per `backend/package.json` engines)
- Alpine Linux (container base image: `node:20-alpine`)

**Package Manager:**
- npm (implied by package-lock.json presence)
- Lockfile: Present (package-lock.json committed)

## Frameworks

**Backend:**
- Express 5.1.0 - HTTP API server
- Model Context Protocol (MCP) SDK 1.0.4 - AI-enabled data access layer (@modelcontextprotocol/sdk)

**Frontend:**
- Next.js 15.4.5 - React framework with App Router
- React 19.1.0 - UI library

**Testing:**
- Jest 30.0.5 - Backend test runner (configured in `backend/jest.config.js`)
- ts-jest 29.4.4 - TypeScript support in Jest
- React Testing Library 16.3.0 - Frontend component testing
- Supertest 7.1.4 - HTTP assertion library for API testing

**Build/Dev:**
- TypeScript Compiler 5.8.3 - Compilation to ES2022
- Nodemon 3.1.10 - Development auto-reload
- ESLint 9.32.0 + @typescript-eslint/parser 8.38.0 - Code linting
- Prettier 3.6.2 - Code formatting (frontend)
- Tailwind CSS 4 - Utility-first CSS framework (frontend)

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` 0.64.0 - Claude API integration for natural language query processing
- `duckdb` 1.3.2 - Embedded analytical database for Census data queries (core data engine)
- `pg` 8.16.3 - PostgreSQL client for user sessions and authentication
- `ioredis` 5.7.0 - Redis client for caching and rate limiting
- `node-sql-parser` 5.3.7 - SQL query parsing for validation and security

**Infrastructure:**
- `express` 5.1.0 - HTTP server framework
- `axios` 1.12.2 - HTTP client for Census API calls
- `helmet` 8.1.0 - Security headers middleware
- `cors` 2.8.5 - CORS middleware
- `compression` 1.8.1 - Gzip response compression
- `morgan` 1.10.1 - HTTP request logging
- `jsonwebtoken` 9.0.2 - JWT token generation and verification
- `bcryptjs` 3.0.2 - Password hashing
- `joi` 17.13.3 - Data validation schema
- `uuid` 13.0.0 - ID generation
- `exceljs` 4.4.0 - Excel file generation for export functionality
- `stream-buffers` 3.0.3 - In-memory stream buffering

**Frontend:**
- `@tanstack/react-query` 5.84.0 - Server state management and caching
- `zustand` 5.0.7 - Client state management
- `axios` 1.11.0 - HTTP client
- `lucide-react` 0.535.0 - Icon library
- `recharts` 3.1.0 - Charting library
- `clsx` 2.1.1 - Conditional CSS class utility
- `tailwind-merge` 3.3.1 - Tailwind class merging utility
- `next-auth` 4.24.11 - Authentication (included but not fully integrated)

## Configuration

**Environment:**
Backend configuration managed via environment variables in `backend/.env`:
- `ANTHROPIC_API_KEY` - Claude API authentication
- `CENSUS_API_KEY` - Census Bureau API authentication
- `JWT_SECRET` - JWT token signing
- `POSTGRES_*` - PostgreSQL connection (host, port, user, password, database)
- `REDIS_*` - Redis connection (host, port, optional password)
- `DUCKDB_PATH` - Path to DuckDB database file (default: `./data/census.duckdb`)
- `NODE_ENV` - Environment mode (development, production, test)
- `CORS_ORIGIN` - CORS allowed origins (comma-separated)
- `PORT` - Backend server port (default: 3001)
- `CENSUS_API_URL` - Census API base URL
- `USE_LIVE_CENSUS_API` - Toggle live API vs mock data
- `CENSUS_CACHE_TTL` - Cache time-to-live in seconds
- `CENSUS_API_REQUESTS_PER_HOUR` - Rate limit threshold

**Build:**
- `backend/tsconfig.json` - TypeScript compilation settings (ES2022 target, strict mode disabled for demo)
- `backend/jest.config.js` - Jest test configuration with 85% coverage threshold
- `backend/nodemon.json` - Development reload configuration
- `frontend/tsconfig.json` - Next.js TypeScript settings
- `frontend/next.config.ts` - Next.js configuration
- `frontend/postcss.config.mjs` - PostCSS configuration for Tailwind
- `frontend/eslint.config.mjs` - ESLint configuration
- `.env.example` - Environment variable template
- `.env` - Local development secrets (not committed)
- `docker-compose.yml` - Multi-container orchestration

## Platform Requirements

**Development:**
- Node.js 20+
- npm (or compatible package manager)
- Docker & Docker Compose (for containerized development)
- PostgreSQL 15 (via Docker or local)
- Redis 7 (via Docker or local)
- Census Bureau API key (for live data mode)
- Anthropic API key (for Claude integration)

**Production:**
- Docker runtime environment
- PostgreSQL 15 database instance
- Redis 7 cache instance
- Minimal 4GB memory (DuckDB pool default)
- 4 CPU threads (DuckDB pool default)

**Data:**
- Census data loaded into DuckDB from ACS (American Community Survey)
- Two primary tables:
  - `county_data` - 3,144 US counties
  - `block_group_data_expanded` - 239,741 block groups with 84 variables

---

*Stack analysis: 2026-02-01*

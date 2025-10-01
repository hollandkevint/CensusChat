# Changelog

All notable changes to CensusChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- True Model Context Protocol (MCP) implementation with SQL validation layer
- SQL security policies with table/column allowlists and row limits
- SQL injection protection (SELECT-only, dangerous pattern blocking)
- Comprehensive audit logging to `/backend/logs/sql-audit.log`
- MCP server with JSON-RPC 2.0 protocol using `@modelcontextprotocol/sdk`
- MCP client for backend with three tools: `get_information_schema`, `validate_sql_query`, `execute_query`
- State abbreviation mapper for natural language preprocessing (CA → California)
- Production data validation with 58 California counties and 47 counties >1M population

### Changed
- Query route now uses MCP validation before DuckDB execution
- SQL parser uses PostgreSQL dialect (DuckDB-compatible)
- Frontend port changed from 3000 to 3002
- Query flow: Frontend → Anthropic → MCP Validator → DuckDB → Results

### Security
- **CRITICAL**: SQL injection protection via validation layer
- Table allowlist: `county_data` only
- Column validation against defined schema
- Row limit enforcement: 1,000 rows maximum
- Blocked patterns: DROP, DELETE, UPDATE, ALTER, comments, multi-statements
- Audit trail: All queries logged with validation status and timestamps

### Documentation
- Added `/docs/MCP_IMPLEMENTATION_SUMMARY.md` - Complete implementation guide
- Updated `/docs/MVP_STATUS.md` - Added October 1, 2025 MCP implementation section
- Updated `/README.md` - Added security features and MCP protocol details
- Updated `/QUICK_START.md` - Updated port numbers and validation information

### Fixed
- SQL parser column extraction for complex AST structures
- SQL parser dialect from 'duckdb' to 'postgresql' for compatibility
- State abbreviation preprocessing in query routes

## [0.2.0] - 2025-09-30

### Added
- Epic 2 Complete: Production DuckDB + MCP integration
- Connection pooling for DuckDB with healthcare-specific settings
- Circuit breakers and timeout enforcement (5 seconds)
- Healthcare analytics module with federated data sources
- MCP monitoring and health checks
- State name mapper (TX → Texas, CA → California)
- Comprehensive test coverage (82%+)

### Changed
- Backend now uses DuckDB connection pool instead of dynamic imports
- Frontend moved from mock data to production data integration
- Query timeout increased from 2 seconds to 5 seconds for MCP validation

## [0.1.0] - 2025-09-15

### Added
- Initial CensusChat MVP architecture
- Next.js 15 + React 19 frontend
- Node.js 20 + TypeScript + Express backend
- PostgreSQL + Redis + DuckDB infrastructure
- ChatInterface component for natural language queries
- Census API integration layer
- Docker-based testing environment
- Foundation mock data (8 counties)

### Documentation
- User personas and journey mapping
- Feature prioritization framework
- Success metrics and KPIs
- Technical architecture documentation
- Testing infrastructure guide

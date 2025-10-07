# CensusChat Backend Structure

Backend architecture documentation for CensusChat healthcare analytics platform.

**Status**: Production Ready (Epic 2 Complete - September 2025)

---

## 📁 Directory Structure

```
backend/src/
├── __tests__/           # Test suites (35+ files, 82%+ coverage)
├── config/              # Configuration management
├── controllers/         # Request handlers (legacy - consider migrating to routes)
├── data-loading/        # Census data loading utilities
├── index.ts            # Application entry point
├── middleware/         # Express middleware
├── models/             # Data models (PostgreSQL)
├── modules/            # Feature modules (NEW in Epic 2)
├── routes/             # API route handlers
├── scripts/            # Utility scripts (data seeding, testing)
├── services/           # Business logic services
├── test/               # Test utilities and fixtures
└── utils/              # Helper functions and utilities
```

---

## 🆕 New Components (Epic 2)

### `/backend/src/modules/` (NEW)

**Purpose**: Feature-based modular architecture

#### `healthcare_analytics/`
Healthcare-specific analytics modules organized by domain.

**Contents**:
- Medicare eligibility calculators
- Population health risk assessment
- Healthcare facility adequacy analysis
- Additional healthcare pattern implementations

**Status**: In development - future expansion point for healthcare analytics features

---

### `/backend/src/services/` - New Services

#### `mcpHealthcareService.ts` (NEW - Epic 2.2)
**Purpose**: MCP (Model Context Protocol) server implementation for healthcare analytics

**Key Features**:
- Bidirectional MCP server/client functionality
- Healthcare analytics tools exposed via MCP:
  - Medicare eligibility calculator
  - Population health risk assessment
  - Healthcare facility adequacy analysis
- Circuit breaker patterns for resilience
- Correlation ID tracking for observability

**Dependencies**: `mcpTools.ts`, `mcpMonitoring.ts`, `circuitBreaker.ts`

**Integration**: Used by MCP routes (`/backend/src/routes/mcp.routes.ts`)

---

#### `dataRefreshService.ts` (NEW - Epic 2.4)
**Purpose**: Real-time data refresh and federation service

**Key Features**:
- Census API data refresh orchestration
- DuckDB data synchronization
- MCP-based data federation
- Scheduled refresh capabilities
- Data freshness tracking

**Dependencies**: `dataFreshnessTracker.ts`, `duckdbPool.ts`

**Integration**: Used by data refresh routes and background jobs

---

### `/backend/src/middleware/` - New Middleware

#### `mcpAuth.ts` (NEW - Epic 2.2)
**Purpose**: Authentication and authorization for MCP endpoints

**Key Features**:
- Token-based authentication for MCP connections
- Role-based access control for healthcare tools
- Rate limiting specific to MCP operations
- Audit logging for MCP access

**Integration**: Applied to MCP routes for security

---

### `/backend/src/utils/` - New Utilities

#### `duckdbPool.ts` (NEW - Epic 2.1)
**Purpose**: Production-grade DuckDB connection pooling

**Key Features**:
- Connection pool management (2-10 connections)
- Healthcare-optimized DuckDB settings (4GB memory, 4 threads)
- EventEmitter-based lifecycle management
- Graceful shutdown handling
- MCP extension loading

**Status**: ✅ Production operational - 18/18 tests passing

---

#### `mcpTools.ts` (NEW - Epic 2.2)
**Purpose**: Healthcare analytics tools framework for MCP

**Key Features**:
- Tool definitions for Medicare, population health, facility adequacy
- Parameter validation and schema definitions
- Tool execution orchestration
- Response formatting

**Dependencies**: Used by `mcpHealthcareService.ts`

---

#### `mcpMonitoring.ts` (NEW - Epic 2.5)
**Purpose**: Production monitoring for MCP integration

**Key Features**:
- Correlation ID generation and tracking
- Performance metrics collection
- Error rate monitoring
- Circuit breaker status tracking
- Prometheus-compatible metrics export

**Integration**: Used throughout MCP services for observability

---

#### `circuitBreaker.ts` (NEW - Epic 2.2)
**Purpose**: Circuit breaker pattern for external service resilience

**Key Features**:
- Configurable failure thresholds
- Automatic circuit opening on failures
- Exponential backoff for recovery
- Health check monitoring

**Use Cases**: MCP external server connections, Census API calls

---

#### `dataFreshnessTracker.ts` (NEW - Epic 2.4)
**Purpose**: Track data freshness and staleness

**Key Features**:
- Last refresh timestamp tracking
- Staleness detection (configurable thresholds)
- Automated refresh triggering
- Data quality monitoring

**Integration**: Used by `dataRefreshService.ts`

---

#### `mcpResponseFormatter.ts` (NEW - Epic 2.2)
**Purpose**: Standardize MCP response formatting

**Key Features**:
- Consistent response structure
- Healthcare-specific metadata inclusion
- Error response formatting
- Statistical confidence indicators

---

## 🔄 Enhanced Components (Epic 2)

### `/backend/src/routes/`

#### `query.routes.ts` (ENHANCED - Epic 2.1, 2.3)
**Enhancements**:
- Integrated DuckDB connection pool (replacing dynamic imports)
- Healthcare analytics pattern recognition
- MCP validation integration
- 2-second timeout enforcement
- Graceful fallback handling

**New Functions**:
- `executeHealthcareAnalytics()` - Healthcare-specific query execution
- Enhanced error handling with correlation IDs

---

#### `health.routes.ts` (ENHANCED - Epic 2.1, 2.5)
**New Endpoints**:
- `GET /health/mcp` - MCP server health status
- `GET /health/mcp/metrics` - Production monitoring metrics

**Enhanced Checks**:
- DuckDB connection pool health
- MCP server status
- Circuit breaker state

---

#### `mcp.routes.ts` (NEW - Epic 2.2)
**Purpose**: MCP-specific API endpoints

**Endpoints**:
- `POST /mcp/tools/execute` - Execute MCP healthcare tools
- `GET /mcp/tools` - List available MCP tools
- `GET /mcp/resources` - List MCP resources
- `GET /mcp/status` - MCP server status

**Security**: Protected by `mcpAuth` middleware

---

### `/backend/src/config/`

#### `index.ts` (ENHANCED - Epic 2.1, 2.2)
**New Configuration**:
- DuckDB pool settings (`DUCKDB_MIN_CONNECTIONS`, `DUCKDB_MAX_CONNECTIONS`, etc.)
- MCP server configuration (`MCP_SERVER_PORT`, `ENABLE_MCP_SERVER`)
- Circuit breaker settings
- Feature flags (`USE_PRODUCTION_DUCKDB`)

---

#### `mcpConfig.ts` (NEW - Epic 2.2)
**Purpose**: MCP-specific configuration management

**Settings**:
- MCP server connection details
- Healthcare tool configurations
- Security settings
- Resource definitions

---

## 📊 Testing Infrastructure

### `/backend/src/__tests__/`

**Test Coverage**: 82%+ line coverage

**New Test Suites** (Epic 2):
- `utils/duckdbPool.test.ts` - 18/18 tests passing
- `utils/mcpTools.test.ts` - MCP tools validation
- `utils/mcpMonitoring.test.ts` - Monitoring functionality
- `utils/circuitBreaker.test.ts` - Circuit breaker patterns
- `utils/dataFreshnessTracker.test.ts` - Data freshness tracking
- `services/mcpServerService.test.ts` - MCP server integration
- `services/mcpClientService.test.ts` - MCP client functionality
- `services/dataRefreshService.test.ts` - Data refresh orchestration
- `routes/query.routes.mcp.test.ts` - MCP query integration

**Testing Approach**:
- Unit tests for individual components
- Integration tests for end-to-end flows
- Performance tests for sub-2 second requirement
- Load tests for concurrent query handling (10+ simultaneous)

---

## 🚀 Key Integration Points

### Application Entry Point: `index.ts`

**Epic 2 Enhancements**:
1. **DuckDB Pool Initialization** - Connection pool startup on app launch
2. **MCP Server Startup** - MCP server initialization if enabled
3. **Graceful Shutdown** - Proper cleanup of connections and services
4. **Health Monitoring** - Lifecycle event listeners for monitoring

**Initialization Order**:
```typescript
1. Load environment configuration
2. Initialize DuckDB connection pool
3. Start MCP server (if enabled)
4. Connect to PostgreSQL and Redis
5. Mount API routes
6. Start Express server
7. Set up graceful shutdown handlers
```

---

## 🔐 Security Considerations

### Authentication & Authorization
- JWT-based authentication (planned for production)
- MCP endpoint protection via `mcpAuth` middleware
- Role-based access control for healthcare tools

### Data Protection
- HIPAA-ready architecture with audit logging
- Data anonymization for externally published MCP resources
- Network segmentation considerations for MCP endpoints

### Rate Limiting
- Query endpoint: 100 requests/15 min per IP
- Export endpoint: 20 requests/15 min per IP
- MCP tools: Configurable per-tool limits

---

## 📈 Performance Optimization

### Connection Pooling
- **DuckDB**: 2-10 connections (configurable)
- **PostgreSQL**: Connection pooling via pg library
- **Redis**: Connection pooling via ioredis

### Caching Strategy
- Redis-based result caching
- Query result TTL: Configurable per query type
- MCP resource caching for repeated requests

### Query Optimization
- 2-second timeout enforcement
- Query complexity analysis
- Efficient DuckDB query patterns
- Healthcare-specific query optimizations

---

## 🔄 Data Flow Architecture

### Query Processing Flow
```
1. Frontend → POST /api/v1/queries
2. Rate limiting middleware
3. MCP validation (anthropicService)
4. DuckDB connection pool acquisition
5. Healthcare analytics execution
6. Result formatting with metadata
7. Response caching
8. Return to frontend
```

### MCP Integration Flow
```
1. External MCP client → MCP server endpoint
2. mcpAuth middleware validation
3. Tool execution request
4. Healthcare analytics tool invocation
5. DuckDB query execution
6. Response formatting with MCP schema
7. Correlation ID tracking
8. Return to MCP client
```

---

## 🛠 Development Guidelines

### Adding New Healthcare Analytics
1. Create tool definition in `mcpTools.ts`
2. Implement SQL patterns in `modules/healthcare_analytics/`
3. Add tests in `__tests__/modules/`
4. Update MCP configuration in `mcpConfig.ts`
5. Document in API reference

### Adding New Services
1. Create service file in `services/`
2. Implement with TypeScript interfaces
3. Add comprehensive tests
4. Integrate with dependency injection
5. Update configuration if needed

### Adding New Routes
1. Create route file in `routes/`
2. Apply appropriate middleware
3. Integrate with services
4. Add route tests
5. Update API documentation

---

## 📝 Migration Notes

### From Epic 1 to Epic 2
- **DuckDB Integration**: Dynamic imports → Connection pooling
- **Error Handling**: Basic try-catch → Circuit breakers + correlation IDs
- **Monitoring**: Console logs → Structured logging + metrics
- **Data Loading**: Mock fallback → Real Census data with graceful degradation

### Feature Flags
- `USE_PRODUCTION_DUCKDB`: Enable production connection pooling (default: false)
- `ENABLE_MCP_SERVER`: Enable MCP server capabilities (default: true)

---

## 📚 Additional Resources

- [API Documentation](/docs/api/README.md) - Complete API reference
- [DuckDB Reference](/docs/references/duckdb/) - DuckDB integration details
- [MCP Integration Guide](/docs/references/duckdb-mcp/) - MCP implementation guide
- [Epic 2 Documentation](/docs/epics/epic-2-duckdb-mcp-integration.md) - Complete Epic 2 details
- [Changelog](/CHANGELOG.md) - Detailed implementation history

---

**Status**: Production Ready • **Version**: 2.0.0 (Epic 2 Complete) • **Last Updated**: September 2025
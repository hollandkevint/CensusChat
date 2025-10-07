# CensusChat API Documentation

Complete API reference for the CensusChat healthcare demographics analytics platform.

**Status**: Production Ready (Epic 2 Complete - September 2025)

## 📚 Documentation Structure

### Core API Guides
- **[MCP API Documentation](MCP_API_DOCUMENTATION.md)** - Model Context Protocol integration and endpoints
- **[FDB MCP Developer Guide](FDB_MCP_DEVELOPER_GUIDE.md)** - Federated data bridge implementation
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment and configuration

### Quick Links
- [REST API Endpoints](#rest-api-endpoints)
- [MCP Integration](#mcp-integration)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## 🚀 REST API Endpoints

### Health & Status

#### `GET /health`
Check overall system health including database connections.

```bash
curl http://localhost:3001/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-29T12:00:00Z",
  "services": {
    "postgres": "healthy",
    "redis": "healthy",
    "duckdb": "healthy"
  }
}
```

#### `GET /health/mcp`
Check MCP server health and status.

```bash
curl http://localhost:3001/health/mcp
```

**Response**:
```json
{
  "status": "operational",
  "server": {
    "running": true,
    "connections": 5
  },
  "tools": ["medicare_eligibility", "population_health", "facility_adequacy"]
}
```

#### `GET /health/mcp/metrics`
Get production monitoring metrics for MCP integration.

```bash
curl http://localhost:3001/health/mcp/metrics
```

**Response**:
```json
{
  "uptime": 86400,
  "requestsProcessed": 1250,
  "averageResponseTime": 0.15,
  "circuitBreaker": {
    "status": "CLOSED",
    "failures": 0
  }
}
```

---

### Query Endpoints

#### `POST /api/v1/queries`
Execute natural language healthcare demographics query.

**Request**:
```bash
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me Medicare eligible seniors in Miami-Dade County"}'
```

**Request Body**:
```json
{
  "query": "string (required) - Natural language query for healthcare demographics"
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": [
    {
      "county": "Miami-Dade County",
      "state": "Florida",
      "total_population": 2716940,
      "seniors_65_plus": 475530,
      "medicare_eligible_estimate": 475530,
      "median_household_income": 52135
    }
  ],
  "metadata": {
    "query": "Show me Medicare eligible seniors in Miami-Dade County",
    "generatedSQL": "SELECT * FROM census_demographics WHERE county = 'Miami-Dade County'",
    "executionTime": "0.15s",
    "dataSource": "DuckDB + Census API",
    "confidence": "HIGH"
  }
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Query timeout exceeded 2 seconds"
}
```

**Features**:
- Sub-2 second response time enforcement
- MCP validation for SQL safety
- DuckDB connection pooling
- Healthcare-specific pattern recognition
- Graceful fallback handling

#### `GET /api/v1/queries/test`
Test query endpoint for system verification.

```bash
curl http://localhost:3001/api/v1/queries/test
```

---

### Export Endpoints

#### `POST /api/v1/export/excel`
Export query results to Excel format with statistical metadata.

**Request**:
```bash
curl -X POST http://localhost:3001/api/v1/export/excel \
  -H "Content-Type: application/json" \
  -d '{
    "data": [...],
    "metadata": {...}
  }' \
  --output results.xlsx
```

**Features**:
- Professional Excel formatting
- Statistical confidence intervals
- Metadata worksheet with query details
- Healthcare-specific calculations

---

## 🔗 MCP Integration

### Overview
CensusChat implements bidirectional Model Context Protocol (MCP) integration:
- **MCP Server**: Exposes healthcare analytics as tools/resources
- **MCP Client**: Connects to external MCP servers for data federation

### MCP Tools Available

#### 1. Medicare Eligibility Calculator
```typescript
{
  name: "medicare_eligibility",
  description: "Calculate Medicare eligibility for population demographics",
  parameters: {
    county: "string",
    state: "string"
  }
}
```

#### 2. Population Health Risk Assessment
```typescript
{
  name: "population_health",
  description: "Assess population health risk stratification",
  parameters: {
    geography: "string",
    metrics: ["income", "age", "access"]
  }
}
```

#### 3. Healthcare Facility Adequacy
```typescript
{
  name: "facility_adequacy",
  description: "Analyze healthcare facility adequacy for population",
  parameters: {
    region: "string",
    facilityType: "string"
  }
}
```

### Configuration
See [MCP API Documentation](MCP_API_DOCUMENTATION.md) for complete setup and configuration details.

---

## 🔐 Authentication

### Current Status
- **Development**: No authentication required for localhost testing
- **Production**: JWT-based authentication planned (see `JWT_SECRET` in `.env`)

### Future Implementation
```bash
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query": "..."}'
```

---

## ⚠️ Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-29T12:00:00Z"
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `QUERY_TIMEOUT` | Query exceeded 2-second limit | Simplify query or check database performance |
| `INVALID_QUERY` | Query validation failed | Review query syntax and try again |
| `DUCKDB_ERROR` | Database connection error | Check DuckDB pool health via `/health` |
| `MCP_VALIDATION_FAILED` | MCP validation rejected query | Query contains unsafe SQL patterns |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry with exponential backoff |

---

## 🚦 Rate Limiting

### Current Limits
- **Query Endpoint**: 100 requests per 15 minutes per IP
- **Export Endpoint**: 20 requests per 15 minutes per IP
- **Health Endpoints**: Unlimited

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

### Exceeding Limits
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

---

## 📊 Performance Characteristics

### Response Times (95th Percentile)
- **Query Endpoint**: < 2 seconds (enforced timeout)
- **Health Endpoints**: < 50ms
- **Export Endpoints**: < 5 seconds (varies with dataset size)

### Concurrency
- **Maximum Concurrent Queries**: 10+ (DuckDB connection pool)
- **Zero Crashes**: Stable connection pooling operational

### Monitoring
- Circuit breaker patterns for resilience
- Correlation ID tracking for request tracing
- Comprehensive error logging with observability

---

## 🧪 Testing the API

### Using cURL
```bash
# Health check
curl http://localhost:3001/health

# Test query
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me population data for Florida counties"}'

# MCP status
curl http://localhost:3001/health/mcp
```

### Using Postman
Import the Postman collection from `/docs/api/postman_collection.json` (coming soon).

### Using Frontend
Navigate to `http://localhost:3000` and use the ChatInterface for interactive testing.

---

## 📖 Additional Resources

- [System Architecture](../architecture/01-system-architecture.md) - Complete technical architecture
- [DuckDB Reference](../references/duckdb/) - Database integration details
- [MCP Comprehensive Guide](../references/duckdb-mcp/comprehensive-guide.md) - Deep dive into MCP
- [Testing Guide](../TESTING_GUIDE.md) - Testing infrastructure and strategies

---

## 🚀 Deployment

For production deployment instructions, see:
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete production deployment guide
- [Environment Configuration](../../.env.example) - Required environment variables
- [Docker Compose](../../docker-compose.yml) - Containerized deployment

### Environment Variables

**Required for Production**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/censuschat
REDIS_URL=redis://localhost:6379

# DuckDB Pool (Epic 2)
USE_PRODUCTION_DUCKDB=true
DUCKDB_MIN_CONNECTIONS=2
DUCKDB_MAX_CONNECTIONS=10
DUCKDB_MEMORY_LIMIT=4GB
DUCKDB_THREADS=4

# MCP Integration (Epic 2)
MCP_SERVER_PORT=3002
ENABLE_MCP_SERVER=true

# Security
JWT_SECRET=your-secure-secret-here
```

---

**Status**: Production Ready • **Version**: 2.0.0 (Epic 2 Complete) • **Last Updated**: September 2025

Need help? [Open an issue](https://github.com/username/CensusChat/issues) or check our [discussions](https://github.com/username/CensusChat/discussions).
# FDB-MCP Developer Guide

**Fast Database - Model Context Protocol Integration Framework**

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Core Concepts](#core-concepts)
5. [Implementation Guide](#implementation-guide)
6. [Performance Optimization](#performance-optimization)
7. [Testing Framework](#testing-framework)
8. [Deployment](#deployment)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

## Overview

The FDB-MCP (Fast Database - Model Context Protocol) framework enables natural language query interfaces for federated public dataset access. Originally demonstrated through healthcare analytics, the framework provides extensible patterns applicable to education, transportation, environment, and other public data domains.

### Key Features

- **Natural Language Processing**: Convert plain English queries to optimized SQL
- **Multi-Source Federation**: Intelligent data source routing with failover
- **Performance Optimization**: Sub-2 second response times with intelligent caching
- **MCP Integration**: External protocol access for AI system consumption
- **Extensible Architecture**: Template-driven module generation for new datasets
- **Comprehensive Testing**: Automated validation across multiple data domains

### Supported Domains

- **Healthcare**: Medicare/Medicaid, population health, facility adequacy
- **Education**: School performance, educational attainment, funding equity
- **Transportation**: Commute patterns, transit accessibility, traffic analysis
- **Environment**: Air quality, climate resilience, water systems
- **Economics**: Regional indicators, employment, business growth
- **Housing**: Affordability, market dynamics, development patterns

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                        │
├─────────────────────────────────────────────────────────────┤
│                  Natural Language Interface                  │
├─────────────────────────────────────────────────────────────┤
│  Healthcare  │ Education │ Transport │ Environment │ Other   │
│   Analytics  │ Analytics │ Analytics │  Analytics  │Domains  │
├─────────────────────────────────────────────────────────────┤
│                    Dataset Federator                         │
├─────────────────────────────────────────────────────────────┤
│  Census API  │ CMS Data  │   DOT     │   EPA API   │ Custom  │
│   Adapter    │  Adapter  │  Adapter  │   Adapter   │Adapters │
├─────────────────────────────────────────────────────────────┤
│              DuckDB Connection Pool (Fast DB)                │
├─────────────────────────────────────────────────────────────┤
│                   MCP Server Integration                     │
└─────────────────────────────────────────────────────────────┘
```

### Core Architecture Patterns

1. **Query Translation Layer**: Natural language to SQL pattern mapping
2. **Federation Strategy**: Multi-source data aggregation with fallback
3. **Performance Layer**: Caching, connection pooling, and optimization
4. **Protocol Layer**: MCP-compatible external tool exposure

## Getting Started

### Prerequisites

```bash
# Required software
- Node.js 18+
- TypeScript 5+
- DuckDB
- MCP Server Infrastructure (from Story 2.2)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/census-chat
cd census-chat

# Install dependencies
npm install

# Initialize healthcare analytics module (example)
npm run setup:healthcare-analytics
```

### Quick Start Example

```typescript
import { HealthcareAnalyticsModule } from './modules/healthcare_analytics';

// Initialize module
const healthcareModule = new HealthcareAnalyticsModule();

// Natural language query
const result = await healthcareModule.query(
  'Show me Medicare eligibility rates for Miami-Dade County',
  ['Miami-Dade'],
  '2023'
);

console.log('Data:', result.data);
console.log('Sources:', result.metadata.sources);
console.log('Execution time:', result.metadata.executionTime, 'ms');
```

## Core Concepts

### 1. Query Translation Patterns

FDB-MCP uses semantic analysis to translate natural language into structured queries:

```typescript
interface QueryTranslationPattern {
  intent: 'healthcare_analytics' | 'education_analytics' | string;
  entities: {
    geography: string[];      // Target geographic areas
    metrics: string[];        // Requested data metrics
    timeframe?: string;       // Temporal scope
  };
  sqlPattern: string;         // Generated SQL template
  parameters: Record<string, any>; // Query parameters
}
```

### 2. Dataset Federation

The framework supports multiple federation strategies:

**Primary with Fallback**
```typescript
// Try primary source (e.g., Census Bureau)
// Fall back to secondary sources on failure
const strategy = new PrimaryWithFallbackStrategy();
```

**Multi-Source Aggregation**
```typescript
// Query multiple sources and combine results
// Useful for comprehensive analysis
const strategy = new MultiSourceAggregationStrategy();
```

### 3. Performance Optimization

Sub-2 second response targets achieved through:

- **Query Optimization**: SQL pattern optimization for specific data sources
- **Intelligent Caching**: LRU cache with TTL and compression
- **Connection Pooling**: Optimized DuckDB connection management
- **Performance Monitoring**: Real-time alerting and metrics

### 4. MCP Protocol Integration

Expose analytics capabilities as MCP tools:

```typescript
interface HealthcareMCPTools {
  medicare_eligibility_analysis: (params: GeographicParams) => Promise<AnalysisResult>;
  population_health_assessment: (params: RiskFactorParams) => Promise<RiskAnalysis>;
  facility_adequacy_calculator: (params: FacilityParams) => Promise<AdequacyMetrics>;
}
```

## Implementation Guide

### Creating a New Dataset Module

#### Step 1: Generate Module Template

```typescript
import { createModuleTemplate } from './core/ModuleTemplateGenerator';

const config = {
  moduleName: 'education',
  domain: 'education',
  datasetConfig: {
    domain: 'education',
    primaryDataSource: 'department_of_education',
    fallbackSources: ['census_bureau', 'state_education_agencies'],
    commonGeographies: ['county', 'school_district', 'state'],
    standardMetrics: ['graduation_rate', 'test_scores', 'per_pupil_spending'],
    temporalGranularity: 'yearly'
  },
  outputDirectory: './modules',
  includeTests: true,
  includeDocs: true,
  mcpIntegration: true
};

const moduleStructure = await createModuleTemplate(config);
console.log('Generated files:', moduleStructure.generatedFiles);
```

#### Step 2: Implement Data Source Adapters

```typescript
// Example: Department of Education adapter
export class DepartmentOfEducationAdapter extends BaseEducationAdapter {
  async connect(): Promise<void> {
    // Implement API connection logic
    this.apiClient = new DOEApiClient({
      apiKey: process.env.DOE_API_KEY,
      baseUrl: 'https://api.ed.gov/data/v3'
    });
  }

  async query(sqlPattern: string, parameters: any): Promise<any[]> {
    // Convert SQL pattern to API-specific requests
    const apiQuery = this.translateSQLToAPI(sqlPattern, parameters);
    const response = await this.apiClient.query(apiQuery);
    return response.data;
  }

  async transformResults(rawData: any[]): Promise<StandardizedDataFormat> {
    // Transform API response to standardized format
    return {
      data: rawData.map(record => this.standardizeEducationRecord(record)),
      metadata: { /* ... */ }
    };
  }
}
```

#### Step 3: Configure Query Patterns

```typescript
// Education-specific query patterns
const educationPatterns = {
  'graduation_rates': `
    SELECT
      district_name, county, state,
      graduation_rate, total_students,
      year
    FROM education_districts
    WHERE county IN ({geography})
      AND year = {year}
    ORDER BY graduation_rate DESC
  `,

  'funding_equity': `
    SELECT
      state,
      AVG(per_pupil_spending) as avg_spending,
      STDDEV(per_pupil_spending) as spending_variation
    FROM education_districts
    WHERE state IN ({geography})
    GROUP BY state
    ORDER BY spending_variation DESC
  `
};
```

#### Step 4: Register with Federation System

```typescript
// Register adapters with federator
const federator = getDatasetFederator();
await federator.registerAdapter(new DepartmentOfEducationAdapter());
await federator.registerAdapter(new CensusBureauAdapter()); // Fallback

// Register MCP tools
const mcpServer = getMCPServer();
const educationTools = await new EducationMCPConnector().exposeEducationTools();
mcpServer.addTools(educationTools);
```

### Customizing Performance Settings

```typescript
// Configure query optimizer
const optimizer = getQueryOptimizer({
  maxSize: 2000,           // Cache up to 2000 queries
  ttl: 600000,             // 10 minutes TTL
  compressionThreshold: 50000, // 50KB compression threshold
});

// Configure performance monitoring
const monitor = getPerformanceMonitor({
  maxExecutionTime: 1500,  // 1.5s threshold for alerts
  minCacheHitRate: 0.75,   // 75% minimum hit rate
  maxConcurrentQueries: 15 // Alert if >15 concurrent
});

monitor.startMonitoring(10000); // Check every 10 seconds
```

### Adding Custom SQL Optimizations

```typescript
class CustomQueryOptimizer extends QueryOptimizer {
  protected optimizeSQL(pattern: QueryTranslationPattern): string {
    let sql = super.optimizeSQL(pattern);

    // Domain-specific optimizations
    if (pattern.intent === 'education_analytics') {
      // Add education-specific index hints
      sql = sql.replace(
        'WHERE school_district',
        'WHERE /*+ INDEX(district_idx) */ school_district'
      );

      // Optimize for common education queries
      if (sql.includes('graduation_rate')) {
        sql = `SET enable_nested_loop = true; ${sql}`;
      }
    }

    return sql;
  }
}
```

## Performance Optimization

### Query Caching Strategy

```typescript
// Cache configuration
const cacheConfig = {
  // Size-based eviction
  maxSize: 1000,

  // Time-based expiration
  ttl: 300000, // 5 minutes

  // Stale-while-revalidate
  staleWhileRevalidate: 60000, // 1 minute

  // Compression for large results
  compressionThreshold: 100000 // 100KB
};

// Cache key generation
function generateCacheKey(pattern: QueryTranslationPattern): string {
  const keyData = {
    intent: pattern.intent,
    geography: pattern.entities.geography?.sort(),
    metrics: pattern.entities.metrics?.sort(),
    timeframe: pattern.entities.timeframe
  };
  return crypto.createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex')
    .substring(0, 16);
}
```

### Connection Pool Optimization

```typescript
// DuckDB pool configuration
const poolConfig = {
  minConnections: 3,        // Minimum pool size
  maxConnections: 15,       // Maximum pool size
  connectionTimeout: 30000, // 30s connection timeout
  memoryLimit: '6GB',       // Per-connection memory
  threads: 6                // Parallel processing threads
};

// Healthcare-specific DuckDB settings
const healthcareSettings = [
  "SET memory_limit = '6GB'",
  "SET threads = 6",
  "SET enable_progress_bar = false",
  "SET default_null_order = 'NULLS LAST'",
  "INSTALL spatial; LOAD spatial", // For geographic analysis
  "INSTALL httpfs; LOAD httpfs"    // For remote data access
];
```

### Performance Monitoring

```typescript
// Real-time performance tracking
monitor.on('alert', (alert) => {
  console.warn(`🚨 Performance Alert: ${alert.message}`);

  if (alert.severity === 'critical') {
    // Implement automated remediation
    if (alert.type === 'query_timeout') {
      // Scale up connection pool
      pool.updateConfig({ maxConnections: pool.config.maxConnections + 5 });
    }

    if (alert.type === 'cache_miss_spike') {
      // Trigger cache warmup
      await warmupCommonQueries();
    }
  }
});

// Performance metrics collection
const metrics = monitor.getPerformanceMetrics();
console.log({
  avgResponseTime: metrics.avgResponseTime,
  cacheHitRate: metrics.cacheStats.hitRatio,
  sub2sCompliance: metrics.sub2sCompliance
});
```

## Testing Framework

### Running Comprehensive Tests

```typescript
// Run all domain test suites
const testFramework = getMultiDatasetTestFramework();
const report = await testFramework.runAllSuites();

console.log(`Test Results:
- Total Tests: ${report.overallSummary.totalTests}
- Pass Rate: ${(report.overallSummary.passRate * 100).toFixed(1)}%
- Avg Response: ${report.overallSummary.avgResponseTime.toFixed(0)}ms
- Domains: ${report.overallSummary.domainsCovered.join(', ')}
`);

// Review recommendations
report.recommendations.forEach(rec => {
  console.log(`💡 ${rec}`);
});
```

### Custom Test Cases

```typescript
// Register custom test suite
testFramework.registerTestSuite({
  id: 'custom_integration_suite',
  name: 'Custom Integration Tests',
  domain: 'healthcare',
  description: 'Custom tests for specific use cases',
  testCases: [
    {
      id: 'custom_01',
      name: 'Multi-State Medicare Analysis',
      domain: 'healthcare',
      description: 'Test cross-state Medicare analysis',
      query: 'Compare Medicare coverage across southeastern states',
      geography: ['Florida', 'Georgia', 'Alabama'],
      expectedMetrics: ['medicare_eligible', 'coverage_rate'],
      priority: 'high'
    }
  ]
});
```

### Performance Validation

```typescript
// Quick performance validation
const validation = await testFramework.runSmokeTests();

if (validation.overallSummary.avgResponseTime > 2000) {
  console.error('❌ Performance regression detected');
  process.exit(1);
}

console.log('✅ Performance validation passed');
```

## API Reference

### Core Classes

#### HealthcareAnalyticsModule

```typescript
class HealthcareAnalyticsModule {
  constructor();

  async query(
    naturalLanguageQuery: string,
    geography: string[],
    timeframe?: string
  ): Promise<FederatedQueryResult>;

  async getAvailableMetrics(): Promise<string[]>;
  async getSupportedGeographies(): Promise<string[]>;
  async healthCheck(): Promise<boolean>;
}
```

#### DatasetFederator

```typescript
class DatasetFederator {
  constructor(config?: DatasetFederatorConfig);

  async registerAdapter(adapter: PublicDatasetAdapter): Promise<void>;
  async executeDistributedQuery(
    pattern: QueryTranslationPattern,
    strategy?: string
  ): Promise<FederatedQueryResult>;

  getAvailableAdapters(): string[];
  getAvailableStrategies(): string[];
}
```

#### QueryOptimizer

```typescript
class QueryOptimizer {
  constructor(config?: QueryCacheConfig);

  async executeOptimizedQuery(
    pattern: QueryTranslationPattern,
    executeFunction: (pattern: QueryTranslationPattern) => Promise<FederatedQueryResult>
  ): Promise<QueryOptimizationResult>;

  getPerformanceMetrics(): PerformanceMetrics;
  getCacheStats(): CacheStatistics;
}
```

### MCP Tool Definitions

#### Healthcare MCP Tools

```typescript
// Medicare eligibility analysis
POST /mcp/tools/medicare_eligibility_analysis
{
  "geography": ["Miami-Dade", "Broward"],
  "timeframe": "2023"
}

// Population health assessment
POST /mcp/tools/population_health_assessment
{
  "geography": ["Florida"],
  "risk_factors": ["diabetes", "hypertension"],
  "timeframe": "2023"
}

// Facility adequacy calculation
POST /mcp/tools/facility_adequacy_calculator
{
  "geography": ["Rural County"],
  "facility_types": ["hospitals", "primary_care"],
  "population_threshold": 10000
}
```

### Configuration Interfaces

```typescript
interface DatasetFederatorConfig {
  defaultStrategy?: string;
  enableCaching?: boolean;
  cacheTimeoutMs?: number;
  maxConcurrentQueries?: number;
  queryTimeoutMs?: number;
  retryAttempts?: number;
}

interface QueryCacheConfig {
  maxSize: number;
  ttl: number;
  staleWhileRevalidate: number;
  compressionThreshold: number;
}

interface PerformanceThreshold {
  maxExecutionTime: number;
  maxCacheMissRate: number;
  minCacheHitRate: number;
  maxConcurrentQueries: number;
  alertCooldown: number;
}
```

## Troubleshooting

### Common Issues

#### 1. Query Translation Failures

```typescript
// Problem: Natural language not translating to SQL
// Solution: Check pattern matching logic

const router = new HealthcareQueryRouter();
const pattern = await router.translateQuery(query, geography);

if (!pattern || !pattern.sqlPattern) {
  console.error('Translation failed for query:', query);
  // Check if query contains recognized keywords
  // Verify geography format matches expected patterns
}
```

#### 2. Performance Degradation

```typescript
// Problem: Response times exceeding 2s threshold
// Solution: Check optimization and caching

const optimizer = getQueryOptimizer();
const metrics = optimizer.getPerformanceMetrics();

if (metrics.avgExecutionTime > 2000) {
  console.log('Cache hit rate:', metrics.cacheStats.hitRatio);

  if (metrics.cacheStats.hitRatio < 0.5) {
    // Warm up cache with common queries
    await optimizer.warmupCache(commonPatterns, executeFunction);
  }

  // Check database connection pool
  const pool = getDuckDBPool();
  const stats = pool.getStats();
  console.log('Pool utilization:', stats.activeConnections / stats.totalConnections);
}
```

#### 3. Data Source Connection Issues

```typescript
// Problem: Adapter connection failures
// Solution: Implement retry and health checking

class RobustAdapter extends BaseHealthcareAdapter {
  async connect(): Promise<void> {
    let retries = 3;
    while (retries > 0) {
      try {
        await super.connect();
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async healthCheck(): Promise<{ healthy: boolean }> {
    try {
      // Implement specific health check logic
      const result = await this.query('SELECT 1', {});
      return { healthy: result.length > 0 };
    } catch (error) {
      return { healthy: false };
    }
  }
}
```

#### 4. MCP Integration Problems

```typescript
// Problem: MCP tools not accessible
// Solution: Verify tool registration and authentication

const mcpServer = getMCPServer();

// Check tool registration
const registeredTools = mcpServer.getRegisteredTools();
console.log('Registered MCP tools:', registeredTools.map(t => t.name));

// Verify authentication
if (!mcpServer.isAuthenticated()) {
  await mcpServer.authenticate({
    clientId: process.env.MCP_CLIENT_ID,
    clientSecret: process.env.MCP_CLIENT_SECRET
  });
}
```

### Debugging Tips

1. **Enable Verbose Logging**
   ```bash
   DEBUG=fdb-mcp:* npm start
   ```

2. **Monitor Performance Metrics**
   ```typescript
   const monitor = getPerformanceMonitor();
   monitor.startMonitoring(5000); // 5 second intervals

   monitor.on('alert', (alert) => {
     console.log('Performance Alert:', alert);
   });
   ```

3. **Test with Known Data**
   ```typescript
   // Use test framework for validation
   const testResult = await testFramework.runSmokeTests();

   if (!testResult.overallSummary.passRate > 0.9) {
     console.error('System validation failed');
   }
   ```

### Performance Tuning Checklist

- [ ] Cache hit rate > 70%
- [ ] Average response time < 1.5s
- [ ] 95th percentile response time < 2s
- [ ] Database pool utilization < 80%
- [ ] Memory usage < 85%
- [ ] Error rate < 2%
- [ ] MCP tool response time < 500ms

### Best Practices

1. **Query Pattern Design**
   - Use specific, targeted SQL patterns
   - Implement proper indexing hints
   - Limit result sets appropriately

2. **Caching Strategy**
   - Cache frequently requested patterns
   - Use appropriate TTL values
   - Monitor cache hit rates

3. **Error Handling**
   - Implement graceful degradation
   - Use circuit breaker patterns
   - Log errors with context

4. **Monitoring**
   - Set up performance alerts
   - Monitor system resources
   - Track user query patterns

5. **Testing**
   - Run comprehensive test suites
   - Validate performance regularly
   - Test failover scenarios

---

*For additional support, please refer to the project issues tracker or contact the development team.*
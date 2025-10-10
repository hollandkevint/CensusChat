# CensusChat API Integration Guide
## MCP Layer, SQL Validation & Census API Flow

### Overview

CensusChat's backend API serves as the intelligent middleware between natural language queries and Census Bureau data. The system uses Model Context Protocol (MCP) for SQL validation and Claude Sonnet for natural language processing.

### Architecture Flow

```
Frontend Query → Backend API → MCP Validation → Claude Translation → Census API → Response Processing → Frontend Display
```

### API Endpoints

#### Core Query Endpoint
**POST** `/api/v1/queries`

**Request Format**:
```json
{
  "query": "Show me Medicare eligible seniors in Florida with income over $50k",
  "options": {
    "format": "table|chart|export",
    "limit": 1000,
    "includeMetadata": true
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "message": "Found 1,234,567 records matching your query",
  "data": [
    {
      "geography": "Florida",
      "seniors_count": 1234567,
      "medicare_eligible": 987654,
      "high_income_seniors": 456789
    }
  ],
  "metadata": {
    "queryTime": 1.8,
    "totalRecords": 1234567,
    "dataSource": "ACS 2022 5-Year",
    "confidenceLevel": 0.95,
    "marginOfError": 2.3
  },
  "sql": {
    "validated": true,
    "query": "SELECT geography, COUNT(*) as seniors_count...",
    "explain": "Query retrieves population data filtered by age 65+, Medicare eligibility, and income thresholds"
  }
}
```

#### Authentication Endpoints
**POST** `/api/v1/auth/login`
**POST** `/api/v1/auth/logout`  
**GET** `/api/v1/auth/profile`

#### Query Management
**GET** `/api/v1/queries/history` - User query history
**POST** `/api/v1/queries/save` - Save query for reuse
**DELETE** `/api/v1/queries/{id}` - Delete saved query

#### Data Export
**POST** `/api/v1/export/excel` - Generate Excel file
**POST** `/api/v1/export/csv` - Generate CSV file
**POST** `/api/v1/export/pdf` - Generate PDF report

### MCP Integration

#### SQL Validation Layer
The MCP (Model Context Protocol) layer provides robust SQL validation before query execution:

**Validation Process**:
1. **Syntax Checking**: Validates SQL syntax correctness
2. **Security Scanning**: Prevents SQL injection attacks
3. **Performance Analysis**: Estimates query complexity and execution time
4. **Data Compliance**: Ensures queries comply with Census data usage policies

**MCP Configuration**:
```typescript
const mcpValidator = new MCPValidator({
  maxComplexity: 1000,
  allowedTables: ['census_data', 'geography', 'demographics'],
  prohibitedOperations: ['DROP', 'DELETE', 'UPDATE', 'INSERT'],
  timeoutMs: 5000
});
```

#### Validation Response
```json
{
  "valid": true,
  "confidence": 0.98,
  "estimatedRows": 125000,
  "estimatedTime": 1.2,
  "warnings": [],
  "suggestions": [
    "Consider adding geographic filters to improve performance"
  ]
}
```

### Claude Integration

#### Natural Language Processing
Claude Sonnet 4 translates natural language queries into SQL:

**Translation Process**:
1. **Intent Recognition**: Identifies query type and data requirements
2. **Entity Extraction**: Extracts geographic, demographic, and temporal filters
3. **SQL Generation**: Creates optimized SQL query
4. **Context Preservation**: Maintains conversation context for follow-up queries

**Claude Configuration**:
```typescript
const claudeClient = new AnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1000,
  temperature: 0.1 // Low temperature for consistent SQL generation
});
```

#### Prompt Template
```typescript
const QUERY_TRANSLATION_PROMPT = `
You are a healthcare demographics expert. Translate this natural language query into SQL for Census data:

Query: "${userQuery}"

Available tables:
- census_data (geography_code, variable_code, value, margin_of_error, year)
- geography (code, name, type, state_code)
- variables (code, label, concept, group)

Healthcare context:
- Medicare eligibility typically starts at age 65
- Senior care focuses on 65+ population
- Income thresholds often reference poverty guidelines

Generate SQL that:
1. Filters for relevant demographics
2. Includes geographic specificity
3. Provides statistical confidence measures
4. Optimizes for performance

SQL Query:
`;
```

### Census API Integration

#### Service Configuration
```typescript
class CensusApiService {
  private baseURL = 'https://api.census.gov/data';
  private apiKey = process.env.CENSUS_API_KEY;
  private timeout = 30000; // 30 second timeout

  async queryData(params: CensusQueryParams): Promise<CensusResponse> {
    const url = this.buildQueryURL(params);
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: { 'User-Agent': 'CensusChat/1.0' }
    });
    return this.processResponse(response.data);
  }
}
```

#### Error Handling
```typescript
const handleCensusAPIError = (error: AxiosError) => {
  if (error.response?.status === 429) {
    throw new APIError('RATE_LIMIT', 'Census API rate limit exceeded');
  } else if (error.response?.status === 400) {
    throw new APIError('INVALID_QUERY', 'Invalid Census API parameters');
  } else if (error.code === 'ENOTFOUND') {
    throw new APIError('NETWORK', 'Cannot connect to Census API');
  } else {
    throw new APIError('UNKNOWN', 'Census API error');
  }
};
```

### Data Processing Pipeline

#### Response Transformation
```typescript
interface ProcessingPipeline {
  // 1. Raw Census API response
  censusData: CensusAPIResponse;
  
  // 2. Data validation and cleaning
  validateData(data: any[]): ValidationResult;
  
  // 3. Statistical calculations
  calculateStatistics(data: any[]): StatisticalSummary;
  
  // 4. Format for frontend consumption
  formatForDisplay(data: any[]): DisplayData;
  
  // 5. Generate export formats
  generateExports(data: any[]): ExportFormats;
}
```

#### Data Validation
```typescript
const validateCensusData = (data: any[]): ValidationResult => {
  const validation = {
    totalRecords: data.length,
    nullValues: countNullValues(data),
    outliers: detectOutliers(data),
    dataQuality: calculateQualityScore(data),
    marginOfError: extractMarginOfError(data)
  };
  
  return {
    isValid: validation.dataQuality > 0.8,
    warnings: generateWarnings(validation),
    metadata: validation
  };
};
```

### Caching Strategy

#### Redis Cache Implementation
```typescript
class QueryCache {
  private redis = new Redis(process.env.REDIS_URL);
  private defaultTTL = 3600; // 1 hour

  async get(queryHash: string): Promise<CachedResult | null> {
    const cached = await this.redis.get(`query:${queryHash}`);
    return cached ? JSON.parse(cached) : null;
  }

  async set(queryHash: string, result: any, ttl = this.defaultTTL): Promise<void> {
    await this.redis.setex(`query:${queryHash}`, ttl, JSON.stringify(result));
  }

  generateHash(query: string, params: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ query, params }))
      .digest('hex');
  }
}
```

#### Cache Invalidation
- **Time-based**: Automatic expiration after 1 hour
- **Version-based**: Clear cache when Census data updates
- **User-based**: Separate cache per user for personalized queries

### Performance Monitoring

#### Query Performance Tracking
```typescript
const trackQueryPerformance = async (queryId: string, startTime: number) => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  await analytics.track('query_performance', {
    queryId,
    duration,
    timestamp: new Date().toISOString(),
    success: true
  });
  
  // Alert if performance degrades
  if (duration > 5000) {
    logger.warn(`Slow query detected: ${queryId} took ${duration}ms`);
  }
};
```

#### Error Rate Monitoring
```typescript
const errorRateMonitor = {
  track: (error: APIError) => {
    metrics.increment('api.errors', {
      type: error.type,
      endpoint: error.endpoint
    });
  },
  
  alert: (errorRate: number) => {
    if (errorRate > 0.05) { // 5% error rate
      alerting.send('High API error rate detected');
    }
  }
};
```

### Security Measures

#### API Key Management
```typescript
const apiKeyRotation = {
  primary: process.env.CENSUS_API_KEY_PRIMARY,
  secondary: process.env.CENSUS_API_KEY_SECONDARY,
  
  getCurrentKey(): string {
    // Rotate keys based on time or usage
    return this.shouldRotate() ? this.secondary : this.primary;
  },
  
  shouldRotate(): boolean {
    // Rotate every 24 hours or after 10k requests
    return Date.now() % (24 * 60 * 60 * 1000) < 1000;
  }
};
```

#### Rate Limiting
```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Development and Testing

#### Mock API Development
```typescript
// Development mode: use mock Census API
if (process.env.NODE_ENV === 'development') {
  const mockCensusAPI = new MockCensusAPI({
    responseDelay: 500,
    errorRate: 0.05,
    dataVariability: true
  });
}
```

#### Integration Testing
```typescript
describe('API Integration', () => {
  test('processes natural language query', async () => {
    const query = "Medicare seniors in California";
    const response = await queryAPI(query);
    
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.sql.validated).toBe(true);
  });
});
```

### Deployment Configuration

#### Environment Variables
```bash
# Production environment
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
CENSUS_API_KEY=your-census-api-key-here
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@host:port/db
MCP_ENDPOINT=https://mcp.service.url
LOG_LEVEL=info
```

#### Health Checks
```typescript
const healthCheck = {
  async checkCensusAPI(): Promise<boolean> {
    try {
      await censusAPI.get('/data');
      return true;
    } catch {
      return false;
    }
  },
  
  async checkMCP(): Promise<boolean> {
    try {
      await mcpValidator.validate('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },
  
  async checkClaude(): Promise<boolean> {
    try {
      await claudeClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
      return true;
    } catch {
      return false;
    }
  }
};
```

### Future Enhancements

#### Planned Integrations
- [ ] **GraphQL API**: More flexible data querying
- [ ] **WebSocket Support**: Real-time query updates  
- [ ] **Batch Processing**: Handle multiple queries efficiently
- [ ] **Machine Learning**: Improve query translation accuracy
- [ ] **Data Streaming**: Handle large result sets efficiently

#### Performance Improvements
- [ ] **Query Optimization**: Automatic query plan analysis
- [ ] **Predictive Caching**: Cache likely follow-up queries
- [ ] **Connection Pooling**: Optimize database connections
- [ ] **CDN Integration**: Cache static responses geographically

This API integration provides a robust, scalable foundation for CensusChat's core functionality while maintaining security, performance, and reliability standards required for enterprise healthcare applications.
# MCP Healthcare Analytics API Documentation

## Overview

The Model Context Protocol (MCP) Healthcare Analytics API provides external systems with standardized access to healthcare data analysis tools. This API exposes healthcare analytics capabilities through a RESTful interface with comprehensive authentication, authorization, and response formatting.

**Base URL:** `/api/v1/mcp`
**Protocol Version:** v1.0.0
**Authentication:** Bearer Token (JWT) or API Key

## Quick Start

### 1. Authentication

Obtain an API key from your administrator or generate a JWT token:

```bash
# Using API Key
curl -H "X-API-Key: mcp_hc_your_api_key_here" \
     -H "Content-Type: application/json" \
     https://your-api.com/api/v1/mcp/info

# Using Bearer Token
curl -H "Authorization: Bearer your_jwt_token_here" \
     -H "Content-Type: application/json" \
     https://your-api.com/api/v1/mcp/info
```

### 2. Protocol Information

```bash
GET /api/v1/mcp/info
```

Response:
```json
{
  "version": "v1.0.0",
  "supportedVersions": ["v1.0.0"],
  "features": {
    "v1.0.0": [
      "medicare_eligibility_analysis",
      "population_health_assessment",
      "facility_adequacy_calculator",
      "healthcare_dashboard_composite"
    ]
  }
}
```

### 3. Available Tools

```bash
GET /api/v1/mcp/tools
```

Response:
```json
{
  "success": true,
  "tools": [
    {
      "name": "medicare_eligibility_analysis",
      "description": "Analyze Medicare eligibility and opportunity across geographic regions",
      "parameters": {
        "geography_type": "state | county | zip",
        "geography_codes": ["array of location codes"],
        "include_projections": "boolean (optional)"
      },
      "permissions": "analyze:medicare"
    }
  ]
}
```

## Authentication & Authorization

### Authentication Methods

#### 1. API Key Authentication
```bash
curl -H "X-API-Key: mcp_hc_your_api_key_here" \
     -d '{"geography_type": "state", "geography_codes": ["FL"]}' \
     -H "Content-Type: application/json" \
     https://your-api.com/api/v1/mcp/tools/medicare_eligibility_analysis
```

#### 2. Bearer Token (JWT)
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     -d '{"geography_type": "state", "geography_codes": ["FL"]}' \
     -H "Content-Type: application/json" \
     https://your-api.com/api/v1/mcp/tools/medicare_eligibility_analysis
```

### Permission Levels

| Permission | Description | Tools |
|------------|-------------|-------|
| `read:medicare_data` | Basic Medicare data access | All tools (read-only) |
| `analyze:medicare` | Medicare analysis capabilities | medicare_eligibility_analysis |
| `analyze:health_risks` | Population health analysis | population_health_assessment |
| `analyze:facilities` | Healthcare facility analysis | facility_adequacy_calculator |
| `analyze:comprehensive` | Full dashboard access | healthcare_dashboard_composite |
| `admin:*` | Administrative access | All tools |

### Rate Limiting

- **Rate Limit:** 60 requests per minute per authenticated user
- **Response Headers:** Rate limit information included in responses
- **429 Status:** Returned when rate limit exceeded

## Healthcare Analytics Tools

### 1. Medicare Eligibility Analysis

Analyzes Medicare eligibility rates and market opportunities across geographic regions.

**Endpoint:** `POST /api/v1/mcp/tools/medicare_eligibility_analysis`
**Required Permission:** `analyze:medicare`

**Request Parameters:**
```typescript
{
  geography_type: 'state' | 'county' | 'zip';
  geography_codes: string[];          // e.g., ["FL", "CA"] for states
  include_projections?: boolean;      // Include 5-year projections
  dual_eligible_focus?: boolean;      // Focus on dual-eligible population
}
```

**Example Request:**
```bash
curl -X POST https://your-api.com/api/v1/mcp/tools/medicare_eligibility_analysis \
  -H "X-API-Key: mcp_hc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "geography_type": "state",
    "geography_codes": ["FL", "CA", "TX"],
    "include_projections": true,
    "dual_eligible_focus": false
  }'
```

**Response:**
```json
{
  "protocol": {
    "version": "v1.0.0",
    "timestamp": "2025-01-23T10:30:00Z",
    "requestId": "req_123456"
  },
  "tool": {
    "name": "medicare_eligibility_analysis",
    "version": "v1.0.0",
    "executionTime": 1.2
  },
  "status": {
    "success": true,
    "code": 200,
    "message": "Healthcare analysis completed successfully"
  },
  "data": {
    "analytics": [
      {
        "geography": "Florida",
        "geography_code": "FL",
        "medicare_eligible_population": 4456789,
        "medicare_eligible_rate": 21.2,
        "estimated_medicare_beneficiaries": 3234567,
        "growth_opportunity_count": 1222222,
        "dual_eligible_population": 567890,
        "projection_2029": {
          "medicare_eligible_population": 5234567,
          "growth_rate": 17.5
        }
      }
    ],
    "summary": {
      "totalRecords": 3,
      "geographicCoverage": ["Florida", "California", "Texas"],
      "keyInsights": [
        "Average Medicare eligibility rate: 19.8%",
        "3 areas have high senior populations (>20% eligibility rate)",
        "Total estimated Medicare beneficiaries: 15,234,567"
      ],
      "recommendations": [
        "Focus Medicare Advantage expansion on 2 high-opportunity markets",
        "Consider dual-eligible special needs plans for low-income senior populations"
      ]
    },
    "chartData": {
      "type": "bar",
      "categories": ["Florida", "California", "Texas"],
      "series": [{
        "name": "Medicare Eligibility Rate (%)",
        "data": [21.2, 18.9, 19.3]
      }]
    }
  },
  "metadata": {
    "recordCount": 3,
    "sources": ["Census Bureau ACS", "CMS State Statistics"],
    "confidenceLevel": 95,
    "cacheInfo": {
      "cached": false
    }
  },
  "links": {
    "self": "/api/v1/mcp/tools/medicare_eligibility_analysis",
    "documentation": "/api/v1/mcp/docs/medicare_eligibility_analysis",
    "relatedTools": ["population_health_assessment", "facility_adequacy_calculator"]
  }
}
```

### 2. Population Health Assessment

Evaluates population health risks and social determinants across geographic areas.

**Endpoint:** `POST /api/v1/mcp/tools/population_health_assessment`
**Required Permission:** `analyze:health_risks`

**Request Parameters:**
```typescript
{
  geography_type: 'state' | 'county' | 'zip';
  geography_codes: string[];
  risk_factors?: string[];           // e.g., ["diabetes", "obesity", "smoking"]
  include_social_determinants?: boolean;
  age_group_focus?: 'all' | 'seniors' | 'adults' | 'children';
}
```

**Example Request:**
```bash
curl -X POST https://your-api.com/api/v1/mcp/tools/population_health_assessment \
  -H "X-API-Key: mcp_hc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "geography_type": "county",
    "geography_codes": ["12086", "06037"],
    "risk_factors": ["diabetes", "obesity"],
    "include_social_determinants": true,
    "age_group_focus": "seniors"
  }'
```

### 3. Facility Adequacy Calculator

Calculates healthcare facility adequacy and access metrics for geographic regions.

**Endpoint:** `POST /api/v1/mcp/tools/facility_adequacy_calculator`
**Required Permission:** `analyze:facilities`

**Request Parameters:**
```typescript
{
  geography_type: 'state' | 'county' | 'zip';
  geography_codes: string[];
  facility_types?: string[];         // e.g., ["hospital", "primary_care", "specialist"]
  include_rural_analysis?: boolean;
  accessibility_metrics?: boolean;   // Include travel time, distance analysis
}
```

### 4. Healthcare Dashboard Composite

Provides comprehensive healthcare analytics combining all data sources.

**Endpoint:** `POST /api/v1/mcp/tools/healthcare_dashboard_composite`
**Required Permission:** `analyze:comprehensive`

**Request Parameters:**
```typescript
{
  geography_type: 'state' | 'county' | 'zip';
  geography_codes: string[];
  analysis_depth: 'summary' | 'detailed' | 'comprehensive';
  include_all_metrics: boolean;
  chart_generation: boolean;
}
```

## Response Format

All MCP tools return standardized responses following the `MCPResponseEnvelope` format:

### Success Response Structure
```typescript
{
  protocol: {
    version: string;                // Protocol version
    timestamp: string;              // ISO 8601 timestamp
    requestId?: string;             // Unique request identifier
    correlationId?: string;         // Cross-system correlation ID
  };
  tool: {
    name: string;                   // Tool name
    version: string;                // Tool version
    executionTime: number;          // Execution time in seconds
  };
  status: {
    success: boolean;               // Always true for success
    code: number;                   // HTTP status code (200)
    message?: string;               // Success message
  };
  data: {
    analytics: any[];               // Core analysis data
    summary: {
      totalRecords: number;
      geographicCoverage: string[];
      keyInsights: string[];
      recommendations?: string[];
    };
    chartData?: {                   // Optional visualization data
      type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap';
      categories: string[];
      series: any[];
    };
  };
  metadata: {
    recordCount: number;            // Number of records returned
    sources: string[];              // Data sources used
    confidenceLevel: number;        // Analysis confidence (0-100)
    queryPattern?: string;          // SQL pattern used
    cacheInfo: {
      cached: boolean;              // Whether result was cached
      ttl?: number;                 // Cache TTL if cached
    };
  };
  links: {
    self?: string;                  // Current endpoint
    documentation?: string;         // Tool documentation
    relatedTools?: string[];        // Related tool endpoints
  };
}
```

### Error Response Structure
```typescript
{
  protocol: { /* same as success */ };
  tool: { /* same as success */ };
  status: {
    success: false;                 // Always false for errors
    code: number;                   // HTTP error code
    message: string;                // Error message
  };
  metadata: {
    recordCount: 0;
    sources: [];
    confidenceLevel: 0;
  };
  error: {
    code: string;                   // Standardized error code
    message: string;                // Detailed error message
    details?: any;                  // Additional error details
    retryable: boolean;             // Whether error is retryable
  };
  links: {
    documentation?: string;         // Tool documentation
    self?: string;                  // Current endpoint
  };
}
```

## Error Codes

### Client Errors (4xx)
- `MCP_400_INVALID_PARAMETERS` - Invalid request parameters
- `MCP_401_AUTHENTICATION_REQUIRED` - Authentication required
- `MCP_403_AUTHORIZATION_FAILED` - Insufficient permissions
- `MCP_404_TOOL_NOT_FOUND` - Requested tool does not exist
- `MCP_429_RATE_LIMIT_EXCEEDED` - Rate limit exceeded

### Server Errors (5xx)
- `MCP_500_INTERNAL_SERVER_ERROR` - Internal server error
- `MCP_503_SERVICE_UNAVAILABLE` - Service temporarily unavailable
- `MCP_504_TIMEOUT` - Request timeout
- `MCP_550_DATA_SOURCE_ERROR` - Data source connection error

## Health Check

Monitor API health and status:

```bash
GET /api/v1/mcp/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T10:30:00Z",
  "version": "v1.0.0",
  "services": {
    "database": "healthy",
    "healthcare_module": "healthy",
    "cache": "healthy"
  },
  "metrics": {
    "uptime": 86400,
    "requestCount": 1234,
    "errorRate": 0.02
  }
}
```

## Integration Examples

### Python Client Example
```python
import requests
import json

class MCPHealthcareClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }

    def medicare_analysis(self, states, include_projections=True):
        url = f"{self.base_url}/api/v1/mcp/tools/medicare_eligibility_analysis"
        payload = {
            "geography_type": "state",
            "geography_codes": states,
            "include_projections": include_projections
        }
        response = requests.post(url, headers=self.headers, data=json.dumps(payload))
        return response.json()

# Usage
client = MCPHealthcareClient('https://your-api.com', 'mcp_hc_your_api_key')
result = client.medicare_analysis(['FL', 'CA', 'TX'])
print(f"Found {result['data']['summary']['totalRecords']} records")
```

### Node.js Client Example
```javascript
const axios = require('axios');

class MCPHealthcareClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.headers = {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
    }

    async medicareAnalysis(states, includeProjections = true) {
        const url = `${this.baseUrl}/api/v1/mcp/tools/medicare_eligibility_analysis`;
        const payload = {
            geography_type: 'state',
            geography_codes: states,
            include_projections: includeProjections
        };

        const response = await axios.post(url, payload, { headers: this.headers });
        return response.data;
    }
}

// Usage
const client = new MCPHealthcareClient('https://your-api.com', 'mcp_hc_your_api_key');
client.medicareAnalysis(['FL', 'CA', 'TX']).then(result => {
    console.log(`Found ${result.data.summary.totalRecords} records`);
});
```

## Security Best Practices

1. **API Key Management:**
   - Store API keys securely (environment variables, secret managers)
   - Rotate API keys regularly
   - Use different keys for different environments

2. **Request Security:**
   - Always use HTTPS in production
   - Validate all input parameters
   - Implement request signing for sensitive operations

3. **Error Handling:**
   - Don't expose sensitive information in error messages
   - Implement retry logic with exponential backoff
   - Log security events for monitoring

4. **Rate Limiting:**
   - Respect rate limits (60 requests/minute)
   - Implement client-side rate limiting
   - Use caching to reduce API calls

## Troubleshooting

### Common Issues

**401 Authentication Required**
```json
{
  "error": {
    "code": "MCP_401_AUTHENTICATION_REQUIRED",
    "message": "Valid authentication required. Provide Bearer token or X-API-Key header."
  }
}
```
Solution: Ensure API key or JWT token is included in request headers.

**403 Authorization Failed**
```json
{
  "error": {
    "code": "MCP_403_AUTHORIZATION_FAILED",
    "message": "Insufficient permissions for tool: medicare_eligibility_analysis"
  }
}
```
Solution: Request appropriate permissions from your administrator.

**429 Rate Limit Exceeded**
```json
{
  "error": {
    "code": "MCP_429_RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum requests per minute exceeded.",
    "details": {
      "maxRequestsPerMinute": 60,
      "retryAfterSeconds": 60
    }
  }
}
```
Solution: Implement exponential backoff and respect the retryAfterSeconds value.

### Support

For additional support and questions:
- API Documentation: `/api/v1/mcp/docs/`
- Health Status: `/api/v1/mcp/health`
- Protocol Info: `/api/v1/mcp/info`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-01-23 | Initial MCP Healthcare Analytics API release |

---

**Last Updated:** 2025-01-23
**API Version:** v1.0.0
**Protocol Version:** v1.0.0
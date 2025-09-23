# Census API Service Virtualization
## Data Ops Engineering - WireMock Implementation

This directory contains a comprehensive service virtualization layer for the US Census Bureau API, designed to support robust testing of the CensusChat application.

## Overview

The mock service provides:
- **Realistic API responses** matching Census Bureau data patterns
- **Dynamic response generation** with templating
- **Error scenario simulation** for resilience testing  
- **Performance characteristics** mimicking real API behavior
- **Comprehensive test coverage** for all API endpoints

## Architecture

```
wiremock/
├── mappings/              # Request/response mappings
│   ├── census-api-base.json       # Core API endpoints
│   ├── census-data-queries.json   # Data query responses
│   ├── census-error-scenarios.json # Error simulation
│   └── admin-endpoints.json       # Mock service management
└── files/                 # Static response files
    └── sample-responses.json      # Reference data and examples
```

## Supported Endpoints

### Core API Endpoints
- `GET /data` - Root endpoint with dataset information
- `GET /data/{year}/acs/acs5/variables` - Variable definitions
- `GET /data/{year}/acs/acs5/geography` - Geography information

### Data Query Endpoints  
- `GET /data/{year}/acs/acs5?get={vars}&for=state:*` - State-level data
- `GET /data/{year}/acs/acs5?get={vars}&for=county:*` - County-level data
- `GET /data/{year}/acs/acs5?get={vars}&for={geography}` - Specific geography

### Administrative Endpoints
- `GET /__admin/health` - WireMock health check
- `GET /info` - Mock service information
- `POST /reset` - Reset test scenarios

## Supported Data Variables

| Variable | Description | Realistic Range |
|----------|-------------|-----------------|
| B01001_001E | Total Population | 500K - 40M |
| B19013_001E | Median Household Income | $40K - $120K |
| B25001_001E | Housing Units | 200K - 15M |
| B08301_001E | Transportation to Work | 100K - 10M |

## Geography Coverage

### States (FIPS Codes)
- 06 - California
- 36 - New York  
- 48 - Texas
- 12 - Florida
- 17 - Illinois

### Counties (FIPS Codes)
- 06037 - Los Angeles County, CA
- 36047 - Kings County, NY
- 48201 - Harris County, TX
- 12086 - Miami-Dade County, FL
- 17031 - Cook County, IL

## Error Scenario Testing

### Trigger Error Scenarios
Use HTTP headers to trigger specific error conditions:

```bash
# Rate limiting
curl -H "X-Test-Scenario: rate-limit" http://localhost:8089/data/2020/acs/acs5

# Server error
curl -H "X-Test-Scenario: server-error" http://localhost:8089/data/2020/acs/acs5

# Timeout simulation
curl -H "X-Test-Scenario: timeout" http://localhost:8089/data/2020/acs/acs5

# Maintenance mode
curl -H "X-Test-Scenario: maintenance" http://localhost:8089/data/2020/acs/acs5

# Partial data response
curl -H "X-Test-Scenario: partial-data" http://localhost:8089/data/2020/acs/acs5
```

### Automatic Error Conditions
- Invalid API key: `?key=invalid_key`
- Invalid geography: `for=state:999`
- Invalid variable: `get=INVALID_VAR`
- Unavailable year: `/data/2015/acs/acs5`

## Response Characteristics

### Realistic Performance
- **Base response time**: 100-500ms
- **Multi-variable queries**: 200ms-1s  
- **Error responses**: Immediate
- **Timeout simulation**: 30s delay

### Dynamic Data Generation
- Population values: Randomized within realistic ranges
- Income data: Adjusted by geography characteristics
- Margin of error: Calculated as ~2% of estimate
- Timestamps: Real-time generation

## Usage Examples

### Basic Population Query
```bash
# Get state population data
curl "http://localhost:8089/data/2020/acs/acs5?get=B01001_001E&for=state:*"

# Response:
[
  ["B01001_001E", "state"],
  ["39538223", "06"],
  ["19336776", "36"]
]
```

### Multi-Variable Query
```bash  
# Get population, income, and housing
curl "http://localhost:8089/data/2020/acs/acs5?get=B01001_001E,B19013_001E,B25001_001E&for=state:06"

# Response:
[
  ["B01001_001E", "B19013_001E", "B25001_001E", "state"],
  ["39538223", "84097", "14421553", "06"]
]
```

### Service Information
```bash
# Get mock service details
curl "http://localhost:8089/info"

# Response includes supported variables, geographies, and test scenarios
```

## Integration with Tests

### Docker Configuration
The mock service runs on port 8089 and is automatically started with the test infrastructure:

```yaml
census-api-mock:
  image: wiremock/wiremock:3.5.2-alpine
  ports: ["8089:8080"]
  volumes:
    - ./test-data/wiremock/mappings:/home/wiremock/mappings
    - ./test-data/wiremock/files:/home/wiremock/__files
```

### Environment Configuration
Set in test containers:
```
CENSUS_API_BASE_URL=http://census-api-mock:8080
CENSUS_API_KEY=test_api_key_mock
```

## Maintenance and Updates

### Adding New Variables
1. Add variable definition to `sample-responses.json`
2. Create mapping in `census-data-queries.json`
3. Update realistic value ranges
4. Test with actual queries

### Adding New Geographies  
1. Update geography codes in `sample-responses.json`
2. Add FIPS codes to response templates
3. Update documentation
4. Verify coverage in tests

### Performance Tuning
- Adjust `fixedDelayMilliseconds` for realistic timing
- Update `randomInt` ranges for data realism
- Monitor response patterns in logs

## Monitoring and Debugging

### Health Check
```bash
curl http://localhost:8089/__admin/health
```

### View All Mappings
```bash
curl http://localhost:8089/__admin/mappings
```

### Request Logs
```bash  
docker-compose -f docker-compose.test.yml logs census-api-mock
```

This service virtualization layer provides comprehensive testing capabilities while maintaining realistic API behavior patterns.
# Census API Integration

This document describes the Census API integration implementation for CensusChat, including the knowledge base extracted from the Census Data API User Guide PDF.

## Overview

The integration provides:
- Structured knowledge base extracted from the Census API PDF guide
- Service layer for Census API interactions
- DuckDB schema for caching Census data
- Test queries for ACS 5-Year data at ZIP5 and Census Block Group levels
- REST API endpoints for data access

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │ Census Service  │
│   (React)       │───▶│   (Express)     │───▶│   (TypeScript)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DuckDB        │◀───│ Census Models   │◀───│ Census API      │
│   (Local Cache) │    │   (Data Layer)  │    │ (census.gov)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. Knowledge Base (`census-api-knowledge.json`)
Structured information extracted from the PDF including:
- API base URLs and patterns
- Dataset configurations (ACS 5-Year, ACS 1-Year)
- Variable types and naming conventions
- Geographic level definitions
- Common variables and their descriptions
- Test query definitions
- Error handling guidance

### 2. Census API Service (`censusApiService.ts`)
- Builds and executes Census API queries
- Validates variable names
- Provides predefined test queries
- Handles rate limiting and error responses
- Supports both direct API calls and knowledge base queries

### 3. Data Models (`CensusData.ts`)
DuckDB schema with tables for:
- `census_data` - Main data storage with geographic and variable information
- `census_variables` - Variable metadata and definitions
- `census_geographies` - Geographic area lookup table
- `census_api_cache` - Query response caching for performance
- `census_datasets` - Dataset metadata

### 4. Data Loader (`censusDataLoader.ts`)
- Fetches initial test data from Census API
- Parses API responses into database records
- Loads variable metadata
- Provides data statistics and validation

## Test Queries Implemented

### ZIP5 (ZCTA) Query
```
GET https://api.census.gov/data/2022/acs/acs5?
get=NAME,B01003_001E,B01003_001M,B25001_001E,B25001_001M&
for=zip%20code%20tabulation%20area:*&
in=state:06
```
- **Geography**: ZIP Code Tabulation Areas in California
- **Variables**: Total Population and Housing Units (with margins of error)
- **Expected Results**: ~1,700 ZIP codes

### Census Block Group Query
```
GET https://api.census.gov/data/2022/acs/acs5?
get=NAME,B01003_001E,B01003_001M,B25001_001E,B25001_001M&
for=block%20group:*&
in=state:06%20county:075
```
- **Geography**: Census Block Groups in San Francisco County, CA
- **Variables**: Total Population and Housing Units (with margins of error)
- **Expected Results**: ~600 block groups

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/census/test-connection` | Test Census API connectivity |
| GET | `/api/v1/census/test-queries` | Get available test queries |
| POST | `/api/v1/census/execute-test/:testName` | Execute predefined test query |
| GET | `/api/v1/census/acs5/zip` | Get ACS 5-Year ZIP data |
| GET | `/api/v1/census/acs5/block-group` | Get ACS 5-Year block group data |
| POST | `/api/v1/census/load-test-data` | Load initial test data into DuckDB |
| GET | `/api/v1/census/data/stats` | Get stored data statistics |
| GET | `/api/v1/census/data/query` | Query stored Census data with filters |
| POST | `/api/v1/census/validate-variables` | Validate Census variable names |
| GET | `/api/v1/census/counties/:state` | Get counties in a state |

## Usage Examples

### Load Initial Test Data
```bash
curl -X POST http://localhost:3001/api/v1/census/load-test-data
```

### Query ZIP Population Data
```bash
curl "http://localhost:3001/api/v1/census/data/query?geographyLevel=zip%20code%20tabulation%20area&variables=B01003_001E&limit=10"
```

### Execute Test Query
```bash
curl -X POST http://localhost:3001/api/v1/census/execute-test/zip5_acs5
```

### Get Data Statistics
```bash
curl http://localhost:3001/api/v1/census/data/stats
```

## Testing

Run the integration test:
```bash
npx ts-node src/scripts/testCensusIntegration.ts
```

This will:
1. Test API connectivity and knowledge base loading
2. Execute both test queries (ZIP5 and Block Group)
3. Load data into DuckDB
4. Query and display sample results
5. Show available API endpoints

## Environment Configuration

Add to your `.env` file:
```env
# Census API (optional - works without key but with rate limits)
CENSUS_API_URL=https://api.census.gov
CENSUS_API_KEY=your_api_key_here

# DuckDB Configuration
DUCKDB_PATH=./data/census.duckdb
DUCKDB_MEMORY=false
```

## Rate Limits

- **Without API Key**: 500 queries per day per IP address
- **With API Key**: Unlimited queries
- **Variables per Query**: Maximum 50 variables
- **Caching**: Implemented to reduce API calls

## Variable Types

Based on the PDF guide, variables follow these patterns:

| Suffix | Type | Description |
|--------|------|-------------|
| E | Estimate | Estimated value from survey sample |
| M | Margin of Error | Statistical margin of error for estimate |
| PE | Percentage Estimate | Percentage-based estimate |
| PM | Percentage Margin | Margin of error for percentage |

## Common Variables

| Variable | Description | Universe |
|----------|-------------|----------|
| B01003_001E | Total Population | Total population |
| B25001_001E | Total Housing Units | Housing units |
| B19013_001E | Median Household Income | Households |
| B25077_001E | Median Home Value | Owner-occupied units |

## Geographic Levels

| Code | Level | Summary Level | Example Geography |
|------|-------|---------------|-------------------|
| 040 | State | State | California (06) |
| 050 | County | County | San Francisco County (075) |
| 140 | Census Tract | Tract | Census Tract 101 |
| 150 | Block Group | Block Group | Block Group 1 |
| 860 | ZCTA | ZIP5 | ZIP Code 94102 |

## Error Handling

The implementation handles common Census API errors:
- 400 Bad Request: Invalid variable names or geography codes
- 404 Not Found: Invalid dataset year or path
- Rate limit exceeded: Automatic retry with exponential backoff
- Network errors: Timeout handling and retry logic

## Performance Optimizations

- **Caching**: API responses cached in DuckDB for 24 hours
- **Batch Processing**: Multiple variables fetched in single API call
- **Indexing**: DuckDB indexes on geography, variables, and time dimensions
- **Pagination**: Support for large result sets with LIMIT/OFFSET

## Future Enhancements

1. **Spatial Data**: Add geometry support for mapping
2. **More Datasets**: Expand beyond ACS to include Economic Census, PEP
3. **Real-time Updates**: Automatic data refresh when new vintages available
4. **Query Builder**: GUI for building complex Census queries
5. **Data Visualization**: Charts and maps for Census data
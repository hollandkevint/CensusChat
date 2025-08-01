# Census API Integration Setup

## Installation Requirements

The Census API integration requires one additional dependency that needs to be installed:

```bash
cd backend
npm install axios
```

## Directory Structure Created

```
backend/
├── data/
│   └── census-api-knowledge.json      # Structured knowledge base from PDF
├── docs/
│   └── census-api-integration.md      # Integration documentation
├── src/
│   ├── models/
│   │   └── CensusData.ts             # DuckDB schema and models
│   ├── routes/
│   │   └── census.routes.ts          # API endpoints
│   ├── scripts/
│   │   └── testCensusIntegration.ts  # Test script
│   ├── services/
│   │   └── censusApiService.ts       # Census API service
│   └── utils/
│       └── censusDataLoader.ts       # Data loading utilities
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install axios
   ```

2. **Set up environment (optional):**
   ```bash
   # Add to .env for higher rate limits
   CENSUS_API_KEY=your_census_api_key_here
   ```

3. **Test the integration:**
   ```bash
   npx ts-node src/scripts/testCensusIntegration.ts
   ```

4. **Start the server and load test data:**
   ```bash
   npm run dev
   
   # In another terminal:
   curl -X POST http://localhost:3001/api/v1/census/load-test-data
   ```

## Test Queries Available

The implementation includes two predefined test queries from the PDF guide:

### 1. ZIP5 (ZCTA) Query
- **Endpoint:** `POST /api/v1/census/execute-test/zip5_acs5`
- **Data:** ACS 5-Year estimates for ZIP Code Tabulation Areas in California
- **Variables:** Total Population, Housing Units (with margins of error)
- **Geography Level:** 860 (ZIP Code Tabulation Area)

### 2. Census Block Group Query  
- **Endpoint:** `POST /api/v1/census/execute-test/blockgroup_acs5`
- **Data:** ACS 5-Year estimates for Census Block Groups in San Francisco County
- **Variables:** Total Population, Housing Units (with margins of error)  
- **Geography Level:** 150 (Census Block Group)

## What Was Implemented

✅ **PDF Knowledge Extraction**: Complete structured knowledge base from the 30-page Census API guide

✅ **Service Layer**: Full Census API service with query building, validation, and error handling

✅ **Database Schema**: DuckDB tables optimized for Census data storage and querying

✅ **Test Queries**: Both ACS 5-Year test queries (ZIP5 and Block Group) fully implemented

✅ **Data Loading**: Automated data fetcher that parses API responses and stores in DuckDB

✅ **API Endpoints**: Complete REST API with 11 endpoints for Census data access

✅ **Error Handling**: Comprehensive error handling based on PDF guidance

✅ **Caching**: API response caching to respect rate limits

✅ **Documentation**: Full documentation including API reference and usage examples

## Sample API Calls

```bash
# Test connectivity
curl http://localhost:3001/api/v1/census/test-connection

# Execute ZIP5 test query  
curl -X POST http://localhost:3001/api/v1/census/execute-test/zip5_acs5

# Execute Block Group test query
curl -X POST http://localhost:3001/api/v1/census/execute-test/blockgroup_acs5

# Load initial test data into DuckDB
curl -X POST http://localhost:3001/api/v1/census/load-test-data

# Get data statistics
curl http://localhost:3001/api/v1/census/data/stats

# Query stored data
curl "http://localhost:3001/api/v1/census/data/query?geographyLevel=zip%20code%20tabulation%20area&variables=B01003_001E&limit=5"
```

## Next Steps

With this foundation in place, you can:

1. **Expand Geographic Coverage**: Add more states and counties to the test queries
2. **Add More Variables**: Include income, education, and demographic variables
3. **Implement Natural Language**: Build query translation from natural language to Census API calls
4. **Add Visualizations**: Create charts and maps using the cached Census data
5. **Real-time Queries**: Enable direct API passthrough for real-time data access

The implementation provides a solid foundation for building natural language queries against Census data while maintaining performance through intelligent caching and following all the best practices outlined in the PDF guide.
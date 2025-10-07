# DuckDB MCP Client Functions Reference

*Complete reference for MCP client functions in healthcare analytics*

## Core Client Functions

### Server Connection and Management

#### `ATTACH` - Connect to MCP Server
```sql
-- Syntax
ATTACH 'command' AS server_name (
    TYPE mcp,
    TRANSPORT 'transport_type',
    ARGS '[command_args]'
);

-- Examples for Healthcare Data Sources
ATTACH 'python3' AS census_api (
    TYPE mcp,
    TRANSPORT 'stdio',
    ARGS '["scripts/census_mcp_server.py", "--api-key", "${CENSUS_API_KEY}"]'
);

ATTACH 'node' AS medicare_analytics (
    TYPE mcp,
    TRANSPORT 'stdio',
    ARGS '["services/medicare_server.js", "--env", "production"]'
);

-- TCP Connection Example
ATTACH 'tcp://healthcare-analytics.internal:8080' AS analytics_server (
    TYPE mcp,
    TRANSPORT 'tcp'
);
```

#### `mcp_reconnect_server()` - Reconnect to MCP Server
```sql
-- Syntax
SELECT mcp_reconnect_server(server_name);

-- Healthcare Examples
SELECT mcp_reconnect_server('census_api');
SELECT mcp_reconnect_server('medicare_analytics');

-- Reconnect all servers
SELECT mcp_reconnect_server(server_name)
FROM (SELECT DISTINCT server_name FROM duckdb_mcp_servers());
```

### Resource Discovery Functions

#### `mcp_list_resources()` - List Available Resources
```sql
-- Syntax
SELECT mcp_list_resources(server_name);

-- Healthcare Examples
SELECT * FROM mcp_list_resources('census_api');
SELECT * FROM mcp_list_resources('medicare_analytics');

-- Filter resources by type
SELECT *
FROM mcp_list_resources('healthcare_server')
WHERE resource_type = 'dataset';

-- Find patient data resources
SELECT *
FROM mcp_list_resources('ehr_server')
WHERE resource_uri LIKE '%patient%';
```

#### `mcp_get_resource()` - Retrieve Specific Resource
```sql
-- Syntax
SELECT mcp_get_resource(server_name, resource_uri);

-- Healthcare Examples
SELECT mcp_get_resource('census_api', 'census://acs/demographics/2022');
SELECT mcp_get_resource('medicare_server', 'medicare://beneficiaries/county/12086');

-- Get facility information
SELECT mcp_get_resource('facilities_server', 'facilities://hospitals/state/FL');

-- Get health indicators
SELECT mcp_get_resource('cdc_server', 'cdc://health-indicators/county/all');
```

### Tool Discovery and Execution

#### `mcp_list_tools()` - List Available Tools
```sql
-- Syntax
SELECT mcp_list_tools(server_name);

-- Healthcare Examples
SELECT * FROM mcp_list_tools('analytics_server');
SELECT * FROM mcp_list_tools('privacy_server');

-- Find specific tool categories
SELECT *
FROM mcp_list_tools('healthcare_tools')
WHERE tool_category = 'population_health';

-- List all analytics tools across servers
SELECT server_name, tool_name, description
FROM (
  SELECT 'census_api' as server_name, * FROM mcp_list_tools('census_api')
  UNION ALL
  SELECT 'medicare_server' as server_name, * FROM mcp_list_tools('medicare_server')
)
WHERE tool_name LIKE '%analytic%';
```

#### `mcp_call_tool()` - Execute MCP Tool
```sql
-- Syntax
SELECT mcp_call_tool(server_name, tool_name, parameters_json);

-- Healthcare Analytics Examples
SELECT mcp_call_tool('analytics_server', 'calculate_medicare_eligibility', '{
  "county_fips": "12086",
  "age_threshold": 65,
  "income_considerations": true
}');

SELECT mcp_call_tool('population_server', 'project_population', '{
  "base_year": 2022,
  "projection_years": 10,
  "geography": "county",
  "state": "FL"
}');

-- Data quality tools
SELECT mcp_call_tool('quality_server', 'validate_demographics', '{
  "dataset": "census_data",
  "validation_rules": ["age_range", "income_positive", "population_consistent"]
}');

-- Privacy and anonymization tools
SELECT mcp_call_tool('privacy_server', 'anonymize_patient_data', '{
  "method": "k_anonymity",
  "k_value": 5,
  "quasi_identifiers": ["age", "zipcode", "gender"]
}');
```

### Prompt Management Functions

#### `mcp_list_prompts()` - List Available Prompts
```sql
-- Syntax
SELECT mcp_list_prompts(server_name);

-- Healthcare Examples
SELECT * FROM mcp_list_prompts('ai_analytics_server');

-- Find healthcare-specific prompts
SELECT *
FROM mcp_list_prompts('healthcare_ai')
WHERE prompt_category = 'clinical_analysis';
```

#### `mcp_get_prompt()` - Retrieve Prompt Template
```sql
-- Syntax
SELECT mcp_get_prompt(server_name, prompt_name);

-- Healthcare Examples
SELECT mcp_get_prompt('ai_server', 'analyze_population_health');
SELECT mcp_get_prompt('clinical_ai', 'generate_health_report');

-- Get prompts for specific healthcare domains
SELECT mcp_get_prompt('epidemiology_ai', 'disease_outbreak_analysis');
```

## Data Access Functions

### File Reading via MCP

#### `read_csv()` with MCP URIs
```sql
-- Syntax
SELECT * FROM read_csv('mcp://server_name/resource_uri', options);

-- Healthcare Examples
SELECT * FROM read_csv('mcp://census_server/file:///data/acs_demographics.csv',
  header=true,
  auto_detect=true
);

SELECT * FROM read_csv('mcp://medicare_server/file:///data/beneficiaries.csv',
  header=true,
  types={
    'BENE_ID': 'VARCHAR',
    'AGE': 'INTEGER',
    'STATE_CD': 'VARCHAR'
  }
);

-- Read multiple demographic files
SELECT * FROM read_csv('mcp://data_server/file:///demographics/*.csv',
  union_by_name=true,
  filename=true
);
```

#### `read_json()` with MCP URIs
```sql
-- Syntax
SELECT * FROM read_json('mcp://server_name/resource_uri', options);

-- Healthcare API Examples
SELECT * FROM read_json('mcp://fhir_server/api://Patient?_count=1000',
  format='array'
);

SELECT * FROM read_json('mcp://healthcare_api/api://facilities/search',
  headers={'Authorization': 'Bearer ${API_TOKEN}'}
);

-- Process nested healthcare JSON
SELECT
  JSON_EXTRACT_STRING(data, '$.patient.id') as patient_id,
  JSON_EXTRACT_STRING(data, '$.diagnosis.primary') as primary_diagnosis
FROM read_json('mcp://clinical_server/api://encounters/recent');
```

#### `read_parquet()` with MCP URIs
```sql
-- Syntax
SELECT * FROM read_parquet('mcp://server_name/resource_uri');

-- Large Healthcare Dataset Examples
SELECT * FROM read_parquet('mcp://warehouse_server/file:///data/claims_data.parquet');

SELECT * FROM read_parquet('mcp://analytics_server/file:///processed/population_health.parquet')
WHERE state = 'FL' AND survey_year = 2022;

-- Read partitioned healthcare data
SELECT * FROM read_parquet('mcp://data_lake/file:///healthcare/year=2022/state=FL/*.parquet');
```

## Healthcare-Specific Function Patterns

### Population Health Analytics
```sql
-- Calculate population health metrics via MCP
CREATE TABLE population_health_metrics AS
SELECT
  county,
  state,
  mcp_call_tool('health_server', 'calculate_health_index',
    JSON_OBJECT('county_fips', geo_id, 'metrics', 'all')
  )::JSON as health_metrics
FROM demographics;

-- Extract specific health indicators
SELECT
  county,
  state,
  JSON_EXTRACT_STRING(health_metrics, '$.diabetes_rate') as diabetes_rate,
  JSON_EXTRACT_STRING(health_metrics, '$.obesity_rate') as obesity_rate
FROM population_health_metrics;
```

### Medicare Advantage Analytics
```sql
-- Get Medicare Advantage penetration data
CREATE TABLE ma_penetration AS
SELECT
  county_fips,
  mcp_call_tool('medicare_server', 'get_ma_penetration',
    JSON_OBJECT('county', county_fips, 'year', 2022)
  )::JSON as ma_data
FROM county_list;

-- Calculate enrollment projections
SELECT
  county_fips,
  mcp_call_tool('actuarial_server', 'project_ma_enrollment',
    JSON_OBJECT(
      'current_enrollment', JSON_EXTRACT(ma_data, '$.current_enrollment'),
      'demographic_trends', JSON_EXTRACT(ma_data, '$.demographic_trends'),
      'projection_years', 5
    )
  ) as enrollment_projection
FROM ma_penetration;
```

### Clinical Data Integration
```sql
-- Access FHIR patient resources
CREATE TABLE patient_demographics AS
SELECT
  JSON_EXTRACT_STRING(resource, '$.id') as patient_id,
  JSON_EXTRACT_STRING(resource, '$.gender') as gender,
  EXTRACT(YEAR FROM CURRENT_DATE) -
    EXTRACT(YEAR FROM CAST(JSON_EXTRACT_STRING(resource, '$.birthDate') AS DATE)) as age,
  JSON_EXTRACT_STRING(resource, '$.address[0].state') as state
FROM read_json('mcp://fhir_server/api://Patient?_count=10000', format='array') t(resource);

-- Process clinical observations
CREATE TABLE clinical_observations AS
SELECT
  JSON_EXTRACT_STRING(obs, '$.subject.reference') as patient_ref,
  JSON_EXTRACT_STRING(obs, '$.code.coding[0].code') as observation_code,
  JSON_EXTRACT_STRING(obs, '$.code.coding[0].display') as observation_name,
  JSON_EXTRACT_STRING(obs, '$.valueQuantity.value') as value,
  JSON_EXTRACT_STRING(obs, '$.valueQuantity.unit') as unit
FROM read_json('mcp://fhir_server/api://Observation?category=vital-signs', format='array') t(obs);
```

## Error Handling Patterns

### Robust MCP Operations
```sql
-- Safe MCP tool execution with error handling
CREATE OR REPLACE FUNCTION safe_mcp_call(
  server_name VARCHAR,
  tool_name VARCHAR,
  parameters VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN mcp_call_tool(server_name, tool_name, parameters);
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO mcp_error_log (server_name, tool_name, error_message, timestamp)
    VALUES (server_name, tool_name, SQLERRM, CURRENT_TIMESTAMP);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT safe_mcp_call('analytics_server', 'calculate_health_score', '{"county": "12086"}');
```

### Connection Resilience
```sql
-- Function to ensure MCP server connectivity
CREATE OR REPLACE FUNCTION ensure_mcp_connection(server_name VARCHAR) RETURNS BOOLEAN AS $$
DECLARE
  server_status VARCHAR;
BEGIN
  -- Check server status
  SELECT status INTO server_status
  FROM duckdb_mcp_servers()
  WHERE name = server_name;

  IF server_status != 'connected' THEN
    -- Attempt reconnection
    PERFORM mcp_reconnect_server(server_name);

    -- Wait and check again
    PERFORM pg_sleep(2);

    SELECT status INTO server_status
    FROM duckdb_mcp_servers()
    WHERE name = server_name;
  END IF;

  RETURN server_status = 'connected';
END;
$$ LANGUAGE plpgsql;

-- Usage before critical operations
SELECT CASE
  WHEN ensure_mcp_connection('census_api') THEN
    mcp_call_tool('census_api', 'get_demographics', '{"state": "FL"}')
  ELSE
    '{"error": "Server unavailable"}'
END as result;
```

## Performance Optimization

### Caching MCP Resources
```sql
-- Create cache table for frequently accessed resources
CREATE TABLE mcp_resource_cache (
  server_name VARCHAR,
  resource_uri VARCHAR,
  resource_data JSON,
  cache_timestamp TIMESTAMP,
  ttl_seconds INTEGER,
  PRIMARY KEY (server_name, resource_uri)
);

-- Function to get cached or fresh resource
CREATE OR REPLACE FUNCTION get_cached_resource(
  server_name VARCHAR,
  resource_uri VARCHAR,
  ttl_seconds INTEGER DEFAULT 3600
) RETURNS JSON AS $$
DECLARE
  cached_data JSON;
  cache_age INTEGER;
BEGIN
  -- Check cache
  SELECT
    resource_data,
    EXTRACT(EPOCH FROM CURRENT_TIMESTAMP - cache_timestamp)::INTEGER
  INTO cached_data, cache_age
  FROM mcp_resource_cache
  WHERE server_name = get_cached_resource.server_name
    AND resource_uri = get_cached_resource.resource_uri;

  -- Return cached data if fresh
  IF cached_data IS NOT NULL AND cache_age < ttl_seconds THEN
    RETURN cached_data;
  END IF;

  -- Fetch fresh data
  cached_data := mcp_get_resource(server_name, resource_uri)::JSON;

  -- Update cache
  INSERT INTO mcp_resource_cache VALUES (
    server_name, resource_uri, cached_data, CURRENT_TIMESTAMP, ttl_seconds
  ) ON CONFLICT (server_name, resource_uri) DO UPDATE SET
    resource_data = EXCLUDED.resource_data,
    cache_timestamp = EXCLUDED.cache_timestamp,
    ttl_seconds = EXCLUDED.ttl_seconds;

  RETURN cached_data;
END;
$$ LANGUAGE plpgsql;
```

### Batch Operations
```sql
-- Batch MCP tool calls for efficiency
CREATE OR REPLACE FUNCTION batch_mcp_tool_calls(
  server_name VARCHAR,
  tool_name VARCHAR,
  parameters_array JSON[]
) RETURNS JSON[] AS $$
DECLARE
  result JSON[];
  param JSON;
BEGIN
  -- Use array processing for batch operations
  SELECT ARRAY_AGG(
    mcp_call_tool(server_name, tool_name, param::VARCHAR)::JSON
  )
  INTO result
  FROM UNNEST(parameters_array) AS param;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Usage for batch county analysis
SELECT batch_mcp_tool_calls(
  'analytics_server',
  'calculate_health_score',
  ARRAY[
    '{"county": "12086"}',
    '{"county": "12011"}',
    '{"county": "12099"}'
  ]::JSON[]
);
```

---

*This reference provides comprehensive coverage of all DuckDB MCP client functions specifically optimized for healthcare analytics and Census data integration scenarios.*
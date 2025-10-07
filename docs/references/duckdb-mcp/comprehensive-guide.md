# DuckDB MCP Extension Comprehensive Guide

*Complete integration guide for Model Context Protocol with DuckDB in healthcare analytics*

## Installation and Setup

### Installing the MCP Extension
```sql
-- Install from community extensions
INSTALL duckdb_mcp FROM community;
LOAD duckdb_mcp;

-- Verify installation
SELECT extension_name, loaded, installed
FROM duckdb_extensions()
WHERE extension_name = 'duckdb_mcp';
```

### Configuration for Healthcare Use
```sql
-- Configure security settings for production
SET allowed_mcp_commands = '/usr/bin/python3:/usr/bin/node';
SET allowed_mcp_urls = 'https://api.census.gov:https://api.medicare.gov:file://';
SET mcp_lock_servers = false;  -- Allow dynamic server configuration in dev
```

## MCP Client Operations

### Connecting to External MCP Servers
```sql
-- Connect to Census Data MCP Server
ATTACH 'python3' AS census_server (
    TYPE mcp,
    TRANSPORT 'stdio',
    ARGS '["scripts/census_mcp_server.py"]'
);

-- Connect to Healthcare Analytics Server
ATTACH 'node' AS analytics_server (
    TYPE mcp,
    TRANSPORT 'stdio',
    ARGS '["services/healthcare_analytics_server.js"]'
);

-- List available MCP servers
SELECT server_name, transport, status FROM duckdb_mcp_servers();
```

### Resource Discovery and Access
```sql
-- Discover available resources
SELECT * FROM mcp_list_resources('census_server');

-- Get specific resource information
SELECT mcp_get_resource('census_server', 'census://acs/demographics/2022');

-- List available tools
SELECT * FROM mcp_list_tools('analytics_server');
```

### Data Access via MCP Protocol
```sql
-- Read Census data via MCP
CREATE TABLE census_mcp_data AS
SELECT * FROM read_csv('mcp://census_server/file:///data/acs2022.csv');

-- Read JSON healthcare data via MCP
CREATE TABLE healthcare_facilities AS
SELECT * FROM read_json('mcp://analytics_server/api://facilities/all');

-- Read Parquet files via MCP
CREATE TABLE large_demographics AS
SELECT * FROM read_parquet('mcp://census_server/file:///data/demographics.parquet');
```

## Healthcare-Specific MCP Patterns

### Medicare Data Integration
```sql
-- Connect to Medicare API via MCP
SELECT * FROM read_json('mcp://medicare_server/api://beneficiaries/county',
  headers={'Authorization': 'Bearer ${MEDICARE_API_TOKEN}'}
);

-- Process Medicare eligibility data
WITH medicare_data AS (
  SELECT * FROM read_json('mcp://medicare_server/api://eligibility/state')
)
SELECT
  state_code,
  county_code,
  beneficiaries_total,
  beneficiaries_aged_65_plus,
  ROUND(100.0 * beneficiaries_aged_65_plus / beneficiaries_total, 2) as aged_percentage
FROM medicare_data
WHERE beneficiaries_total > 1000;
```

### Clinical Data Integration
```sql
-- Access FHIR-compliant healthcare data
CREATE TABLE patient_demographics AS
SELECT
  JSON_EXTRACT_STRING(resource, '$.id') as patient_id,
  JSON_EXTRACT_STRING(resource, '$.gender') as gender,
  JSON_EXTRACT_STRING(resource, '$.birthDate') as birth_date,
  JSON_EXTRACT(resource, '$.address[0]') as primary_address
FROM read_json('mcp://fhir_server/api://Patient',
  headers={'Accept': 'application/fhir+json'}
);
```

### Public Health Data Sources
```sql
-- CDC Data Integration
CREATE TABLE cdc_health_indicators AS
SELECT * FROM read_csv('mcp://cdc_server/file:///data/health_indicators.csv');

-- WHO Global Health Data
CREATE TABLE who_health_data AS
SELECT * FROM read_json('mcp://who_server/api://health-indicators/country');
```

## MCP Tool Execution

### Healthcare Analytics Tools
```sql
-- Execute population health calculation tool
SELECT mcp_call_tool('analytics_server', 'calculate_population_health', '{
  "geography": "county",
  "state": "FL",
  "metrics": ["diabetes_prevalence", "obesity_rate", "access_to_care"]
}');

-- Run Medicare advantage enrollment prediction
SELECT mcp_call_tool('medicare_server', 'predict_ma_enrollment', '{
  "county_fips": "12086",
  "projection_years": 5,
  "include_confidence_intervals": true
}');

-- Execute healthcare facility adequacy analysis
SELECT mcp_call_tool('analytics_server', 'analyze_facility_adequacy', '{
  "geography": "msa",
  "specialty": "cardiology",
  "population_threshold": 50000
}');
```

### Data Quality and Validation Tools
```sql
-- Validate healthcare data quality
SELECT mcp_call_tool('quality_server', 'validate_healthcare_data', '{
  "dataset": "demographics",
  "checks": ["completeness", "consistency", "accuracy"],
  "threshold": 0.95
}');

-- Anonymize patient data
SELECT mcp_call_tool('privacy_server', 'anonymize_data', '{
  "input_table": "patient_records",
  "privacy_level": "hipaa_safe_harbor",
  "preserve_utility": true
}');
```

## MCP Server Capabilities

### Exposing CensusChat Data as MCP Resources
```sql
-- Start MCP server to expose database content
SELECT mcp_server_start('stdio', 'localhost', 0, '{
  "name": "censuschat_server",
  "description": "Healthcare demographics and analytics data",
  "security": {
    "require_auth": false,
    "allowed_operations": ["read", "query"]
  }
}');

-- Check server status
SELECT mcp_server_status();
```

### Publishing Healthcare Tables
```sql
-- Publish demographics table as MCP resource
SELECT mcp_publish_table('demographics', 'data://tables/demographics', 'json');

-- Publish Medicare eligibility view
CREATE VIEW medicare_eligible AS
SELECT
  state,
  county,
  population_65_plus,
  estimated_ma_eligible,
  eligibility_rate
FROM demographics
WHERE population_65_plus > 0;

SELECT mcp_publish_table('medicare_eligible', 'data://views/medicare_eligible', 'csv');
```

### Dynamic Query Publishing
```sql
-- Publish dynamic healthcare analytics queries
SELECT mcp_publish_query(
  'SELECT state, SUM(population_65_plus) as senior_pop FROM demographics GROUP BY state',
  'analytics://queries/state_senior_population',
  'json',
  300  -- Refresh every 5 minutes
);

-- Publish real-time facility utilization
SELECT mcp_publish_query(
  'SELECT facility_id, current_capacity, max_capacity, utilization_rate FROM facility_status',
  'realtime://facilities/utilization',
  'json',
  60   -- Refresh every minute
);
```

## Advanced MCP Patterns

### Federated Healthcare Analytics
```sql
-- Create federated view across multiple MCP sources
CREATE VIEW federated_healthcare AS
SELECT
  'census' as source,
  state,
  county,
  total_population,
  NULL as facility_count
FROM read_csv('mcp://census_server/file:///demographics.csv')
UNION ALL
SELECT
  'facilities' as source,
  state,
  county,
  NULL as total_population,
  COUNT(*) as facility_count
FROM read_json('mcp://facilities_server/api://facilities/all')
GROUP BY state, county;
```

### Multi-Modal Healthcare Data Integration
```sql
-- Combine structured and unstructured healthcare data
WITH structured_data AS (
  SELECT * FROM read_csv('mcp://ehr_server/file:///patient_data.csv')
),
unstructured_notes AS (
  SELECT
    patient_id,
    mcp_call_tool('nlp_server', 'extract_conditions', note_text) as conditions
  FROM read_json('mcp://notes_server/api://clinical_notes')
)
SELECT
  s.patient_id,
  s.age,
  s.primary_diagnosis,
  u.conditions as extracted_conditions
FROM structured_data s
JOIN unstructured_notes u ON s.patient_id = u.patient_id;
```

### Healthcare Pipeline Orchestration
```sql
-- Orchestrate complex healthcare analytics pipeline
CREATE SEQUENCE IF NOT EXISTS pipeline_runs;

-- Step 1: Load and validate data
CREATE TABLE pipeline_demographics AS
SELECT * FROM read_csv('mcp://data_server/file:///latest_demographics.csv')
WHERE mcp_call_tool('validation_server', 'validate_row', ROW(*))::BOOLEAN;

-- Step 2: Enrich with external data
CREATE TABLE enriched_demographics AS
SELECT
  d.*,
  f.facility_count,
  h.health_score
FROM pipeline_demographics d
LEFT JOIN (
  SELECT
    county_fips,
    COUNT(*) as facility_count
  FROM read_json('mcp://facilities_server/api://facilities/by_county')
  GROUP BY county_fips
) f ON d.geo_id = f.county_fips
LEFT JOIN (
  SELECT
    county_fips,
    mcp_call_tool('health_server', 'calculate_health_score', geo_id)::DECIMAL as health_score
  FROM pipeline_demographics
) h ON d.geo_id = h.county_fips;

-- Step 3: Generate analytics and export
SELECT mcp_call_tool('reporting_server', 'generate_healthcare_report', '{
  "data_table": "enriched_demographics",
  "report_type": "county_health_assessment",
  "output_format": "pdf"
}');
```

## Security and Compliance

### HIPAA-Compliant MCP Configuration
```sql
-- Configure secure MCP settings for healthcare data
SET allowed_mcp_commands = '/usr/bin/python3';  -- Restrict to known binaries
SET allowed_mcp_urls = 'https://secure-api.healthcare.gov:file:///secure/';
SET mcp_lock_servers = true;  -- Prevent runtime changes

-- Enable audit logging
SET mcp_audit_log = '/var/log/duckdb_mcp_audit.log';
SET mcp_log_level = 'INFO';
```

### Data Privacy Controls
```sql
-- Implement data masking via MCP tools
CREATE VIEW patient_data_masked AS
SELECT
  patient_id,
  mcp_call_tool('privacy_server', 'mask_field', age::VARCHAR) as age_range,
  mcp_call_tool('privacy_server', 'mask_field', zipcode) as zip_prefix,
  diagnosis_code,
  treatment_date
FROM patient_records;

-- Apply differential privacy
SELECT mcp_call_tool('privacy_server', 'apply_differential_privacy', '{
  "query": "SELECT state, AVG(age) FROM patients GROUP BY state",
  "epsilon": 0.1,
  "delta": 1e-5
}');
```

## Monitoring and Troubleshooting

### MCP Connection Monitoring
```sql
-- Monitor MCP server health
SELECT
  server_name,
  last_heartbeat,
  connection_status,
  error_count
FROM mcp_server_health();

-- Check resource availability
SELECT
  server_name,
  resource_uri,
  last_accessed,
  access_count,
  error_rate
FROM mcp_resource_stats();
```

### Performance Monitoring
```sql
-- Monitor MCP operation performance
SELECT
  operation_type,
  server_name,
  avg_response_time_ms,
  success_rate,
  total_operations
FROM mcp_performance_stats()
WHERE operation_date >= CURRENT_DATE - INTERVAL '7 days';

-- Identify slow MCP operations
SELECT
  server_name,
  operation,
  duration_ms,
  timestamp
FROM mcp_operation_log
WHERE duration_ms > 5000  -- Operations taking > 5 seconds
ORDER BY duration_ms DESC
LIMIT 10;
```

### Error Handling and Recovery
```sql
-- Implement retry logic for MCP operations
CREATE OR REPLACE FUNCTION mcp_retry_operation(server VARCHAR, operation VARCHAR, params VARCHAR, max_retries INTEGER DEFAULT 3)
RETURNS VARCHAR AS $$
DECLARE
  attempt INTEGER := 1;
  result VARCHAR;
  error_msg VARCHAR;
BEGIN
  WHILE attempt <= max_retries LOOP
    BEGIN
      result := mcp_call_tool(server, operation, params);
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      error_msg := SQLERRM;
      IF attempt = max_retries THEN
        RAISE EXCEPTION 'MCP operation failed after % attempts: %', max_retries, error_msg;
      END IF;
      attempt := attempt + 1;
      -- Wait before retry (exponential backoff)
      PERFORM pg_sleep(POWER(2, attempt - 1));
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## Best Practices for Healthcare Analytics

### 1. Resource Management
- Use connection pooling for multiple MCP servers
- Implement timeout controls for long-running operations
- Cache frequently accessed resources locally

### 2. Data Quality Assurance
- Validate all external data via MCP tools before analysis
- Implement data lineage tracking through MCP metadata
- Use MCP-based anomaly detection for data quality monitoring

### 3. Performance Optimization
- Prefer structured data formats (Parquet) over JSON for large datasets
- Use MCP resource caching for frequently accessed data
- Implement async patterns for non-critical MCP operations

### 4. Security and Compliance
- Always use encrypted transport for healthcare data
- Implement comprehensive audit logging for all MCP operations
- Use MCP-based anonymization tools before data sharing

---

*This guide provides comprehensive coverage of DuckDB MCP extension capabilities specifically optimized for healthcare analytics and Census data integration in CensusChat.*
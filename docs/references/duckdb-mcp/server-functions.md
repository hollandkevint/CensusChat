# DuckDB MCP Server Functions Reference

*Complete reference for exposing CensusChat data via MCP server capabilities*

## Core MCP Server Functions

### Server Lifecycle Management

#### `mcp_server_start()` - Initialize MCP Server
```sql
-- Syntax
SELECT mcp_server_start(transport, host, port, config_json);

-- Start stdio MCP server for CensusChat
SELECT mcp_server_start('stdio', 'localhost', 0, '{
  "name": "censuschat_server",
  "description": "Healthcare demographics and analytics data server",
  "version": "1.0.0",
  "security": {
    "require_auth": false,
    "allowed_operations": ["read", "query", "list"]
  },
  "capabilities": {
    "resources": true,
    "tools": true,
    "prompts": true
  }
}');

-- Start TCP server for external access
SELECT mcp_server_start('tcp', '0.0.0.0', 8080, '{
  "name": "censuschat_analytics",
  "description": "CensusChat Analytics MCP Server",
  "security": {
    "require_auth": true,
    "api_key_header": "X-API-Key",
    "allowed_origins": ["https://healthcare-analytics.com"]
  }
}');
```

#### `mcp_server_stop()` - Shutdown MCP Server
```sql
-- Stop all MCP servers
SELECT mcp_server_stop();

-- Stop specific server by transport
SELECT mcp_server_stop('stdio');
```

#### `mcp_server_status()` - Check Server Status
```sql
-- Get server status and metrics
SELECT mcp_server_status();

-- Returns:
-- {
--   "active": true,
--   "transport": "stdio",
--   "connections": 3,
--   "requests_served": 1247,
--   "uptime_seconds": 3600,
--   "resources_published": 15,
--   "tools_available": 8
-- }
```

### Resource Publishing Functions

#### `mcp_publish_table()` - Expose Database Tables
```sql
-- Syntax
SELECT mcp_publish_table(table_name, resource_uri, format, options);

-- Publish demographics table
SELECT mcp_publish_table(
  'demographics',
  'data://tables/demographics',
  'json',
  '{
    "description": "County-level demographic data with Medicare eligibility metrics",
    "access_level": "public",
    "refresh_interval": 3600
  }'
);

-- Publish Medicare analytics view
CREATE VIEW medicare_county_summary AS
SELECT
  state,
  county,
  population_total,
  population_65_plus,
  ROUND(100.0 * population_65_plus / population_total, 2) as senior_percentage,
  ROUND(population_65_plus * 0.85, 0) as estimated_ma_eligible
FROM demographics
WHERE population_65_plus > 0;

SELECT mcp_publish_table(
  'medicare_county_summary',
  'analytics://medicare/county_summary',
  'csv',
  '{
    "description": "Medicare Advantage eligibility by county",
    "tags": ["medicare", "demographics", "analytics"],
    "schema_version": "1.0"
  }'
);
```

#### `mcp_publish_view()` - Expose Dynamic Views
```sql
-- Publish parameterized healthcare views
SELECT mcp_publish_view(
  'SELECT * FROM demographics WHERE state = $1 AND survey_year = $2',
  'data://views/state_demographics',
  'json',
  '{
    "parameters": [
      {"name": "state", "type": "string", "description": "Two-letter state code"},
      {"name": "survey_year", "type": "integer", "description": "Census survey year"}
    ],
    "description": "State-specific demographic data by year"
  }'
);

-- Publish real-time facility utilization
SELECT mcp_publish_view(
  'SELECT facility_id, name, current_capacity, max_capacity,
   ROUND(100.0 * current_capacity / max_capacity, 1) as utilization_pct
   FROM healthcare_facilities
   WHERE last_updated >= CURRENT_TIMESTAMP - INTERVAL ''1 hour''',
  'realtime://facilities/utilization',
  'json',
  '{
    "refresh_interval": 60,
    "description": "Real-time healthcare facility utilization",
    "alert_threshold": {"utilization_pct": 90}
  }'
);
```

#### `mcp_publish_query()` - Expose Ad-Hoc Queries
```sql
-- Publish complex analytics queries
SELECT mcp_publish_query(
  'WITH state_totals AS (
     SELECT state, SUM(population_65_plus) as total_seniors
     FROM demographics GROUP BY state
   )
   SELECT state, total_seniors,
          RANK() OVER (ORDER BY total_seniors DESC) as senior_pop_rank
   FROM state_totals',
  'analytics://rankings/state_senior_population',
  'json',
  '{
    "description": "State rankings by senior population",
    "cache_duration": 1800,
    "tags": ["rankings", "seniors", "state"]
  }'
);

-- Publish healthcare facility analysis
SELECT mcp_publish_query(
  'SELECT
     h.state,
     COUNT(h.facility_id) as facility_count,
     AVG(d.population_65_plus) as avg_senior_pop,
     ROUND(COUNT(h.facility_id) * 1000.0 / AVG(d.population_65_plus), 2) as facilities_per_1k_seniors
   FROM healthcare_facilities h
   JOIN demographics d ON h.county_fips = d.geo_id
   GROUP BY h.state
   ORDER BY facilities_per_1k_seniors DESC',
  'analytics://healthcare/facility_adequacy',
  'csv',
  '{
    "description": "Healthcare facility adequacy by state",
    "methodology": "Facilities per 1,000 senior residents"
  }'
);
```

### Tool Registration Functions

#### `mcp_register_tool()` - Register Custom Analytics Tools
```sql
-- Register population health calculator
SELECT mcp_register_tool(
  'calculate_population_health',
  '{
    "description": "Calculate comprehensive population health metrics for a geographic area",
    "parameters": {
      "geography_type": {
        "type": "string",
        "enum": ["county", "state", "msa"],
        "description": "Geographic aggregation level"
      },
      "geography_id": {
        "type": "string",
        "description": "FIPS code or identifier for the geography"
      },
      "metrics": {
        "type": "array",
        "items": {"type": "string"},
        "description": "List of health metrics to calculate"
      }
    }
  }',
  'SELECT calculate_population_health_impl($1, $2, $3)'
);

-- Register Medicare eligibility projector
SELECT mcp_register_tool(
  'project_medicare_enrollment',
  '{
    "description": "Project Medicare Advantage enrollment for a county",
    "parameters": {
      "county_fips": {"type": "string", "description": "5-digit county FIPS code"},
      "projection_years": {"type": "integer", "minimum": 1, "maximum": 10},
      "scenario": {"type": "string", "enum": ["conservative", "moderate", "aggressive"]}
    }
  }',
  'SELECT project_ma_enrollment($1, $2, $3)'
);

-- Register data quality validator
SELECT mcp_register_tool(
  'validate_healthcare_data',
  '{
    "description": "Validate healthcare dataset for completeness and accuracy",
    "parameters": {
      "table_name": {"type": "string", "description": "Name of table to validate"},
      "validation_rules": {
        "type": "array",
        "items": {"type": "string"},
        "description": "List of validation rules to apply"
      }
    }
  }',
  'SELECT validate_dataset($1, $2)'
);
```

#### `mcp_register_function()` - Register SQL Functions as Tools
```sql
-- Register existing healthcare functions as MCP tools
CREATE OR REPLACE FUNCTION medicare_eligibility_rate(county_fips VARCHAR)
RETURNS DECIMAL AS $$
  SELECT ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2)
  FROM demographics
  WHERE geo_id = county_fips;
$$ LANGUAGE SQL;

SELECT mcp_register_function(
  'medicare_eligibility_rate',
  'Calculate Medicare eligibility rate for a county',
  '{
    "county_fips": {
      "type": "string",
      "pattern": "^[0-9]{5}$",
      "description": "5-digit county FIPS code"
    }
  }'
);
```

### Prompt Management Functions

#### `mcp_register_prompt()` - Register AI Prompts
```sql
-- Register healthcare analysis prompts
SELECT mcp_register_prompt(
  'analyze_population_health',
  '{
    "description": "Generate comprehensive population health analysis for a geographic area",
    "parameters": {
      "geography": {"type": "string", "description": "Geographic area identifier"},
      "focus_areas": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Specific health areas to focus on"
      }
    }
  }',
  'Analyze the population health characteristics for {{geography}}.

   Based on the demographic data available, provide insights on:
   {{#each focus_areas}}
   - {{this}}
   {{/each}}

   Include specific recommendations for healthcare resource allocation and
   Medicare Advantage market opportunities. Use data-driven analysis and
   cite specific metrics from the demographics database.'
);

-- Register Medicare market analysis prompt
SELECT mcp_register_prompt(
  'medicare_market_analysis',
  '{
    "description": "Analyze Medicare Advantage market opportunity in a geographic area",
    "parameters": {
      "state": {"type": "string", "description": "Two-letter state code"},
      "counties": {
        "type": "array",
        "items": {"type": "string"},
        "description": "List of county FIPS codes to analyze"
      }
    }
  }',
  'Conduct a Medicare Advantage market analysis for {{state}} focusing on:
   {{#each counties}}
   - County {{this}}
   {{/each}}

   Provide analysis of:
   1. Senior population demographics and growth trends
   2. Current MA penetration and competitive landscape
   3. Healthcare facility adequacy and access
   4. Market opportunity and recommendations

   Base your analysis on the latest Census and Medicare data available in the database.'
);
```

### Security and Access Control

#### `mcp_set_resource_permissions()` - Configure Resource Access
```sql
-- Set permissions for healthcare data resources
SELECT mcp_set_resource_permissions('data://tables/demographics', '{
  "access_level": "public",
  "allowed_operations": ["read", "list"],
  "rate_limit": {
    "requests_per_minute": 100,
    "requests_per_hour": 1000
  }
}');

-- Restrict access to sensitive patient data
SELECT mcp_set_resource_permissions('data://tables/patient_records', '{
  "access_level": "restricted",
  "allowed_operations": ["read"],
  "require_auth": true,
  "allowed_roles": ["healthcare_analyst", "medical_researcher"],
  "data_classification": "PHI",
  "audit_all_access": true
}');
```

#### `mcp_configure_auth()` - Authentication Setup
```sql
-- Configure API key authentication
SELECT mcp_configure_auth('{
  "method": "api_key",
  "api_key_header": "X-CensusChat-Key",
  "valid_keys": ["${ANALYTICS_API_KEY}", "${RESEARCH_API_KEY}"],
  "key_permissions": {
    "${ANALYTICS_API_KEY}": ["read", "query"],
    "${RESEARCH_API_KEY}": ["read", "query", "export"]
  }
}');

-- Configure OAuth for external systems
SELECT mcp_configure_auth('{
  "method": "oauth2",
  "issuer": "https://auth.healthcare-platform.com",
  "audience": "censuschat-api",
  "required_scopes": ["healthcare.read", "demographics.access"]
}');
```

### Monitoring and Logging Functions

#### `mcp_get_server_metrics()` - Server Performance Metrics
```sql
-- Get comprehensive server metrics
SELECT mcp_get_server_metrics();

-- Returns detailed metrics:
-- {
--   "requests": {
--     "total": 15847,
--     "success": 15623,
--     "errors": 224,
--     "avg_response_time_ms": 145
--   },
--   "resources": {
--     "published": 23,
--     "active": 21,
--     "most_accessed": "data://tables/demographics"
--   },
--   "connections": {
--     "current": 8,
--     "peak": 15,
--     "total_established": 342
--   }
-- }
```

#### `mcp_get_access_logs()` - Access Logging
```sql
-- Get recent access logs
SELECT mcp_get_access_logs(
  start_time => CURRENT_TIMESTAMP - INTERVAL '1 hour',
  resource_pattern => 'data://tables/%'
);

-- Get logs for specific resource
SELECT mcp_get_access_logs(
  resource_uri => 'analytics://medicare/county_summary',
  include_auth_failures => true
);
```

#### `mcp_get_resource_stats()` - Resource Usage Statistics
```sql
-- Get usage statistics for all resources
SELECT mcp_get_resource_stats();

-- Get stats for healthcare-specific resources
SELECT mcp_get_resource_stats('analytics://healthcare/%');

-- Returns:
-- {
--   "resource_uri": "analytics://healthcare/facility_adequacy",
--   "access_count": 1247,
--   "unique_clients": 23,
--   "avg_response_size_bytes": 15872,
--   "last_accessed": "2024-01-15T14:30:22Z",
--   "cache_hit_rate": 0.87
-- }
```

## Healthcare-Specific Server Patterns

### Population Health Data Server
```sql
-- Create comprehensive population health MCP server
SELECT mcp_server_start('tcp', '0.0.0.0', 8080, '{
  "name": "population_health_server",
  "description": "Population health analytics and demographics server"
}');

-- Publish core demographic tables
SELECT mcp_publish_table('demographics', 'data://demographics/counties', 'parquet');
SELECT mcp_publish_table('health_indicators', 'data://health/indicators', 'json');

-- Register population health calculation tools
SELECT mcp_register_tool(
  'calculate_health_index',
  '{"description": "Calculate composite health index for geographic area"}',
  'SELECT calculate_composite_health_index($1)'
);

-- Register health trend analysis
SELECT mcp_register_prompt(
  'health_trend_analysis',
  '{"description": "Analyze health trends over time"}',
  'Analyze health trends for the specified geography and time period...'
);
```

### Medicare Analytics Server
```sql
-- Specialized Medicare analytics MCP server
SELECT mcp_server_start('stdio', 'localhost', 0, '{
  "name": "medicare_analytics_server",
  "description": "Medicare Advantage analytics and enrollment projections"
}');

-- Publish Medicare-specific views
SELECT mcp_publish_view(
  'SELECT state, county, population_65_plus, estimated_ma_eligible
   FROM medicare_eligible_view WHERE state = $1',
  'medicare://eligible/by_state',
  'json'
);

-- Register Medicare projection tools
SELECT mcp_register_tool(
  'project_ma_growth',
  '{"description": "Project Medicare Advantage enrollment growth"}',
  'SELECT project_medicare_advantage_growth($1, $2, $3)'
);
```

### Clinical Data Integration Server
```sql
-- FHIR-compatible clinical data MCP server
SELECT mcp_server_start('tcp', '0.0.0.0', 8443, '{
  "name": "clinical_data_server",
  "description": "FHIR-compatible clinical data integration",
  "security": {
    "require_tls": true,
    "require_auth": true,
    "data_classification": "PHI"
  }
}');

-- Publish anonymized patient demographics
SELECT mcp_publish_table(
  'patient_demographics_anonymized',
  'fhir://Patient/demographics',
  'json',
  '{
    "compliance": ["HIPAA", "FHIR_R4"],
    "anonymization_method": "k_anonymity",
    "k_value": 5
  }'
);
```

## Advanced Server Configuration

### Multi-Tenant Healthcare Server
```sql
-- Configure multi-tenant server for healthcare organizations
SELECT mcp_server_start('tcp', '0.0.0.0', 8080, '{
  "name": "multi_tenant_healthcare",
  "description": "Multi-tenant healthcare analytics platform",
  "tenancy": {
    "enabled": true,
    "tenant_header": "X-Healthcare-Org-ID",
    "data_isolation": "schema_based"
  }
}');

-- Register tenant-specific data access
SELECT mcp_register_tool(
  'get_org_demographics',
  '{
    "description": "Get demographics data for healthcare organization",
    "tenant_scoped": true
  }',
  'SELECT * FROM ${tenant_schema}.demographics WHERE authorized = true'
);
```

### Federated Healthcare Data Server
```sql
-- Federation server connecting multiple healthcare data sources
SELECT mcp_server_start('tcp', '0.0.0.0', 9090, '{
  "name": "federated_healthcare_server",
  "description": "Federated healthcare data integration platform",
  "federation": {
    "upstream_servers": [
      "census_data_server:8080",
      "medicare_data_server:8081",
      "clinical_data_server:8082"
    ]
  }
}');

-- Register federated query tool
SELECT mcp_register_tool(
  'federated_health_query',
  '{
    "description": "Execute queries across federated healthcare data sources",
    "parameters": {
      "query": {"type": "string", "description": "SQL query to execute"},
      "data_sources": {"type": "array", "description": "List of data sources to query"}
    }
  }',
  'SELECT execute_federated_query($1, $2)'
);
```

## Error Handling and Recovery

### Server Error Management
```sql
-- Configure error handling and recovery
SELECT mcp_configure_error_handling('{
  "max_retries": 3,
  "retry_delay_ms": 1000,
  "circuit_breaker": {
    "failure_threshold": 5,
    "timeout_ms": 30000,
    "recovery_timeout_ms": 60000
  },
  "error_responses": {
    "include_stack_trace": false,
    "log_all_errors": true,
    "custom_error_codes": {
      "HEALTHCARE_DATA_UNAVAILABLE": 503,
      "INSUFFICIENT_PERMISSIONS": 403
    }
  }
}');

-- Register health check endpoint
SELECT mcp_register_tool(
  'health_check',
  '{"description": "Server health check and status"}',
  'SELECT check_server_health()'
);
```

---

*This reference provides comprehensive coverage of all DuckDB MCP server functions specifically optimized for exposing CensusChat healthcare analytics data and capabilities to external systems.*
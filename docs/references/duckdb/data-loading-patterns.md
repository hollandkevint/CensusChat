# DuckDB Data Loading Patterns for Healthcare Analytics

*Optimized patterns for Census data and healthcare demographics*

## Census Bureau Data Loading

### ACS (American Community Survey) Data
```sql
-- Load ACS 5-Year Estimates
CREATE TABLE acs_demographics AS
SELECT * FROM read_csv('data/census/ACSST5Y*.csv',
  header=true,
  auto_detect=true,
  skip=1,  -- Skip metadata row
  nullstr=['', 'N', '(X)', '-'],
  types={
    'GEO_ID': 'VARCHAR',
    'NAME': 'VARCHAR',
    'B01003_001E': 'INTEGER',  -- Total Population
    'B25003_001E': 'INTEGER',  -- Total Housing Units
    'B19013_001E': 'INTEGER'   -- Median Household Income
  }
);
```

### Healthcare-Specific Data Patterns
```sql
-- Medicare Beneficiary Data Loading
CREATE TABLE medicare_data AS
SELECT
  state_code,
  county_code,
  state_name,
  county_name,
  CAST(beneficiaries_total AS INTEGER) as total_beneficiaries,
  CAST(beneficiaries_aged AS INTEGER) as aged_beneficiaries,
  CAST(beneficiaries_disabled AS INTEGER) as disabled_beneficiaries,
  CAST(REPLACE(per_capita_costs, '$', '') AS DECIMAL(10,2)) as per_capita_costs
FROM read_csv('data/medicare/county_beneficiaries.csv',
  header=true,
  ignore_errors=true
);
```

## Multi-File Loading Strategies

### Yearly Data Consolidation
```sql
-- Load multiple years of Census data
CREATE TABLE census_multi_year AS
SELECT
  *,
  EXTRACT(YEAR FROM CAST(filename AS DATE)) as survey_year
FROM read_csv('data/census/20*.csv',
  filename=true,
  union_by_name=true,
  header=true
);
```

### Geographic Hierarchy Loading
```sql
-- Load nested geographic data (State -> County -> Tract)
CREATE TABLE geo_hierarchy AS
WITH state_data AS (
  SELECT 'state' as geo_level, * FROM read_csv('data/geo/states.csv')
),
county_data AS (
  SELECT 'county' as geo_level, * FROM read_csv('data/geo/counties.csv')
),
tract_data AS (
  SELECT 'tract' as geo_level, * FROM read_csv('data/geo/tracts.csv')
)
SELECT * FROM state_data
UNION ALL SELECT * FROM county_data
UNION ALL SELECT * FROM tract_data;
```

## Data Quality and Validation Patterns

### Census Data Validation
```sql
-- Validate Census geographic codes
CREATE OR REPLACE FUNCTION validate_fips_code(code VARCHAR) AS (
  CASE
    WHEN LENGTH(code) = 2 AND code ~ '^[0-9]{2}$' THEN 'state'
    WHEN LENGTH(code) = 5 AND code ~ '^[0-9]{5}$' THEN 'county'
    WHEN LENGTH(code) = 11 AND code ~ '^[0-9]{11}$' THEN 'tract'
    ELSE 'invalid'
  END
);

-- Apply validation during loading
CREATE TABLE validated_census AS
SELECT
  *,
  validate_fips_code(geo_id) as geo_level,
  CASE WHEN validate_fips_code(geo_id) = 'invalid' THEN true ELSE false END as has_error
FROM read_csv('data/census_raw.csv', auto_detect=true)
WHERE validate_fips_code(geo_id) != 'invalid';
```

### Healthcare Data Quality Checks
```sql
-- Validate healthcare demographics
CREATE TABLE quality_checked_demographics AS
SELECT
  *,
  CASE
    WHEN age < 0 OR age > 120 THEN 'invalid_age'
    WHEN income < 0 OR income > 1000000 THEN 'invalid_income'
    WHEN population_65_plus > total_population THEN 'invalid_senior_count'
    ELSE 'valid'
  END as quality_flag
FROM raw_demographics
WHERE quality_flag = 'valid';
```

## Performance-Optimized Loading

### Parallel Loading for Large Datasets
```sql
-- Use parallel CSV reading
SET threads = 4;
SET memory_limit = '8GB';

CREATE TABLE large_census_data AS
SELECT * FROM read_csv('data/large_census/*.csv',
  header=true,
  parallel=true,
  union_by_name=true,
  auto_detect=true
);
```

### Incremental Loading Pattern
```sql
-- Create staging table for new data
CREATE TABLE staging_demographics AS
SELECT * FROM read_csv('data/new_demographics.csv', auto_detect=true);

-- Merge with existing data
MERGE INTO demographics_master AS target
USING staging_demographics AS source
ON target.geo_id = source.geo_id AND target.survey_year = source.survey_year
WHEN MATCHED THEN UPDATE SET
  population = source.population,
  median_income = source.median_income,
  last_updated = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN INSERT VALUES (
  source.geo_id,
  source.population,
  source.median_income,
  source.survey_year,
  CURRENT_TIMESTAMP
);
```

## JSON Data Patterns for Healthcare

### Complex Healthcare Records
```sql
-- Load healthcare facility JSON data
CREATE TABLE healthcare_facilities AS
SELECT
  facility_id,
  JSON_EXTRACT_STRING(facility_data, '$.name') as facility_name,
  JSON_EXTRACT_STRING(facility_data, '$.type') as facility_type,
  JSON_EXTRACT_STRING(facility_data, '$.address.state') as state,
  JSON_EXTRACT_STRING(facility_data, '$.address.county') as county,
  JSON_EXTRACT(facility_data, '$.services') as services_offered,
  JSON_ARRAY_LENGTH(facility_data, '$.services') as service_count,
  CAST(JSON_EXTRACT_STRING(facility_data, '$.capacity') AS INTEGER) as bed_capacity
FROM read_json('data/healthcare/facilities.json', format='array');
```

### Patient Demographics JSON
```sql
-- Process nested patient demographic data
CREATE TABLE patient_demographics AS
SELECT
  patient_id,
  JSON_EXTRACT_STRING(demographics, '$.age_group') as age_group,
  JSON_EXTRACT_STRING(demographics, '$.insurance.primary') as primary_insurance,
  JSON_EXTRACT_STRING(demographics, '$.geography.state') as state,
  JSON_EXTRACT_STRING(demographics, '$.geography.county') as county,
  JSON_EXTRACT(demographics, '$.conditions') as medical_conditions,
  JSON_EXTRACT_STRING(demographics, '$.socioeconomic.income_bracket') as income_bracket
FROM read_json('data/patient_demographics.jsonl', format='newline_delimited');
```

## Parquet Optimization Patterns

### Partitioned Healthcare Data
```sql
-- Create partitioned table for efficient querying
CREATE TABLE partitioned_demographics (
  geo_id VARCHAR,
  population INTEGER,
  median_income INTEGER,
  survey_year INTEGER,
  state VARCHAR
) PARTITION BY (state);

-- Load data maintaining partitions
INSERT INTO partitioned_demographics
SELECT
  geo_id,
  population,
  median_income,
  survey_year,
  state
FROM read_parquet('data/demographics/*.parquet');
```

### Columnar Storage for Analytics
```sql
-- Export optimized for analytics
COPY (
  SELECT
    state,
    county,
    survey_year,
    total_population,
    senior_population,
    median_income,
    poverty_rate
  FROM demographics_master
) TO 'analytics/demographics_optimized.parquet' (
  FORMAT 'parquet',
  COMPRESSION 'snappy',
  ROW_GROUP_SIZE 100000
);
```

## External Data Source Integration

### Census Bureau API Integration
```sql
-- Load directly from Census API (requires extension)
CREATE TABLE api_census_data AS
SELECT * FROM read_json_auto(
  'https://api.census.gov/data/2021/acs/acs5',
  params={
    'get': 'B01003_001E,B19013_001E',
    'for': 'county:*',
    'in': 'state:*',
    'key': '${CENSUS_API_KEY}'
  }
);
```

### Healthcare Data Warehouse Integration
```sql
-- Connect to external healthcare database
INSTALL postgres;
LOAD postgres;

ATTACH 'host=healthcare-db.example.com port=5432 dbname=analytics user=reader' AS healthcare_warehouse;

-- Load data from external source
CREATE TABLE external_patient_data AS
SELECT * FROM healthcare_warehouse.patient_analytics
WHERE last_updated >= CURRENT_DATE - INTERVAL '30 days';
```

## Memory Management for Large Loads

### Streaming Data Processing
```sql
-- Process large files in chunks
SET memory_limit = '4GB';
SET temp_directory = '/tmp/duckdb_temp';

-- Use streaming aggregation for large datasets
CREATE TABLE aggregated_demographics AS
SELECT
  state,
  county,
  SUM(population) as total_pop,
  AVG(median_income) as avg_income,
  COUNT(*) as record_count
FROM read_csv('data/very_large_census.csv', auto_detect=true)
GROUP BY state, county;
```

### Efficient Data Types
```sql
-- Optimize data types for memory efficiency
CREATE TABLE optimized_demographics (
  state_code UTINYINT,           -- 0-255 for state codes
  county_code USMALLINT,         -- 0-65535 for county codes
  population UINTEGER,           -- Unsigned for population counts
  median_income UINTEGER,        -- Unsigned for income
  poverty_rate DECIMAL(5,2),     -- Precise decimal for percentages
  survey_date DATE               -- Date instead of timestamp
);
```

## Error Handling and Recovery

### Robust Loading with Error Logging
```sql
-- Create error log table
CREATE TABLE load_errors (
  load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_file VARCHAR,
  error_type VARCHAR,
  error_message VARCHAR,
  row_data VARCHAR
);

-- Load with error handling
INSERT INTO demographics_staging
SELECT * FROM read_csv('data/problematic_census.csv',
  auto_detect=true,
  ignore_errors=true,
  max_line_length=1000000
)
ON CONFLICT DO NOTHING;

-- Log any rows that failed validation
INSERT INTO load_errors (source_file, error_type, error_message, row_data)
SELECT
  'problematic_census.csv',
  'validation_error',
  'Invalid age or income values',
  CONCAT(geo_id, '|', age, '|', income)
FROM demographics_staging
WHERE age < 0 OR age > 120 OR income < 0;
```

---

*These patterns are optimized for the CensusChat healthcare analytics use case and can handle large-scale Census Bureau and healthcare datasets efficiently.*
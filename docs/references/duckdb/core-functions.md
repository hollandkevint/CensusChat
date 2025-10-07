# DuckDB Core Functions Reference

*Healthcare Analytics Focused Reference for CensusChat*

## Data Loading Functions

### File Reading Functions
```sql
-- CSV Data Loading
SELECT * FROM read_csv('data/census_data.csv',
  header=true,
  auto_detect=true,
  ignore_errors=true
);

-- JSON Data Loading
SELECT * FROM read_json('data/demographics.json');

-- Parquet Data Loading (Recommended for large datasets)
SELECT * FROM read_parquet('data/census_analytics.parquet');

-- Multiple File Loading
SELECT * FROM read_csv('data/*.csv', union_by_name=true);
```

### Database Connection Functions
```sql
-- Attach External Database
ATTACH 'database.db' AS external_db;

-- Memory Database
ATTACH ':memory:' AS temp_analytics;

-- Read-only Database
ATTACH 'readonly.db' AS read_only (READ_ONLY);
```

## Healthcare Analytics Functions

### Date & Time Functions
```sql
-- Age Calculation
SELECT
  patient_id,
  EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birth_date) AS age,
  CASE
    WHEN EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birth_date) >= 65
    THEN 'Medicare Eligible'
    ELSE 'Not Medicare Eligible'
  END AS medicare_status
FROM patients;

-- Date Range Analysis
SELECT * FROM demographics
WHERE survey_date BETWEEN '2020-01-01' AND '2023-12-31';
```

### Aggregation Functions
```sql
-- Population Statistics
SELECT
  county,
  COUNT(*) as total_count,
  AVG(age) as avg_age,
  MEDIAN(income) as median_income,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY income) as income_95th_percentile,
  STDDEV(age) as age_std_dev
FROM demographics
GROUP BY county;

-- Healthcare Specific Aggregations
SELECT
  state,
  SUM(CASE WHEN age >= 65 THEN 1 ELSE 0 END) as seniors_count,
  SUM(population) as total_population,
  ROUND(100.0 * SUM(CASE WHEN age >= 65 THEN 1 ELSE 0 END) / SUM(population), 2) as senior_percentage
FROM census_data
GROUP BY state;
```

### Window Functions
```sql
-- Ranking by Healthcare Metrics
SELECT
  county,
  state,
  senior_population,
  RANK() OVER (PARTITION BY state ORDER BY senior_population DESC) as state_rank,
  PERCENT_RANK() OVER (ORDER BY senior_population DESC) as national_percentile
FROM county_demographics;

-- Moving Averages for Trend Analysis
SELECT
  year,
  medicare_enrollment,
  AVG(medicare_enrollment) OVER (
    ORDER BY year
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) as three_year_avg
FROM yearly_enrollment;
```

### String Functions for Healthcare Data
```sql
-- Diagnosis Code Processing
SELECT
  patient_id,
  UPPER(diagnosis_code) as standardized_code,
  LEFT(diagnosis_code, 3) as diagnosis_category,
  REGEXP_EXTRACT(notes, '[A-Z][0-9]{2}\.[0-9]') as icd_codes
FROM medical_records;

-- Geographic Data Cleaning
SELECT
  TRIM(UPPER(state_name)) as clean_state,
  REGEXP_REPLACE(zip_code, '[^0-9]', '') as clean_zip,
  CASE
    WHEN LENGTH(zip_code) = 5 THEN zip_code
    WHEN LENGTH(zip_code) = 9 THEN LEFT(zip_code, 5)
    ELSE NULL
  END as standard_zip
FROM address_data;
```

## Performance Optimization Functions

### Indexing
```sql
-- Create Index for Fast Lookups
CREATE INDEX idx_county_state ON demographics (county, state);
CREATE INDEX idx_age_range ON demographics (age) WHERE age >= 65;
```

### Query Optimization
```sql
-- Use EXPLAIN for Query Analysis
EXPLAIN SELECT * FROM large_demographics
WHERE age >= 65 AND income > 50000;

-- Materialized Views for Complex Calculations
CREATE VIEW medicare_eligible_summary AS
SELECT
  state,
  county,
  COUNT(*) as total_seniors,
  AVG(income) as avg_income,
  COUNT(CASE WHEN income > 50000 THEN 1 END) as high_income_seniors
FROM demographics
WHERE age >= 65
GROUP BY state, county;
```

### Memory Management
```sql
-- Set Memory Limits
SET memory_limit = '4GB';
SET threads = 4;

-- Enable Query Progress
SET enable_progress_bar = true;
```

## Data Type Functions

### Numeric Functions
```sql
-- Healthcare Calculations
SELECT
  county,
  population,
  senior_population,
  ROUND(100.0 * senior_population / population, 2) as senior_percentage,
  CEIL(senior_population * 0.85) as estimated_medicare_eligible,
  FLOOR(population / 1000) as population_thousands
FROM county_stats;
```

### Array and List Functions
```sql
-- Multiple Diagnosis Processing
SELECT
  patient_id,
  diagnosis_codes,
  ARRAY_LENGTH(diagnosis_codes) as diagnosis_count,
  ARRAY_CONTAINS(diagnosis_codes, 'E11') as has_diabetes,
  LIST_FILTER(diagnosis_codes, x -> x LIKE 'I%') as cardiac_codes
FROM patient_diagnoses;
```

### JSON Functions
```sql
-- Process Healthcare JSON Data
SELECT
  patient_id,
  JSON_EXTRACT(medical_history, '$.allergies') as allergies,
  JSON_ARRAY_LENGTH(medical_history, '$.medications') as medication_count,
  JSON_EXTRACT_STRING(demographics, '$.insurance_type') as insurance
FROM patient_records;
```

## Export Functions

### Data Export
```sql
-- Export to CSV
COPY (
  SELECT county, state, senior_population, medicare_eligible
  FROM healthcare_summary
) TO 'healthcare_export.csv' (HEADER, DELIMITER ',');

-- Export to Parquet (Recommended for large datasets)
COPY (SELECT * FROM analytics_results) TO 'results.parquet';

-- Export to JSON
COPY (SELECT * FROM summary_stats) TO 'summary.json';
```

## Error Handling and Data Quality

### Data Validation
```sql
-- Check for Data Quality Issues
SELECT
  'Missing Ages' as issue,
  COUNT(*) as count
FROM demographics WHERE age IS NULL
UNION ALL
SELECT
  'Invalid Ages' as issue,
  COUNT(*) as count
FROM demographics WHERE age < 0 OR age > 120
UNION ALL
SELECT
  'Missing States' as issue,
  COUNT(*) as count
FROM demographics WHERE state IS NULL;
```

### Safe Data Operations
```sql
-- Safe Division with NULL Handling
SELECT
  county,
  COALESCE(senior_population, 0) as safe_senior_pop,
  CASE
    WHEN population > 0 THEN 100.0 * senior_population / population
    ELSE NULL
  END as safe_percentage
FROM county_data;
```

## Connection Management

### Database Configuration
```sql
-- Optimize for Analytics Workload
SET default_null_order = 'NULLS LAST';
SET enable_object_cache = true;
SET checkpoint_threshold = '100MB';
```

### Transaction Management
```sql
-- Explicit Transaction Control
BEGIN TRANSACTION;
  INSERT INTO demographics_backup SELECT * FROM demographics;
  UPDATE demographics SET processed = true WHERE processed IS NULL;
COMMIT;
```

---

*This reference is optimized for healthcare demographics and Census data analysis use cases in CensusChat.*
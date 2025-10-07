# DuckDB Performance Optimization for Healthcare Analytics

*Optimizing query performance for Census data and healthcare demographics*

## Memory Configuration

### Optimal Memory Settings for Healthcare Analytics
```sql
-- Recommended settings for 8GB+ systems
SET memory_limit = '6GB';          -- Leave 2GB for OS
SET threads = 4;                   -- Match CPU cores
SET max_memory = '6GB';
SET temp_directory = '/fast_ssd/duckdb_temp';

-- For systems with limited memory (4GB)
SET memory_limit = '2GB';
SET threads = 2;
```

### Memory-Conscious Query Patterns
```sql
-- Use streaming aggregation for large datasets
SELECT
  state,
  COUNT(*) as population_count,
  AVG(median_income) as avg_income
FROM read_csv('large_census.csv', auto_detect=true)
GROUP BY state;  -- DuckDB will stream and aggregate

-- Avoid loading entire dataset into memory
-- Instead of: CREATE TABLE temp AS SELECT * FROM huge_table;
-- Use views: CREATE VIEW temp AS SELECT * FROM huge_table;
```

## Indexing Strategies

### Strategic Index Creation
```sql
-- Primary lookup indexes for healthcare queries
CREATE INDEX idx_demographics_geo ON demographics (state, county);
CREATE INDEX idx_demographics_age ON demographics (age_group);
CREATE INDEX idx_demographics_income ON demographics (income_bracket);

-- Composite indexes for common query patterns
CREATE INDEX idx_demographics_senior_income ON demographics (age_65_plus, median_income)
WHERE age_65_plus > 0;

-- Conditional indexes for specific populations
CREATE INDEX idx_medicare_eligible ON demographics (state, county, population_65_plus)
WHERE population_65_plus > 0;
```

### Index Maintenance
```sql
-- Monitor index usage
SELECT * FROM duckdb_indexes() WHERE database_name = 'main';

-- Rebuild indexes if needed
DROP INDEX IF EXISTS idx_demographics_geo;
CREATE INDEX idx_demographics_geo ON demographics (state, county);
```

## Query Optimization Techniques

### Efficient Filtering Patterns
```sql
-- Push filters down early
SELECT
  county,
  SUM(population_65_plus) as senior_population
FROM demographics
WHERE state IN ('FL', 'CA', 'TX', 'NY')  -- Filter early
  AND survey_year = 2022                  -- Most selective first
  AND population_65_plus > 0              -- Exclude empty records
GROUP BY county;

-- Use LIMIT for exploratory queries
SELECT * FROM large_demographics
WHERE state = 'CA'
LIMIT 1000;  -- Prevents accidentally loading millions of rows
```

### Optimized JOIN Strategies
```sql
-- Use broadcast joins for small dimension tables
SELECT /*+ USE_MERGE_JOIN */
  d.county,
  d.population,
  g.region,
  g.metro_area
FROM demographics d
JOIN geography g ON d.geo_id = g.geo_id
WHERE d.state = 'FL';

-- Optimize join order (smallest table first)
SELECT
  c.county_name,
  d.population,
  f.facility_count
FROM counties c  -- Smallest table first
JOIN demographics d ON c.fips_code = d.geo_id
JOIN facilities f ON c.fips_code = f.county_fips;
```

### Window Function Optimization
```sql
-- Efficient ranking queries
SELECT
  county,
  state,
  senior_population,
  RANK() OVER (PARTITION BY state ORDER BY senior_population DESC) as state_rank
FROM demographics
WHERE senior_population > 1000  -- Filter before window function
ORDER BY state, state_rank;

-- Use QUALIFY for window function filtering
SELECT
  county,
  state,
  senior_population,
  RANK() OVER (PARTITION BY state ORDER BY senior_population DESC) as state_rank
FROM demographics
QUALIFY state_rank <= 5;  -- More efficient than subquery
```

## Data Layout Optimization

### Columnar Storage Benefits
```sql
-- Export to Parquet for better compression and query performance
COPY (
  SELECT
    geo_id,
    state,
    county,
    total_population,
    population_65_plus,
    median_income,
    survey_year
  FROM demographics
  ORDER BY state, county, survey_year  -- Sort for better compression
) TO 'optimized_demographics.parquet' (
  FORMAT 'parquet',
  COMPRESSION 'snappy'
);
```

### Table Partitioning
```sql
-- Partition large tables by frequently filtered columns
CREATE TABLE demographics_partitioned (
  geo_id VARCHAR,
  population INTEGER,
  median_income INTEGER,
  survey_year INTEGER
) PARTITION BY (survey_year);

-- Query partitioned tables efficiently
SELECT * FROM demographics_partitioned
WHERE survey_year = 2022;  -- Only scans 2022 partition
```

## Aggregation Optimization

### Pre-aggregated Views for Common Patterns
```sql
-- Create materialized aggregations for frequent queries
CREATE TABLE state_summary AS
SELECT
  state,
  survey_year,
  SUM(total_population) as state_population,
  SUM(population_65_plus) as state_seniors,
  AVG(median_income) as avg_median_income,
  COUNT(*) as county_count
FROM demographics
GROUP BY state, survey_year;

-- Use pre-aggregated data for dashboards
SELECT
  state,
  state_population,
  ROUND(100.0 * state_seniors / state_population, 2) as senior_percentage
FROM state_summary
WHERE survey_year = 2022
ORDER BY senior_percentage DESC;
```

### Efficient Group-By Patterns
```sql
-- Use appropriate grouping sets for multi-dimensional analysis
SELECT
  state,
  county,
  age_group,
  SUM(population) as total_pop
FROM detailed_demographics
GROUP BY GROUPING SETS (
  (state),                    -- State totals
  (state, county),           -- County totals
  (state, age_group),        -- Age group by state
  (state, county, age_group) -- Full detail
);
```

## I/O Optimization

### File Format Optimization
```sql
-- Parquet is fastest for analytical queries
SELECT * FROM read_parquet('data/*.parquet');  -- Fastest

-- CSV with optimizations
SELECT * FROM read_csv('data/*.csv',
  parallel=true,           -- Enable parallel reading
  buffer_size=1048576,     -- 1MB buffer
  auto_detect=true
);

-- JSON optimization for nested data
SELECT * FROM read_json('data/*.json',
  format='array',
  maximum_object_size=1048576
);
```

### Parallel Processing
```sql
-- Enable parallel execution
SET threads = 4;
SET enable_external_access = true;

-- Parallel file reading
SELECT state, COUNT(*) as record_count
FROM read_csv('data/census_*.csv', parallel=true, union_by_name=true)
GROUP BY state;
```

## Query Analysis and Monitoring

### Performance Profiling
```sql
-- Enable query profiling
SET enable_profiling = true;
SET profiling_output = 'query_profile.json';

-- Analyze query execution
EXPLAIN ANALYZE SELECT
  state,
  AVG(median_income) as avg_income
FROM demographics
WHERE population_65_plus > 1000
GROUP BY state;

-- View execution plan
EXPLAIN SELECT * FROM demographics WHERE state = 'CA';
```

### Query Optimization Hints
```sql
-- Force specific join algorithms when needed
SELECT /*+ USE_MERGE_JOIN */
  d.county,
  f.facility_count
FROM demographics d
JOIN facilities f ON d.geo_id = f.county_fips;

-- Disable certain optimizations if causing issues
SELECT /*+ NO_PUSHDOWN */
  state,
  complex_calculation(population, income) as score
FROM demographics;
```

## Common Performance Anti-Patterns

### Avoid These Patterns
```sql
-- DON'T: Load entire large table for small result
-- SELECT * FROM huge_demographics WHERE county = 'Miami-Dade';

-- DO: Use selective queries
SELECT county, population, median_income
FROM demographics
WHERE county = 'Miami-Dade' AND state = 'FL';

-- DON'T: Use functions in WHERE clauses on large tables
-- SELECT * FROM demographics WHERE UPPER(state) = 'FLORIDA';

-- DO: Store data in consistent case
SELECT * FROM demographics WHERE state = 'FL';

-- DON'T: Use DISTINCT without understanding cardinality
-- SELECT DISTINCT * FROM large_table;

-- DO: Use GROUP BY for aggregations
SELECT state, COUNT(*) FROM demographics GROUP BY state;
```

### Memory-Efficient Patterns
```sql
-- DON'T: Create unnecessary temp tables
-- CREATE TABLE temp AS SELECT * FROM large_table WHERE condition;
-- SELECT * FROM temp WHERE another_condition;

-- DO: Use CTEs or subqueries
WITH filtered AS (
  SELECT * FROM large_table WHERE condition
)
SELECT * FROM filtered WHERE another_condition;
```

## Monitoring and Maintenance

### Performance Monitoring Queries
```sql
-- Check memory usage
SELECT * FROM duckdb_memory();

-- Monitor active queries
SELECT * FROM duckdb_queries();

-- Check table statistics
SELECT * FROM duckdb_tables();

-- View index usage
SELECT * FROM duckdb_indexes();
```

### Maintenance Operations
```sql
-- Update table statistics for better query planning
ANALYZE demographics;

-- Checkpoint database to disk
CHECKPOINT;

-- Vacuum to reclaim space (if needed)
VACUUM;

-- Optimize database file
PRAGMA optimize;
```

## Healthcare-Specific Optimizations

### Medicare Analytics Optimization
```sql
-- Optimized view for Medicare eligibility queries
CREATE VIEW medicare_analytics AS
SELECT
  state,
  county,
  population_65_plus as medicare_eligible_pop,
  CASE
    WHEN median_income > 50000 THEN population_65_plus * 0.85
    ELSE population_65_plus * 0.95
  END as estimated_enrollment
FROM demographics
WHERE population_65_plus > 0;

-- Use for fast Medicare queries
SELECT state, SUM(medicare_eligible_pop) FROM medicare_analytics GROUP BY state;
```

### Geographic Hierarchy Optimization
```sql
-- Optimized geographic lookup table
CREATE TABLE geo_lookup AS
SELECT DISTINCT
  LEFT(geo_id, 2) as state_fips,
  LEFT(geo_id, 5) as county_fips,
  geo_id as full_fips,
  state_name,
  county_name
FROM demographics;

CREATE INDEX idx_geo_hierarchy ON geo_lookup (state_fips, county_fips, full_fips);
```

---

*These optimization techniques are specifically tuned for healthcare demographics and Census data analysis patterns commonly used in CensusChat.*
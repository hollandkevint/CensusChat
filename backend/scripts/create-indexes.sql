-- Create performance indexes for block group queries
-- Run with: duckdb data/census.duckdb < scripts/create-indexes.sql

-- Block Group Indexes (for fast filtering and joins)
CREATE INDEX IF NOT EXISTS idx_bg_geoid ON block_group_data(geoid);
CREATE INDEX IF NOT EXISTS idx_bg_state ON block_group_data(state_name);
CREATE INDEX IF NOT EXISTS idx_bg_county ON block_group_data(state_name, county_name);
CREATE INDEX IF NOT EXISTS idx_bg_state_fips ON block_group_data(state_fips);
CREATE INDEX IF NOT EXISTS idx_bg_age_65_plus ON block_group_data(age_65_plus);
CREATE INDEX IF NOT EXISTS idx_bg_poverty ON block_group_data(poverty_rate);
CREATE INDEX IF NOT EXISTS idx_bg_uninsured ON block_group_data(uninsured_rate);
CREATE INDEX IF NOT EXISTS idx_bg_population ON block_group_data(population);

-- County Indexes (county_data uses different column names: state, county)
CREATE INDEX IF NOT EXISTS idx_county_state_fips ON county_data(state, county);
CREATE INDEX IF NOT EXISTS idx_county_state_name ON county_data(state_name);
CREATE INDEX IF NOT EXISTS idx_county_name ON county_data(state_name, county_name);
CREATE INDEX IF NOT EXISTS idx_county_population ON county_data(population);

-- Summary
SELECT 'Indexes created successfully' as status;

-- Show table sizes
SELECT
  'county_data' as table_name,
  COUNT(*) as records,
  COUNT(DISTINCT state_name) as states
FROM county_data
UNION ALL
SELECT
  'block_group_data' as table_name,
  COUNT(*) as records,
  COUNT(DISTINCT state_name) as states
FROM block_group_data;

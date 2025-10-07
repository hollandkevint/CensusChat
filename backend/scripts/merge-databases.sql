-- Merge block group data into main census database
-- Run this script from the backend directory with:
-- duckdb data/census.duckdb < scripts/merge-databases.sql

-- Attach the block group database
ATTACH 'data/census_blockgroups.duckdb' AS bg_db;

-- Copy the block_group_data table to main database
CREATE TABLE IF NOT EXISTS block_group_data AS
SELECT * FROM bg_db.block_group_data;

-- Verify the import
SELECT 'Block groups imported: ' || COUNT(*)::VARCHAR as result
FROM block_group_data;

-- Show sample by state
SELECT state_name, COUNT(*) as block_groups
FROM block_group_data
GROUP BY state_name
ORDER BY block_groups DESC
LIMIT 5;

-- Detach the source database
DETACH bg_db;

-- Summary of all tables
SELECT
  'county_data' as table_name,
  COUNT(*) as record_count
FROM county_data
UNION ALL
SELECT
  'block_group_data' as table_name,
  COUNT(*) as record_count
FROM block_group_data;

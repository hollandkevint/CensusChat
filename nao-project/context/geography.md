# Census Geography Hierarchy

## Geographic Levels

The US Census Bureau organizes geography in a nested hierarchy. CensusChat covers the following levels:

```
Nation
  └── State (50 states + DC + territories)
        └── County (3,144 counties and county-equivalents)
              └── Census Tract (~85,000 tracts)
                    └── Block Group (~239,741 block groups)
                          └── Block (~11 million blocks)
```

CensusChat provides data at two levels:
1. **County** - via `county_data` table (3,144 records)
2. **Block Group** - via `block_group_data` and `block_group_data_expanded` tables (239,741 records)

## GEOID Format

The GEOID (Geographic Identifier) is a hierarchical code that uniquely identifies each geographic unit.

### Block Group GEOID Structure (12 digits)

```
120860102001
│││   │     │
││└───┘     └── Block Group (1 digit): 1
││    └──────── Census Tract (6 digits): 010200
│└───────────── County FIPS (3 digits): 086
└────────────── State FIPS (2 digits): 12
```

**Example:** GEOID `120860102001`
- State: `12` (Florida)
- County: `086` (Miami-Dade County)
- Tract: `010200`
- Block Group: `1`

### Extracting Geography from GEOID

Use DuckDB string functions to extract components:

```sql
-- Extract state FIPS (first 2 digits)
LEFT(geoid, 2) AS state_fips

-- Extract county FIPS (first 5 digits = state + county)
LEFT(geoid, 5) AS county_fips

-- Extract tract (first 11 digits = state + county + tract)
LEFT(geoid, 11) AS tract_fips

-- Extract just the block group digit
RIGHT(geoid, 1) AS block_group
```

### Common FIPS Codes

| State | FIPS | Example County | County FIPS |
|-------|------|----------------|-------------|
| Alabama | 01 | Jefferson (Birmingham) | 01073 |
| Arizona | 04 | Maricopa (Phoenix) | 04013 |
| California | 06 | Los Angeles | 06037 |
| Florida | 12 | Miami-Dade | 12086 |
| Georgia | 13 | Fulton (Atlanta) | 13121 |
| Illinois | 17 | Cook (Chicago) | 17031 |
| New York | 36 | New York (Manhattan) | 36061 |
| Ohio | 39 | Cuyahoga (Cleveland) | 39035 |
| Pennsylvania | 42 | Philadelphia | 42101 |
| Texas | 48 | Harris (Houston) | 48201 |

## Querying by Geography

### Find all block groups in a county

```sql
SELECT *
FROM block_group_data_expanded
WHERE LEFT(geoid, 5) = '12086'  -- Miami-Dade County, FL
LIMIT 100
```

### Find all block groups in a state

```sql
SELECT *
FROM block_group_data
WHERE state_fips = '12'  -- Florida
LIMIT 100
```

### Aggregate block groups to county level

```sql
SELECT
  state_name,
  county_name,
  SUM(population) AS total_population,
  SUM(age_65_plus) AS total_seniors,
  ROUND(SUM(age_65_plus) * 100.0 / NULLIF(SUM(population), 0), 2) AS senior_pct,
  ROUND(SUM(median_household_income * population) / NULLIF(SUM(population), 0), 0) AS weighted_avg_income
FROM block_group_data
WHERE state_name = 'Florida'
GROUP BY state_name, county_name
ORDER BY total_population DESC
LIMIT 50
```

### Multi-county comparison using county_data

```sql
SELECT county_name, state_name, population, median_income, poverty_rate
FROM county_data
WHERE state_name = 'Florida'
  AND county_name IN ('Miami-Dade County', 'Broward County', 'Palm Beach County')
ORDER BY population DESC
```

## Geography Notes

- **County names** in the data typically include the suffix (e.g., "Miami-Dade County", "Los Angeles County"). Always include the suffix when filtering by `county_name`.
- **State names** are stored as full names (e.g., "Florida", not "FL").
- **FIPS codes** are stored as strings with leading zeros preserved (e.g., state FIPS "06" for California, not integer 6).
- **Block groups** are the smallest geographic unit in CensusChat. They typically contain 600-3,000 people.
- **Census tracts** are not directly queryable as a table, but you can aggregate block groups by tract using `LEFT(geoid, 11)`.
- A single county may contain anywhere from a handful to thousands of block groups depending on population.

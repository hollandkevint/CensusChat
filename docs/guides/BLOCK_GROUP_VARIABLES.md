# Block Group Data Variables

## Overview

CensusChat now loads **35+ demographic, economic, health, and social variables** at the census block group level - the finest geographic granularity available in the ACS 5-Year dataset.

This provides **70x more geographic detail** than county-level data (~220,000 block groups vs. 3,144 counties).

## Geographic Identifiers

| Field | Type | Description |
|-------|------|-------------|
| `geoid` | VARCHAR(12) | Full 12-digit FIPS code (Primary Key) |
| `state_fips` | VARCHAR(2) | State FIPS code |
| `county_fips` | VARCHAR(3) | County FIPS code |
| `tract_fips` | VARCHAR(6) | Census tract FIPS code |
| `block_group` | VARCHAR(1) | Block group number (1-9) |
| `state_name` | VARCHAR(50) | State name |
| `county_name` | VARCHAR(100) | County name |

## Demographics (7 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `population` | BIGINT | B01003_001E | Total population |
| `median_age` | DOUBLE | B01002_001E | Median age |
| `male_population` | INTEGER | B01001_002E | Male population |
| `female_population` | INTEGER | B01001_026E | Female population |

### Age Group Breakdowns (Healthcare Focus)

| Variable | Type | Calculated From | Description |
|----------|------|-----------------|-------------|
| `under_5` | INTEGER | B01001_003E + B01001_027E | Children under 5 |
| `age_5_17` | INTEGER | B01001_004-006E + B01001_028E | School-age children |
| `age_18_64` | INTEGER | B01001_007-012E + B01001_029E | Working-age adults |
| `age_65_plus` | INTEGER | B01001_013E + B01001_025E + B01001_044E + B01001_049E | Medicare-eligible seniors |
| `age_75_plus` | INTEGER | B01001_025E + B01001_049E | Very elderly (high healthcare needs) |

## Race and Ethnicity (4 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `white_alone` | INTEGER | B02001_002E | White alone |
| `black_alone` | INTEGER | B02001_003E | Black/African American alone |
| `asian_alone` | INTEGER | B02001_005E | Asian alone |
| `hispanic_latino` | INTEGER | B03003_003E | Hispanic or Latino (any race) |

## Economic Indicators (5 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `median_household_income` | INTEGER | B19013_001E | Median household income ($) |
| `per_capita_income` | INTEGER | B19301_001E | Per capita income ($) |
| `poverty_rate` | DOUBLE | Calculated | % below poverty line |
| `unemployment_rate` | DOUBLE | Calculated | % of labor force unemployed |
| `uninsured_rate` | DOUBLE | Calculated | % without health insurance |

**Calculation formulas:**
- `poverty_rate` = (B17001_002E / B17001_001E) × 100
- `unemployment_rate` = (B23025_005E / B23025_002E) × 100
- `uninsured_rate` = (B27001_005E / B27001_001E) × 100

## Education (2 variables)

| Variable | Type | ACS Codes | Description |
|----------|------|-----------|-------------|
| `high_school_or_higher_pct` | DOUBLE | Calculated | % with HS diploma or higher |
| `bachelors_or_higher_pct` | DOUBLE | Calculated | % with bachelor's degree or higher |

**Calculation formulas:**
- HS+ = (HS grad + some college + associate + bachelor's + graduate) / total 25+ × 100
- Bachelor's+ = (bachelor's + graduate) / total 25+ × 100

## Housing (4 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `total_housing_units` | INTEGER | B25001_001E | Total housing units |
| `median_home_value` | INTEGER | B25077_001E | Median home value ($) |
| `median_rent` | INTEGER | B25064_001E | Median gross rent ($) |
| `renter_occupied_pct` | DOUBLE | Calculated | % renter-occupied units |

**Calculation formula:**
- `renter_occupied_pct` = (B25003_003E / B25001_001E) × 100

## Health-Related (2 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `disability_rate` | DOUBLE | Calculated | % with a disability |
| `limited_english_pct` | DOUBLE | Calculated | % speaking English less than "very well" |

**Calculation formulas:**
- `disability_rate` = (B18101_004E / B18101_001E) × 100
- `limited_english_pct` = (B16004_067E / B16004_001E) × 100

## Transportation (2 variables)

| Variable | Type | ACS Code | Description |
|----------|------|----------|-------------|
| `no_vehicle_pct` | DOUBLE | Calculated | % households with no vehicle |
| `public_transit_pct` | DOUBLE | Calculated | % commuting via public transit |

**Calculation formulas:**
- `no_vehicle_pct` = (B25044_003E / B25044_001E) × 100
- `public_transit_pct` = (B08301_010E / B08301_001E) × 100

## Healthcare Use Cases

### Medicare/Medicaid Targeting
```sql
-- Find block groups with high Medicare-eligible population
SELECT geoid, state_name, county_name,
       age_65_plus, age_75_plus,
       (age_65_plus::FLOAT / population * 100) as senior_pct
FROM block_group_data
WHERE age_65_plus > 500
  AND (age_65_plus::FLOAT / population * 100) > 20
ORDER BY senior_pct DESC;
```

### Social Determinants of Health
```sql
-- Identify vulnerable populations
SELECT geoid, state_name, county_name,
       poverty_rate, uninsured_rate, disability_rate,
       limited_english_pct, no_vehicle_pct
FROM block_group_data
WHERE poverty_rate > 20
  AND uninsured_rate > 15
  AND disability_rate > 10
ORDER BY poverty_rate + uninsured_rate + disability_rate DESC;
```

### Health Equity Analysis
```sql
-- Compare health access by race/ethnicity and income
SELECT
  CASE
    WHEN median_household_income < 40000 THEN 'Low'
    WHEN median_household_income < 75000 THEN 'Medium'
    ELSE 'High'
  END as income_group,
  AVG(uninsured_rate) as avg_uninsured_rate,
  AVG(disability_rate) as avg_disability_rate,
  AVG(no_vehicle_pct) as avg_no_vehicle_pct,
  COUNT(*) as block_groups
FROM block_group_data
GROUP BY income_group;
```

### Pediatric Health Planning
```sql
-- Find areas with high child populations and limited resources
SELECT geoid, state_name, county_name,
       under_5 + age_5_17 as total_children,
       poverty_rate, uninsured_rate,
       median_household_income
FROM block_group_data
WHERE (under_5 + age_5_17) > 200
  AND poverty_rate > 15
ORDER BY poverty_rate DESC;
```

## Data Source

- **Dataset**: ACS 5-Year Estimates (2019-2023)
- **Geographic Level**: Census Block Group
- **Total Variables**: 35+ variables across 7 categories
- **Coverage**: ~220,000 block groups nationwide
- **API**: Census Bureau Data API

## Loading Instructions

### Quick Start
```bash
cd backend
npm run load-blockgroups
```

### Test with Small State First
```typescript
// Modify STATES array to test with District of Columbia
const STATES = [
  { fips: '11', name: 'District of Columbia' }
];
```

### Full Load
- Estimated time: 2-4 hours
- Total records: ~220,000 block groups
- Database size: ~50-100 MB
- Rate limit: 200ms delay between states

## Next Steps

1. **Update Query Routes**: Modify `/backend/src/routes/query.routes.ts` to support block group queries
2. **Add Aggregation Logic**: Enable rollup from block groups → tracts → counties → states
3. **Update Frontend**: Add block group-level visualizations
4. **Create Indexes**: Add performance indexes for common query patterns

## Performance Considerations

### Recommended Indexes
```sql
CREATE INDEX idx_state ON block_group_data(state_name);
CREATE INDEX idx_county ON block_group_data(state_name, county_name);
CREATE INDEX idx_age_65_plus ON block_group_data(age_65_plus);
CREATE INDEX idx_poverty ON block_group_data(poverty_rate);
CREATE INDEX idx_uninsured ON block_group_data(uninsured_rate);
```

### Query Optimization
- Always filter by state or county first to reduce scan size
- Use specific column selection rather than `SELECT *`
- Consider materialized views for common aggregations
- Block group queries will be ~70x slower than county queries without proper indexing

## Variable Categories Summary

| Category | Variables | Use Cases |
|----------|-----------|-----------|
| **Demographics** | 7 | Population profiling, market sizing |
| **Age Groups** | 5 | Healthcare targeting, Medicare/Medicaid |
| **Race/Ethnicity** | 4 | Health equity, disparity analysis |
| **Economic** | 5 | SDOH analysis, affordability studies |
| **Education** | 2 | Health literacy, outcomes correlation |
| **Housing** | 4 | Housing insecurity, cost burden |
| **Health** | 2 | Disability services, language access |
| **Transportation** | 2 | Care access, mobility barriers |

**Total: 31 analytical variables + 7 geographic identifiers = 38 fields**

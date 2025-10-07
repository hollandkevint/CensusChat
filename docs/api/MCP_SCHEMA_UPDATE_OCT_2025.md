# MCP Schema Update - October 2025
## Marketing Analytics & Geographic Hierarchy Expansion

**Date**: October 6, 2025
**Schema Version**: 2.0
**Previous Version**: 1.0 (County-only, 29 variables)
**Status**: 📝 Documentation Complete - Implementation Pending

---

## 🎯 Overview

This document describes the database schema updates for Claude's MCP (Model Context Protocol) server to support the expanded marketing analytics and 4-level geographic hierarchy.

### What Changed

**Previous Schema (v1.0)**:
- 1 table: `county_data`
- 3,144 counties
- 29 variables (healthcare SDOH focus)
- Single geographic level

**New Schema (v2.0)**:
- 5 tables: `state_data`, `county_data`, `tract_data`, `block_group_data_expanded`, `geo_hierarchy`
- 327,337 total geographies
- 84 variables (marketing + healthcare)
- 4-level geographic hierarchy

---

## 📊 Database Schema

### Table 1: `state_data` (NEW)

**Purpose**: State-level aggregated demographics
**Records**: 52 (50 states + DC + PR)
**Primary Key**: `geoid` (2-digit state FIPS)

**Schema**:
```sql
CREATE TABLE state_data (
  -- Geographic identifiers
  state_fips VARCHAR,
  geoid VARCHAR PRIMARY KEY,  -- 2-digit (e.g., "06" for California)
  state_name VARCHAR,

  -- Demographics (16 variables)
  population BIGINT,
  median_age DOUBLE,
  male_population INTEGER,
  female_population INTEGER,
  age_under_5 INTEGER,
  age_5_to_17 INTEGER,
  age_18_to_64 INTEGER,
  age_65_plus INTEGER,
  white_alone INTEGER,
  black_alone INTEGER,
  asian_alone INTEGER,
  hispanic_latino INTEGER,

  -- Economics (16 variables)
  median_household_income INTEGER,
  per_capita_income INTEGER,
  poverty_rate DOUBLE,
  public_assistance INTEGER,
  snap_benefits INTEGER,
  unemployment_rate DOUBLE,
  income_less_10k INTEGER,
  income_10_to_25k INTEGER,
  income_25_to_50k INTEGER,
  income_50_to_75k INTEGER,
  income_75_to_100k INTEGER,
  income_100_to_150k INTEGER,
  income_150_to_200k INTEGER,
  income_200k_plus INTEGER,

  -- Education (5 variables)
  some_high_school_pct DOUBLE,
  high_school_grad_pct DOUBLE,
  some_college_pct DOUBLE,
  bachelors_plus_pct DOUBLE,

  -- Housing (10 variables)
  housing_units INTEGER,
  vacant_units INTEGER,
  renter_occupied_pct DOUBLE,
  rent_burden_50pct_plus DOUBLE,
  crowded_housing_pct DOUBLE,
  single_family_homes INTEGER,
  mobile_homes INTEGER,
  median_year_built INTEGER,
  median_home_value INTEGER,

  -- Technology (6 variables)
  with_computer_pct DOUBLE,
  with_broadband_pct DOUBLE,
  with_smartphone_pct DOUBLE,
  with_tablet_pct DOUBLE,
  no_internet_pct DOUBLE,

  -- Transportation (10 variables)
  commute_less_10_min INTEGER,
  commute_10_to_19_min INTEGER,
  commute_20_to_29_min INTEGER,
  commute_30_to_44_min INTEGER,
  commute_45_plus_min INTEGER,
  work_from_home INTEGER,
  public_transit_pct DOUBLE,
  no_vehicle_transit_pct DOUBLE,
  no_vehicle_walk_pct DOUBLE,

  -- Occupation (5 variables)
  management_occupations_pct DOUBLE,
  business_finance_occupations_pct DOUBLE,
  healthcare_occupations_pct DOUBLE,
  service_occupations_pct DOUBLE,
  retail_sales_pct DOUBLE,

  -- Healthcare (8 variables)
  uninsured_rate DOUBLE,
  uninsured_under_19 INTEGER,
  uninsured_19_to_64 INTEGER,
  uninsured_65_plus INTEGER,
  disability_rate DOUBLE,
  ambulatory_difficulty_pct DOUBLE,
  independent_living_difficulty_pct DOUBLE,

  -- Language (3 variables)
  limited_english_pct DOUBLE,
  spanish_limited_english_pct DOUBLE,
  asian_limited_english_pct DOUBLE,

  -- Family Structure (5 variables)
  children_with_2_parents_pct DOUBLE,
  children_single_parent_pct DOUBLE,
  single_person_households_pct DOUBLE,
  seniors_living_alone_pct DOUBLE,
  grandparents_responsible_pct DOUBLE
);
```

**Sample Query**:
```sql
SELECT state_name, population, median_household_income, with_broadband_pct
FROM state_data
WHERE population > 10000000
ORDER BY median_household_income DESC;
```

---

### Table 2: `county_data` (EXISTING - No Changes)

**Purpose**: County-level demographics
**Records**: 3,144 counties
**Primary Key**: `state` + `county` (composite)

**Note**: This table remains unchanged for backward compatibility.

---

### Table 3: `tract_data` (NEW)

**Purpose**: Census tract-level demographics
**Records**: 84,400 tracts
**Primary Key**: `geoid` (11-digit tract FIPS)

**Schema**: Same 84 variables as `state_data`, plus:
```sql
CREATE TABLE tract_data (
  -- Geographic identifiers
  state_fips VARCHAR,
  county_fips VARCHAR,
  tract_fips VARCHAR,
  geoid VARCHAR PRIMARY KEY,  -- 11-digit (e.g., "06075014500")
  state_name VARCHAR,
  county_name VARCHAR,
  tract_name VARCHAR,

  -- ... same 84 variables as state_data ...
);
```

**Sample Query**:
```sql
-- Find high-income tracts in San Francisco County
SELECT geoid, tract_name, median_household_income, income_200k_plus
FROM tract_data
WHERE county_fips = '075' AND state_fips = '06'
  AND median_household_income > 150000
ORDER BY median_household_income DESC;
```

---

### Table 4: `block_group_data_expanded` (NEW)

**Purpose**: Block group-level demographics with expanded variables
**Records**: 239,741 block groups
**Primary Key**: `geoid` (12-digit block group FIPS)

**Schema**: Same 84 variables as `state_data`, plus:
```sql
CREATE TABLE block_group_data_expanded (
  -- Geographic identifiers
  state_fips VARCHAR,
  county_fips VARCHAR,
  tract_fips VARCHAR,
  block_group VARCHAR,
  geoid VARCHAR PRIMARY KEY,  -- 12-digit (e.g., "060750145001")
  state_name VARCHAR,
  county_name VARCHAR,

  -- ... same 84 variables as state_data ...
);
```

**Sample Query**:
```sql
-- Find tech-savvy block groups with high broadband and smartphone adoption
SELECT geoid, county_name, population,
       with_broadband_pct, with_smartphone_pct
FROM block_group_data_expanded
WHERE state_fips = '06'
  AND with_broadband_pct > 90
  AND with_smartphone_pct > 85
LIMIT 100;
```

---

### Table 5: `geo_hierarchy` (NEW)

**Purpose**: Geographic hierarchy metadata for all levels
**Records**: 327,337 (all geographies)
**Primary Key**: `geo_type` + `geoid` (composite)

**Schema**:
```sql
CREATE TABLE geo_hierarchy (
  geo_type VARCHAR NOT NULL,       -- 'state', 'county', 'tract', 'block_group'
  geoid VARCHAR NOT NULL,          -- Full GEOID for this geography
  parent_geoid VARCHAR,            -- GEOID of parent geography (NULL for states)
  geo_name VARCHAR,                -- Human-readable name
  population BIGINT,               -- Total population
  land_area_sqmi DOUBLE,           -- Land area in square miles (optional)
  PRIMARY KEY (geo_type, geoid)
);

CREATE INDEX idx_geo_hierarchy_geoid ON geo_hierarchy(geoid);
CREATE INDEX idx_geo_hierarchy_parent ON geo_hierarchy(parent_geoid);
CREATE INDEX idx_geo_hierarchy_type ON geo_hierarchy(geo_type);
```

**Sample Queries**:

**1. Find parent geography**:
```sql
SELECT parent_geoid, geo_name
FROM geo_hierarchy
WHERE geoid = '06075';
-- Returns: parent_geoid='06', geo_name='San Francisco County'
```

**2. Find all children of a geography**:
```sql
SELECT geoid, geo_name, population
FROM geo_hierarchy
WHERE parent_geoid = '06' AND geo_type = 'county'
ORDER BY population DESC;
-- Returns all California counties
```

**3. Get full hierarchy path (recursive)**:
```sql
WITH RECURSIVE hierarchy AS (
  SELECT geo_type, geoid, parent_geoid, geo_name, 1 as level
  FROM geo_hierarchy
  WHERE geoid = '060750145001'

  UNION ALL

  SELECT h.geo_type, h.geoid, h.parent_geoid, h.geo_name, p.level + 1
  FROM geo_hierarchy h
  INNER JOIN hierarchy p ON h.geoid = p.parent_geoid
)
SELECT * FROM hierarchy ORDER BY level DESC;
-- Returns: State → County → Tract → Block Group
```

---

## 🔧 MCP Tool Updates

### Updated Tool: `get_information_schema`

**Previous Response**:
```json
{
  "tables": ["county_data"],
  "county_data": {
    "columns": ["state", "county", "population", "median_income", ...]
  }
}
```

**New Response**:
```json
{
  "tables": [
    "state_data",
    "county_data",
    "tract_data",
    "block_group_data_expanded",
    "geo_hierarchy"
  ],
  "state_data": {
    "description": "State-level demographics (52 states)",
    "primary_key": "geoid",
    "record_count": 52,
    "variable_count": 84,
    "columns": {
      "geoid": "VARCHAR - 2-digit state FIPS (e.g., '06')",
      "state_name": "VARCHAR - State name",
      "population": "BIGINT - Total population",
      "median_household_income": "INTEGER - Median household income",
      "with_broadband_pct": "DOUBLE - % with broadband",
      // ... 79 more columns
    }
  },
  "tract_data": {
    "description": "Census tract demographics (84,400 tracts)",
    "primary_key": "geoid",
    "record_count": 84400,
    "variable_count": 84,
    // ... same 84 columns
  },
  "block_group_data_expanded": {
    "description": "Block group demographics (239,741 block groups)",
    "primary_key": "geoid",
    "record_count": 239741,
    "variable_count": 84,
    // ... same 84 columns
  },
  "geo_hierarchy": {
    "description": "Geographic hierarchy metadata (327,337 geographies)",
    "primary_key": ["geo_type", "geoid"],
    "record_count": 327337,
    "columns": {
      "geo_type": "VARCHAR - 'state', 'county', 'tract', 'block_group'",
      "geoid": "VARCHAR - Full GEOID",
      "parent_geoid": "VARCHAR - Parent GEOID (NULL for states)",
      "geo_name": "VARCHAR - Human-readable name",
      "population": "BIGINT - Total population"
    }
  }
}
```

---

### New Tool: `get_geography_level_recommendation`

**Purpose**: Suggests optimal geography level for a query based on intent

**Input Schema**:
```typescript
{
  name: "get_geography_level_recommendation",
  description: "Recommends the best geographic level (state/county/tract/block_group) for a natural language query",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language query from user"
      },
      estimatedPopulation: {
        type: "number",
        description: "Optional: Estimated population size mentioned in query"
      }
    },
    required: ["query"]
  }
}
```

**Example Request**:
```json
{
  "query": "Find affluent neighborhoods in Los Angeles",
  "estimatedPopulation": null
}
```

**Example Response**:
```json
{
  "recommended_level": "block_group",
  "recommended_table": "block_group_data_expanded",
  "reasoning": "Query asks for 'neighborhoods' which suggests granular block group level. Los Angeles is a large county, so block group provides necessary detail.",
  "estimated_rows": 5000,
  "alternative_levels": [
    {
      "level": "tract",
      "table": "tract_data",
      "reasoning": "Could use tracts for broader neighborhood analysis",
      "estimated_rows": 2000
    }
  ]
}
```

---

### New Tool: `get_variable_categories`

**Purpose**: Returns all 10 variable categories with variable counts and descriptions

**Input Schema**:
```typescript
{
  name: "get_variable_categories",
  description: "Lists all variable categories with counts and example variables",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Optional: Filter to specific category (demographics, economics, technology, etc.)",
        enum: ["demographics", "economics", "education", "housing", "technology",
               "transportation", "occupation", "healthcare", "language", "family"]
      }
    }
  }
}
```

**Example Response** (all categories):
```json
{
  "categories": [
    {
      "name": "demographics",
      "variable_count": 16,
      "description": "Population, age, race, ethnicity",
      "example_variables": [
        "population", "median_age", "age_65_plus", "hispanic_latino"
      ],
      "use_cases": ["Market sizing", "Audience targeting", "Demographic segmentation"]
    },
    {
      "name": "economics",
      "variable_count": 16,
      "description": "Income distribution, poverty, assistance programs",
      "example_variables": [
        "median_household_income", "income_200k_plus", "poverty_rate", "snap_benefits"
      ],
      "use_cases": ["Pricing strategy", "Affordability analysis", "Premium targeting"]
    },
    {
      "name": "technology",
      "variable_count": 6,
      "description": "Digital access, device ownership, internet connectivity",
      "example_variables": [
        "with_broadband_pct", "with_smartphone_pct", "no_internet_pct"
      ],
      "use_cases": ["E-commerce readiness", "Digital marketing", "Tech product targeting"]
    },
    // ... 7 more categories
  ],
  "total_variables": 84
}
```

---

### New Tool: `get_hierarchy_path`

**Purpose**: Gets full geographic hierarchy for any location

**Input Schema**:
```typescript
{
  name: "get_hierarchy_path",
  description: "Returns the full geographic hierarchy (state → county → tract → block group) for a given GEOID",
  inputSchema: {
    type: "object",
    properties: {
      geoid: {
        type: "string",
        description: "GEOID at any level (2-digit state, 5-digit county, 11-digit tract, 12-digit block group)"
      },
      include_siblings: {
        type: "boolean",
        description: "Include sibling geographies at each level (default: false)"
      }
    },
    required: ["geoid"]
  }
}
```

**Example Request**:
```json
{
  "geoid": "060750145001",
  "include_siblings": false
}
```

**Example Response**:
```json
{
  "full_path": [
    {
      "level": "state",
      "geoid": "06",
      "name": "California",
      "population": 39242785
    },
    {
      "level": "county",
      "geoid": "06075",
      "name": "San Francisco County",
      "population": 851036
    },
    {
      "level": "tract",
      "geoid": "06075014500",
      "name": "Tract 145; San Francisco County; California",
      "population": 4521
    },
    {
      "level": "block_group",
      "geoid": "060750145001",
      "name": "Block Group 1",
      "population": 1205
    }
  ],
  "total_levels": 4
}
```

---

## 🔒 Security Policy Updates

### Updated: `sqlSecurityPolicies.ts`

**Add to Table Allowlist**:
```typescript
const ALLOWED_TABLES = [
  'county_data',              // existing
  'state_data',               // NEW
  'tract_data',               // NEW
  'block_group_data_expanded', // NEW
  'geo_hierarchy'             // NEW
];
```

**Add to Column Validation**:
```typescript
const ALLOWED_COLUMNS = {
  state_data: ['*'],  // Allow all 84 + geographic columns
  tract_data: ['*'],
  block_group_data_expanded: ['*'],
  geo_hierarchy: [
    'geo_type', 'geoid', 'parent_geoid', 'geo_name', 'population', 'land_area_sqmi'
  ],
  county_data: ['*']  // existing
};
```

**Row Limit**: Keep at 1,000 max per query (prevents performance issues with 240K block groups)

---

## 📝 Claude System Prompt Updates

### Update: `anthropicService.ts` Schema Description

**Add to System Prompt**:

```markdown
## Database Schema

You have access to 5 tables with comprehensive U.S. Census demographic data:

### Geographic Hierarchy (4 Levels)

1. **state_data** (52 states)
   - GEOID format: 2-digit (e.g., "06" = California)
   - Use for: State comparisons, national trends

2. **county_data** (3,144 counties)
   - GEOID format: 5-digit (e.g., "06075" = San Francisco County)
   - Use for: Regional analysis, market studies

3. **tract_data** (84,400 census tracts)
   - GEOID format: 11-digit (e.g., "06075014500")
   - Avg population: 4,500
   - Use for: Neighborhood analysis, local targeting

4. **block_group_data_expanded** (239,741 block groups)
   - GEOID format: 12-digit (e.g., "060750145001")
   - Avg population: 1,400
   - Use for: Micro-targeting, hyperlocal analysis

5. **geo_hierarchy** (327,337 geographies)
   - Links all levels with parent-child relationships
   - Use for: Hierarchical queries, geographic navigation

### 84 Variables Across 10 Categories

**Demographics (16 variables)**:
- population, median_age, male_population, female_population
- age_under_5, age_5_to_17, age_18_to_64, age_65_plus
- white_alone, black_alone, asian_alone, hispanic_latino

**Economics (16 variables)**:
- median_household_income, per_capita_income, poverty_rate
- income_less_10k through income_200k_plus (8 income brackets)
- unemployment_rate, public_assistance, snap_benefits

**Education (5 variables)**:
- some_high_school_pct, high_school_grad_pct
- some_college_pct, bachelors_plus_pct

**Housing (10 variables)**:
- housing_units, vacant_units, renter_occupied_pct
- rent_burden_50pct_plus, crowded_housing_pct
- single_family_homes, mobile_homes, median_year_built, median_home_value

**Technology & Digital Access (6 variables)**:
- with_computer_pct, with_broadband_pct, with_smartphone_pct
- with_tablet_pct, no_internet_pct

**Transportation & Commuting (10 variables)**:
- commute_less_10_min, commute_10_to_19_min, etc. (5 time brackets)
- work_from_home, public_transit_pct
- no_vehicle_transit_pct, no_vehicle_walk_pct

**Occupation & Industry (5 variables)**:
- management_occupations_pct, business_finance_occupations_pct
- healthcare_occupations_pct, service_occupations_pct, retail_sales_pct

**Healthcare & Insurance (8 variables)**:
- uninsured_rate, uninsured_under_19, uninsured_19_to_64, uninsured_65_plus
- disability_rate, ambulatory_difficulty_pct, independent_living_difficulty_pct

**Language & Cultural Access (3 variables)**:
- limited_english_pct, spanish_limited_english_pct, asian_limited_english_pct

**Family Structure & Social (5 variables)**:
- children_with_2_parents_pct, children_single_parent_pct
- single_person_households_pct, seniors_living_alone_pct
- grandparents_responsible_pct

### Query Guidelines

**Geographic Level Selection**:
- State comparisons → `state_data`
- Market/county analysis → `county_data`
- Neighborhood targeting → `tract_data`
- Micro-targeting → `block_group_data_expanded`

**Performance Optimization**:
- ALWAYS filter by geography first (state_fips, county_fips)
- Use appropriate level (don't aggregate from block groups unnecessarily)
- Apply LIMIT for large result sets

**Hierarchical Queries**:
- Use `geo_hierarchy` for parent-child lookups
- Substring GEOIDs for filtering:
  - State: SUBSTRING(geoid, 1, 2)
  - County: SUBSTRING(geoid, 1, 5)
  - Tract: SUBSTRING(geoid, 1, 11)

### Example Queries

1. **State Comparison**:
   ```sql
   SELECT state_name, median_household_income, with_broadband_pct
   FROM state_data
   WHERE population > 5000000
   ORDER BY median_household_income DESC;
   ```

2. **Affluent Neighborhoods**:
   ```sql
   SELECT geoid, county_name, income_200k_plus, median_household_income
   FROM block_group_data_expanded
   WHERE state_fips = '06' AND income_200k_plus > 100
   ORDER BY income_200k_plus DESC LIMIT 50;
   ```

3. **Tech-Ready Markets**:
   ```sql
   SELECT county_name, AVG(with_broadband_pct) as avg_broadband
   FROM tract_data
   WHERE state_fips = '06'
   GROUP BY county_name
   HAVING AVG(with_broadband_pct) > 85;
   ```

4. **Hierarchy Navigation**:
   ```sql
   SELECT geoid, geo_name, population
   FROM geo_hierarchy
   WHERE parent_geoid = '06' AND geo_type = 'county'
   ORDER BY population DESC;
   ```
```

---

## 🧪 Testing Scenarios

### Natural Language Query Examples

**Geography Level Routing**:

1. **State Level**:
   - "Compare California and Texas by median income" → `state_data`
   - "Which states have the highest broadband adoption?" → `state_data`

2. **County Level**:
   - "Show me demographics for San Francisco County" → `county_data`
   - "Find counties in California with poverty rate > 15%" → `county_data` (or join state)

3. **Tract Level**:
   - "What are the demographics of neighborhoods in downtown LA?" → `tract_data`
   - "Find tracts with high tech worker concentration" → `tract_data`

4. **Block Group Level**:
   - "Target affluent neighborhoods in Silicon Valley" → `block_group_data_expanded`
   - "Find micro-areas with high senior populations" → `block_group_data_expanded`

**Variable Category Coverage**:

1. **Marketing Analytics**:
   - "Where are high-income consumers located?" → Uses `income_200k_plus`
   - "Find areas with long commutes" → Uses `commute_45_plus_min`
   - "Which neighborhoods have high broadband access?" → Uses `with_broadband_pct`

2. **Healthcare Marketing**:
   - "Find uninsured working-age adults" → Uses `uninsured_19_to_64`
   - "Where are Spanish-speaking communities with limited English?" → Uses `spanish_limited_english_pct`
   - "Target isolated seniors for care services" → Uses `seniors_living_alone_pct`

**Cross-Geography Queries**:

1. **Hierarchical Rollup**:
   - "Show me California counties ranked by broadband access" → Aggregate from `tract_data` or use `county_data`

2. **Drill-Down**:
   - "Find block groups within San Francisco County with >$150k income" → Filter `block_group_data_expanded` by county

---

## 🚀 Implementation Checklist

### Phase 1: Schema Updates ✅ **COMPLETE**
- [x] Load state_data (52 states)
- [x] Load tract_data (84,400 tracts)
- [x] Load block_group_data_expanded (239,741 block groups)
- [x] Create geo_hierarchy (327,337 geographies)

### Phase 2: MCP Server Updates (NEXT)
- [ ] Update `get_information_schema` tool response
- [ ] Implement `get_geography_level_recommendation` tool
- [ ] Implement `get_variable_categories` tool
- [ ] Implement `get_hierarchy_path` tool
- [ ] Update `anthropicService.ts` system prompt
- [ ] Update `sqlSecurityPolicies.ts` table allowlist

### Phase 3: Testing & Validation
- [ ] Test all MCP tools with new schema
- [ ] Run natural language query eval suite
- [ ] Verify geography level routing accuracy
- [ ] Validate SQL generation for all tables
- [ ] Performance test with block group queries

### Phase 4: Documentation & Training
- [ ] Update API documentation
- [ ] Create user guide for new variables
- [ ] Document performance best practices
- [ ] Create video tutorials (optional)

---

## 📊 Performance Considerations

### Query Performance Guidelines

| Table | Records | Unfiltered Query | With State Filter | With County Filter |
|-------|---------|------------------|-------------------|-------------------|
| state_data | 52 | <1ms | N/A | N/A |
| county_data | 3,144 | ~10ms | ~5ms | N/A |
| tract_data | 84,400 | ~100ms | ~20ms | ~5ms |
| block_group_data_expanded | 239,741 | ~500ms | ~50ms | ~10ms |

**Optimization Strategies**:

1. **Always Filter by Geography**:
   ```sql
   -- GOOD
   SELECT * FROM block_group_data_expanded
   WHERE state_fips = '06' AND median_household_income > 100000;

   -- BAD (scans 240K rows)
   SELECT * FROM block_group_data_expanded
   WHERE median_household_income > 100000;
   ```

2. **Use Appropriate Level**:
   ```sql
   -- GOOD: State comparison
   SELECT state_name, AVG(poverty_rate) FROM state_data;

   -- BAD: Unnecessary aggregation
   SELECT state_name, AVG(poverty_rate)
   FROM block_group_data_expanded GROUP BY state_name;
   ```

3. **Create Indexes** (recommended):
   ```sql
   CREATE INDEX idx_blockgroup_state ON block_group_data_expanded(state_fips);
   CREATE INDEX idx_blockgroup_income ON block_group_data_expanded(median_household_income);
   CREATE INDEX idx_tract_poverty ON tract_data(poverty_rate);
   ```

---

## 🔗 Related Documentation

- **Main Expansion Guide**: `/docs/MARKETING_ANALYTICS_EXPANSION.md`
- **Quick Start**: `/docs/QUICK_START_EXPANDED.md`
- **Epic 3 Documentation**: `/docs/epics/epic-3-marketing-analytics-expansion.md`
- **Session Summary**: `/docs/sessions/SESSION_OCT_6_2025_EXPANSION.md`
- **MCP API Docs**: `/docs/api/MCP_API_DOCUMENTATION.md`

---

**Document Status**: ✅ Complete - Ready for Implementation
**Next Step**: Update `anthropicService.ts` and `mcpServer.ts` with new schema
**Estimated Implementation Time**: 2-3 hours

---

*Last Updated: October 6, 2025*
*Schema Version: 2.0*
*Author: Kevin Kellogg*

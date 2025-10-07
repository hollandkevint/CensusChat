# Marketing Analytics & Geographic Hierarchy Expansion

## 🎯 Overview

CensusChat has been expanded with **84 comprehensive variables** and **4-level geographic hierarchy** to support both **marketing analytics** and **healthcare marketing analytics**.

### What's New

✅ **84 Total Variables** (up from 29)
- **43 new marketing variables**: Consumer behavior, technology adoption, commuting, occupation, income distribution
- **12 new healthcare marketing variables**: Insurance gaps, disability types, family structure, language barriers
- **29 original healthcare SDOH variables**: Retained for compatibility

✅ **4-Level Geographic Hierarchy**
- **State** (51): Highest-level aggregates, fastest queries
- **County** (3,144): Current production level, maintained
- **Tract** (73,000): NEW - Medium granularity, good balance
- **Block Group** (240,000): NEW - Highest granularity, neighborhood-level

✅ **Intelligent Geographic Routing**
- Automatically selects optimal geography level based on query
- Supports hierarchical rollups and drill-downs
- Cross-geography joins and aggregations

---

## 📊 Variable Categories (84 Total)

### 1. Demographics (16 variables)
**Core Population**
- Total population, median age
- Male/female population
- Age groups: <5, 5-17, 18-64, 65+

**Race & Ethnicity**
- White alone, Black alone, Asian alone
- Hispanic/Latino (any race)

**Use Cases**: Market sizing, audience targeting, demographic segmentation

### 2. Economics & Income (16 variables)
**Income Distribution** (NEW - Marketing Analytics)
- Income <$10k, $10-25k, $25-50k, $50-75k
- Income $75-100k, $100-150k, $150-200k, $200k+

**Economic Indicators**
- Median household income, per capita income
- Public assistance, SNAP benefits
- Poverty rate, unemployment rate

**Use Cases**: Pricing strategy, affordability analysis, premium targeting, financial product marketing

### 3. Education (5 variables)
**Educational Attainment**
- Some high school, HS graduate
- Some college, Bachelor's+

**Use Cases**: Health literacy correlation, product complexity targeting, professional services marketing

### 4. Housing (10 variables)
**Housing Stock** (NEW - Marketing Analytics)
- Total units, vacant units
- Single-family homes, mobile homes
- Median year built, median home value

**Housing Burden**
- Renter-occupied %, rent burden (50%+ income)
- Crowded housing indicators

**Use Cases**: Real estate marketing, home services targeting, housing security analysis

### 5. Technology & Digital Access (6 variables - NEW)
**Device Ownership**
- Households with computer
- Desktop/laptop, smartphone, tablet presence

**Internet Access**
- Broadband subscription
- No internet access %

**Use Cases**: Digital marketing strategy, e-commerce readiness, tech product targeting

### 6. Transportation & Commuting (10 variables - NEW)
**Commute Time Distribution**
- <10 min, 10-19 min, 20-29 min
- 30-44 min, 45+ min
- Work from home

**Transportation Mode**
- Public transit %, no vehicle + transit
- No vehicle + walk

**Use Cases**: Retail site selection, convenience service targeting, mobility product marketing

### 7. Occupation & Industry (5 variables - NEW)
**Occupation Categories**
- Management occupations %
- Healthcare occupations %
- Retail sales %
- Business/finance occupations
- Service occupations

**Use Cases**: B2B targeting, professional services, industry-specific marketing

### 8. Healthcare & Insurance (8 variables)
**Insurance Coverage** (NEW - Healthcare Marketing)
- Uninsured rate, uninsured by age group
- Uninsured <19, 19-64, 65+

**Disability & Health**
- Disability rate, ambulatory difficulty
- Independent living difficulty

**Use Cases**: Health insurance marketing, medical device targeting, care services

### 9. Language & Cultural Access (3 variables - NEW)
**Language Barriers**
- Limited English proficiency %
- Spanish speakers with limited English
- Asian language speakers with limited English

**Use Cases**: Multilingual marketing, cultural targeting, translation services

### 10. Family Structure & Social (5 variables - NEW)
**Family Composition**
- Children with 2 parents %
- Children with single parent %
- Single-person households %

**Social Isolation**
- Seniors living alone %
- Grandparents raising grandchildren %

**Use Cases**: Family product marketing, senior services, caregiver targeting

---

## 🗺️ Geographic Hierarchy

### Hierarchy Structure
```
Nation (USA)
  └── State (51 entities)
      └── County (3,144 counties)
          └── Census Tract (73,000 tracts)
              └── Block Group (240,000 block groups)
```

### Geographic Level Characteristics

| Level | Count | Avg Population | GEOID Format | Best For |
|-------|-------|----------------|--------------|----------|
| **State** | 51 | 6.5M | 2-digit (e.g., "06") | State comparisons, high-level trends |
| **County** | 3,144 | 105K | 5-digit (e.g., "06075") | Market analysis, regional targeting |
| **Tract** | 73,000 | 4.5K | 11-digit (e.g., "06075014500") | Neighborhood analysis, local targeting |
| **Block Group** | 240,000 | 1.4K | 12-digit (e.g., "060750145001") | Micro-targeting, hyperlocal analysis |

### When to Use Each Level

**State Level** - Use when:
- Comparing states or regions
- National trends analysis
- High-level market sizing
- Performance: ⚡⚡⚡⚡⚡ (51 rows)

**County Level** - Use when:
- Metropolitan area analysis
- Market penetration studies
- Regional competitive analysis
- Performance: ⚡⚡⚡⚡ (3K rows)

**Tract Level** - Use when:
- Neighborhood targeting
- Local market analysis
- Community-level insights
- Performance: ⚡⚡⚡ (73K rows)

**Block Group Level** - Use when:
- Micro-targeting campaigns
- Hyperlocal analysis
- Precise geographic targeting
- Performance: ⚡⚡ (240K rows)

---

## 🚀 Loading the Data

### Quick Start - Load Everything
```bash
cd backend
npm run load-all-geography
```

This runs all loaders in sequence (~6-12 hours total):
1. State data (51 states) - ~5 minutes
2. Tract data (73K tracts) - ~2-3 hours
3. Block group data (240K) - ~3-5 hours
4. Geographic hierarchy - ~1 minute

### Load Individual Levels

**State Level** (Fastest)
```bash
npm run load-states
```
- Time: ~5 minutes
- Records: 51 states
- Variables: 84 per state

**Tract Level**
```bash
npm run load-tracts
```
- Time: ~2-3 hours
- Records: ~73,000 tracts
- Variables: 84 per tract

**Block Group Level** (Most Comprehensive)
```bash
npm run load-blockgroups-expanded
```
- Time: ~3-5 hours
- Records: ~240,000 block groups
- Variables: 84 per block group

**Create Hierarchy**
```bash
npm run create-geo-hierarchy
```
- Time: ~1 minute
- Creates parent-child relationships
- Enables hierarchical queries

### Test with Small State First
Before full load, test with DC:
```typescript
// In any loader script, modify STATES array:
const STATES = [
  { fips: '11', name: 'District of Columbia' }  // ~571 block groups
];
```

---

## 🔍 Intelligent Geographic Routing

### How It Works

The `geoRoutingService` automatically selects the optimal geographic level based on:

**1. Explicit Geographic Mentions**
```
"Show me data for Los Angeles County" → County level
"What are the census tracts in Texas?" → Tract level
"Compare California to New York" → State level
```

**2. Population Estimates**
```
"Areas with 5 million people" → State level
"Communities of 50,000" → Tract level
"Neighborhoods under 5,000" → Block group level
```

**3. Granularity Keywords**
```
"Detailed neighborhood analysis" → Block group level
"High-level state trends" → State level
"Specific local targeting" → Tract or block group level
```

### Usage Example
```typescript
import { routeQueryWithFallback } from './services/geoRoutingService';

const query = "Show me high-income neighborhoods in San Francisco County";
const decision = routeQueryWithFallback(query);

console.log(decision);
// {
//   level: 'block_group',
//   table: 'block_group_data_expanded',
//   reasoning: 'Specific county + neighborhood granularity requested',
//   estimatedRows: 100
// }
```

### Hierarchical Queries

**Get all children of a geography:**
```sql
-- All tracts in California
SELECT * FROM tract_data
WHERE SUBSTRING(geoid, 1, 2) = '06';

-- All block groups in a county
SELECT * FROM block_group_data_expanded
WHERE SUBSTRING(geoid, 1, 5) = '06075';
```

**Roll up from granular to aggregate:**
```sql
-- Aggregate block groups to county level
SELECT
  SUBSTRING(geoid, 1, 5) as county_geoid,
  SUM(population) as total_population,
  ROUND(AVG(median_household_income), 0) as avg_income
FROM block_group_data_expanded
WHERE state_fips = '06'
GROUP BY SUBSTRING(geoid, 1, 5);
```

---

## 💼 Marketing Use Cases

### 1. Consumer Segmentation by Income
```sql
-- Find affluent neighborhoods (HHI >$150k)
SELECT geoid, county_name,
       income_150_to_200k + income_200k_plus as affluent_households,
       (income_150_to_200k + income_200k_plus)::FLOAT / population * 100 as affluent_pct
FROM block_group_data_expanded
WHERE (income_150_to_200k + income_200k_plus) > 100
ORDER BY affluent_pct DESC
LIMIT 100;
```

### 2. Technology Adoption Analysis
```sql
-- Tech-ready markets (high broadband + smartphone)
SELECT county_name, state_name,
       AVG(with_broadband_pct) as avg_broadband,
       AVG(with_computer_pct) as avg_computer,
       COUNT(*) as tract_count
FROM tract_data
GROUP BY county_name, state_name
HAVING AVG(with_broadband_pct) > 85
ORDER BY avg_broadband DESC;
```

### 3. Commuter Targeting
```sql
-- Long commuters for audio/podcast advertising
SELECT county_name,
       SUM(commute_45_plus_min) as long_commuters,
       SUM(work_from_home) as wfh_workers
FROM tract_data
WHERE state_fips = '06'  -- California
GROUP BY county_name
ORDER BY long_commuters DESC;
```

### 4. Occupation-Based B2B Targeting
```sql
-- Areas with high concentration of healthcare workers
SELECT geoid, county_name,
       healthcare_occupations_pct,
       population,
       ROUND(population * healthcare_occupations_pct / 100) as healthcare_workers
FROM block_group_data_expanded
WHERE healthcare_occupations_pct > 20
ORDER BY healthcare_workers DESC;
```

---

## 🏥 Healthcare Marketing Use Cases

### 1. Insurance Gap Analysis
```sql
-- Uninsured working-age adults by county
SELECT county_name, state_name,
       SUM(uninsured_19_to_64) as uninsured_working_age,
       AVG(uninsured_rate) as avg_uninsured_pct
FROM tract_data
GROUP BY county_name, state_name
ORDER BY uninsured_working_age DESC
LIMIT 50;
```

### 2. Senior Living Targeting
```sql
-- Isolated seniors needing care services
SELECT geoid, county_name,
       seniors_living_alone_pct,
       age_65_plus as senior_population,
       ambulatory_difficulty_pct
FROM block_group_data_expanded
WHERE age_65_plus > 200
  AND seniors_living_alone_pct > 30
ORDER BY age_65_plus DESC;
```

### 3. Multilingual Health Outreach
```sql
-- Spanish-speaking communities with limited English
SELECT county_name, state_name,
       AVG(spanish_limited_english_pct) as avg_spanish_limited,
       SUM(population) as total_population
FROM tract_data
GROUP BY county_name, state_name
HAVING AVG(spanish_limited_english_pct) > 15
ORDER BY avg_spanish_limited DESC;
```

### 4. Family-Focused Services
```sql
-- Areas with high single-parent families
SELECT geoid, county_name,
       children_single_parent_pct,
       (population * children_single_parent_pct / 100) as est_single_parent_children,
       poverty_rate
FROM block_group_data_expanded
WHERE children_single_parent_pct > 40
  AND poverty_rate > 20
ORDER BY est_single_parent_children DESC;
```

---

## 📈 Performance Considerations

### Query Optimization

**1. Always Filter by Geography First**
```sql
-- Good: Filter by state first
SELECT * FROM block_group_data_expanded
WHERE state_fips = '06' AND median_household_income > 100000;

-- Bad: No geographic filter
SELECT * FROM block_group_data_expanded
WHERE median_household_income > 100000;  -- Scans all 240K rows
```

**2. Use Appropriate Geographic Level**
```sql
-- State comparison: Use state_data (51 rows)
SELECT state_name, AVG(poverty_rate) FROM state_data;

-- Not: Aggregate from block groups (240K rows)
SELECT state_name, AVG(poverty_rate) FROM block_group_data_expanded GROUP BY state_name;
```

**3. Create Indexes for Common Queries**
```sql
-- Add indexes on frequently filtered columns
CREATE INDEX idx_blockgroup_state ON block_group_data_expanded(state_fips);
CREATE INDEX idx_blockgroup_income ON block_group_data_expanded(median_household_income);
CREATE INDEX idx_tract_poverty ON tract_data(poverty_rate);
```

### Expected Query Performance

| Geography Level | Records | Unfiltered Query | With State Filter | With County Filter |
|----------------|---------|------------------|-------------------|-------------------|
| State | 51 | <1ms | N/A | N/A |
| County | 3,144 | ~10ms | ~5ms | N/A |
| Tract | 73,000 | ~100ms | ~20ms | ~5ms |
| Block Group | 240,000 | ~500ms | ~50ms | ~10ms |

---

## 🔄 Migration from Old Schema

### Backward Compatibility

The original 29-variable `block_group_data` table is **preserved**. New data is in separate tables:
- `state_data` (NEW)
- `county_data` (EXISTS)
- `tract_data` (NEW)
- `block_group_data_expanded` (NEW)

### Updating Existing Queries

**Old Query:**
```sql
SELECT * FROM block_group_data WHERE state_fips = '06';
```

**New Query (same data):**
```sql
SELECT * FROM block_group_data_expanded WHERE state_fips = '06';
```

**New Query (with marketing variables):**
```sql
SELECT geoid, population, income_200k_plus,
       with_broadband_pct, healthcare_occupations_pct
FROM block_group_data_expanded
WHERE state_fips = '06';
```

---

## 📚 Variable Reference

### Complete Variable List

See `/docs/guides/VARIABLE_REFERENCE.md` for:
- All 84 variable definitions
- ACS table codes
- Calculation formulas
- Data types and ranges
- NULL handling strategies

### API Integration

The `acsVariablesExpanded.ts` module provides:
```typescript
import {
  ACS_VARIABLES_EXPANDED,
  getVariableCodesBatched,
  getVariablesByCategory
} from './utils/acsVariablesExpanded';

// Get all variables by category
const techVars = getVariablesByCategory('technology');
// Returns: 6 technology variables

// Get batched for Census API (43 vars × 2 batches)
const [batch1, batch2] = getVariableCodesBatched();
```

---

## 🎯 Next Steps

### Immediate Actions
1. ✅ Load all geographic levels: `npm run load-all-geography`
2. ✅ Update SQL security policies with new tables/columns
3. ✅ Update Claude prompt with new variables and geography levels
4. ✅ Test queries across all geographic levels

### Enhancement Opportunities
1. **Materialized Views**: Pre-aggregate common rollups
2. **Spatial Joins**: Add lat/long for geographic joins
3. **Time Series**: Load multiple ACS years for trend analysis
4. **Custom Segments**: Create marketing personas from variable clusters

---

## 📖 Additional Documentation

- **Variable Expansion Plan**: `/docs/VARIABLE_EXPANSION_PLAN.md`
- **Geographic Hierarchy Guide**: `/docs/GEOGRAPHIC_HIERARCHY.md` (this file)
- **Block Group Quickstart**: `/docs/block-group/BLOCK_GROUP_QUICKSTART.md`
- **API Reference**: `/docs/api/GEO_ROUTING_API.md`

---

**Last Updated**: October 2025
**Total Variables**: 84 (verified with ACS 2023 API)
**Geographic Levels**: 4
**Total Records**: ~316,195 (51 + 3,144 + 73,000 + 240,000)

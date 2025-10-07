# Quick Start: Marketing Analytics & Geographic Hierarchy

## 🚀 Load All Data (Recommended)

### One Command - Full Setup
```bash
cd backend
npm run load-all-geography
```

This loads:
1. ✅ **51 states** with 84 variables (~5 min)
2. ✅ **73,000 census tracts** with 84 variables (~2-3 hours)
3. ✅ **240,000 block groups** with 84 variables (~3-5 hours)
4. ✅ **Geographic hierarchy** metadata (~1 min)

**Total Time: 6-12 hours** | **Total Records: 316,195** | **Database Size: ~500MB**

---

## ⚡ Load Individual Levels (Faster)

### Option 1: State Level Only (Fastest)
```bash
npm run load-states
```
- **Time**: 5 minutes
- **Records**: 51 states
- **Use Case**: State comparisons, national trends
- **Best For**: Quick testing, high-level analysis

### Option 2: State + County (Current Production)
```bash
npm run load-states
# County data already loaded
```
- **Time**: 5 minutes
- **Records**: 51 + 3,144 = 3,195
- **Use Case**: Market analysis, regional targeting
- **Best For**: Production-ready, balanced performance

### Option 3: Add Tract Level (Medium Granularity)
```bash
npm run load-states
npm run load-tracts
```
- **Time**: 2-3 hours
- **Records**: 51 + 3,144 + 73,000 = 76,195
- **Use Case**: Neighborhood analysis, local targeting
- **Best For**: Marketing campaigns, local insights

### Option 4: Full Hierarchy (Maximum Detail)
```bash
npm run load-all-geography
```
- **Time**: 6-12 hours
- **Records**: 316,195
- **Use Case**: Micro-targeting, hyperlocal analysis
- **Best For**: Advanced marketing, precision targeting

---

## 🧪 Test First (Recommended)

### Test with Small State (District of Columbia)
Before full load, test with DC to verify setup:

**1. Modify any loader script** (e.g., `load-acs-state.ts`, `load-acs-tract.ts`):
```typescript
const STATES = [
  { fips: '11', name: 'District of Columbia' }  // Only DC
];
```

**2. Run test load:**
```bash
npm run load-states  # ~30 seconds
# or
npm run load-tracts  # ~2 minutes (146 tracts)
# or
npm run load-blockgroups-expanded  # ~3 minutes (571 block groups)
```

**3. Verify data:**
```bash
npm run duckdb
```
```sql
-- Check state data
SELECT * FROM state_data WHERE state_fips = '11';

-- Check tract data
SELECT COUNT(*) FROM tract_data WHERE state_fips = '11';  -- Should be ~146

-- Check block group data
SELECT COUNT(*) FROM block_group_data_expanded WHERE state_fips = '11';  -- Should be ~571
```

**4. Test queries:**
```sql
-- High income neighborhoods in DC
SELECT geoid, county_name, income_200k_plus
FROM block_group_data_expanded
WHERE state_fips = '11' AND income_200k_plus > 50
ORDER BY income_200k_plus DESC
LIMIT 10;
```

---

## 📊 What You Get

### 84 Variables Across 10 Categories

| Category | Variables | Examples |
|----------|-----------|----------|
| **Demographics** | 16 | Population, age groups, race/ethnicity |
| **Economics** | 16 | Income distribution, poverty, employment |
| **Education** | 5 | Educational attainment levels |
| **Housing** | 10 | Housing types, values, burden |
| **Technology** | 6 | Broadband, devices, digital access |
| **Transportation** | 10 | Commute times, modes, WFH |
| **Occupation** | 5 | Job categories, industries |
| **Healthcare** | 8 | Insurance, disability, health access |
| **Language** | 3 | Limited English, language barriers |
| **Family** | 5 | Family structure, social isolation |

### 4 Geographic Levels

| Level | Records | Granularity | GEOID Format | Query Speed |
|-------|---------|-------------|--------------|-------------|
| **State** | 51 | Highest-level | 2-digit | ⚡⚡⚡⚡⚡ |
| **County** | 3,144 | Regional | 5-digit | ⚡⚡⚡⚡ |
| **Tract** | 73,000 | Neighborhood | 11-digit | ⚡⚡⚡ |
| **Block Group** | 240,000 | Hyperlocal | 12-digit | ⚡⚡ |

---

## 🔍 Example Queries

### Marketing Analytics

**1. Find Tech-Ready Markets**
```sql
SELECT county_name, state_name,
       AVG(with_broadband_pct) as broadband_pct,
       COUNT(*) as tract_count
FROM tract_data
WHERE with_broadband_pct > 85
GROUP BY county_name, state_name
ORDER BY broadband_pct DESC
LIMIT 20;
```

**2. Affluent Neighborhoods**
```sql
SELECT geoid, county_name,
       income_200k_plus as affluent_households,
       (income_200k_plus::FLOAT / population * 100) as affluent_pct
FROM block_group_data_expanded
WHERE income_200k_plus > 100
ORDER BY affluent_pct DESC
LIMIT 50;
```

**3. Long Commuters (Audio Ad Targeting)**
```sql
SELECT county_name,
       SUM(commute_45_plus_min) as long_commuters
FROM tract_data
WHERE state_fips = '06'  -- California
GROUP BY county_name
ORDER BY long_commuters DESC;
```

### Healthcare Marketing

**4. Uninsured Working-Age Adults**
```sql
SELECT county_name, state_name,
       SUM(uninsured_19_to_64) as uninsured_working_age,
       AVG(uninsured_rate) as avg_rate
FROM tract_data
GROUP BY county_name, state_name
ORDER BY uninsured_working_age DESC
LIMIT 25;
```

**5. Isolated Seniors (Care Services)**
```sql
SELECT geoid, county_name,
       age_65_plus as seniors,
       seniors_living_alone_pct,
       ambulatory_difficulty_pct
FROM block_group_data_expanded
WHERE age_65_plus > 200
  AND seniors_living_alone_pct > 30
ORDER BY age_65_plus DESC;
```

**6. Spanish-Speaking Communities**
```sql
SELECT county_name, state_name,
       AVG(spanish_limited_english_pct) as spanish_pct,
       SUM(population) as total_pop
FROM tract_data
WHERE spanish_limited_english_pct > 15
GROUP BY county_name, state_name
ORDER BY spanish_pct DESC;
```

---

## 🎯 Geographic Routing

### Automatic Level Selection

The system automatically chooses the best geographic level:

```typescript
// Query mentions specific geography
"Show me data for Los Angeles County"
→ County level (or block group if detailed analysis)

// Query about neighborhoods
"Find high-income neighborhoods in San Francisco"
→ Block group level

// Query about states
"Compare California to Texas"
→ State level

// Query about local areas
"Census tracts with high poverty in Chicago"
→ Tract level
```

### Manual Level Selection

Override automatic routing:

```typescript
import { routeQueryWithFallback } from './services/geoRoutingService';

// Force specific level
const decision = routeQueryWithFallback(query, 'tract');
// Always uses tract level
```

---

## 🔧 Troubleshooting

### Census API Issues

**Rate Limit Errors**
```
Error: 429 Too Many Requests
```
**Solution**: Scripts include 200-300ms delays. Increase if needed:
```typescript
await new Promise(resolve => setTimeout(resolve, 500)); // Increase to 500ms
```

**Timeout Errors**
```
Error: timeout of 60000ms exceeded
```
**Solution**: Already set to 60s. Check internet connection.

**Missing API Key**
```
Error: CENSUS_API_KEY not configured
```
**Solution**: Add to `.env`:
```
CENSUS_API_KEY=your_key_here
```

### Load Interrupted

All loaders save progress automatically. Simply re-run to resume:
```bash
npm run load-tracts  # Continues from last completed state
```

Progress files:
- `/backend/data/tract-progress.json`
- `/backend/data/blockgroup-expanded-progress.json`

### Database Issues

**Table Already Exists**
```
Error: table already exists
```
**Solution**: Loaders use `CREATE TABLE IF NOT EXISTS` - this is normal, not an error.

**Out of Memory**
```
Error: Cannot allocate memory
```
**Solution**: Reduce batch size in loader:
```typescript
const batchSize = 250;  // Reduce from 500
```

---

## 📚 Next Steps

### 1. Create Indexes (Performance)
```sql
-- Common query indexes
CREATE INDEX idx_bg_state ON block_group_data_expanded(state_fips);
CREATE INDEX idx_bg_income ON block_group_data_expanded(median_household_income);
CREATE INDEX idx_tract_poverty ON tract_data(poverty_rate);
```

### 2. Create Hierarchy Metadata
```bash
npm run create-geo-hierarchy
```

Enables:
- Parent-child lookups
- Hierarchical rollups
- Cross-level joins

### 3. Update Security Policies
Add new tables to `/backend/src/validation/sqlSecurityPolicies.ts`:
```typescript
const ALLOWED_TABLES = [
  'county_data',
  'state_data',           // Add
  'tract_data',           // Add
  'block_group_data_expanded'  // Add
];
```

### 4. Update Claude Prompt
Add to `/backend/src/services/anthropicService.ts`:
```typescript
const systemPrompt = `
Available tables:
- state_data (51 states, 84 variables)
- county_data (3,144 counties, existing)
- tract_data (73,000 tracts, 84 variables)
- block_group_data_expanded (240,000 block groups, 84 variables)

Use geographic routing for optimal performance.
`;
```

---

## 📖 Full Documentation

- **Comprehensive Guide**: `/docs/MARKETING_ANALYTICS_EXPANSION.md`
- **Variable Reference**: `/docs/guides/VARIABLE_REFERENCE.md`
- **Geographic Hierarchy**: `/docs/GEOGRAPHIC_HIERARCHY.md`
- **API Documentation**: `/docs/api/GEO_ROUTING_API.md`

---

## ✅ Success Checklist

- [ ] Census API key configured in `.env`
- [ ] Tested with DC (small state)
- [ ] Loaded desired geographic levels
- [ ] Created geo_hierarchy table
- [ ] Added performance indexes
- [ ] Updated security policies
- [ ] Updated Claude system prompt
- [ ] Tested example queries
- [ ] Verified data quality

---

**Total Variables**: 84 (verified with ACS 2023 API)
**Estimated Total Time**: 6-12 hours (full load) or 5 minutes (state only)
**Database Size**: ~500MB (full) or ~5MB (state only)
**Ready to Use**: Immediately after each level loads

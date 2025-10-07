# Block Group Data - Quick Start Guide

## 🚀 Load Block Group Data

### Option 1: Standard Load (29 variables) - 2-4 hours
**Current implementation - Tested and production-ready**

```bash
cd backend
npm run load-blockgroups
```

Loads **239,741 block groups** with **29 core variables**:
- Demographics: population, age, gender, race/ethnicity
- Economic: income, poverty, unemployment, uninsured rate
- Health: disability rate, limited English
- Housing: units, values, ownership rates
- Transportation: vehicle access

### Option 2: Expanded Load (43+ variables) - 3-5 hours
**Enhanced SDOH analysis - See expansion plan below**

Adds 14 critical healthcare variables:
- **Insurance gaps** by age group (pediatric, working-age, senior)
- **Disability types** (ambulatory, independent living)
- **Housing burden** (rent 50%+ of income)
- **Food insecurity** (SNAP/Food Stamps)
- **Crowding** indicators for outbreak analysis

See `/docs/VARIABLE_EXPANSION_PLAN.md` for implementation guide.

### Option 3: Full SDOH Load (68 variables) - 4-6 hours
**Comprehensive social determinants - Future enhancement**

Includes all Phase 1-4 variables:
- Detailed income distribution
- Transportation barriers (commute time)
- Family structure & social support
- Language-specific access barriers

---

## ✅ What You Get (Standard Load)

- **76x more granular** than county-level data
- **29 comprehensive variables** including:
  - Age groups (pediatric, working-age, Medicare-eligible)
  - Race/ethnicity breakdowns (4 categories)
  - Economic indicators (income, poverty, unemployment)
  - Health metrics (uninsured rate, disability rate)
  - Education levels (HS+, Bachelor's+)
  - Housing characteristics (ownership, values)

## 📊 Example Queries

### Find High Medicare-Eligible Areas
```sql
SELECT geoid, state_name, county_name, age_65_plus
FROM block_group_data
WHERE age_65_plus > 500
ORDER BY age_65_plus DESC
LIMIT 20;
```

### Identify Vulnerable Populations
```sql
SELECT geoid, state_name, poverty_rate, uninsured_rate
FROM block_group_data
WHERE poverty_rate > 20 AND uninsured_rate > 15
ORDER BY poverty_rate DESC;
```

## 🔧 Next Steps After Loading

1. **Update Query Routes** - Modify `/backend/src/routes/query.routes.ts` to support block group queries
2. **Add Indexes** - Create indexes on commonly queried fields (state, county, age_65_plus, poverty_rate)
3. **Test Queries** - Use DuckDB CLI to verify data: `npm run duckdb`

## 📖 Full Documentation

- **Implementation Details**: `/BLOCK_GROUP_IMPLEMENTATION.md`
- **Variable Reference**: `/docs/guides/BLOCK_GROUP_VARIABLES.md`
- **Loader Code**: `/backend/scripts/load-acs-blockgroup.ts`

## ⚙️ Technical Details

- **Data Source**: ACS 5-Year 2023 (2019-2023)
- **API**: Census Bureau Data API
- **Database**: DuckDB (`/backend/data/census_blockgroups.duckdb`)
- **Load Time**: 2-4 hours (with 200ms rate limiting)
- **Database Size**: ~50-100 MB

## 🐛 Troubleshooting

**Census API Key Missing**
```bash
# Add to .env file
CENSUS_API_KEY=your_key_here
```

**Load Interrupted**
- Progress is automatically saved
- Re-run `npm run load-blockgroups` to resume from last completed state

**Test with Small State First**
```typescript
// In load-acs-blockgroup.ts, modify STATES array:
const STATES = [
  { fips: '11', name: 'District of Columbia' }  // ~571 block groups
];
```

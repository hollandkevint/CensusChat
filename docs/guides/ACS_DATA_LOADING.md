# ACS Data Loading Guide

**Status**: Ready for implementation
**Timeline**: 10-15 minutes (after API key obtained)
**Outcome**: 3,143 US counties with production ACS data

## Overview

This guide provides step-by-step instructions for loading real American Community Survey (ACS) data into CensusChat's DuckDB database. Currently, the system operates with mock data for 8 test counties. Following this guide will enable production data for all US counties.

## Prerequisites

### 1. Get Census API Key (2 minutes)

```bash
# Visit Census API registration page
open https://api.census.gov/data/key_signup.html

# Fill out the form:
# - Organization: Your organization name
# - Email: Your email address
#
# API key will be emailed immediately (usually < 1 minute)
```

### 2. Configure Environment

Add your API key to backend `.env`:

```bash
# In /backend/.env
CENSUS_API_KEY=your_key_here
```

## Implementation Steps

### Step 1: Create Data Loader Script (5 minutes)

Create `/backend/scripts/load-acs-data.ts`:

```typescript
/**
 * ACS Data Loader for CensusChat
 *
 * Loads 5-year ACS data for all US counties into DuckDB
 * Variables: Population, Median Income, Poverty Rate
 */

import axios from 'axios';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const CENSUS_API_BASE = 'https://api.census.gov/data';
const YEAR = 2022; // Most recent complete 5-year ACS
const DB_PATH = path.join(__dirname, '../data/census.duckdb');

interface CountyData {
  state: string;
  county: string;
  stateName: string;
  countyName: string;
  population: number;
  medianIncome: number;
  povertyRate: number;
}

// ACS variable mappings
const ACS_VARIABLES = {
  population: 'B01003_001E',      // Total population
  medianIncome: 'B19013_001E',    // Median household income
  povertyRate: 'B17001_002E',     // Population below poverty
  totalForPoverty: 'B17001_001E'  // Total for poverty calculation
};

// State FIPS codes and names
const STATES = [
  { fips: '01', name: 'Alabama' },
  { fips: '02', name: 'Alaska' },
  { fips: '04', name: 'Arizona' },
  { fips: '05', name: 'Arkansas' },
  { fips: '06', name: 'California' },
  { fips: '08', name: 'Colorado' },
  { fips: '09', name: 'Connecticut' },
  { fips: '10', name: 'Delaware' },
  { fips: '11', name: 'District of Columbia' },
  { fips: '12', name: 'Florida' },
  { fips: '13', name: 'Georgia' },
  { fips: '15', name: 'Hawaii' },
  { fips: '16', name: 'Idaho' },
  { fips: '17', name: 'Illinois' },
  { fips: '18', name: 'Indiana' },
  { fips: '19', name: 'Iowa' },
  { fips: '20', name: 'Kansas' },
  { fips: '21', name: 'Kentucky' },
  { fips: '22', name: 'Louisiana' },
  { fips: '23', name: 'Maine' },
  { fips: '24', name: 'Maryland' },
  { fips: '25', name: 'Massachusetts' },
  { fips: '26', name: 'Michigan' },
  { fips: '27', name: 'Minnesota' },
  { fips: '28', name: 'Mississippi' },
  { fips: '29', name: 'Missouri' },
  { fips: '30', name: 'Montana' },
  { fips: '31', name: 'Nebraska' },
  { fips: '32', name: 'Nevada' },
  { fips: '33', name: 'New Hampshire' },
  { fips: '34', name: 'New Jersey' },
  { fips: '35', name: 'New Mexico' },
  { fips: '36', name: 'New York' },
  { fips: '37', name: 'North Carolina' },
  { fips: '38', name: 'North Dakota' },
  { fips: '39', name: 'Ohio' },
  { fips: '40', name: 'Oklahoma' },
  { fips: '41', name: 'Oregon' },
  { fips: '42', name: 'Pennsylvania' },
  { fips: '44', name: 'Rhode Island' },
  { fips: '45', name: 'South Carolina' },
  { fips: '46', name: 'South Dakota' },
  { fips: '47', name: 'Tennessee' },
  { fips: '48', name: 'Texas' },
  { fips: '49', name: 'Utah' },
  { fips: '50', name: 'Vermont' },
  { fips: '51', name: 'Virginia' },
  { fips: '53', name: 'Washington' },
  { fips: '54', name: 'West Virginia' },
  { fips: '55', name: 'Wisconsin' },
  { fips: '56', name: 'Wyoming' }
];

async function fetchCountyData(stateFips: string, stateName: string): Promise<CountyData[]> {
  const variables = Object.values(ACS_VARIABLES).join(',');
  const url = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=NAME,${variables}&for=county:*&in=state:${stateFips}&key=${CENSUS_API_KEY}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const [headers, ...rows] = response.data;

    return rows.map((row: any[]) => {
      const countyName = row[0].split(',')[0]; // Extract county name before comma
      const population = parseInt(row[1]) || 0;
      const medianIncome = parseInt(row[2]) || 0;
      const povertyCount = parseInt(row[3]) || 0;
      const povertyTotal = parseInt(row[4]) || 1; // Avoid division by zero
      const county = row[6]; // County FIPS

      return {
        state: stateFips,
        county,
        stateName,
        countyName,
        population,
        medianIncome,
        povertyRate: (povertyCount / povertyTotal) * 100
      };
    });
  } catch (error) {
    console.error(`Error fetching data for ${stateName}:`, error);
    return [];
  }
}

async function loadDataIntoDuckDB(data: CountyData[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(DB_PATH, (err) => {
      if (err) return reject(err);

      const conn = db.connect();

      // Create table
      conn.run(`
        CREATE TABLE IF NOT EXISTS county_data (
          state VARCHAR,
          county VARCHAR,
          state_name VARCHAR,
          county_name VARCHAR,
          population INTEGER,
          median_income INTEGER,
          poverty_rate DOUBLE,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (state, county)
        )
      `, (err) => {
        if (err) return reject(err);

        // Clear existing data
        conn.run('DELETE FROM county_data', (err) => {
          if (err) return reject(err);

          // Insert new data
          const stmt = conn.prepare(`
            INSERT INTO county_data (
              state, county, state_name, county_name,
              population, median_income, poverty_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          data.forEach(row => {
            stmt.run(
              row.state,
              row.county,
              row.stateName,
              row.countyName,
              row.population,
              row.medianIncome,
              row.povertyRate
            );
          });

          stmt.finalize((err) => {
            if (err) return reject(err);
            conn.close();
            db.close(() => resolve());
          });
        });
      });
    });
  });
}

async function main() {
  console.log('🚀 Starting ACS Data Load...');
  console.log(`API Key: ${CENSUS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('');

  if (!CENSUS_API_KEY) {
    console.error('❌ CENSUS_API_KEY not found in environment');
    console.error('Please add it to /backend/.env');
    process.exit(1);
  }

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let allData: CountyData[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Fetch data for all states
  for (const state of STATES) {
    process.stdout.write(`Fetching ${state.name}... `);
    const data = await fetchCountyData(state.fips, state.name);

    if (data.length > 0) {
      allData = allData.concat(data);
      successCount++;
      console.log(`✅ ${data.length} counties`);
    } else {
      errorCount++;
      console.log('❌ Failed');
    }

    // Rate limiting: 1 request per 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log(`📊 Fetched ${allData.length} counties from ${successCount} states`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} states failed`);
  }

  // Load into DuckDB
  console.log('');
  console.log('💾 Loading data into DuckDB...');
  await loadDataIntoDuckDB(allData);

  console.log('✅ Data load complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart backend: npm run dev');
  console.log('2. Test query: "Show me counties in California"');
  console.log('3. Verify data: SELECT COUNT(*) FROM county_data;');
}

main().catch(console.error);
```

### Step 2: Add NPM Script

Add to `/backend/package.json` scripts:

```json
{
  "scripts": {
    "load-acs-data": "ts-node scripts/load-acs-data.ts"
  }
}
```

### Step 3: Execute Data Load (10-15 minutes)

```bash
cd backend
npm run load-acs-data
```

**Expected Output:**
```
🚀 Starting ACS Data Load...
API Key: ✅ Configured
Database: /path/to/census.duckdb

Fetching Alabama... ✅ 67 counties
Fetching Alaska... ✅ 29 counties
Fetching Arizona... ✅ 15 counties
...
Fetching Wyoming... ✅ 23 counties

📊 Fetched 3,143 counties from 51 states
💾 Loading data into DuckDB...
✅ Data load complete!
```

### Step 4: Verify Data Load

```bash
# Start DuckDB CLI
npm run duckdb

# Check record count
SELECT COUNT(*) FROM county_data;
-- Expected: 3,143

# Check data sample
SELECT state_name, county_name, population, median_income
FROM county_data
LIMIT 5;

# Check for your state
SELECT county_name, population, median_income
FROM county_data
WHERE state_name = 'California'
ORDER BY population DESC
LIMIT 10;
```

### Step 5: Enable Production Queries

Update `/backend/src/services/duckDBService.ts`:

```typescript
// Change from mock data to real queries
async executeQuery(sql: string): Promise<any[]> {
  // Remove mock data check
  // Now uses real DuckDB queries
  return this.pool.query(sql);
}
```

### Step 6: Test Application

```bash
# Restart backend
npm run dev

# Test queries in frontend:
# 1. "Show me all counties in Texas"
# 2. "What are the top 10 most populous counties?"
# 3. "Find counties with median income over $75,000"
# 4. "Compare poverty rates in California vs Florida"
```

## Troubleshooting

### API Key Issues

```bash
# Test API key manually
curl "https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=county:*&in=state:06&key=YOUR_KEY"

# Should return California county data
```

### Rate Limiting

If you hit rate limits (400 errors):
- Script already includes 100ms delay between requests
- Total load time: ~5-6 minutes for all states
- Census API limit: 500 requests/day (you'll use ~51)

### Database Issues

```bash
# Check database exists
ls -lh backend/data/census.duckdb

# Verify permissions
chmod 644 backend/data/census.duckdb

# Rebuild if corrupted
rm backend/data/census.duckdb
npm run load-acs-data
```

### Missing Counties

Some territories may not have complete ACS data:
- Puerto Rico: Use separate API endpoint
- Guam, Virgin Islands: Limited ACS coverage
- This is expected and won't affect 50 states + DC

## Data Freshness

**Current**: 2022 ACS 5-year estimates (2018-2022 data)
**Update Schedule**: Census releases new 5-year data each September
**Next Update**: September 2025 (2023 ACS data)

To update to newer data:
1. Change `YEAR` constant in script
2. Re-run data load
3. Update `last_updated` timestamp verification

## Expected Results

After successful completion:

- **Total Counties**: 3,143 (50 states + DC)
- **Database Size**: ~500KB
- **Query Performance**: <100ms per query
- **Data Quality**: Direct from Census Bureau
- **Coverage**: 100% of US counties

## Next Steps After Loading

1. **Update Configuration**
   - Set `USE_REAL_DATA=true` in backend env
   - Remove mock data fallbacks
   - Update frontend messaging

2. **Performance Optimization**
   - Add DuckDB indexes on frequently queried columns
   - Implement query result caching
   - Add pagination for large result sets

3. **Data Enrichment**
   - Add more ACS variables (age, race, education)
   - Include metropolitan area classifications
   - Add geographic coordinates for mapping

4. **Monitoring**
   - Track query patterns
   - Monitor data freshness
   - Alert on API failures

## Additional Resources

- [Census API Documentation](https://www.census.gov/data/developers/data-sets/acs-5year.html)
- [ACS Variable List](https://api.census.gov/data/2022/acs/acs5/variables.html)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [County FIPS Codes](https://www.census.gov/library/reference/code-lists/ansi.html)

---

**Questions or Issues?**
Refer to `/docs/SESSION_SUMMARY.md` for context on this implementation or check `/docs/NEXT_STEPS.md` for the planned workflow.
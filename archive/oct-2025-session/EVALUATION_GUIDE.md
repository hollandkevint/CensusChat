# CensusChat Evaluation & Testing Guide

## Overview

This guide covers the evaluation framework for testing CensusChat's query accuracy and the process for loading block group level census data.

---

## Part 1: Query Evaluation Framework

### What is it?

A comprehensive evaluation system following LLM testing best practices:
- **Golden Dataset**: 20 curated test cases with expected results
- **Multi-Metric Evaluation**: Tests accuracy, SQL correctness, and performance
- **LLM-as-Judge**: Uses Anthropic API to evaluate response quality
- **Automated Scoring**: Pass/fail criteria with detailed metrics

### Test Categories

1. **Accuracy (ACC)**: Verify correct data retrieval
   - Population sums
   - County counts
   - Data integrity

2. **Geography (GEO)**: Test location parsing
   - State/county name resolution
   - City-to-county mapping
   - Name variations

3. **Filters (FIL)**: Test query filters
   - Income thresholds
   - Population ranges
   - Qualitative filters

4. **Aggregation (AGG)**: Test data operations
   - SUM, AVG, COUNT
   - GROUP BY
   - ORDER BY & LIMIT

5. **Edge Cases (EDGE)**: Handle errors gracefully
   - Typos
   - Ambiguous queries
   - Minimal input

### Running Evaluations

```bash
# Ensure backend is running
cd backend
npm run dev

# In another terminal, run evaluation
cd backend
npm run eval
```

### Evaluation Output

```
🧪 Starting CensusChat Query Evaluation...

📋 Running 20 test cases

Testing [ACC-001]: sum the population of florida
  ✅ PASS (score: 100%)

Testing [ACC-002]: show me all counties in Texas
  ✅ PASS (score: 95%)

...

====================================================================
📊 EVALUATION SUMMARY
====================================================================

⏱️  Total Time: 45.2s
📋 Tests Run: 20
✅ Passed: 18 (90.0%)
❌ Failed: 2 (10.0%)
📈 Overall Score: 87.5%
⚡ Avg Response Time: 2250ms

📊 Category Scores:
  accuracy: 95.0%
  geography: 88.0%
  filters: 85.0%
  aggregation: 90.0%
  edge_case: 70.0%

====================================================================
```

### Evaluation Metrics

Each test is scored on:
- **SQL Correctness** (30%): Generated SQL matches expected query
- **Data Accuracy** (40%): Results contain expected data
- **Row Count Match** (20%): Correct number of records returned
- **Performance** (10%): Response time < 30 seconds

**Pass Threshold**: 70% overall score

### Adding New Test Cases

Edit `/backend/src/evals/golden-dataset.json`:

```json
{
  "id": "NEW-001",
  "category": "accuracy",
  "query": "your test query here",
  "expectedSql": "SELECT ...",
  "expectedRowCount": 42,
  "expectedDataContains": [
    { "field": "county_name", "value": "Expected County" }
  ],
  "description": "What this test verifies",
  "priority": "high"
}
```

### Evaluation Results

Results are saved to `/backend/logs/eval-results.json`:

```json
[
  {
    "timestamp": "2025-10-02T14:30:00.000Z",
    "totalTests": 20,
    "passed": 18,
    "failed": 2,
    "overallScore": 0.875,
    "categoryScores": {
      "accuracy": 0.95,
      "geography": 0.88
    },
    "results": [...]
  }
]
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Query Evaluation
  run: |
    npm run dev &
    sleep 10
    npm run eval
```

---

## Part 2: Block Group Data Loading

### What is Block Group Data?

- **Finest geographic level** in ACS (American Community Survey)
- **~220,000 block groups** nationwide (vs 3,144 counties)
- **70x more granular** than county-level data
- **2023 ACS 5-Year** (most recent available)

### Geographic Hierarchy

```
Nation
 └─ State (51)
     └─ County (3,144)
         └─ Census Tract (~74,000)
             └─ Block Group (~220,000)  ← ACS finest level
                 └─ Census Block (~11M)  ← Decennial Census only
```

### Data Variables

The loader fetches these ACS variables:

| Variable | ACS Code | Description |
|----------|----------|-------------|
| Population | B01003_001E | Total population |
| Median Income | B19013_001E | Median household income |
| Poverty Rate | B17001_002E/B17001_001E | % below poverty |
| Seniors 65+ | B01001_020E + others | Medicare eligible |
| Median Age | B01002_001E | Median age |
| Education | B15003_022E | Bachelor's or higher |
| Housing | B25003_003E | Renter occupied |
| Home Value | B25077_001E | Median home value |

### Database Schema

```sql
CREATE TABLE block_group_data (
  state_fips VARCHAR(2),           -- State FIPS code
  county_fips VARCHAR(3),          -- County FIPS code
  tract_fips VARCHAR(6),           -- Census tract code
  block_group VARCHAR(1),          -- Block group number
  geoid VARCHAR(12) PRIMARY KEY,   -- Full FIPS: state+county+tract+bg
  state_name VARCHAR(50),          -- State name
  county_name VARCHAR(100),        -- County name
  population BIGINT,               -- Total population
  median_income INTEGER,           -- Median household income
  poverty_rate DOUBLE,             -- Poverty rate (%)
  seniors_65_plus INTEGER,         -- Population 65+
  median_age DOUBLE,               -- Median age
  bachelors_or_higher INTEGER,     -- With bachelor's+
  median_home_value INTEGER,       -- Median home value
  renter_occupied INTEGER          -- Renter-occupied units
);
```

### Loading Block Group Data

**Step 1: Ensure Census API Key**

```bash
# Check your .env file
cat .env | grep CENSUS_API_KEY

# Should show:
CENSUS_API_KEY=your_actual_key_here
```

**Step 2: Run the Loader**

```bash
cd backend
npm run load-blockgroups
```

**Expected Output:**

```
🚀 Starting ACS Block Group Data Load...
   Year: 2023 ACS 5-Year
   Database: /backend/data/census_blockgroups.duckdb

📊 Progress: 0/51 states completed
   Total block groups loaded: 0

✅ Database table ready

🔄 Processing 51 remaining states...

  Fetching Alabama...
  ✅ Alabama: 4,293 block groups

  Fetching Alaska...
  ✅ Alaska: 547 block groups

  ...

📊 Load Complete!
   Total states: 51
   Total block groups: 220,334
   Database records: 220,334

✅ All states completed - progress file removed
```

### Loading Time

- **API Calls**: ~51 states × 200ms delay = ~10 seconds
- **Data Processing**: ~2-3 hours (220k records)
- **Total Time**: ~2-4 hours

### Progress Tracking

The loader saves progress after each state:

```json
// backend/data/blockgroup-progress.json
{
  "lastCompletedState": "06",
  "completedStates": ["01", "02", "04", "05", "06"],
  "totalBlockGroups": 45231,
  "startTime": "2025-10-02T10:00:00.000Z",
  "lastUpdateTime": "2025-10-02T10:15:00.000Z"
}
```

**To Resume**: Just run `npm run load-blockgroups` again. It will skip completed states.

### Verification

```bash
# Check record count
cd backend
npm run duckdb

# In DuckDB:
SELECT COUNT(*) FROM block_group_data;
-- Expected: ~220,000

# Check California block groups
SELECT COUNT(*) FROM block_group_data WHERE state_name = 'California';
-- Expected: ~23,000

# Sample data
SELECT * FROM block_group_data LIMIT 5;

.quit
```

### Database Size

- **County-level DB**: 1.5 MB (3,144 records)
- **Block Group DB**: ~100 MB estimated (220,000 records)

### Performance Considerations

1. **Indexes**: Add for common queries
   ```sql
   CREATE INDEX idx_state ON block_group_data(state_fips);
   CREATE INDEX idx_county ON block_group_data(county_fips);
   CREATE INDEX idx_income ON block_group_data(median_income);
   ```

2. **Aggregation**: Block groups often need to be rolled up
   ```sql
   -- County-level summary from block groups
   SELECT
     state_name,
     county_name,
     SUM(population) as total_pop,
     AVG(median_income) as avg_income
   FROM block_group_data
   GROUP BY state_name, county_name;
   ```

3. **Query Optimization**: Use materialized views for common aggregations

---

## Troubleshooting

### Evaluation Issues

**Problem**: Tests timing out
```bash
# Increase timeout in query.routes.ts (already set to 30s)
# Check Anthropic API status
curl https://status.anthropic.com
```

**Problem**: SQL mismatch failures
```bash
# Check actual vs expected SQL in logs/eval-results.json
# Update golden-dataset.json with correct expected SQL
```

### Block Group Loading Issues

**Problem**: API rate limit errors
```bash
# Increase delay in load-acs-blockgroup.ts
# Currently set to 200ms between requests
```

**Problem**: Out of memory
```bash
# Reduce batch size from 1000 to 500
# Process states one at a time (already implemented)
```

**Problem**: Load interrupted
```bash
# Just re-run - it will resume from last completed state
npm run load-blockgroups
```

---

## Best Practices

### Evaluation

1. **Run before each release**: Ensure no regressions
2. **Add test for each bug fix**: Prevent future issues
3. **Monitor score trends**: Track improvement over time
4. **Review failures**: Update golden dataset if needed

### Block Group Data

1. **Load during off-hours**: Takes 2-4 hours
2. **Backup existing data**: Before loading new data
3. **Verify after load**: Check record counts
4. **Index after load**: Add indexes for performance

---

## Future Enhancements

### Evaluation

- [ ] Add visual regression testing
- [ ] Implement A/B testing framework
- [ ] Add user behavior simulations
- [ ] Create performance benchmarks

### Data Loading

- [ ] Add incremental updates
- [ ] Implement ZIP code to block group mapping
- [ ] Add geographic boundary data
- [ ] Create data quality monitoring

---

## Support

**Documentation**: See `/docs` directory
**Issues**: Create GitHub issue
**Questions**: kevin@kevintholland.com

---

**Last Updated**: October 2, 2025

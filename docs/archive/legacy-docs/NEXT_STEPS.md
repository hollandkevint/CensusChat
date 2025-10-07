# Next Steps: ACS Data Loading

**Current Status**: System operational with mock data (8 counties)
**Next Action**: Load production ACS data (3,143 counties)
**Time Required**: 15-20 minutes
**Priority**: HIGH - Enables production data queries

---

## Immediate Actions (This Session)

### 1. Obtain Census API Key (2 minutes)

```bash
# Open registration page
open https://api.census.gov/data/key_signup.html
```

**Fill out form:**
- Organization: Your organization name
- Email: Your email address

**Receive key:** Check email (usually <1 minute)

### 2. Configure Environment (1 minute)

```bash
# Add API key to backend environment
echo "CENSUS_API_KEY=your_actual_key_here" >> backend/.env

# Verify configuration
cat backend/.env | grep CENSUS_API_KEY
```

### 3. Load ACS Data (10-15 minutes)

```bash
# Navigate to backend
cd backend

# Execute data loader
npm run load-acs-data
```

**Expected output:**
```
🚀 Starting ACS Data Load...
API Key: ✅ Configured
Database: /backend/data/census.duckdb

Fetching Alabama... ✅ 67 counties
Fetching Alaska... ✅ 29 counties
...
Fetching Wyoming... ✅ 23 counties

📊 Fetched 3,143 counties from 51 states
💾 Loading data into DuckDB...
✅ Data load complete!
```

---

## Verification Steps

### Check Database

```bash
# Start DuckDB CLI
cd backend
npm run duckdb

# Verify record count
SELECT COUNT(*) FROM county_data;
-- Expected: 3,143

# Check sample data
SELECT state_name, county_name, population, median_income, poverty_rate
FROM county_data
LIMIT 10;

# Verify your state (example: California)
SELECT county_name, population, median_income
FROM county_data
WHERE state_name = 'California'
ORDER BY population DESC
LIMIT 10;

# Exit DuckDB
.quit
```

### Test Application

```bash
# Restart backend (if running)
cd backend
npm run dev

# In separate terminal, ensure frontend is running
cd frontend
npm run dev
```

**Test Queries in Application:**
1. "Show me all counties in Texas"
2. "What are the top 10 most populous counties?"
3. "Find counties with median income over $75,000"
4. "Compare poverty rates in California and Florida"

**Expected Results:**
- Real county data from Census Bureau
- Query response time <100ms
- All 50 states + DC represented
- Accurate population, income, poverty data

---

## Quick Start Commands

```bash
# Complete workflow (copy-paste ready)

# 1. Get API key (manual step - visit website)
open https://api.census.gov/data/key_signup.html

# 2. Configure (replace YOUR_KEY)
echo "CENSUS_API_KEY=YOUR_KEY" >> backend/.env

# 3. Load data
cd backend && npm run load-acs-data

# 4. Verify
npm run duckdb
# Run: SELECT COUNT(*) FROM county_data;
# Expected: 3,143
# Type: .quit

# 5. Start application
npm run dev
# Frontend should already be running on port 3000

# 6. Test queries in browser
open http://localhost:3000
```

---

## Expected Outcomes

### Database
- **Records**: 3,143 counties
- **Size**: ~500KB
- **Coverage**: All 50 states + District of Columbia
- **Variables**: Population, Median Income, Poverty Rate
- **Performance**: Query execution <100ms

### Application
- **Status**: Production data enabled
- **Features**: All queries use real Census data
- **Exports**: Excel exports contain real data
- **Performance**: No change from mock data performance

### User Experience
- Same natural language interface
- Real census data in results
- Full US county coverage
- Accurate demographic information

---

## Troubleshooting

### API Key Not Working

```bash
# Test API key manually
curl "https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=county:001&in=state:01&key=YOUR_KEY"

# Should return JSON with Alabama county data
```

**If error:**
- Check email for actual key
- Verify no extra spaces in .env file
- Key should be 40 characters long

### Data Load Fails

**Symptom**: Script errors during state fetching

**Solutions:**
```bash
# Check internet connection
ping api.census.gov

# Verify API key in environment
node -e "require('dotenv').config(); console.log(process.env.CENSUS_API_KEY);"

# Check available disk space
df -h

# Retry load (script is idempotent)
npm run load-acs-data
```

### Wrong County Count

**Expected**: 3,143 counties
**If different**: Some states may have failed

```bash
# Check which states succeeded
npm run duckdb
SELECT state_name, COUNT(*) as counties
FROM county_data
GROUP BY state_name
ORDER BY state_name;
```

Compare against expected counts:
- California: 58 counties
- Texas: 254 counties
- Georgia: 159 counties
- Virginia: 133 counties

### Performance Issues

**Symptom**: Queries taking >500ms

**Solutions:**
```bash
# Add indexes (run in DuckDB CLI)
CREATE INDEX idx_state ON county_data(state);
CREATE INDEX idx_state_county ON county_data(state, county);
CREATE INDEX idx_population ON county_data(population);
CREATE INDEX idx_income ON county_data(median_income);

# Verify indexes
SHOW TABLES;
PRAGMA show_tables;
```

---

## After Data Load Complete

### 1. Update Documentation

```bash
# Update README to reflect production data
# Update MVP_STATUS.md with completion status
# Mark this task complete in NEXT_STEPS.md
```

### 2. Run Full Test Suite

```bash
cd backend
npm test

# Expected: All tests pass with real data
```

### 3. Test Export Functionality

```bash
# In application:
# 1. Run query: "Top 50 most populous counties"
# 2. Click "Export to Excel"
# 3. Open exported file
# 4. Verify 50 rows with real data
```

### 4. Commit Changes

```bash
git add backend/.env
git add backend/data/census.duckdb
git commit -m "feat: Load production ACS data for 3,143 US counties"
```

---

## Deployment to Production (Railway + Vercel)

### 5. Deploy to Railway (15 minutes)

**Complete deployment guide**: [📖 Railway Deployment Guide](/docs/guides/RAILWAY_DEPLOYMENT.md)

**Quick Steps:**
1. Create Railway account at https://railway.com
2. Deploy backend from GitHub repository
3. Add PostgreSQL and Redis databases
4. Configure environment variables (Census API key, JWT secret)
5. Deploy frontend to Vercel
6. Connect services and test

**Expected Outcome:**
- ✅ Backend live at: `https://censuschat-backend.up.railway.app`
- ✅ Frontend live at: `https://censuschat.vercel.app`
- ✅ Public access for beta testing
- ✅ Production-grade monitoring and logs

### 6. External Access Setup (5 minutes)

**Share with Beta Testers:**

```markdown
# CensusChat Beta Access

🔗 **URL**: https://censuschat.vercel.app

## Try These Queries:
1. "Show me all counties in Texas"
2. "Medicare eligible seniors in Florida"
3. "Counties with median income over $75,000"

📧 **Feedback**: kevin@kevintholland.com
```

**Access Checklist:**
- [ ] Beta tester email list (10-20 people)
- [ ] Usage analytics configured
- [ ] Feedback form created
- [ ] Support email monitored

---

## Future Enhancements (Optional)

### Add More Variables

Edit `backend/scripts/load-acs-data.ts`:

```typescript
const ACS_VARIABLES = {
  // Existing
  population: 'B01003_001E',
  medianIncome: 'B19013_001E',
  povertyRate: 'B17001_002E',

  // Add these
  medianAge: 'B01002_001E',
  bachelorsOrHigher: 'B15003_022E',
  unemploymentRate: 'B23025_005E',
  medianHomeValue: 'B25077_001E'
};
```

Re-run: `npm run load-acs-data`

### Automate Updates

Create cron job for monthly updates:

```bash
# Add to crontab
0 2 1 * * cd /path/to/backend && npm run load-acs-data
```

### Add Geographic Data

Integrate county centroid coordinates for mapping:

```typescript
// Add to county_data table
latitude: DOUBLE,
longitude: DOUBLE
```

---

## Success Criteria

✅ **Data Load Complete When:**
- [ ] Census API key obtained
- [ ] 3,143 counties in database
- [ ] All 50 states + DC represented
- [ ] Sample queries return correct data
- [ ] Query performance <100ms
- [ ] Excel export works with real data
- [ ] No errors in application logs

✅ **Ready for Production When:**
- [ ] All success criteria met
- [ ] Full test suite passes
- [ ] Documentation updated
- [ ] Changes committed to git

---

## Timeline

| Task | Duration | Cumulative |
|------|----------|------------|
| Get API key | 2 min | 2 min |
| Configure environment | 1 min | 3 min |
| Load ACS data | 12 min | 15 min |
| Verify data | 2 min | 17 min |
| Test queries | 3 min | 20 min |
| **Total** | **20 min** | |

---

## Support Resources

- **Implementation Guide**: `/docs/guides/ACS_DATA_LOADING.md`
- **Session Context**: `/docs/SESSION_SUMMARY.md`
- **Census API Docs**: https://www.census.gov/data/developers/data-sets/acs-5year.html
- **ACS Variables**: https://api.census.gov/data/2022/acs/acs5/variables.html
- **DuckDB Docs**: https://duckdb.org/docs/

---

## Questions?

**Q: Do I need to restart the backend after loading data?**
A: Yes, restart to clear any cached connections.

**Q: Will this overwrite my existing database?**
A: Yes, the script clears existing data. If you have custom data, back it up first.

**Q: Can I load data for specific states only?**
A: Yes, edit the `STATES` array in `/backend/scripts/load-acs-data.ts`

**Q: How often should I refresh the data?**
A: Census releases new ACS data in September. Update annually.

**Q: What if I hit rate limits?**
A: Script includes 100ms delays. You're well under the 500 requests/day limit (only ~51 requests).

---

**Current Priority**: Execute steps 1-3 to load production data
**Blocker**: Census API key acquisition (self-service, <2 minutes)
**Next Documentation Update**: After successful data load
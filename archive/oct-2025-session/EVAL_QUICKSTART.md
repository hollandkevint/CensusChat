# Evaluation & Block Group Loading - Quick Start

## 🧪 Run Evaluation (2 minutes)

```bash
# Ensure backend is running
cd backend && npm run dev

# In new terminal - run evaluation
cd backend && npm run eval
```

**What it tests**: 20 queries across accuracy, geography, filters, aggregation, and edge cases

**Pass criteria**: 70% overall score

**Results**: Saved to `/backend/logs/eval-results.json`

---

## 📊 Load Block Group Data (2-4 hours)

```bash
cd backend
npm run load-blockgroups
```

**What it loads**:
- 2023 ACS 5-Year data
- ~220,000 block groups
- 10 demographic variables
- All 51 states

**Resume if interrupted**: Just run the command again

**Verify after load**:
```bash
cd backend && npm run duckdb

SELECT COUNT(*) FROM block_group_data;
-- Expected: ~220,000

.quit
```

---

## 📝 Add Test Cases

Edit `/backend/src/evals/golden-dataset.json`:

```json
{
  "id": "YOUR-001",
  "category": "accuracy",
  "query": "your query here",
  "expectedRowCount": 42,
  "description": "what this tests",
  "priority": "high"
}
```

---

## 📈 View Results

```bash
# Evaluation results
cat backend/logs/eval-results.json | jq '.[-1]'

# Block group progress
cat backend/data/blockgroup-progress.json
```

---

## 🚨 Troubleshooting

**Eval timeout**: Check Anthropic API status, increase timeout in `query.routes.ts`

**Block group API errors**: Increase delay in `load-acs-blockgroup.ts` from 200ms to 500ms

**Resume load**: Just re-run `npm run load-blockgroups`

---

## 📚 Full Docs

- `/EVALUATION_GUIDE.md` - Complete guide
- `/IMPLEMENTATION_SUMMARY.md` - What was built

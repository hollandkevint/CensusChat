# Runbook: Refresh CensusChat to a new ACS vintage

The ACS 5-year dataset publishes a new vintage each December (e.g. the 2020–2024
5-year release ships in December 2025). This runbook bumps CensusChat to a new
vintage and reloads the DuckDB tables. Budget ~2–3 hours, almost all of it the
block-group load.

Prerequisites: `CENSUS_API_KEY` set in `backend/.env`; run everything from
`backend/`.

## 1. Confirm the new vintage is live

Replace `<YEAR>` with the target 5-year vintage and check the endpoint returns
data (HTTP 200 with a value row), not a 404:

```bash
curl -sL "https://api.census.gov/data/<YEAR>/acs/acs5?get=NAME,B01001_001E&for=state:06&key=$(grep '^CENSUS_API_KEY=' .env | cut -d= -f2)"
```

If it returns an error page, the vintage is not published yet — stop here.

## 2. Bump the vintage in one place per file

- `const YEAR = <YEAR>` in each loader: `scripts/load-acs-data.ts`,
  `scripts/load-acs-state.ts`, `scripts/load-acs-tract.ts`,
  `scripts/load-acs-blockgroup.ts`, `scripts/load-acs-blockgroup-expanded.ts`.
  (`scripts/create-geo-hierarchy.ts` has no `YEAR` — it derives from the base tables.)
- `ACS_VINTAGE_LABEL = 'ACS <YEAR> 5-Year'` in `src/config/censusVintage.ts` — this is
  what the UI's data-source line shows.

## 3. Back up the current database

The load rewrites tables in place. Keep a rollback:

```bash
cp data/census.duckdb data/census.duckdb.bak
```

## 4. Reload

The loaders clear each table on a **fresh** run (no progress file present), so a
clean reload replaces the old vintage. If a run is interrupted, re-running
resumes from its progress file and does **not** re-clear — to force a full
fresh reload instead, delete the loader's `data/*-progress.json` first.

```bash
npm run load-acs-data        # county_data (~3,144 rows, minutes)
npm run load-all-geography   # states + tracts + block groups (expanded) + geo-hierarchy (2–3 hrs)
```

`load-all-geography` runs state → tract → block-group-expanded → geo-hierarchy in
order (geo-hierarchy reads the freshly loaded base tables). The separate
`npm run load-blockgroups` loader writes the legacy `census_blockgroups.duckdb`
and is only needed if that secondary DB is still in use.

## 5. Verify before deleting the backup

Confirm the block-group table is full and values actually changed vs the backup:

```bash
npx ts-node --transpile-only -e "
import { DuckDBInstance } from '@duckdb/node-api';
(async () => {
  const q = async (db, sql) => (await (await (await DuckDBInstance.create(db)).connect()).runAndReadAll(sql)).getRowObjects();
  console.log('rows:', await q('data/census.duckdb', 'SELECT count(*) n FROM block_group_data_expanded'));
  console.log('new :', await q('data/census.duckdb', \"SELECT median_household_income FROM block_group_data_expanded WHERE geoid='060750179021'\"));
  console.log('old :', await q('data/census.duckdb.bak', \"SELECT median_household_income FROM block_group_data_expanded WHERE geoid='060750179021'\"));
})();
"
```

Expect ~239,741 rows and a `new` value that differs from `old`. (Swap the geoid
for any block group you like.)

## 6. Delete the backup and restart

```bash
rm data/census.duckdb.bak
npm run dev   # or restart the running backend
```

Send a query in the app and confirm the data-source line shows the new vintage.

## Rollback

If a load fails or the numbers look wrong, restore the backup:

```bash
mv data/census.duckdb.bak data/census.duckdb
```

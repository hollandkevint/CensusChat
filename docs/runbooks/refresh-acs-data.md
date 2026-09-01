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

One line, in `src/config/censusVintage.ts`:

```ts
export const ACS_VINTAGE_YEAR = <YEAR>;
```

All five loaders import `ACS_VINTAGE_YEAR` for their `YEAR` constant and
`ACS_VINTAGE_LABEL` is derived from it, so nothing can drift out of lockstep.
(`scripts/create-geo-hierarchy.ts` has no year — it derives from the base tables.)

Note this constant sets what the code TARGETS. The vintage the UI reports comes
from the database: each loader stamps a `data_vintage` row, and the query path
reads it. Bumping this constant alone does not make the app claim a new vintage —
only a completed reload does.

## 3. Back up the current database

The load rewrites tables in place. Keep a rollback:

```bash
cp data/census.duckdb data/census.duckdb.bak
```

## 4. Reload

The loaders replace each table on a **fresh** run, so a clean reload swaps the
old vintage out. A failed reload will not leave you with an empty table:

- `load-acs-data` (county) and `load-acs-state` clear and insert inside **one
  transaction** — any failure rolls back to the previous vintage.
- `load-acs-tract` and `load-acs-blockgroup-expanded` stream for hours and cannot
  hold one transaction, so they **defer the clear until the first state actually
  returns rows**. A rejected API key or an outage aborts before anything is
  deleted.

If a run is interrupted, re-running resumes from its progress file and does
**not** re-clear — to force a full fresh reload instead, delete the loader's
`data/*-progress.json` first.

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
It reads `data_vintage` in the DB, so if it still shows the old vintage (or no
vintage at all), the reload did not complete — check the loader output rather
than the constant.

```bash
npm run duckdb -- -c "SELECT * FROM data_vintage"
```

## Rollback

If a load fails or the numbers look wrong, restore the backup:

```bash
mv data/census.duckdb.bak data/census.duckdb
```

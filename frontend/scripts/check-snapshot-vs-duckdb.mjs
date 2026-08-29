#!/usr/bin/env node
/**
 * Proves the committed snapshot shares county_data's ACS vintage.
 *
 *   node scripts/check-snapshot-vs-duckdb.mjs [path/to/census.duckdb]
 *
 * Developer-only. CI never runs this -- it reads only the committed JSON.
 * Kept separate from build-county-snapshot.mjs so the generator carries no
 * DuckDB dependency.
 *
 * Note on the database file: census.duckdb ships with a corrupt .wal
 * sidecar. Opening the database in place replays it and raises
 *   Catalog Error: Table with name "county_data" already exists
 * Copy the .duckdb file alone (no .wal) to a scratch path and point this
 * script at the copy.
 *
 * Requires @duckdb/node-api, which lives in the backend workspace:
 *   node --experimental-default-type=module \
 *     -e "..." # or run from a directory that resolves backend/node_modules
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = process.argv[2] ?? resolve(HERE, '..', '..', 'backend', 'data', 'census.duckdb');

// Poverty rate is compared with a tolerance: county_data stores full
// precision while the Data Profile publishes one decimal, and the two are not
// guaranteed to share a universe. Population is the vintage proof and is exact.
const POVERTY_TOLERANCE = 0.15;

const require = createRequire(import.meta.url);
let DuckDBInstance;
try {
  ({ DuckDBInstance } = require('@duckdb/node-api'));
} catch {
  console.error(
    '@duckdb/node-api is not resolvable from this directory.\n' +
      'It is a backend dependency. Run this script with NODE_PATH pointed at it:\n' +
      '  NODE_PATH=../backend/node_modules node scripts/check-snapshot-vs-duckdb.mjs <db>'
  );
  process.exit(2);
}

const snapshot = JSON.parse(readFileSync(join(HERE, '..', 'src', 'data', 'counties.json'), 'utf8'));
const meta = JSON.parse(readFileSync(join(HERE, '..', 'src', 'data', 'counties.meta.json'), 'utf8'));
const byFips = new Map(snapshot.counties.map((c) => [c.fips, c]));

const instance = await DuckDBInstance.create(DB, { access_mode: 'READ_ONLY' });
const connection = await instance.connect();
const result = await connection.run(
  'select state, county, state_name, county_name, population, median_income, poverty_rate from county_data'
);
const rows = await result.getRowObjectsJson();

const mismatches = { population: [], income: [], poverty: [] };
let missing = 0;
let incomeCompared = 0;
let povertyCompared = 0;

for (const row of rows) {
  const fips = `${row.state}${row.county}`;
  const c = byFips.get(fips);
  if (!c) {
    missing += 1;
    console.error(`  not in snapshot: ${fips} ${row.county_name}, ${row.state_name}`);
    continue;
  }
  const label = `${fips} ${c.name}, ${c.stateName}`;

  if (Number(row.population) !== c.metrics.population) {
    mismatches.population.push(`${label}: county_data=${row.population} snapshot=${c.metrics.population}`);
  }

  const income = row.median_income === null ? null : Number(row.median_income);
  if (income !== null && income > 0 && c.metrics.medianHouseholdIncome !== null) {
    incomeCompared += 1;
    if (income !== c.metrics.medianHouseholdIncome) {
      mismatches.income.push(`${label}: county_data=${income} snapshot=${c.metrics.medianHouseholdIncome}`);
    }
  }

  const poverty = row.poverty_rate === null ? null : Number(row.poverty_rate);
  if (poverty !== null && c.metrics.povertyPct !== null) {
    povertyCompared += 1;
    if (Math.abs(poverty - c.metrics.povertyPct) > POVERTY_TOLERANCE) {
      mismatches.poverty.push(
        `${label}: county_data=${poverty.toFixed(3)} snapshot=${c.metrics.povertyPct}`
      );
    }
  }
}

const report = (name, list, compared) => {
  const ok = compared - list.length;
  console.log(`  ${name.padEnd(10)} ${ok} / ${compared} match${list.length ? ` (${list.length} mismatched)` : ''}`);
  for (const m of list.slice(0, 20)) console.log(`      ${m}`);
  if (list.length > 20) console.log(`      ... and ${list.length - 20} more`);
};

console.log(`\nSnapshot: ${meta.vintage}`);
console.log(`DuckDB:   ${DB}`);
console.log(`county_data rows: ${rows.length}, snapshot counties: ${snapshot.counties.length}\n`);
report('population', mismatches.population, rows.length - missing);
report('income', mismatches.income, incomeCompared);
report('poverty', mismatches.poverty, povertyCompared);

// Population is the vintage proof. Income mismatches are fatal too; poverty is
// advisory because of the precision and universe differences noted above.
const fatal = missing + mismatches.population.length + mismatches.income.length;
console.log(
  fatal === 0
    ? `\nPASS - the snapshot reproduces county_data exactly on population and income, so both are ${meta.vintage}.\n`
    : `\nFAIL - ${fatal} fatal mismatches.\n`
);
process.exit(fatal === 0 ? 0 : 1);

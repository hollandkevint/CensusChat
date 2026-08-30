#!/usr/bin/env node
/**
 * Builds src/data/counties.json and src/data/counties.meta.json from the
 * Census API.
 *
 * Run this by hand when a new ACS vintage ships:
 *
 *   CENSUS_API_KEY=... npm run build:counties
 *
 * The snapshot is committed, so `next build` and CI need neither the API key
 * nor a network call.
 *
 * Why the Data Profile and Subject tables and not the detailed B-tables: a
 * detailed-table measure has to be assembled by summing narrow cells, and
 * getting one cell wrong produces a plausible-looking number. This repo
 * already has that bug -- backend/src/utils/acsVariablesExpanded.ts maps
 * "male 65+" to B01001_020E, which is "Male: 65 and 66 years", so the loaded
 * block-group data reports 7.8M seniors nationally instead of ~58M. Profile
 * and Subject tables publish each measure as a single cell with a
 * self-describing label, so a wrong code is caught by reading the label
 * (assertLabel below) rather than by noticing an implausible total.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VINTAGE_YEAR = 2024;
const VINTAGE_LABEL = 'American Community Survey 2020-2024 5-year estimates';
const DATASET = `acs/acs5 (${VINTAGE_YEAR})`;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

/**
 * Every metric committed to the snapshot.
 *
 * assertLabel is checked against the code's published label in the endpoint's
 * variables.json before any value is accepted. nationalRange is checked
 * against the US row. Both gates abort the run.
 */
const METRICS = [
  // --- Profile endpoint -----------------------------------------------------
  { key: 'population', endpoint: 'profile', code: 'DP05_0001E',
    label: 'Total population', unit: 'count',
    assertLabel: "Estimate!!SEX AND AGE!!Total population", nationalRange: [300e6, 360e6] },
  { key: 'medianAge', endpoint: 'profile', code: 'DP05_0018E',
    label: 'Median age', unit: 'years',
    assertLabel: "Estimate!!SEX AND AGE!!Total population!!Median age (years)", nationalRange: [30, 50] },
  { key: 'age65PlusCount', endpoint: 'profile', code: 'DP05_0024E',
    label: 'Population 65 and over', unit: 'count',
    assertLabel: "Estimate!!SEX AND AGE!!Total population!!65 years and over", nationalRange: [45e6, 75e6] },
  { key: 'age65PlusPct', endpoint: 'profile', code: 'DP05_0024PE',
    label: 'Share of population 65 and over', unit: 'percent',
    assertLabel: "Percent!!SEX AND AGE!!Total population!!65 years and over", nationalRange: [14, 22] },
  { key: 'medianHouseholdIncome', endpoint: 'profile', code: 'DP03_0062E',
    label: 'Median household income', unit: 'usd',
    assertLabel: `Estimate!!INCOME AND BENEFITS (IN ${VINTAGE_YEAR} INFLATION-ADJUSTED DOLLARS)!!Total households!!Median household income (dollars)`, nationalRange: [50e3, 120e3] },
  { key: 'povertyPct', endpoint: 'profile', code: 'DP03_0128PE',
    label: 'People below the poverty level', unit: 'percent',
    assertLabel: "Percent!!PERCENTAGE OF FAMILIES AND PEOPLE WHOSE INCOME IN THE PAST 12 MONTHS IS BELOW THE POVERTY LEVEL!!All people", nationalRange: [8, 18] },
  { key: 'bachelorsPlusPct', endpoint: 'profile', code: 'DP02_0068PE',
    label: "Bachelor's degree or higher (age 25+)", unit: 'percent',
    assertLabel: "Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!Bachelor's degree or higher", nationalRange: [25, 45] },
  { key: 'broadbandPct', endpoint: 'profile', code: 'DP02_0154PE',
    label: 'Households with a broadband subscription', unit: 'percent',
    assertLabel: "Percent!!COMPUTERS AND INTERNET USE!!Total households!!With a broadband Internet subscription", nationalRange: [80, 98] },
  { key: 'limitedEnglishPct', endpoint: 'profile', code: 'DP02_0115PE',
    label: 'Speaks English less than "very well" (age 5+)', unit: 'percent',
    assertLabel: "Percent!!LANGUAGE SPOKEN AT HOME!!Population 5 years and over!!Language other than English!!Speak English less than \"very well\"", nationalRange: [2, 20] },
  { key: 'noVehiclePct', endpoint: 'profile', code: 'DP04_0058PE',
    label: 'Occupied housing units with no vehicle', unit: 'percent',
    assertLabel: "Percent!!VEHICLES AVAILABLE!!Occupied housing units!!No vehicles available", nationalRange: [3, 15] },

  // --- Subject endpoint -----------------------------------------------------
  { key: 'age75PlusCount', endpoint: 'subject', code: 'S0101_C01_031E',
    label: 'Population 75 and over', unit: 'count',
    assertLabel: "Estimate!!Total!!Total population!!SELECTED AGE CATEGORIES!!75 years and over", nationalRange: [15e6, 35e6] },
  { key: 'uninsuredPct', endpoint: 'subject', code: 'S2701_C05_001E',
    label: 'Uninsured', unit: 'percent',
    assertLabel: "Estimate!!Percent Uninsured!!Civilian noninstitutionalized population", nationalRange: [4, 15] },
  { key: 'uninsured19to64Pct', endpoint: 'subject', code: 'S2701_C05_012E',
    label: 'Uninsured, ages 19-64', unit: 'percent',
    assertLabel: "Estimate!!Percent Uninsured!!Civilian noninstitutionalized population!!AGE!!19 to 64 years", nationalRange: [5, 20] },
  { key: 'uninsured65PlusPct', endpoint: 'subject', code: 'S2701_C05_013E',
    label: 'Uninsured, ages 65 and over', unit: 'percent',
    assertLabel: "Estimate!!Percent Uninsured!!Civilian noninstitutionalized population!!AGE!!65 years and older", nationalRange: [0.2, 4] },
  { key: 'disabilityPct', endpoint: 'subject', code: 'S1810_C03_001E',
    label: 'With a disability', unit: 'percent',
    assertLabel: "Estimate!!Percent with a disability!!Total civilian noninstitutionalized population", nationalRange: [8, 18] },
  { key: 'disability65to74Pct', endpoint: 'subject', code: 'S1810_C03_017E',
    label: 'With a disability, ages 65-74', unit: 'percent',
    assertLabel: "Estimate!!Percent with a disability!!Total civilian noninstitutionalized population!!AGE!!65 to 74 years", nationalRange: [15, 35] },
  { key: 'disability75PlusPct', endpoint: 'subject', code: 'S1810_C03_018E',
    label: 'With a disability, ages 75 and over', unit: 'percent',
    assertLabel: "Estimate!!Percent with a disability!!Total civilian noninstitutionalized population!!AGE!!75 years and over", nationalRange: [35, 60] },
];

/**
 * Fetched, cross-checked against age65PlusCount, then discarded. Two
 * independent tables must agree on the headline metric before it ships.
 */
const CROSS_CHECK = {
  endpoint: 'subject',
  code: 'S0101_C01_030E',
  assertLabel: "Estimate!!Total!!Total population!!SELECTED AGE CATEGORIES!!65 years and over",
  against: 'age65PlusCount',
};

/** 50 states plus DC. Excludes Puerto Rico (72) so the set matches county_data. */
const STATE_FIPS = new Set([
  '01', '02', '04', '05', '06', '08', '09', '10', '11', '12', '13', '15', '16',
  '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42',
  '44', '45', '46', '47', '48', '49', '50', '51', '53', '54', '55', '56',
]);

const EXPECTED_COUNTY_COUNT = 3144;

function die(message) {
  console.error(`\n[build-county-snapshot] FAILED\n${message}\n`);
  process.exit(1);
}

/** Census sentinels (-666666666 and friends) and blanks all mean "not published". */
function coerce(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n <= -100000) return null;
  return n;
}

// Decompose accents first, or "Doña Ana County" slugs to "do-a-ana-county".
function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getJson(url, what) {
  const res = await fetch(url);
  if (!res.ok) die(`${what}: HTTP ${res.status} from ${url.replace(/key=[^&]+/, 'key=***')}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    die(`${what}: response was not JSON. First 300 chars:\n${text.slice(0, 300)}`);
  }
}

/**
 * Gate (a): every code's published label must match ours exactly.
 *
 * Exact, not substring: Subject-table columns share a suffix, so
 * "AGE!!19 to 64 years" matches both S2701_C01_012E (a count) and
 * S2701_C05_012E (a percent). The column is the axis a typo moves along, so
 * a suffix check misses the failure this gate exists to catch.
 */
async function assertLabels() {
  const failures = [];
  for (const endpoint of ['profile', 'subject']) {
    const url = `https://api.census.gov/data/${VINTAGE_YEAR}/acs/acs5/${endpoint}/variables.json`;
    const { variables } = await getJson(url, `${endpoint} variables.json`);
    const checks = METRICS.filter((m) => m.endpoint === endpoint);
    if (CROSS_CHECK.endpoint === endpoint) checks.push(CROSS_CHECK);
    for (const m of checks) {
      const published = variables[m.code]?.label;
      if (!published) {
        failures.push(`${m.code}: not present in ${endpoint} variables.json`);
      } else if (published !== m.assertLabel) {
        failures.push(
          `${m.code}: expected label\n      ${JSON.stringify(m.assertLabel)}\n    but the Census Bureau publishes\n      ${JSON.stringify(published)}`
        );
      }
    }
  }
  if (failures.length) {
    die(`Variable label mismatch (${failures.length}):\n  - ${failures.join('\n  - ')}`);
  }
  console.log(`  label gate: ${METRICS.length + 1} codes verified against published labels`);
}

async function fetchRows(endpoint, geo, key) {
  const codes = METRICS.filter((m) => m.endpoint === endpoint).map((m) => m.code);
  if (CROSS_CHECK.endpoint === endpoint) codes.push(CROSS_CHECK.code);
  const url =
    `https://api.census.gov/data/${VINTAGE_YEAR}/acs/acs5/${endpoint}` +
    `?get=NAME,${codes.join(',')}&for=${geo}&key=${key}`;
  const [header, ...rows] = await getJson(url, `${endpoint} ${geo}`);
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

/** Pull the metric values out of a merged profile+subject row. */
function readMetrics(raw) {
  const out = {};
  for (const m of METRICS) out[m.key] = coerce(raw[m.code]);
  return out;
}

/** Gate (b): a mis-mapped cell shows up as an implausible national total. */
function assertNationalRanges(us) {
  const failures = [];
  for (const m of METRICS) {
    const value = us[m.key];
    const [lo, hi] = m.nationalRange;
    const ok = value !== null && value >= lo && value <= hi;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${m.key.padEnd(24)} national=${String(value).padStart(12)}  expected ${lo}..${hi}`
    );
    if (!ok) failures.push(`${m.key} (${m.code}) = ${value}, outside ${lo}..${hi}`);
  }
  if (failures.length) {
    die(`National plausibility gate (${failures.length}):\n  - ${failures.join('\n  - ')}`);
  }
}

function rankDescending(counties, field) {
  const ordered = counties
    .filter((c) => c.metrics[field] !== null)
    .sort((a, b) => b.metrics[field] - a.metrics[field]);
  ordered.forEach((c, i) => {
    c.ranks[field] = i + 1;
  });
  return ordered.length;
}

/** Nearest neighbours by senior population. Precomputed so pages stay pure rendering. */
function attachPeers(counties) {
  const pool = counties.filter((c) => c.metrics.age65PlusCount !== null);
  const sorted = [...pool].sort((a, b) => a.metrics.age65PlusCount - b.metrics.age65PlusCount);
  const index = new Map(sorted.map((c, i) => [c.fips, i]));
  for (const c of counties) {
    if (!index.has(c.fips)) {
      c.peerFips = [];
      continue;
    }
    const i = index.get(c.fips);
    const window = sorted.slice(Math.max(0, i - 5), i + 6).filter((o) => o.fips !== c.fips);
    window.sort(
      (a, b) =>
        Math.abs(a.metrics.age65PlusCount - c.metrics.age65PlusCount) -
        Math.abs(b.metrics.age65PlusCount - c.metrics.age65PlusCount)
    );
    c.peerFips = window.slice(0, 5).map((o) => o.fips);
  }
}

/** Same-state counties closest in total population. Not the whole state -- Texas has 254. */
function attachStateNeighbors(counties) {
  const byState = new Map();
  for (const c of counties) {
    if (!byState.has(c.stateFips)) byState.set(c.stateFips, []);
    byState.get(c.stateFips).push(c);
  }
  for (const group of byState.values()) {
    for (const c of group) {
      c.stateNeighborFips = group
        .filter((o) => o.fips !== c.fips && o.metrics.population !== null)
        .sort(
          (a, b) =>
            Math.abs(a.metrics.population - c.metrics.population) -
            Math.abs(b.metrics.population - c.metrics.population)
        )
        .slice(0, 5)
        .map((o) => o.fips);
    }
  }
}

async function main() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    die(
      'CENSUS_API_KEY is not set.\n' +
        '  Get a free key at https://api.census.gov/data/key_signup.html, then run:\n' +
        '    CENSUS_API_KEY=your-key npm run build:counties'
    );
  }

  console.log(`[build-county-snapshot] ${VINTAGE_LABEL}`);
  await assertLabels();

  const [profCounty, subjCounty, profState, subjState, profUs, subjUs] = await Promise.all([
    fetchRows('profile', 'county:*', key),
    fetchRows('subject', 'county:*', key),
    fetchRows('profile', 'state:*', key),
    fetchRows('subject', 'state:*', key),
    fetchRows('profile', 'us:1', key),
    fetchRows('subject', 'us:1', key),
  ]);

  // --- National -------------------------------------------------------------
  const usRaw = { ...profUs[0], ...subjUs[0] };
  const national = readMetrics(usRaw);
  console.log('\n  national plausibility gate:');
  assertNationalRanges(national);

  // --- States ---------------------------------------------------------------
  const subjStateByFips = new Map(subjState.map((r) => [r.state, r]));
  const states = {};
  for (const row of profState) {
    if (!STATE_FIPS.has(row.state)) continue;
    states[row.state] = {
      fips: row.state,
      name: row.NAME,
      slug: slugify(row.NAME),
      metrics: readMetrics({ ...row, ...(subjStateByFips.get(row.state) ?? {}) }),
    };
  }

  // --- Counties -------------------------------------------------------------
  const subjCountyByFips = new Map(subjCounty.map((r) => [r.state + r.county, r]));
  const counties = [];
  const crossCheckFailures = [];

  for (const row of profCounty) {
    if (!STATE_FIPS.has(row.state)) continue;
    const fips = row.state + row.county;
    const merged = { ...row, ...(subjCountyByFips.get(fips) ?? {}) };
    const metrics = readMetrics(merged);

    // Gate (c1): two independent tables must agree on the headline metric.
    const alt = coerce(merged[CROSS_CHECK.code]);
    if (metrics[CROSS_CHECK.against] !== alt) {
      crossCheckFailures.push(
        `${row.NAME}: ${CROSS_CHECK.against}=${metrics[CROSS_CHECK.against]} but ${CROSS_CHECK.code}=${alt}`
      );
    }

    // "Los Angeles County, California" -> name + state name.
    const comma = row.NAME.lastIndexOf(',');
    const countyName = row.NAME.slice(0, comma).trim();
    const stateName = row.NAME.slice(comma + 1).trim();

    counties.push({
      fips,
      stateFips: row.state,
      countyFips: row.county,
      name: countyName,
      stateName,
      slug: slugify(countyName),
      stateSlug: slugify(stateName),
      metrics,
      ranks: {},
      peerFips: [],
      stateNeighborFips: [],
    });
  }

  if (crossCheckFailures.length) {
    die(
      `${CROSS_CHECK.code} disagrees with ${CROSS_CHECK.against} for ${crossCheckFailures.length} counties:\n  - ` +
        crossCheckFailures.slice(0, 10).join('\n  - ')
    );
  }
  console.log(`\n  cross-check gate: ${CROSS_CHECK.code} agrees with ${CROSS_CHECK.against} for all counties`);

  if (counties.length !== EXPECTED_COUNTY_COUNT) {
    die(`Expected ${EXPECTED_COUNTY_COUNT} counties, got ${counties.length}.`);
  }

  const seen = new Set();
  for (const c of counties) {
    const path = `${c.stateSlug}/${c.slug}`;
    if (seen.has(path)) die(`Duplicate route slug: ${path} (${c.fips})`);
    seen.add(path);
  }
  console.log(`  slug gate: ${counties.length} unique routes`);

  const rankedPop = rankDescending(counties, 'population');
  const ranked65 = rankDescending(counties, 'age65PlusPct');
  const ranked65Count = rankDescending(counties, 'age65PlusCount');

  attachPeers(counties);
  attachStateNeighbors(counties);

  counties.sort((a, b) => a.fips.localeCompare(b.fips));

  mkdirSync(OUT_DIR, { recursive: true });
  const dataPath = join(OUT_DIR, 'counties.json');
  const metaPath = join(OUT_DIR, 'counties.meta.json');

  writeFileSync(dataPath, JSON.stringify({ counties, states, national }));
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        vintage: VINTAGE_LABEL,
        vintageYear: VINTAGE_YEAR,
        dataset: DATASET,
        source: 'U.S. Census Bureau, American Community Survey',
        sourceUrl: `https://api.census.gov/data/${VINTAGE_YEAR}/acs/acs5`,
        generatedOn: new Date().toISOString().slice(0, 10),
        countyCount: counties.length,
        rankedOnPopulation: rankedPop,
        rankedOnAge65PlusPct: ranked65,
        rankedOnAge65PlusCount: ranked65Count,
        metrics: METRICS.map(({ key: k, endpoint, code, label, unit }) => ({
          key: k,
          code,
          table: code.split('_')[0],
          endpoint: `acs5/${endpoint}`,
          label,
          unit,
        })),
      },
      null,
      2
    )
  );

  const mb = (p) => (Buffer.byteLength(JSON.stringify(p)) / 1e6).toFixed(2);
  console.log(`\n  wrote ${dataPath} (${mb({ counties, states, national })} MB)`);
  console.log(`  wrote ${metaPath}`);
  console.log(`  ${counties.length} counties, ${Object.keys(states).length} states, ${VINTAGE_LABEL}\n`);
}

main();

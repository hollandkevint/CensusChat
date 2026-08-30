---
title: Public Precomputed County Pages - Plan
type: feat
date: 2026-08-29
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Public Precomputed County Pages - Plan

## Goal Capsule

- **Objective:** A healthcare strategy analyst who has never signed up for CensusChat can land on a page for any US county from a search engine, read correct, sourced demographics that answer a real market-sizing question, and carry a county-specific follow-up into the live chat.
- **Means:** Statically generate one Next.js App Router page per county from a committed ACS 2020-2024 5-year snapshot, with no LLM call and no database access at render time (KTD1, KTD2).
- **Authority hierarchy:** Product Contract requirements (R-IDs) win on behavior. KTDs win on mechanism inside those requirements. Units override neither.
- **Execution profile:** Verify a 10-county subset rendered in a browser before generating all counties (R14). Measure `next build` on the subset and on the full set; record both numbers (R15).
- **Stop conditions:** Stop and report if a snapshot value fails a cross-check in U2 or U3. Do not publish a page carrying an unverified figure.
- **Tail ownership:** LFG owns commit, push, PR, and CI.

---

## Product Contract

### Summary

Add a public `/counties` section to the Next.js frontend. One page per US county renders healthcare-relevant demographics from a JSON snapshot committed to the repo. The snapshot is produced by a script that pulls county, state, and national figures from the Census API at a single ACS vintage, asserts every variable's published label before accepting it, and cross-checks its own output against the existing `county_data` table. Pages state their vintage and per-metric variable code, place every figure next to state and national benchmarks, rank the county nationally, link to peer and sibling counties, and deep-link into the chat with a county-scoped question.

### Problem Frame

CensusChat has exactly one page today: the chat at `frontend/src/app/page.tsx`. A visitor must know what to ask before the product shows them anything, and there is no surface a search engine can index. Nothing demonstrates the data without a running backend, a DuckDB file, and an Anthropic key.

The data the product would naturally reach for is not trustworthy. `block_group_data_expanded`, `tract_data`, and `state_data` in `backend/data/census.duckdb` carry age brackets built from single narrow ACS cells rather than bracket sums: `age_65_plus` totals 7.8M nationally against a true figure near 58M, because `backend/src/utils/acsVariablesExpanded.ts` maps `male65plus` to `B01001_020E`, which is "Male: 65 and 66 years". `uninsured_65_plus` totals 13.3M against a true figure under 1M. `poverty_rate`, `disability_rate`, `with_broadband_pct`, `seniors_living_alone_pct`, and `retirement_income` are constant zero across all 239,741 rows. `median_age` holds `-666666666` Census sentinels. Publishing the product's headline metric from that table would put a figure roughly seven times wrong on the open web.

`county_data` is clean but carries only `population`, `median_income`, and `poverty_rate` - no age, no coverage, no disability, no access. It cannot answer a healthcare strategy question on its own.

### Key Decisions

- **Pages are public with no account.** Governs R1. (session-settled: user-directed - chosen over gating behind signup: the pages are the zero-setup demo surface.)
- **No LLM call at render time.** Governs R2, R3. (session-settled: user-directed - chosen over server-side generation per visit: pages must cost nothing per visitor.)
- **Every page states its ACS vintage and source.** Governs R9, R10. (session-settled: user-directed - chosen over omitting provenance: the repo has a known vintage inconsistency and the pages carry numbers a reader will act on.)
- **Every page deep-links into the chat with a county-scoped question.** Governs R11. (session-settled: user-directed - chosen over a generic chat link: the pages are a funnel into the product.)
- **The template must be substantively useful, not a repeated stat table.** Governs R5, R6, R7, R8. (session-settled: user-directed - chosen over a minimal per-county data dump: near-duplicate programmatic pages are search-penalized and deserve to be.)
- **No figure is invented, interpolated, or estimated; a missing value renders as missing.** Governs R12, R13. (session-settled: user-directed - chosen over imputing gaps: correctness is the product's entire claim.)
- **No authentication, billing, or accounts.** Governs R1. (session-settled: user-directed - chosen over adding an account layer: explicitly out of scope.)
- **Backend census loader files are not modified.** Governs R16. (session-settled: user-directed - chosen over fixing the loaders in place: open PR #54 touches `backend/src/utils/censusDataLoader.ts` and `backend/src/services/censusApiService.ts`.)

### Requirements

**Public surface**

- R1. `/counties` and every county page render for an anonymous visitor with no account, no cookie, and no backend process running.
- R2. A county page performs no LLM call and no database query at render time.
- R3. A county page's data comes from a JSON file committed to the repo, read at build time.
- R4. Route shape is `/counties/[state]/[county]`, slugged from state and county name (`/counties/california/los-angeles-county`). `/counties` lists every county grouped by state.

**Page content**

- R5. The page leads with the Medicare-eligible market: population 65 and over as a count and as a share of total population, and population 75 and over as a count and as a share of the 65-and-over cohort.
- R6. The page reports coverage and access: uninsured rate overall, for ages 19-64, and for ages 65 and over; disability rate overall, for ages 65-74, and for ages 75 and over; households without a vehicle; households with a broadband subscription; population speaking English less than "very well".
- R7. Every metric appears beside its state value and its national value, with the county-to-national difference shown.
- R8. The page shows the county's national rank on share of population 65 and over and on total population, links to the five counties nationally closest in population 65 and over, links to the five counties in the same state closest in total population, and links to the state's full list on `/counties`. It does not list every county in the state; Texas has 254, and repeating them on each of 254 pages is the near-duplicate boilerplate R5 through R8 exist to avoid.
- R9. The page states the ACS vintage in words on the page body, not only in metadata: "American Community Survey 2020-2024 5-year estimates, U.S. Census Bureau".
- R10. Each metric displays the ACS variable code it came from and the table family that code belongs to.
- R11. The page offers at least three county-scoped questions, each linking to `/?q=<url-encoded question>`, and the chat prefills its input from that parameter.

**Data integrity**

- R12. Every figure on every page traces to a value returned by the Census API for that county at the stated vintage. No figure is computed by interpolation, imputation, or estimation. Shares and differences computed from two figures of the same vintage are permitted and are labeled as derived.
- R13. A metric absent for a county renders as an em dash with the note that the Census Bureau does not publish that estimate for this county. It never renders as zero and never falls back to a state or national value.
- R14. A 10-county subset is generated and checked in a browser before all counties are generated.
- R15. `next build` wall-clock time and generated output size are measured on the subset and on the full set. The measurements and the resulting static-versus-ISR decision are recorded.
- R16. No file under `backend/` is modified.

### Success Criteria

- Los Angeles County's page shows 1,487,700 people aged 65 and over at 15.2% of population, matching the ACS 2024 5-year API exactly.
- The snapshot's `population`, `median household income`, and `poverty rate` for all 3,144 counties reproduce `county_data` to within rounding, proving the snapshot shares that table's vintage.
- `npm run lint` and `npm run typecheck` pass in `frontend/`.
- CI passes, including the existing frontend build job.

### Scope Boundaries

In scope: the `/counties` route tree, the snapshot generator, the snapshot data file, a sitemap, and a query-prefill on the chat input.

Deferred: fixing the ACS variable mapping in `backend/src/utils/acsVariablesExpanded.ts`; sub-county (tract, block group, ZIP) pages; Medicaid and dual-eligible coverage measures from table S2704; automated snapshot refresh in CI; a state-level landing page.

Outside this product's identity: authentication, billing, accounts, per-visitor personalization.

### Sources

- ACS variable labels confirmed against `https://api.census.gov/data/2024/acs/acs5/profile/variables.json` and `.../acs5/subject/variables.json`.
- Vintage confirmed by comparing `county_data` Los Angeles County (`population` 9808667, `median_income` 90112) against the ACS 2022, 2023, and 2024 5-year county endpoints. Only 2024 matches. `block_group_data_expanded` LA population 9848406 matches ACS 2023, a different vintage in the same file.
- Corruption confirmed by national rollup of `block_group_data_expanded` against published national totals.
- Existing chat input state: `frontend/src/components/ChatInterface.tsx:24`.
- CI frontend job: `.github/workflows/ci.yml`, runs `npm run lint`, `npm run typecheck`, `npm run build` in `frontend/`.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Build the snapshot from the Census API at ACS 2020-2024 5-year, not from DuckDB.** Governs R3, R5, R6, R12. `county_data` is the only clean table in `backend/data/census.duckdb`, and it holds three metrics. The tables that nominally hold the healthcare metrics are corrupt at exactly those columns. The API returns all 3,222 county-equivalents in one request per endpoint, in under three seconds. Using it keeps one vintage across every number on every page, needs no DuckDB in CI, and needs no API key at build time once the snapshot is committed. (session-settled: user-directed - chosen over sourcing pages from `county_data` alone, which yields the thin three-number page the settled template decision forbids, and over rolling up `block_group_data_expanded`, which would publish a 65-and-over figure roughly seven times wrong: the source constraint exists to prevent invented figures, and the block-group path invents worse ones.)

  The snapshot is not a departure from `county_data` so much as a superset of it at the same vintage: the API's `DP05_0001E`, `DP03_0062E`, and `DP03_0128PE` returned 9808667, 90112, and 13.7 for Los Angeles County, matching `county_data`'s `population`, `median_income`, and `poverty_rate` exactly. U3 turns that into an enforced check across all 3,144 counties.

- KTD2. **Use Data Profile and Subject tables, not detailed B-tables.** Governs R5, R6, R10, R12. Detailed tables require summing narrow cells - the exact operation the existing loader got wrong six times. Profile and Subject tables give each measure as a single cell with a self-describing published label, so a wrong code is caught by reading the label rather than by noticing an implausible total. Two endpoints, `acs5/profile` and `acs5/subject`, cover the full metric set.

- KTD3. **The generator asserts before it writes.** Governs R12. Three gates, all failing the run loudly: (a) each variable code's `label` in the endpoint's `variables.json` must match an expected substring declared beside the code; (b) each metric's national value must fall inside a declared plausible range; (c) `population`, `median household income`, and `poverty rate` must match `county_data` for a sampled set of counties. Gate (a) is the one that would have caught the existing bug.

- KTD4. **Precompute ranks and peers into the snapshot.** Governs R8. Nearest-peer selection over 3,144 counties is 10M comparisons. Doing it once in the generator costs nothing and leaves the page component as pure rendering. Peers are stored as 5-character FIPS codes to keep the file small.

- KTD5. **Deep-link via `?q=` read from `window.location.search` in `ChatInterface`.** Governs R11. `useSearchParams` in Next 15 forces the consuming route into a Suspense boundary and opts it out of static rendering. Reading `window.location.search` once in an existing effect prefills the input with no prop plumbing, no new boundary, and no change to `frontend/src/app/page.tsx`. The value prefills the input; it does not auto-send.

- KTD6. **Decide full static generation against ISR from a measurement, not a prior.** Governs R15. Generate 10 counties, time `next build`, then generate all and time it again. If the full build adds more than three minutes over the subset build, switch `generateStaticParams` to return the 250 most populous counties, set `export const dynamicParams = true` and `export const revalidate = 604800`, and record the switch. `next.config.ts` already sets `output: "standalone"`, so the Docker runtime runs a Node server and ISR works there.

### High-Level Technical Design

```
Census API (ACS 2020-2024 5-year)
  acs5/profile   for=county:* , for=state:* , for=us:1
  acs5/subject   for=county:* , for=state:* , for=us:1
        |
        |  frontend/scripts/build-county-snapshot.mjs
        |    - fetch variables.json, assert every label      (KTD3a)
        |    - fetch 6 result sets
        |    - filter to the 3,144 state+DC counties
        |    - assert national plausibility ranges           (KTD3b)
        |    - assert against county_data sample             (KTD3c)
        |    - compute national ranks and nearest peers      (KTD4)
        v
frontend/src/data/counties.json         (committed, ~1 MB)
frontend/src/data/counties.meta.json    (committed: vintage, dataset, per-metric codes and labels, generated date)
        |
        |  frontend/src/lib/counties.ts  (typed read, slug helpers, lookup)
        v
/counties                      index, grouped by state
/counties/[state]/[county]     generateStaticParams + generateMetadata
/sitemap.xml                   every county URL
        |
        v
/?q=<county-scoped question>   ChatInterface prefills its input   (KTD5)
```

### Metric set

Each row is one committed metric. The `Assert label contains` column is the string U1 checks against the published `variables.json` label before the value is accepted.

| Key | Endpoint | Code | Assert label contains |
|---|---|---|---|
| `population` | profile | `DP05_0001E` | `SEX AND AGE!!Total population` |
| `medianAge` | profile | `DP05_0018E` | `Median age (years)` |
| `age65PlusCount` | profile | `DP05_0024E` | `65 years and over` |
| `age65PlusPct` | profile | `DP05_0024PE` | `65 years and over` |
| `medianHouseholdIncome` | profile | `DP03_0062E` | `Median household income (dollars)` |
| `povertyPct` | profile | `DP03_0128PE` | `BELOW THE POVERTY LEVEL!!All people` |
| `bachelorsPlusPct` | profile | `DP02_0068PE` | `Bachelor's degree or higher` |
| `broadbandPct` | profile | `DP02_0154PE` | `With a broadband Internet subscription` |
| `limitedEnglishPct` | profile | `DP02_0115PE` | `Speak English less than "very well"` |
| `noVehiclePct` | profile | `DP04_0058PE` | `No vehicles available` |
| `age75PlusCount` | subject | `S0101_C01_031E` | `SELECTED AGE CATEGORIES!!75 years and over` |
| `uninsuredPct` | subject | `S2701_C05_001E` | `Percent Uninsured!!Civilian noninstitutionalized population` |
| `uninsured19to64Pct` | subject | `S2701_C05_012E` | `19 to 64 years` |
| `uninsured65PlusPct` | subject | `S2701_C05_013E` | `65 years and older` |
| `disabilityPct` | subject | `S1810_C03_001E` | `Percent with a disability` |
| `disability65to74Pct` | subject | `S1810_C03_017E` | `65 to 74 years` |
| `disability75PlusPct` | subject | `S1810_C03_018E` | `75 years and over` |

`S0101_C01_030E` (65 years and over) is fetched as a redundant cross-check against `DP05_0024E`; the two must agree exactly or the run fails. It is not stored.

### Assumptions

- The Census API stays reachable during snapshot generation. It is not needed at build time, in CI, or at request time.
- `CENSUS_API_KEY` is available in the developer's environment when regenerating the snapshot. It never enters the repo.
- The 3,144 rows in `county_data` are the target set. `for=county:*` returns 3,222; the surplus is Puerto Rico municipios and is filtered out by state FIPS.
- Census sentinel values (`-666666666` and similar large negatives) mean "not published" and route to R13's missing rendering.

### Sequencing

U1 produces the snapshot the rest depends on. U2 and U3 harden it. U4 through U7 build the surface. U8 measures and decides scale. U2 and U3 must both pass before U4 starts, because a page built on an unchecked snapshot is the failure this plan exists to prevent.

### Risks & Dependencies

- **Committing a 1 MB JSON to the repo.** Accepted: it removes the API key, the network, and DuckDB from every build. Regeneration is one command.
- **The snapshot goes stale when ACS publishes a new vintage.** Mitigated by stating the vintage on every page and in `counties.meta.json`. Automated refresh is deferred.
- **3,144 pages inflate the Docker image.** Measured in U8; the ISR fallback in KTD6 bounds it.
- **PR #54 conflict.** Avoided by R16. No file under `backend/` is touched. `backend/src/utils/acsVariablesExpanded.ts` stays wrong; the defect is recorded, not fixed here.

---

## Implementation Units

### U1. Snapshot generator

- **Goal:** One script produces a committed, label-verified county snapshot at a single ACS vintage.
- **Requirements:** R3, R12, R16
- **Files:** `frontend/scripts/build-county-snapshot.mjs` (new); `frontend/package.json` (add `"build:counties"` script)
- **Approach:** Plain Node ESM, global `fetch`, no new dependency. Declare the metric table from the Planning Contract as a literal in the script. Fetch `variables.json` for both endpoints and assert each code's label contains its expected substring (KTD3a); abort on the first mismatch, naming the code, the expected substring, and the published label. Fetch six result sets: county, state, and US for each endpoint. Merge on state and county FIPS. Filter to state FIPS in the 50 states plus `11`, excluding `72`. Coerce values: a numeric string becomes a number; a value at or below `-666666666`, an empty string, or `null` becomes `null`. Assert `DP05_0024E` equals `S0101_C01_030E` for every county. Write `frontend/src/data/counties.json` and `frontend/src/data/counties.meta.json`. Read the key from `process.env.CENSUS_API_KEY` and exit with a clear message when it is unset.
- **Test scenarios:** A deliberately wrong code (`DP05_0025E` in place of `DP05_0024E`) aborts the run with a label mismatch. A missing `CENSUS_API_KEY` exits non-zero with an actionable message. The written file has exactly 3,144 county entries. A county whose `medianHouseholdIncome` the Census Bureau does not publish is stored as `null`, never `0` and never `-666666666`. `DP05_0024E` and `S0101_C01_030E` disagreeing aborts the run.
- **Verification:** `CENSUS_API_KEY=... npm run build:counties` in `frontend/` writes both files and prints the county count, the vintage, and the file sizes.

### U2. National plausibility gate

- **Goal:** An implausible national total stops the snapshot before it is committed.
- **Requirements:** R12
- **Files:** `frontend/scripts/build-county-snapshot.mjs`
- **Approach:** Declare a plausible range beside each metric. Assert the fetched US row falls inside every range. Report every violation before exiting, not just the first. Ranges are wide enough to survive a vintage change and narrow enough to catch a mis-mapped cell: population 300M-360M; `age65PlusPct` 14-22; `age65PlusCount` 45M-75M; `uninsuredPct` 4-15; `uninsured65PlusPct` 0.2-4; `disabilityPct` 8-18; `povertyPct` 8-18; `broadbandPct` 80-98.
- **Test scenarios:** Swapping `age65PlusCount`'s code for a narrow single-year cell drives the national total to roughly 7M and trips the 45M floor - the check that would have caught the existing `block_group_data_expanded` defect. All ranges pass on the real ACS 2024 data.
- **Verification:** The generator prints each metric's national value beside its range and a pass marker.

### U3. Cross-check against county_data

- **Goal:** Prove the snapshot shares `county_data`'s vintage rather than asserting it.
- **Requirements:** R12, R16
- **Files:** `frontend/scripts/check-snapshot-vs-duckdb.mjs` (new, developer-only, not run in CI)
- **Approach:** A separate script so the generator keeps no DuckDB dependency. Open a copy of `census.duckdb` read-only - copy the `.duckdb` file alone, because its `.wal` is corrupt and replaying it raises `Catalog Error: Table with name "county_data" already exists`. Compare `population`, `median_income`, and `poverty_rate` for all 3,144 counties against the snapshot's `population`, `medianHouseholdIncome`, and `povertyPct`. Population is the vintage proof and must match exactly for all 3,144; any mismatch fails the run. Income must match exactly wherever `county_data` publishes it. Poverty rate is compared with a 0.15 tolerance, because `county_data` stores full precision while the Data Profile publishes one decimal, and the two may be derived from different universes; poverty mismatches are reported, not fatal. Report the count matched, the count mismatched, and every mismatching county by FIPS and name.
- **Test scenarios:** All 3,144 counties match on population, and a single population mismatch fails the run. All counties with a published income match on income. Poverty rate matches within 0.15 for every county, or the outliers are listed. Any mismatch is listed by FIPS and name, not summarized as a count.
- **Verification:** Run the script and record its summary line in the PR body. This is the evidence that the snapshot is the same vintage as the table the task named.

### U4. Typed data access

- **Goal:** Pages read the snapshot through one typed module.
- **Requirements:** R3, R4, R7, R8, R13
- **Files:** `frontend/src/lib/counties.ts` (new); `frontend/src/data/counties.json`, `frontend/src/data/counties.meta.json` (generated by U1)
- **Approach:** Export a `County` type with every metric typed `number | null`. Export `getAllCounties()`, `getCounty(stateSlug, countySlug)`, `getStateCounties(stateSlug)`, `getPeers(county)`, and the state and national benchmark rows. Slug helper lowercases, strips punctuation, and joins on hyphens; assert at module load that all 3,144 slugs are unique. `resolveJsonModule` is already enabled in `frontend/tsconfig.json`. This module is server-only: no file carrying `'use client'` may import it, or the 1 MB snapshot ships to the browser. Keep the slug helper in a separate dependency-free module if a client component ever needs it.
- **Test scenarios:** All 3,144 `state/county` slug pairs are unique. `getCounty` on an unknown slug returns `undefined`. A county with a `null` metric keeps it `null` through the accessor - no coercion to `0`. No client component imports this module: `rg -l "lib/counties" frontend/src` returns no file containing `'use client'`.
- **Verification:** `npm run typecheck` in `frontend/`.

### U5. County page template

- **Goal:** One page a healthcare strategy reader would keep open.
- **Requirements:** R1, R2, R4, R5, R6, R7, R9, R10, R11, R13
- **Files:** `frontend/src/app/counties/[state]/[county]/page.tsx` (new); `frontend/src/components/county/MetricTable.tsx`, `frontend/src/components/county/StatCard.tsx`, `frontend/src/components/county/ProvenanceNote.tsx`, `frontend/src/components/county/ChatCta.tsx` (new)
- **Approach:** Server component, no `'use client'`. Sections in order: header with county, state, and FIPS; a Medicare-eligible market panel of stat cards (65+ count, 65+ share with national delta, 75+ count, 75+ as a share of the 65+ cohort); a coverage and access metric table; a socioeconomic metric table; a comparison panel with national rank and peer and sibling county links; the provenance note; the chat call to action. Every `MetricTable` row carries county, state, and national columns, the county-to-national difference, and the ACS variable code. A `null` renders as an em dash with a footnote marker resolving to "The Census Bureau does not publish this estimate for this county." `generateMetadata` sets a title and description built from real figures. Tailwind classes only, matching the existing palette in `frontend/src/app/page.tsx`.
- **Test scenarios:** Los Angeles County renders 1,487,700 for 65 and over and 15.2% for its share. A county with a suppressed metric shows an em dash and the footnote, not `0` and not the state value. The vintage string appears in the page body text. Every metric row shows its variable code. Peer links resolve to real routes. The page contains no `'use client'` directive.
- **Verification:** `npm run dev` in `frontend/`, load `/counties/california/los-angeles-county`, compare every figure against a live `acs5/profile` and `acs5/subject` call for FIPS `06037`.

### U6. Index, sitemap, and static params

- **Goal:** Search engines and humans can reach every county page.
- **Requirements:** R1, R4, R14
- **Files:** `frontend/src/app/counties/page.tsx` (new); `frontend/src/app/counties/[state]/[county]/page.tsx` (add `generateStaticParams`); `frontend/src/app/sitemap.ts` (new); `frontend/src/app/layout.tsx` (replace the `create-next-app` default metadata)
- **Approach:** The index groups counties by state with a count per state. `generateStaticParams` reads the county list from `frontend/src/lib/counties.ts` and returns every `{ state, county }` pair - initially limited to a 10-county subset for R14, then unlimited. `sitemap.ts` emits `/`, `/counties`, and every county URL, using `NEXT_PUBLIC_SITE_URL` with a localhost default. Update `layout.tsx` metadata, which still says "Create Next App".
- **Test scenarios:** The subset build emits exactly 10 county pages. The full build emits 3,144. `/counties` links to every state group. `sitemap.xml` contains 3,146 URLs. An unknown county slug returns 404.
- **Verification:** `npm run build` in `frontend/`; count the generated route entries in the build output.

### U7. Chat deep link

- **Goal:** A county page's question arrives prefilled in the chat.
- **Requirements:** R11
- **Files:** `frontend/src/components/ChatInterface.tsx` (edit); `frontend/e2e/county-pages.spec.ts` (new)
- **Approach:** In `ChatInterface`, add one mount effect reading `window.location.search`; when `q` is present and non-empty, `setInput` to its decoded value. Do not auto-send. `ChatCta` builds three questions from the county's real figures, for example "How many of the 1,487,700 residents aged 65 and over in Los Angeles County, California live below the poverty line?", each linking to `/?q=<encodeURIComponent(question)>`.
- **Test scenarios:** Loading `/?q=test%20question` prefills the input with `test question` and sends nothing. Loading `/` with no parameter leaves the input empty and preserves the existing greeting message. A question containing an ampersand and a percent sign survives the round trip. Clicking a chat call-to-action link from a county page lands on `/` with the input prefilled.
- **Verification:** `npm run test:e2e` in `frontend/`.

### U8. Measure, then decide scale

- **Goal:** The static-versus-ISR choice rests on a measurement.
- **Requirements:** R14, R15
- **Files:** `frontend/src/app/counties/[state]/[county]/page.tsx` (`generateStaticParams`, possibly `dynamicParams` and `revalidate`)
- **Approach:** Run `npm run build` with the 10-county subset and record wall-clock time and `.next` size. Verify the 10 pages in a browser (R14). Then lift the limit, rebuild, and record both numbers again. Apply KTD6's threshold. Record both measurements and the decision in the PR body.
- **Test scenarios:** The subset build is timed and its pages are visually verified before the full build runs. The full build completes without an out-of-memory failure; if it exhausts the heap, raise it with `NODE_OPTIONS=--max-old-space-size=4096` and record that CI needs the same setting. If ISR is selected, a county outside `generateStaticParams` still renders on first request.
- **Verification:** `time npm run build` in `frontend/` for both configurations; `du -sh frontend/.next` after each.

---

## Verification Contract

Run from `frontend/`:

| Gate | Command | Passes when |
|---|---|---|
| Lint | `npm run lint` | No errors |
| Types | `npm run typecheck` | No errors |
| Build | `npm run build` | Completes; county route count matches the configured set |
| Browser e2e | `npm run test:e2e` | `chat.spec.ts` and `county-pages.spec.ts` pass |
| Snapshot integrity | `npm run build:counties` | Label, plausibility, and redundancy gates all pass |
| Vintage proof | `node scripts/check-snapshot-vs-duckdb.mjs` | 3,144 of 3,144 counties match on population |

CI runs lint, typecheck, and build for the frontend, and the Playwright e2e job, per `.github/workflows/ci.yml`. The snapshot generator and the DuckDB cross-check are developer-run; CI reads only the committed JSON.

Manual gate, required by R14 and not replaceable by a test: load the 10-county subset in a browser and compare each figure against a live Census API call for that county's FIPS before generating the remaining 3,134.

---

## Definition of Done

Global:

- All 17 metrics on a county page trace to a Census API value at ACS 2020-2024 5-year, and the generator's three gates pass.
- The DuckDB cross-check reports 3,144 of 3,144 counties matching on population.
- The vintage appears in the body text of every county page.
- Every metric row shows its ACS variable code.
- No file under `backend/` is modified.
- `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` pass in `frontend/`.
- Build time and page count are measured for both the subset and the full set, and the scale decision is recorded.
- The PR body carries the rendered output of at least one real county page, the confirmed vintage with how it was confirmed, and the build measurement.
- Experimental scaffolding, scratch scripts, and abandoned approaches are removed from the diff.

Per unit: each unit's Verification line passes, and its test scenarios are covered by the named test file or by a recorded manual check.

---

## Appendix: recorded defects in existing data

Not fixed here (R16). Recorded so the next person does not rediscover them.

| Column | Loader mapping | Published label of that code | National total | True |
|---|---|---|---|---|
| `age_5_17` | `B01001_004E` + `B01001_028E` | Male / Female: 5 to 9 years | 20.1M | ~53M |
| `age_18_64` | `B01001_007E` + `B01001_031E` | Male / Female: 18 and 19 years | 8.8M | ~200M |
| `age_65_plus` | `B01001_020E` + `B01001_044E` | Male / Female: 65 and 66 years | 7.8M | ~58M |
| `uninsured_65_plus` | `B27010_050E` | Not the 65+ no-coverage cell | 13.3M | <1M |
| `work_from_home` | `B08303_013E` | A commute-duration bucket | 3.8M | ~19M |

Constant zero across all 239,741 rows of `block_group_data_expanded`: `poverty_rate`, `disability_rate`, `with_broadband_pct`, `seniors_living_alone_pct`, `retirement_income`. `median_age` holds `-666666666` sentinels.

Columns that check out against published national totals: `population`, `male_population`, `female_population`, `under_5`, `white_alone`, `black_alone`, `asian_alone`, `hispanic_latino`, `total_housing_units`, `vacant_units`, `snap_benefits`, the `income_*` buckets, `single_family_homes`, `mobile_homes`.

Two vintages coexist in `backend/data/census.duckdb`: `county_data` is ACS 2020-2024 5-year; `block_group_data_expanded`, `tract_data`, and `state_data` are ACS 2019-2023 5-year.

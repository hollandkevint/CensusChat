# CensusChat

Ask US Census demographics a question in plain English. Claude turns it into SQL, a validation layer checks the SQL against an allowlist, and DuckDB answers it.

[![DuckDB 1.4](https://img.shields.io/badge/DuckDB-1.4.3-blue?style=flat-square)](docs/references/duckdb/)
[![MCP HTTP](https://img.shields.io/badge/MCP-HTTP%20Transport-success?style=flat-square)](docs/implementation/MCP_IMPLEMENTATION_SUMMARY.md)
[![Agent SDK](https://img.shields.io/badge/Claude-Agent%20SDK-purple?style=flat-square)](backend/src/agent/)

---

## Example

**Question:** which Florida counties have the most residents aged 65 and over?

| County | Population | Age 65+ | Age 65+ % | Median household income | National rank, 65+ count |
|---|---|---|---|---|---|
| Miami-Dade County | 2,738,356 | 463,896 | 16.9% | $71,753 | 7 |
| Palm Beach County | 1,533,806 | 380,989 | 24.8% | $83,581 | 11 |
| Broward County | 1,977,129 | 354,411 | 17.9% | $77,633 | 13 |
| Pinellas County | 963,481 | 254,248 | 26.4% | $72,646 | 25 |
| Lee County | 817,666 | 236,549 | 28.9% | $76,107 | 30 |

Those are real values, read from [`frontend/src/data/counties.json`](frontend/src/data/counties.json) — the committed county snapshot, ACS 2020-2024 5-year estimates. The same rows render at `/counties/florida/pinellas-county`, and you can serve that page in about a minute with no API key.

**Who this is for:** A healthcare strategy analyst deciding where to expand services, place facilities, or investigate a market. CensusChat is meant to shorten the first demographic cut from a custom SQL request to a reviewable answer. It does not replace source review or a formal market study.

---

## Run it

### Fast path — county pages, no keys, no database

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000/counties/florida/pinellas-county>. The county pages read the committed JSON snapshot, so they need no backend, no DuckDB file, and no API key.

### Full path — the chat interface

The chat needs an Anthropic key, a Census API key, and a populated DuckDB file.

1. **Keys.** See [API_KEY_SETUP.md](API_KEY_SETUP.md). Put both in `backend/.env`.
2. **Data.** `cd backend && ./scripts/setup-database.sh`. This pulls from the Census API and takes hours, not minutes.
3. **Start.** `./demo-setup.sh`, then open <http://localhost:3000>.

Longer version: [QUICK_START.md](QUICK_START.md).

### As an MCP server

`backend/src/mcp/stdioServer.ts` runs standalone over stdio, so Claude Desktop can query the same DuckDB file without the web app. Setup: [docs/guides/MCP_STDIO_SETUP.md](docs/guides/MCP_STDIO_SETUP.md).

---

## Project status

Read this before you invest an afternoon.

- **No authentication.** `backend/src/routes/auth.routes.ts` is four handlers that return `"...to be implemented"`. Register, login, refresh, and logout do nothing.
- **No billing, no accounts, no signup.** Nothing to buy and nothing to log into.
- **No production users and no hosted instance.** There is nothing to sign up for. Everything below is how it behaves when you run it yourself.
- **Mixed ACS vintages, and a loader that disagrees with its own output.** Don't read the vintage off the loader constants. `backend/scripts/load-acs-data.ts` declares `YEAR = 2022`, but the shipped `county_data` checks out as **ACS 2024**: Los Angeles County holds `population` 9808667 and `median_income` 90112, which match only the 2024 5-year endpoint, not 2022 or 2023. `block_group_data_expanded` really is ACS 2023, matching its loader — so one DuckDB file carries two vintages. The frontend county snapshot is ACS 2020-2024 ([`counties.meta.json`](frontend/src/data/counties.meta.json)) and agrees with `county_data` on those LA figures. Verification detail: [docs/plans/2026-08-29-public-county-pages.md](docs/plans/2026-08-29-public-county-pages.md). [PR #54](https://github.com/hollandkevint/CensusChat/pull/54) refreshes the loaders to match.
- **`block_group_data_expanded` has known-bad columns.** Its age brackets are built from single narrow ACS cells rather than bracket sums, so `age_65_plus` sums to roughly 7.8M nationally against a true figure near 58M. Several columns are constant zero and `median_age` holds Census `-666666666` sentinels. Detail and the affected list: [docs/plans/2026-08-29-public-county-pages.md](docs/plans/2026-08-29-public-county-pages.md). `county_data` and the frontend county snapshot are clean.

Performance numbers are targets, not measurements. Contributors aim for sub-2-second query responses; the enforced ceiling is the 30-second request timeout in `backend/src/routes/query.routes.ts` (`QUERY_TIMEOUT_MS`), which covers validation and the Anthropic round trip.

## Product decisions, tests, and iteration

Three choices define the current product:

- **Validate generated SQL before execution.** Claude proposes the query; the allowlist and row policy decide whether DuckDB may run it. This narrows the query surface, but keeps model output outside the trust boundary.
- **Offer a keyless county-page path beside the full chat.** A reviewer can inspect real output in about a minute. The tradeoff is that the county pages do not demonstrate the natural-language flow; the full path still requires API keys and a multi-hour data load.
- **Keep questionable data visible.** The repository labels mixed ACS vintages and the known-bad block-group columns instead of hiding them behind a polished demo. That makes the limitations noisier and the useful datasets easier to choose correctly.

Evaluation currently covers two boundaries: SQL-policy tests check what generated queries may reach DuckDB, and `backend/scripts/verify-mcp-stdio.ts` exercises a real MCP `SELECT` plus rejection of a destructive statement. Data checks exposed the vintage mismatch and broken derived fields documented above; the opening example now uses the clean county snapshot and the affected block-group table remains flagged.

There is not yet a published natural-language-to-SQL accuracy benchmark, recorded demo, hosted chat, production-user feedback loop, or production user base. Current iteration evidence comes from repository tests and review findings, not customer outcomes.

---

## How it works

```
plain English question
  → Claude Sonnet 4 + Agent SDK        backend/src/agent/
  → SQL validation layer                backend/src/validation/
  → DuckDB                              backend/data/census.duckdb
  → table, chart, Excel/PDF export      frontend/src/components/
```

The validation layer is the part worth reading: [`backend/src/validation/sqlSecurityPolicies.ts`](backend/src/validation/sqlSecurityPolicies.ts).

- `SELECT` only, against three allowlisted tables: `county_data`, `block_group_data`, `block_group_data_expanded`.
- Per-table column allowlist. A column outside it is rejected by name.
- 1,000-row cap. A `LIMIT` above 1,000 is rejected outright (`ROW_LIMIT_EXCEEDED`); any other `LIMIT` is stripped and replaced by the 1,000-row policy maximum, so `LIMIT 10` is raised rather than capped.
- Multi-statement queries and SQL comments are blocked.
- Every query is written to `backend/logs/sql-audit.log`.

`backend/scripts/verify-mcp-stdio.ts` is a manual end-to-end check: it spawns the stdio server as a real MCP client would, runs a `SELECT`, and confirms `DELETE FROM county_data` is rejected.

**Stack:** Node.js 20, TypeScript, Express 5 (backend) · Next.js 15, React 19, Tailwind 4 (frontend) · PostgreSQL 15, Redis 7, DuckDB 1.4.3 · Claude Sonnet 4 via Agent SDK and MCP SDK · TanStack Table and Recharts · Docker.

---

## Data

| Table | Rows | Notes |
|---|---|---|
| `county_data` | 3,144 counties | Name, state, population, median income, poverty rate. Clean, ACS 2024. |
| `block_group_data_expanded` | 239,741 block groups | 84 variables, ACS 2023. See the status section — several are wrong. |
| `frontend/src/data/counties.json` | 3,144 counties | Committed snapshot behind the county pages. Clean, ACS 2020-2024. |

---

## Contributing

CI runs on every push: backend lint, typecheck, Jest, and build; frontend lint, typecheck, and build; Playwright e2e (`cd frontend && npm run test:e2e`, backend mocked); Docker builds; and a marketing-claim guard.

[CONTRIBUTING.md](CONTRIBUTING.md) has the rules. The one that surprises people: **every factual claim on a public surface must be checkable against a file in this repo.** `scripts/check-marketing-claims.sh` enforces a blocklist of claims already removed once, and resolves every relative link on the scanned surfaces. Run `npm run secret-scan` before committing.

---

## Docs

- [Quick Start](QUICK_START.md) · [API Key Setup](API_KEY_SETUP.md) · [MVP Status](docs/project-management/MVP_STATUS.md)
- [System Architecture](docs/architecture/01-system-architecture.md) · [MCP Implementation](docs/implementation/MCP_IMPLEMENTATION_SUMMARY.md) · [DuckDB Reference](docs/references/duckdb/)
- [Testing Guide](docs/testing/TESTING_GUIDE.md) · [Railway Deployment](docs/guides/RAILWAY_DEPLOYMENT.md) · [Security Policy](SECURITY.md)
- [Who this is for and why it exists](docs/positioning.md)

Built by [Kevin Holland](https://www.kevintholland.com). Questions: [kevin@kevintholland.com](mailto:kevin@kevintholland.com).

# CensusChat Strategy

**Last updated:** August 2026 • **Owner:** Kevin Holland

This document captures the product and infrastructure strategy for CensusChat following the v1 launch (February 2026). It covers strategic priorities, API/model currency, and the platform consolidation plan (Supabase → Railway).

---

## 1. Where We Are

**v1 shipped.** Natural-language Census queries with MCP-validated SQL, DuckDB 1.4 analytics over 3,144 counties and 239,741 block groups, interactive tables/charts, parallel comparison queries, and Excel/PDF export.

**Core value proposition:** transform 6-week, $50K demographic consulting engagements into 6-second, $297/month queries for healthcare strategy teams.

**Current stack:** Node.js 20 + Express 5 backend, Next.js 15 frontend, PostgreSQL 15 (users/sessions), Redis 7 (cache/rate limits), DuckDB (Census analytics), Claude + MCP for query translation and validation.

---

## 2. Strategic Priorities (Brainstorm → Recommendations)

### Near term (next 30–60 days) — *Recommended focus*

1. **Get to production on Railway.** The app runs locally and in Docker; the highest-leverage move is a public deployment beta testers can touch without setup. The playbook already exists ([docs/guides/RAILWAY_DEPLOYMENT.md](docs/guides/RAILWAY_DEPLOYMENT.md)): backend + Postgres + Redis on Railway (~$15/mo), frontend on Vercel.
2. **Model currency.** Keep Claude model IDs on supported versions (see §3). Retired model IDs are a silent production outage — the API returns 404 and every query fails.
3. **Beta cohort of 10 healthcare users.** Use the deployed instance to run structured feedback loops (queries attempted, time-to-answer, export usage). Feed findings into the feedback database.

### Mid term (60–120 days)

4. **Monetization scaffolding.** Wire up the $297/month tier: auth (JWT already present), Stripe billing, per-org rate limits. Keep a free tier limited to county-level queries; block-group resolution becomes the paid differentiator.
5. **Healthcare analytics patterns as a moat.** Expand the `healthcare_analytics` module (Medicare Advantage penetration, facility-siting scores, SDOH indices). Patterns are productized domain expertise — harder to copy than the NL→SQL plumbing.
6. **Data freshness automation.** Monthly ACS refresh via a Railway cron service so the "current data" claim stays true without manual loads.

### Long term (120+ days)

7. **Beyond Census:** CMS enrollment data, HRSA shortage areas, claims-adjacent public datasets — same NL interface, more decisions supported per seat.
8. **Embedded/API distribution:** the MCP server already speaks HTTP; expose it as a product so health-system data teams can call CensusChat from their own Claude Desktop / agent workflows.

**Recommendation:** sequence strictly 1 → 2 → 3. Everything mid/long-term depends on a deployed product with real users; nothing depends on more features.

---

## 3. API & Model Currency

Audit of Claude API usage (August 2026):

| Location | Model in use | Status | Action |
|---|---|---|---|
| `backend/src/services/anthropicService.ts` | ~~`claude-3-5-sonnet-20241022`~~ → `claude-sonnet-4-5` | Old ID **retired Oct 2025** (calls were returning 404) | ✅ Fixed — upgraded to `claude-sonnet-4-5` (drop-in, keeps existing `temperature` params) |
| `backend/src/agent/*` (Agent SDK services) | `claude-sonnet-4-20250514` | **Deprecated — retires June 15, 2026 window per Anthropic guidance; plan migration** | Migrate to `claude-sonnet-5`. Note: Sonnet 5 rejects non-default `temperature`/`top_p` and uses adaptive thinking — review request params when migrating, don't just swap the ID |
| Census Bureau API | ACS 5-year endpoints | Stable | Re-verify variable list at annual ACS release |

**Standing practice:** check the [Anthropic model deprecation list](https://platform.claude.com/docs/en/about-claude/models/overview) quarterly; pin model IDs in one config location instead of hard-coding per call site (refactor candidate).

---

## 4. Infrastructure Strategy: Consolidate on Railway (Supabase → Railway Migration Plan)

### Context

CensusChat itself has **no Supabase dependency** — its Postgres/Redis run in Docker locally and are planned for Railway in production. However, other projects in the portfolio run on Supabase, and the strategic decision is to **consolidate all backend infrastructure on Railway** rather than split across providers. This section is the plan for (a) keeping CensusChat Supabase-free and (b) migrating any Supabase-hosted workload to Railway.

### Why Railway over Supabase for this stack

- **Full-stack hosting, not just Postgres.** CensusChat needs Node services, Redis, DuckDB file storage, and cron jobs — Railway hosts all of them; Supabase would still leave the backend homeless.
- **Plain Postgres.** CensusChat uses vanilla `pg` connections with JWT auth in Express. Supabase's differentiators (RLS-based client auth, PostgREST, edge functions, realtime) are unused surface area.
- **One bill, one dashboard, one deploy pipeline.** GitHub push → Railway deploy for every service.
- **Cost:** ~$15/mo (backend + Postgres + Redis) vs. Supabase Pro ($25/mo) *plus* a separate backend host.

**Trade-offs accepted:** no built-in auth UI/magic links (we own JWT auth), no automatic API layer (we have Express), Railway backups require configuration (see Phase 3).

### Migration plan (for any Supabase-hosted Postgres workload)

**Phase 0 — Inventory (½ day)**
- List tables, extensions, roles, RLS policies: `supabase db dump --schema-only` or `pg_dump -s`.
- Identify Supabase-specific features in use: Auth (`auth.*` schema), Storage, Edge Functions, Realtime, PostgREST clients. Each needs a replacement decision, not just a data copy.
- Record DB size and daily write volume to size the cutover window.

**Phase 1 — Provision Railway (½ day)**
- Create Railway project; add PostgreSQL (and Redis if needed).
- Match Postgres major version to source (Supabase projects run PG 15/17 — check per project).
- Install required extensions (`CREATE EXTENSION` — verify Railway supports each; `pgvector`, `pg_trgm`, `uuid-ossp` are available).
- Set env vars; generate fresh `JWT_SECRET` — never reuse Supabase service keys.

**Phase 2 — Data migration (1 day)**
```bash
# Dump from Supabase (use the direct connection string, not the pooler)
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  --exclude-schema 'auth|storage|realtime|supabase_*|extensions|graphql*' \
  -Fc -f app_data.dump

# Restore to Railway
pg_restore -d "$RAILWAY_DATABASE_URL" --no-owner --no-privileges app_data.dump
```
- If Supabase Auth is in use: export `auth.users` separately and import into the app's own `users` table (bcrypt hashes port cleanly; users on OAuth/magic-link need a password-reset flow on first login).
- Rewrite any PostgREST/`supabase-js` client calls as backend API endpoints.

**Phase 3 — Parity hardening (1 day)**
- Backups: enable Railway's backup schedule + a nightly `pg_dump` to object storage (Cloudflare R2 is the cheap default).
- Monitoring: Railway metrics + health-check endpoint + alerting (already spec'd in the Railway deployment guide).
- Recreate any RLS-enforced rules as application-layer authorization in Express middleware.

**Phase 4 — Cutover (hours, low traffic window)**
1. Enable maintenance mode / read-only.
2. Final incremental dump-and-restore.
3. Flip `DATABASE_URL` in the app's environment; deploy.
4. Smoke-test (`/health`, one write path, one read path).
5. Keep Supabase project **paused, not deleted**, for 30 days as rollback insurance; then delete.

**Rollback:** at any point before DNS/env flip, nothing has changed for users. After cutover, rollback = flip `DATABASE_URL` back and replay the delta (acceptable for current traffic volumes).

### CensusChat-specific deployment plan

Follow [docs/guides/RAILWAY_DEPLOYMENT.md](docs/guides/RAILWAY_DEPLOYMENT.md) directly — no migration needed, it's a greenfield deploy:
1. Railway: backend service + PostgreSQL + Redis (+ monthly ACS-refresh cron).
2. Vercel: Next.js frontend (free tier to start).
3. DuckDB: ship the built `census.duckdb` file with the deploy or load via `railway run npm run load-acs-data`; Railway's filesystem is ephemeral, so persist to a Railway volume.
4. Custom domains: `api.censuschat.com` (Railway) + `censuschat.com` (Vercel).

---

## 5. Success Metrics

| Metric | Target (90 days post-deploy) |
|---|---|
| Deployed uptime | 99% + green health checks |
| Beta users onboarded | 10 active |
| Query success rate (valid answer, <2s) | >90% |
| Time from question → exported Excel | <60 seconds |
| Infra cost | <$40/month all-in |
| Paying pilot commitments | 2 |

---

*Related docs: [README](README.md) • [Railway Deployment Guide](docs/guides/RAILWAY_DEPLOYMENT.md) • [Architecture](docs/architecture/) • [MVP Status](docs/MVP_STATUS.md)*

---
title: Honest Pricing Offer Across Public Surfaces - Plan
type: docs
date: 2026-08-29
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Honest Pricing Offer Across Public Surfaces - Plan

## Goal Capsule

- **Objective:** A reader of any CensusChat public surface can name exactly what they can buy today, and every dollar figure they see is either one Kevin Holland can charge or one labeled as an estimate.
- **Means:** Edit the marketing copy in place. Remove the `$297/month` subscription, publish the delivered-analysis and early-access offer, and delete the ROI arithmetic that depended on the removed price (KTD1, KTD2, KTD3).
- **Authority:** Product behavior is owned by the R-IDs below. Implementation mechanism is owned by the KTDs. No source file under `backend/` or `frontend/` is in this plan's authority.
- **Execution profile:** Documentation-only change. No build, no migration, no runtime behavior.
- **Stop conditions:** Stop and report if the work would require naming a dollar amount not already supported, if a target file has diverged from the line numbers below in a way that changes meaning, or if the coordination boundary in R5 cannot be held.
- **Tail ownership:** Commit, push, and PR are owned by the invoking pipeline.

---

## Product Contract

### Summary

Replace the advertised `$297/month unlimited` CensusChat subscription with the offer the project can actually fulfil: a fixed-price analysis that Kevin Holland runs and delivers by hand, plus free early access to the self-serve product while it is built. Delete the ROI figures computed from the removed price. Label the `$50K / 6 weeks` consulting baseline as an estimate wherever it survives.

### Problem Frame

CensusChat advertises `$297/month` on its README, both landing pages, and the landing-page build prompt. Nothing in the repository can collect that money. `backend/src/routes/auth.routes.ts` is 25 lines of `to be implemented` stubs for register, login, refresh, and logout. `backend/src/routes/user.routes.ts:20` returns a stub for `GET /subscription`. A search for Stripe or any billing integration across `backend/src` and `frontend/src` returns nothing. The only working call to action on every surface is a `mailto:` link to `kevin@kevintholland.com`.

`landing/executives.md:19-28` compounds the problem. It runs an ROI calculation on the `$297` figure and publishes `$196,436` in net savings at `5,500% ROI`. Both numbers are arithmetic on a price nobody can pay, so both are unsupportable regardless of how the price is corrected.

### Key Decisions

- **Advertise the delivered analysis and early access instead of a subscription.** The two things Kevin can honor today. *(session-settled: user-directed — chosen over keeping `$297/month`: no billing, auth, or subscription code exists, so no customer can be charged that price.)* Governs R1, R2.
- **Do not name a headline dollar amount for the delivered analysis.** The offer is fixed-price, scoped and quoted before work begins, requested through the existing `mailto:` link. *(session-settled: user-approved — chosen over publishing a figure such as "$2,500 per analysis": the change must not replace one unsupportable number with another, and a per-engagement quote is one Kevin can always honor.)* Governs R2.
- **Delete the ROI figures rather than recompute them.** *(session-settled: user-directed — chosen over recomputing against a new price: the arithmetic is downstream of an unpurchasable price, and a recomputed figure would be equally invented.)* Governs R3.
- **Keep the consulting comparison, labeled as an estimate.** *(session-settled: user-directed — chosen over presenting `$50K / 6 weeks` as established fact: no citable source for it exists in the repository.)* Governs R4.

### Requirements

**Pricing claims**

- R1. No file under `README.md`, `landing/`, `docs/landing/`, or `marketing/` advertises a recurring subscription price. The string `$297` does not appear in any of them.
- R2. Every surface that previously advertised `$297/month` states the two real offers: a fixed-price analysis scoped and quoted before work begins, and free early access to the self-serve product, both reachable through the existing `mailto:kevin@kevintholland.com` link.
- R3. `landing/executives.md` and `docs/landing/executives.md` contain no savings figure or ROI percentage. `$196,436` and `5,500% ROI` are removed and not restated at any value.
- R4. Every surviving mention of the `$50K` or `6-week` consulting baseline in the files named in R1 is marked as an estimate at or adjacent to the claim.

**Consistency**

- R5. `docs/landing/executives.md` and `docs/landing/developers.md` stay identical to their `landing/` counterparts except for the pre-existing relative-vs-absolute "About" link on the last line of each.
- R6. `marketing/funnel-optimization.md` and `marketing/social-media-strategy.md` quote headline copy that must match what the live surfaces now say.

**Coordination and boundaries**

- R7. `landing/executives.md` lines 32-41 — the `## Success Stories` heading, the testimonial, and its Impact block — are byte-identical after the change. A parallel worker owns them.
- R8. No speed or latency claim changes value. The `⚡ 23 minutes` bullet and the time-savings block keep their existing numbers.
- R9. No file under `archive/`, `backend/`, or `frontend/` changes.

### Success Criteria

- `grep -rn '\$297' README.md landing docs/landing marketing` returns no matches.
- A reader who has only the README can state, in one sentence, what they can buy and how to ask for it.
- No dollar figure survives that is neither chargeable nor labeled an estimate.

### Scope Boundaries

**Out of scope**

- Billing, Stripe, subscription, or authentication implementation. This change alters what is advertised, not what is built.
- The fabricated testimonial and the contradictory speed claims in `landing/executives.md`. Session `censuschat-2` owns them in a parallel PR.
- `archive/` — historical build-in-public material, explicitly excluded by the request.

**Deferred to follow-up work**

- `content/` (`LINKEDIN_BUILD_IN_PUBLIC.md`, `LENNYS_SLACK_POST.md`, `BUILD_IN_PUBLIC_GUIDE.md`, `CONTENT_SUMMARY.md`) still carries `$297/month`. These are dated narrative posts describing what was believed when written, not live offer pages.
- `docs/project-management/` (`USER_PERSONAS.md`, `FEATURE_ROADMAP.md`, `SUCCESS_METRICS.md`, `MVP_STATUS.md`) and `docs/epics/epic-2-duckdb-mcp-integration.md` state `$297/month` as a planning target rather than an advertised price.

Both sets are named in the PR body as remaining, unsubstantiated references so the decision to leave them is visible rather than silent.

### Sources

- `backend/src/routes/auth.routes.ts` — stub handlers, no auth.
- `backend/src/routes/user.routes.ts:20` — stub `GET /subscription`.
- `README.md:180` — the repository already carries an estimate disclaimer (`Illustrative framing — figures are directional estimates…`) above its Market Impact figures. R4's labeling follows that existing house style.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Edit the markdown surfaces in place; add no new page.** *(session-settled: user-directed — chosen over keeping `$297/month`: no billing, auth, or subscription code exists, so no customer can be charged that price.)* Instantiates the advertise-the-real-offer decision governing R1, R2. The offer text lives where the price used to live, so no surface is left pointing at a removed claim.
- KTD2. **Express the price as "fixed price, scoped and quoted before work begins" with the existing `mailto:` as the request channel.** *(session-settled: user-approved — chosen over publishing a figure such as "$2,500 per analysis": the change must not replace one unsupportable number with another, and a per-engagement quote is one Kevin can always honor.)* Instantiates the no-headline-amount decision governing R2. No new form, no waitlist service, no signup route — the `mailto:` link is the only working call to action that exists.
- KTD3. **Replace the `## ROI Calculator` section body rather than deleting the whole section.** *(session-settled: user-directed — chosen over recomputing against a new price: the arithmetic is downstream of an unpurchasable price, and a recomputed figure would be equally invented.)* Instantiates the delete-the-ROI decision governing R3. The money sub-block (`landing/executives.md:21-24`) is replaced with prose that names the estimate and says why no savings figure is published. The time sub-block (lines 26-28) is left intact because it carries no price dependency and its numbers belong to the parallel worker under R8.
- KTD4. **Apply each `landing/` edit to its `docs/landing/` twin in the same unit.** The two directories are byte-identical apart from one link per file. Editing them together is what keeps R5 true; editing them in separate units invites drift.

### Assumptions

- `docs/landing/` is a published mirror of `landing/`, not an independent surface. The only diff today is the About link on the last line of each file.
- `marketing/` files are internal campaign-planning documents whose quoted headlines are drafts of copy that appears on the live surfaces. Updating the quotes keeps the plan documents honest without implying the campaigns ran.

### Sequencing

U1 through U4 are independent and may run in any order. U5 verifies all of them and runs last.

---

## Implementation Units

### U1. README pricing lines

- **Goal:** The README states the real offer and carries no subscription price.
- **Requirements:** R1, R2, R4, R8.
- **Files:** `README.md`
- **Approach:** Three sites. Line 5's tagline drops `$297/month` and describes the capability instead of the price. Line 44's problem statement keeps the weeks-and-tens-of-thousands comparison but marks the `$50K` / `6-week` baseline as an estimate per R4. Line 190's `~200x cost reduction: $50K project → $297/month` bullet becomes a cost bullet that names the fixed-price analysis against the estimated consulting project. The adjacent `~300x speed improvement` bullet is untouched per R8. Add the delivered-analysis and early-access offer to the `## Get Involved` section, reusing the existing `mailto:` link per KTD2.
- **Test scenarios:**
  - Happy path: `grep -n '297' README.md` returns nothing.
  - Happy path: the `## Get Involved` section names both the fixed-price analysis and free early access.
  - Edge case: every surviving `$50K` or `6-week` mention in the file sits under or beside an estimate label.
  - Error path: the `~300x speed improvement` bullet is byte-identical to `origin/main`.
- **Verification:** `git diff origin/main -- README.md` shows changes only at the tagline, problem statement, cost bullet, and Get Involved section.

### U2. Executives landing page offer and ROI section

- **Goal:** Both executives pages advertise the real offer and publish no savings figure.
- **Requirements:** R1, R2, R3, R4, R5, R7, R8.
- **Files:** `landing/executives.md`, `docs/landing/executives.md`
- **Approach:** Replace the `💰 $297/month unlimited analyses` bullet with the fixed-price-analysis bullet. Rename the `## ROI Calculator` heading to reflect what the section now holds, replace the four-line money block with prose that states the estimated consulting baseline and says no savings figure is published because only one of the two prices is known, and leave the time block intact per KTD3. Add the two offers to the closing call-to-action area alongside the existing demo `mailto:`. Apply the identical edit to `docs/landing/executives.md` per KTD4.
- **Test scenarios:**
  - Happy path: neither file contains `297`, `196,436`, or `5,500`.
  - Happy path: both files name the fixed-price analysis and free early access.
  - Edge case: the `$50,000+ per demographic analysis` bullet in Current Reality is marked as an estimate.
  - Error path: `sed -n '32,41p' landing/executives.md` on the new file matches the same range on `origin/main` in content — the Success Stories block is unchanged per R7.
  - Integration: `diff landing/executives.md docs/landing/executives.md` reports only the pre-existing final-line About link difference.
- **Verification:** `diff` between the two files reports one hunk; `git diff origin/main` shows no change inside the Success Stories block.

### U3. Landing-page build prompt

- **Goal:** The mockup prompt describes a page that matches the corrected offer.
- **Requirements:** R1, R2, R4, R8.
- **Files:** `landing/mockup_prompt.md`
- **Approach:** Four sites carry the removed claims: the project-context line, the hero subtitle, the comparison-table `Cost:` row, and the final-CTA subheadline. Each takes the corrected offer wording. The comparison section's bold result callout (`$196,436 annual savings (5,500% ROI)`) is removed with the rest of the ROI arithmetic per R3. The `$50,000+ per analysis` row on the current-reality side is marked as an estimate per R4. The `23 minutes` timings are untouched per R8.
- **Test scenarios:**
  - Happy path: `grep -n '297\|196,436\|5,500' landing/mockup_prompt.md` returns nothing.
  - Happy path: the hero subtitle and final CTA both describe the fixed-price analysis or early access rather than a monthly price.
  - Edge case: the current-reality cost row still names the `$50,000+` figure and marks it an estimate.
- **Verification:** `git diff origin/main -- landing/mockup_prompt.md` touches only those sites.

### U4. Marketing copy quotes

- **Goal:** Campaign-planning documents quote headlines that match the live surfaces.
- **Requirements:** R4, R6.
- **Files:** `marketing/funnel-optimization.md`, `marketing/social-media-strategy.md`
- **Approach:** `marketing/funnel-optimization.md:92` and `:100` and `marketing/social-media-strategy.md:61` state the `$50K` consulting figure as fact inside proposed headline and content copy. Mark each as an estimate, matching the wording used on the live surfaces. No `$297` appears in `marketing/`, so no price removal is needed here.
- **Test scenarios:**
  - Happy path: every `$50K` in `marketing/` is qualified as an estimate.
  - Edge case: no other content in these files changes — they are planning documents, not offer pages.
- **Verification:** `git diff origin/main -- marketing/` shows only those three lines.

### U5. Repository-wide claim sweep

- **Goal:** Prove no in-scope surface still advertises the removed price, and record what was deliberately left.
- **Requirements:** R1, R3, R9.
- **Files:** none changed — verification only.
- **Approach:** Run the greps in the Verification Contract. Confirm the remaining `$297` matches are confined to `archive/`, `content/`, `docs/project-management/`, and `docs/epics/`, all named in Scope Boundaries. Confirm `git diff --name-only origin/main` lists no path under `backend/`, `frontend/`, or `archive/`.
- **Test scenarios:**
  - Happy path: the in-scope grep returns nothing.
  - Error path: a `$297` match outside the four deferred directories fails the sweep and sends the run back to the owning unit.
- **Verification:** commands below, all clean.

---

## Verification Contract

| Check | Command | Expected |
|---|---|---|
| No subscription price on in-scope surfaces | `grep -rn '297' README.md landing docs/landing marketing` | no matches |
| No ROI arithmetic survives | `grep -rn '196,436\|5,500%' README.md landing docs/landing marketing` | no matches |
| Landing mirrors stay in sync | `diff landing/executives.md docs/landing/executives.md` | one hunk, the final About link only |
| Parallel worker's block untouched | `git diff origin/main -- landing/executives.md` | no hunk inside the Success Stories block (lines 32-41 on `origin/main`) |
| No source code changed | `git diff --name-only origin/main` | markdown only; nothing under `backend/`, `frontend/`, or `archive/` |
| CI | GitHub Actions on the PR | green |

This change touches no TypeScript, so the repository's `npm run test`, `npm run lint`, and `npm run typecheck` results are unaffected by construction. CI green on the PR is the confirming signal, not a per-unit gate.

---

## Definition of Done

**Global**

- R1 through R9 hold.
- Every check in the Verification Contract passes.
- No file was created that the plan did not call for; no exploratory or abandoned edit remains in the diff.
- The PR body lists each pricing claim changed, what replaced it, and every claim that could not be substantiated — including the `content/` and `docs/project-management/` references left in place and why.

**Per unit**

| Unit | Done when |
|---|---|
| U1 | `README.md` carries no `297`, states both offers, and labels its consulting baseline as an estimate. |
| U2 | Both executives pages carry no `297`, `196,436`, or `5,500%`; the Success Stories block is unchanged; the two files still `diff` to one hunk. |
| U3 | `landing/mockup_prompt.md` carries no `297`, `196,436`, or `5,500`, and its current-reality cost row is estimate-labeled. |
| U4 | Every `$50K` in `marketing/` is estimate-labeled and nothing else in those files changed. |
| U5 | The sweep is clean and the remaining `$297` matches are confined to the four deferred directories. |

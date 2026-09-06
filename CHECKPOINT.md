# CalTrack / Fuelwise Phase 6.5 checkpoint — VERIFIED

User scope: Phase 6.5 correctness/core-loop pass only. **Do not begin Phases 7–10.** Advanced Phase 9 optimization has NOT been implemented. Branding/internal names remain CalTrack.

## Current status and usage boundary

Phase 6.5 completion and verification finished on September 5, 2026 (America/Los_Angeles). Stop here; no later phase is authorized. The latest user instruction sets an **85% five-hour usage cutoff**. This verification run began with credit balance **2476.730633**; it remained unchanged at the 55% usage check before final documentation. No credit reset was redeemed. The previous checkpoint's 93%/2500 statement was stale: the user reported that the previous run reached 100% and consumed credits. Do not reuse that old statement.

The previous Phases 1–6 foundation remains in place. Their original 001–008 migrations were not edited. All new schema changes are forward migrations; no database reset occurred.

## Existing Phase 6.5 implementation retained

- Atomic grocery purchasing: `shopping_sessions` and `shopping_fulfillments` connect a shopping requirement, selected product/offer and receipt line to an additive pantry movement and running receipt/budget total. One database transaction; stable request UUID plus unique active fulfillment prevents duplicate stock/spending even with different duplicate request IDs.
- “Already have it” fulfills a requirement without stock or spending. Old checkmarks migrate to this state rather than inventing historical receipts.
- Explicit purchase reversal is idempotent, removes the exact added quantity and spending, and blocks when that stock may already have been consumed. Price correction changes spending without changing inventory. Session receipts cannot be modified/deleted through the generic manual receipt flow. Session finishing and recent receipt corrections are exposed on Groceries.
- New `/preferences` with independent Goals, Macros, Budget, Cooking/meal count/prep/repetition, Dietary exclusions, Preferred/disliked foods, Stores, Shopping, Activity, Profile and Country/measurement sections. Writes compare only the section's previous fields and preserve unrelated data. Completed users visiting onboarding are redirected; stale onboarding submission is rejected. Explicit link to regenerate, with existing plans preserved.
- Food-specific portion normalization and macro recalculation from the resulting canonical grams. Whole eggs/bananas/slices/tortillas; practical weight increments. Whole-recipe scaling replaces independent ingredient inflation. Configurable macro tolerances. Country defaults/overrides and deterministic weight/volume helpers; volume conversions require known density.
- 43 coherent recipes, with prep/cook/total time, difficulty, servings, preparation notes, optional seasonings and authored numbered instructions. Forward updates preserve template IDs and historical logged nutrition. Cooking temperature source is linked in README and migration.
- More varied regeneration, search and Recommended/Higher Protein/Lower Calorie/Cheaper/Quick Prep/Browse All swap filters. Completed/locked meals show a clear explanation and link to undo tracking, with no fake swap action.
- “Cook From My Pantry”: coverage, missing ingredients, macro fit, cooking constraints, near-expiry use and clearly labeled demo extra-package estimates. Objectives: pantry first, extra spend, macro fit and expiring stock. No multi-store optimizer.
- Practical package references (eggs by dozen, bread loaves, cans, tubs, tofu blocks, fruit counts) preserve old product records used by historical receipts. Deterministic smallest-sufficient package-combination helper and leftover quantity separation. New package offers remain explicitly simulated.
- Manual receipt editor prioritizes shopping-list/recent items and exposes broader catalog through Add Something Else. A shopping-list shortcut uses the connected checkout flow; manual historical receipts remain spend-only.
- Budget health states, percent used, conditional weekly/day averages and projections. Demo amounts are separately identified within spending. Shopping-origin receipts link to corrections. Export format 3 includes sessions and fulfillments.
- Receipt metadata supports future reviewed scanning; OCR/extraction and nutrition-label scanning are NOT implemented.

## Migrations

Linked Supabase project: `pafgnztyzwbtvfcsmbor`.

- 001–008: existing phases, unchanged.
- `202609050009_shopping_sessions.sql`: receipts/session/event ledger, checkout/reversal/correction/state RPCs, private RLS, restricted direct writes, atomic totals and demo-spending summary.
- `202609050010_preferences.sql`: country/measurement override and atomic section updates; initial-onboarding-only wrapper.
- `202609050011_practical_recipes.sql`: practical food units and 43 structured recipes.
- `202609050012_realistic_packages.sql`: new active package references and demo offers; old products retained inactive for historical receipts.
- `202609050013_whole_purchase_units.sql`: whole-number piece/package purchases on new writes, without rewriting legacy quantities.

**All 001–013 migrations match the linked remote history.** No migrations were added or edited in this verification run. No reset or data rewrite was needed.

## Fixes in this verification run

- Fixed the browser's rejection of whole package/piece purchases: `min=.001` combined with `step=1` made integer quantities invalid. Discrete purchase inputs now use minimum 1 and step 1. The browser regression checks the actual native validity before checkout and then verifies committed stock/spending.
- Today now formats ingredient snapshots in the user's selected units and known natural counts without changing stored grams or nutrition. Receipts retain original price/quantity units and add a converted food amount; checkout and demo package displays use the selected measurement system.
- Manual receipt matching shows active retail packages before loose foods, retains historical products needed to edit existing receipts, and includes shopping items plus ingredients from recent and upcoming saved meals in Recent / Planned Groceries.
- Recipe instructions visibly retain step numbers. Planned totals outside the configured tolerance show a plain target-range note; these are estimates and the generator does not guarantee every macro target.
- Corrected the Cooking time browser locator and added a 15-second action timeout so missing controls fail promptly. Added browser coverage for country-default metric settings, preservation of saved nutrition/plans, search/filter empty states, pantry meal selection, and mobile dialogs.
- Restarted an unresponsive local preview. No application workaround was needed for that process issue.

## Final validation

- **92 automated tests across 7 files pass**, including all prior domain/Postgres tests with the intentional new fulfillment semantics, plus atomic purchases/retries/reversal/price correction, already-have, no partial writes, consumed-stock reversal rejection, protected receipts, RLS, independent preference writes, stale edits, country defaults, whole portions, exact recalculated macros, recipe ratios, variety, swaps, pantry ranking, package combinations and budget health.
- **TypeScript, lint, and production build pass after the final code changes.** `git diff --check` passes.
- **Both browser scenarios pass in the final fresh-account run (1.2 minutes):** `core.spec.ts` and `phase65-review.spec.ts`. They retain the prior auth/onboarding/tracking checks and verify the Phase 6.5 workflow below. No browser page errors were recorded.
- All three live rollback-only SQL suites pass: `security.sql`, `phases_4_6_security.sql`, and `phase65_security.sql`. Coverage includes exact pantry/spending, concurrent retries, already-have, correction/reversal, private owner isolation, anonymous RPC denial and read-only pricing. Fixtures rolled back; all public tables have RLS.
- Checked 29 production browser bundles: no administrative secret key or service-role JWT matches. Runtime configuration uses the public project URL and publishable key; `.env.local` and disposable `.env.qa` are ignored by Git.

## Browser workflows verified

- Completed account edits Cooking time directly; only that preference section changes. Visiting onboarding redirects to preferences.
- Generate, swap, save and regenerate meals; inspect practical portions and recipes. Completed/eaten meals have a clear explanation and no swap button. Numbered instructions, prep/cook times, food preparation forms, and searched swap alternatives were visually reviewed.
- Switch Canada + Country default to metric; verify Today/planner displays and unchanged saved nutrition/plans/budget, then restore US customary. Pantry changes 2000 g → 2 kg → 2000 g without changing inventory.
- Pantry discovery shows positive stock coverage, missing foods and labeled demo estimates; selecting a breakfast fills the editable day's draft. Filters and no-match search behavior work.
- Generate groceries, select a Walmart shopping session, confirm a whole package purchase, verify exact stock and receipt total, repeat the same request concurrently three times, and verify no duplicate fulfillment or pantry quantity.
- Already Have It completes another requirement without adding purchase lines or pantry stock. Correct price updates the receipt, finish closes the session, and Budget shows the sum of the manual receipt and corrected shopping receipt exactly once.
- Manual Log Purchase defaults to shopping-list matching, shows packages first and supports Recent / Planned. Receipts/corrections and the budget were visually inspected.
- Desktop 1440×1000 and mobile 390×844 layouts checked, including preferences, planner, groceries, pantry, budget and scrollable dialogs. Screenshot artifacts are under ignored `test-results/`; relevant recipe, swap, pantry discovery, preferences, receipt/correction and budget screenshots were reviewed.

No Phase 6.5 completion work remains within the requested scope. The full browser suite assumes a fresh isolated QA account and one worker; the second scenario reviews the account created and completed by the first. Follow README's setup/run/cleanup sequence when rerunning.

Final cleanup confirmed: the temporary Supabase QA account and its records were deleted, and `.env.qa` is absent. Final usage check before this closing note: **60% of the five-hour window**, below the user's 85% cutoff; credit balance **2476.7306330000**, unchanged from this run's baseline. No reset used. Work stopped after Phase 6.5 verification.

## Limits to preserve

- Changing display units preserves previously saved canonical grams and nutrition. Existing imperial portions can therefore show decimal grams after switching to metric; explicit regeneration uses metric portion steps. Historical receipt price units remain as entered, with converted amounts shown alongside them.
- Macro fitting is a deterministic best effort with practical recipe ratios. Some generated days, especially legume-heavy combinations, exceed fiber targets; the UI now identifies values outside the target range. No claim of exact macro matching or independently verified branded nutrition.
- Checkout selects one product size per shopping row; the current active demo catalog has one practical package per food. The package helper supports combinations, but multi-product/store optimization remains outside this phase. Volume conversions require known density; no invented cup conversions.

- No real retailer/provider integration. All seeded offers and cost estimates remain Demo pricing; never label them today's verified prices. Manual receipt price is distinct from a demo estimate.
- Pantry is aggregate per food, not separate lots. Expired stock must be depleted before adding a fresh purchase of the same food. Reversal is conservative after meal consumption.
- Purchase-session totals sum item prices; full receipt taxes/discount allocation is not yet provided in the shopping-session UI. Manual historical receipts support a total including tax.
- No receipt OCR, label OCR, camera/storage feature, advanced store/cart/distance optimizer, photos or expanded progress analytics. Phase 7/8/9 should build on the canonical food/product/offer/receipt/event separation.
- Broader Canadian postal/store onboarding is still deferred; country and measurement defaults are now directly editable.

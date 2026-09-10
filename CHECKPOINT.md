# PHASE 9 COMPLETE — saved split-store lifecycle — September 7, 2026

Completed only the remaining Best Split save/apply gap from the current repository. This section supersedes earlier partial statuses below. All final checks passed. Phase 10 has not been started; STOP here.

## Implementation

- Use This Plan persists structured `split_plans` and `split_assignments`: original grocery identity and need, allocated grams, selected store/location/product, package count/weight, expected unit price, price reference/source/date, total, comparison baseline, maximum stores, penalty, engine version and lifecycle status. Original snapshots survive unavailable offers and removed requirements. Private export includes both tables.
- Canonical owner-scoped fingerprints and an owner transaction lock make repeated/concurrent application idempotent. Applying makes no purchase, stock or spending changes. A new recommendation explicitly replaces the previous active plan; abandonment is supported. Failed stale application rolls back without replacing the existing plan.
- Store-grouped saved cards expose applied, partially shopped, completed and historical states, quantities, provenance, expected subtotals/total and supported comparison savings. Stable location IDs separate stores even when names coincide. Desktop and mobile retain the existing design.
- Checkout uses the existing shopping-session, receipt, fulfillment and pantry ledger. Each store can be shopped and finished independently. Actual entered prices determine receipts and budget; original expected prices remain intact. Multiple packages/sizes can fulfill one requirement through separate assignments. Request/assignment uniqueness prevents duplicate stock, spending and history.
- Deferred reconciliation recognizes purchases, external purchases, Already-have, changed quantities and removed/covered needs. Stale quantities require review; the saved plan never recreates demand. Receipt reversal can reopen the latest relevant assignment. New depletion still uses existing idempotent replenishment. Unavailable products/offers allow matching alternatives or manual actual weight/price without optimizer recomputation.
- Applied-plan reopening reads persisted assignments. New comparison and Apply explicitly evaluate the cart optimizer; unrelated navigation and shopping returns do not. Targeted route invalidation preserves existing navigation reuse.
- Necessary pricing integration: own actual package observations at known product/location/currency combinations can supply an option even when that location has no demo offer. Unknown locations and future observations remain excluded. No retailer data was fabricated or changed for browser QA.

Main files: `lib/shopping/splits.ts`, `app/(app)/groceries/split-actions.ts`, `components/groceries/split-plan-panel.tsx`, existing cart/workspace/purchase components, shopping/pricing services, private export and small responsive styles. README documents the workflow and three-account browser setup.

## Database and security

Forward migration `202609070024_split_plans.sql` applied successfully. Local/remote migration histories match through 024; existing migrations were not reset or reapplied. New tables have owner-only RLS reads and no authenticated direct writes. Public self-scoped RPCs validate ownership, current state, quantities, price references and store/session identity. Internal transaction/reconciliation functions and all anonymous split actions are inaccessible. The fulfillment relationship has a composite owner foreign key.

All **seven live rollback security suites PASS**: `security`, `phases_4_6_security`, `phase65_security`, `phase78_security`, `receipt_completion_security`, `phase9_security`, and new `split_plans_security`. New live assertions cover repeated apply, store separation, wrong-store denial, actual-price corrections, exact stock/spending, cross-user read/apply/abandon/start/purchase denial, direct-write denial, RLS and private/anonymous privileges. All SQL fixtures rolled back. No service credential was added to application runtime.

## Final verification

- **165 automated tests across 12 files PASS** (previous 150 preserved; 14 split database cases and one actual-price integration case added). Focused cases include every requested A–P lifecycle area, same-food multi-package checkout, fallback, replacement, rollback and reversal.
- TypeScript, lint, production build and diff whitespace checks PASS.
- **All eight browser scenarios PASS in one clean final production run (4.3 minutes)**. Existing core/preferences/progress/photos/label/receipt/replenishment/cache journeys remain passing. New dedicated split-account scenario passes save → refresh, three concurrent repeat applications without duplicates, Costco purchase/finish with Walmart untouched, later Walmart purchase/finish on mobile, actual prices vs saved expectations, exact stock/spending, stale quantity review and owner isolation. Initial targeted test setup omitted the required preferred stores; corrected the fixture, then both targeted and clean full runs passed without weakening product assertions.
- Desktop stale-plan and 390px mobile completed-plan screenshots inspected: readable grouping, states, quantities and totals; no horizontal overflow. Browser page-error assertions pass. Dedicated server logged three closed-stream messages during navigation/teardown, with no failed browser requests asserted by the suite.
- Final measured warm returns: Groceries 73 ms, Plan 71 ms, Budget 58 ms; zero new RSC requests. Local production measurements only, not deployment benchmarks.

## Remaining practical limits

No remaining blocker in the requested split lifecycle. One store session is open at a time; finish it before starting another. Cart search remains bounded to existing candidate/package/store limits, not a global optimum guarantee. No live retailer, travel or OCR provider is configured. Expected prices exclude unrecorded tax/travel and retain explicit demo labels. Unknown-location purchases remain private history. Prior-plan summaries show the latest ten plans; export retains all rows. Existing aggregate-pantry and manual-quantity semantics remain unchanged.

Cleanup/status: dedicated QA preview stopped; user preview untouched. All three disposable QA accounts, their private uploads and records, credential files and generated browser artifacts were removed. Final reported five-hour usage: **79%**, below the user's 85% cutoff. Credit balance remains **2476.7306330000**; no paid credits consumed or reset redeemed.

---

# Phase 9 integration and verification — September 7, 2026

Resumed the previous working tree without restarting Phase 9. Phase 10 remains untouched. This section supersedes the older Phase 9 checkpoint below. Final clean production browser run: all six core scenarios passed, including all five former failures. The added account-switch test initially encountered two correctly labeled desktop logout buttons; its locator was narrowed to Settings. The targeted account-switch rerun PASSED (7.3 seconds). All seven scenarios therefore pass across the final clean run and this targeted rerun. Desktop pantry/swap and mobile Budget receipt screenshots were inspected. Final warm return times: Groceries 62 ms, Plan 78 ms, Budget 109 ms, with zero RSC requests.

Stopped development at the reported 84% five-hour usage reading. Credit balance remained 2476.7306330000; no reset redeemed. Both temporary QA accounts, private uploaded files and records were removed; generated browser artifacts deleted and dedicated QA server stopped. Existing user preview was left running. Phase 9 remains partial for the shopping-cart application limits documented below.

## Five previous browser failures: reproduced individually and resolved

1. Core receipt matching: the test stocked the ingredient fully, then looked for it under the active shopping-list filter. Live replenishment correctly removed the covered requirement. Historical receipt matching now selects Recent / Planned. A subsequent stale assertion compared regenerated meals before asynchronous optimization completed; it now waits for the resulting meal names, without arbitrary timeouts.
2. Recipe review: the chosen recipe had two authored instructions, while the test required at least three. The test now compares rendered instructions exactly against the saved recipe and still checks visible numbering. Country/measurement restoration runs in finally, including after failures.
3. Progress/photos/prep: the previous failed recipe test left the account in Canada/metric mode; progress correctly showed kilograms while the test searched for pounds. Restoring preferences fixes the root cause; the full progress/private-photo/prep scenario passed individually.
4. Receipt review: the same country change made the receipt default to CAD while the test searched for USD. The test explicitly selects its receipt currency using the actual accessible combobox. Confirmation, retry protection, stock updates and prep optimistic rollback passed individually.
5. Phase 9: earlier tests stopped before creating the receipt the final scenario expected. With successful setup, the original scenario passed. The expanded scenario creates its own shopping receipt and verifies depletion, purchase, Budget reversal, repurchase, consumption, automatic return, Already-have and warm navigation.

## Product fixes and integration completed this run

- Shared request-scoped optimization pricing for Plan and Groceries. Own actual package purchases with known product/location/currency matches replace matching demo references. Selection uses purchase date, with deterministic ties; unknown locations and future observations are excluded. Price history retains provenance. Checkout never treats a private observation as a demo offer; it displays the previous price and asks for the amount actually paid. Discovery also uses the available package/cart data and correct demo labeling.
- Smart swap ranking now uses package spending across the visible draft, pantry coverage, macro compatibility and existing dietary/cooking constraints. The draft is passed through to swaps; absent meals cannot produce fabricated zero-savings claims. Negative savings display as additional cost. No unsupported monthly extrapolation.
- Twelve deterministic candidate plans include ordinary and greater-variety candidates, scored with the same objective weights. Fixtures establish at least three distinct selected plans across the six objectives, optimal ranking within the bounded candidate pool for each objective, and reproducibility. Single-day regeneration considers other saved days in the weekly budget horizon. Recent completed templates from the prior 30 days inform repetition.
- Planner receives new saved meal/status data without silently retaining old pristine state. Locked incoming days remain protected. Swap lists compute only while their dialog is open; unchanged summary inputs use the owner-keyed cache.
- Budget receipt modal stays mounted through corrections/reversal, retains reversed lines, and is available for manual receipts too. Older inline detail disclosure is explicitly named Item price details. No duplicate receipt records.
- Pantry shows recent explicit expired/discarded events, known historical cost estimates, actual stock consumed by completed meals and a conservative repeated-waste suggestion. No invented smaller-package savings. Bounded to 500 records per category over the last 30 days; only Pantry requests these additional queries.

## Migrations and security

021–022 were already applied and unchanged. Corrective forward migration 023 was genuinely necessary: explicit one-day/future shopping horizons had been expanded to seven days. It now honors the requested range and reserves pantry stock for earlier planned meals before a future horizon. Expired list periods roll forward. Regression coverage checks exact demand, prior stock allocation and idempotency. 023 applied successfully; no reset/reapplication of older migrations.

All six live rollback suites passed: security, phases_4_6_security, phase65_security, phase78_security, receipt_completion_security, phase9_security. They cover own-row RLS, private storage, atomic stock/spending, retries, reversal, review gates and replenishment. No service/admin credential was added to application runtime.

## Automated checks and performance

150 automated tests in 12 files pass. Typecheck, lint, production build and diff whitespace checks pass. Added actual-price merging, future/unknown-location exclusion, all six representative package cases, missing package weights, travel/store penalties, expired pantry, draft swap accounting, objective selection and future-horizon regressions.

Expanded targeted browser run passed. Local production warm returns: Groceries 71 ms, Plan 64 ms, Budget 93 ms; zero RSC requests on all three returns. These are local observations, not deployment benchmarks. Next 16 documentation states that revalidatePath from a server action can currently refresh all previously visited pages even when specific paths are named. Mutations intentionally refresh affected data; 30-second safe client reuse serves unchanged navigation. Request-scoped data and owner/input-keyed summary caching do not share private page data across users. No Vercel URL/telemetry supplied.

## Remaining limits / Phase 9 completion status

Core workflows and integrations are substantially verified, but Phase 9 is still PARTIAL against every item in the previous checkpoint: there is no persistent saved shopping-cart selection or automatic application of a split cart to checkout. Recommendations show package/store choices; checkout still confirms one product size per requirement and users handle separate store sessions. Multi-size cart recommendations therefore require manual purchasing decisions. Extra-store penalty/max-store controls are local UI choices, not saved profile preferences. Future-plan leftovers beyond the current aggregate horizon are not reserved automatically.

Package search is bounded to selected one/two-product combinations, ten locations and three stores; it is not a global optimum guarantee. Variety candidates can coincide when constraints narrow choices. No live retailer or travel provider is configured. Distances are unknown; injected distance penalties are tested. OCR still needs an external gateway. Actual observations only integrate when product/location/weight are known; unknown-location receipts stay private history. Pantry is aggregate per food, waste records the whole remaining amount, and manual grocery quantities remain user-owned overrides. Full browser tests use a documented ordered disposable-account journey; targeted review scenarios require the core setup.

---

# Phase 9 partial implementation — September 7, 2026

Stopped at the user’s 85% five-hour usage cutoff. Last check: 85% five-hour, 97% weekly; credit balance 2476.7306330000 unchanged. No reset redeemed. Phase 9 is NOT complete or fully browser-verified. Preserve all existing work; do not restart Phase 1–8.

## Implemented this run

- Applied forward migrations 021 live replenishment and 022 waste events to the linked Supabase project. Deferred transaction triggers reconcile pantry, planned meal demand and shopping fulfillment; active generated requirements are unique/idempotent. Purchased/Already-have rows leave the active list while history remains. Later insufficient stock reactivates demand with a new row. Self-only reconciliation RPC also runs when inventory loads to catch date/expiry changes.
- Budget receipt sheet shows receipt lines, quantities, prices, subtotal/total and existing correction/reversal controls without intentional navigation away from Budget. Unknown tax/discounts are not inferred.
- Deterministic six-objective planner, shared scoring, dated pantry allocation, expiry/runout, remaining monthly budget and package/cart estimates. Bounded package combinations and store subsets provide single-store, split and fewest-store comparisons, configurable extra-store penalty and missing-price warnings. These are heuristic recommendations, not a proof of global minimum.
- Meal swaps display whole-plan package cash and macro deltas. Grocery product alternatives show package/leftover differences. Price quality uses sufficiently sampled dated history; demo provenance remains explicit. Plan pricing can use actual private receipt/manual observations matched to known products and locations.
- Explicit whole-item waste recording, owner-only history/export, idempotency and stock depletion; cost is unavailable without a usable actual purchase reference. No inferred waste from ordinary consumption.
- Thirty-second client route reuse, targeted mutation invalidation, parallel independent reads, removal of redundant plan refresh, owner-and-input-keyed bounded optimizer cache, logout clearing. No global cache of private page data. Missing travel provider returns unknown distances.

## Verification and failures

136 tests in 12 files pass. Typecheck, lint, production build and diff whitespace checks pass. Live rollback SQL suites passed: security, phases_4_6_security, phase65_security, receipt_completion_security and new phase9_security. Phase 7–8 SQL suite was not rerun this turn.

Final production browser suite: 1 passed, 5 failed. Do NOT describe browser QA as passing. Core test stopped selecting a food absent from the Budget purchase match options (core.spec.ts:352). Phase65 expected at least three recipe steps but the selected recipe had two. Phase78 progress/prep failed; inspect on next run. Receipt review used a hardcoded USD label while account currency was CAD. Phase9 verified depletion/replenishment, optimizer controls and mobile plan width, but failed to find a Budget shopping receipt after preceding receipt-creation scenarios failed. Tests share account state and need isolation/robust fixtures before drawing regression conclusions. Warm return to Plan measured 52 ms with zero Plan RSC requests on local production; this is one observation, not a deployment benchmark. Budget modal mobile QA remains pending.

Temporary QA account and uploaded files were cleaned up at stop; generated test-results removed. Dedicated production QA server stopped; existing user preview left running.

## Next work / known limits

1. Repair browser fixtures and investigate all failures; finish Budget receipt correction/reversal and full pantry → buy → consume → replenish browser verification. Preserve security and existing flows.
2. Unify Groceries cart pricing with Plan actual private observations: Groceries comparison still uses demo offers. Existing serving-cost discovery estimates also remain demo based.
3. Smart swap cash deltas are displayed but new scoring does not yet rank all swaps. Full recent-meal history, persistent saved shopping-plan/apply behavior, richer waste history/pattern suggestions and leftover reuse across future plans remain incomplete.
4. Replenishment uses a minimum seven-day horizon even for a shorter requested list and begins today rather than a future requested start. Manual grocery quantities remain user-owned overrides. Review these semantics and deferred-trigger query cost; inventory reads now add reconciliation work.
5. Cart search is bounded (up to ten locations, three stores, selected one/two-package combinations); partial/unpriced carts cannot support exact total savings. Travel abstraction has no live provider; do not fabricate distance. Waste action records the whole remaining pantry amount only. Voided purchase lines are currently filtered from Budget views.
6. Complete remaining Phase 9 acceptance requirements before Phase 10. No external retailer or distance credentials configured, no deployment benchmark performed.

---

# Phase 7–8 completion / QA checkpoint — September 6, 2026

Scope: surgical completion and polish of Phases 7–8. Phase 9/advanced optimization and Phase 10 remain untouched. Do not restart completed work.

## This run

- Reviewed receipt flow at `/scan/receipt`, linked from Budget: private image → optional extraction → editable lines/food/package/grocery matches → mandatory confirmation. No stock/spending write before review. One SQL transaction creates the receipt, lines, finished shopping-session ledger, additive pantry stock, selected grocery fulfillments, and private product-price references. Upload UUID is idempotent. Exact total validation rolls back all writes on mismatch. Unknown items/tax may stay spending-only; discounted paid prices are entered on the item. Matched groceries require a full gram-based requirement. Stocked receipts use existing correction/undo and cannot be edited/deleted through the manual receipt editor. Receipt price observations remain private and refer to actual receipt lines; no shared/demo offer pollution. A dedicated price-history browsing UI is not added.
- Production HTTP extraction adapter for labels and receipts: HTTPS-only configurable gateway, server-only bearer credential, raw allowed image upload, 20-second timeout, 128 KB response cap, validated envelope, confidence filtering at 0.85, no automatic confirmation. Every failure allows manual review. No OCR service is configured or called. README and .env.example document `EXTRACTION_SERVICE_URL`, `EXTRACTION_SERVICE_TOKEN`, and the exact gateway payload/response contract. The operator must provide an actual OCR vendor gateway and credentials; this adapter alone does not perform OCR. Reopening a confirmed label or receipt shows saved state instead of offering a silent overwrite.
- Recipe-based prep replaces one task per ingredient. Only meaningful recipe steps generate tasks; ready oil/yogurt/bread/protein-powder ingredients and last-minute serving tasks are excluded. Exact compatible preparation text/food sets consolidate deterministically; differing preparations remain separate. Includes related meals, ingredient weights, times and saved completion. Fixed visual QA finding where serving references mislabeled rice/tofu as steamed and pasta as wash/chop. Old prep snapshots remain intact and are identified as legacy. Task completion never consumes stock. Matching is deliberately conservative: differently worded compatible recipes may remain separate, and times are planning estimates. Pantry availability text is scoped to the first ingredient rather than claiming all multi-ingredient tasks are stocked.
- Shared quantity formatting uses practical gram increments, quarter-ounce increments, natural-unit fractions and teaspoon/tablespoon amounts. No “about 0” counts or redundant oil unit strings. Canonical historical quantities/nutrition stay intact; new plan portions still use the existing normalization/macro recalculation. Country defaults and explicit overrides retained.
- Real completion timestamps on new meal status transitions. Same-status retry preserves time; undo clears active time while retaining audit events; recompletion records a fresh time. Historical unknown times stay unknown. Today displays the recorded local time. Weekly progress summarizes sufficiently sampled completion/logging times in profile timezone with midnight-aware ranges and prior-week shifts. These are logging times, not inferred eating times for retrospective entries.
- Request-scoped auth/profile/catalog/pricing memoization, removal of redundant client refresh after server revalidation, independent Progress reads in parallel instead of loading Today first, app route loading feedback, optimistic meal/prep checkmarks with rollback, immediate save states. Private data is never globally cached. Existing completed-meal swap explanation/disabled workflow retained.
- Once-per-user/day daily checklist celebration; feature-detected subtle haptics on meaningful meal/prep/shopping success; short onboarding/content transitions with reduced-motion support. No added animation dependency.

## Migrations

Forward 018 reviewed receipts/private price observations; 019 completion timestamps/audit; 020 account-deletion audit guard. 018–020 applied. Account cleanup succeeded after 020. The final cleanup initially exposed an audit insert during profile deletion; 020 prevents recreating events for a removed profile. No applied migration was edited, no reset, no historical completion times fabricated.

## Verification

- 125 automated tests in 11 files pass, including receipt transaction/retry/rollback, full grocery/product-price linking, mandatory review, owner isolation, timestamp/retry/undo/recompletion/account deletion, prep exclusions/consolidation/method naming, natural fractions, midnight/week timing, provider confidence/error fallback, and once-only celebration.
- TypeScript, lint, production build and diff whitespace checks pass. Final changes after the last build are SQL/test/documentation only.
- All five live rollback SQL suites passed: security, phases_4_6_security, phase65_security, phase78_security, receipt_completion_security.
- Browser first pass: core scenario passed; second run all four phase65/phase78/receipt scenarios passed. Verified photos/upload/privacy, label upload/manual review/private food save, receipt no-write-before-confirmation, stock/grocery updates, reopening without duplicate purchase, and prep optimistic rollback after a simulated server failure. Desktop/mobile screenshots reviewed for progress/prep/receipt; receipt/photo fixtures are a one-pixel PNG and establish upload/access behavior, not real OCR quality.
- Final fresh-account run: core, phase65, progress/photos/prep and label passed. Receipt confirmation passed; rollback assertion hit an ambiguous alert locator (Next route announcer). Locator narrowed to the prep error; targeted receipt/rollback rerun PASSED (20.7 seconds). All five browser scenarios now pass across the final run and targeted rerun. Final QA account, private files and records were removed successfully.

## Performance findings

Measured local authenticated full-page responses, one warm-up + three samples/route; medians ms before → after: Today 354→300, Plan 331→372, Groceries 442→405, Pantry 252→347, Budget 366→343, Progress 459→346, Prep 441→439. After measurements overlapped browser QA; these are diagnostic samples, not a controlled benchmark or proof all routes improved. Local warm requests did not consistently reproduce 2–3 seconds. No deployment URL/cold-start telemetry was available, so Vercel-specific latency is unverified. README records method, causes and changes; scripts/profile-routes.mjs reproduces local checks with a disposable account.

## Remaining practical limits / next work

- Configure a real OCR gateway externally before claiming automatic extraction works. No paid API calls were made here.
- Recipe prep conservatively groups matching text; times do not account for batch size/equipment and may overestimate sequential work. Old sessions need explicit replacement to get new tasks. No stock reservations or deductions on prep.
- Receipt discounts are reflected in paid line prices; negative discount lines and partial grocery fulfillment are not supported. Price observations are stored/exported privately; there is no new dedicated browsing UI.
- Meal analytics reflect completion/logging time. Historical timestamps remain unknown, and retrospective entry is not an exact meal-time diary.
- Pending failed uploads can retain metadata until deletion/account cleanup. No background cleanup job is introduced.
- Remote deployment performance and device-native vibration remain unverified. Browser rollback is tested; actual haptic hardware support varies.

## Resource boundary

This run began with the included window available. Credit baseline 2476.7306330000 has remained unchanged; no usage reset or paid credits authorized. At 68% work switched to final verification/cleanup, preserving room below the hard 85% cutoff. Final usage reading: 85%; credit balance unchanged at 2476.7306330000. No reset. Development stopped; only final verification/QA cleanup performed. Temporary QA account/files/records removed. Generated test-results and timing scratch files removed.

---

## Previous checkpoint (historical, superseded by the status above)

# Phase 7–8 checkpoint — PARTIAL, STOPPED AT USAGE BOUNDARY

September 6, 2026. Latest user request authorizes Phases 7–8 only. PHASE 9 ADVANCED OPTIMIZATION HAS NOT BEEN IMPLEMENTED. Phase 10 is untouched.

Usage: latest check was 86%, exceeding the requested 85% cutoff. Development stopped immediately upon that reading. Credit balance remained 2476.730633, unchanged from this run's baseline; no reset redeemed. Do not claim the cutoff was met. Use a materially earlier cleanup threshold next run.

## Implemented

- Phase 7: /progress now has 7-calendar-day weight averages, raw/trend/goal chart with 7D/30D/3M/6M/All ranges; deterministic trajectory requiring 8 entries across 21 days, recent data and consistent direction for an ETA; weekly nutrition, meal/workout/tracking/spending metrics with explicit missing-data denominators; neutral plateau foundation; optional body-measurement add/edit/delete/history and unit conversion. Analytics live in lib/progress/analytics.ts; getProgress paginates full weight/measurement history. No automatic nutrition changes.
- Private photo upload/history/delete/comparison at /progress/photos. Three private Storage buckets: progress-photos, receipts, nutrition-labels; 6 MB JPEG/PNG/WebP limits; user-folder ownership policies. /api/media/[id] checks the signed-in owner and streams uncached images, avoiding public/signed bearer URLs. Missing images offer reload. Metadata in user_uploads. Uploads use the public client key and authenticated session only.
- /prep groups shared ingredients from upcoming saved uneaten meals, preserves canonical quantities, shows related meals and usable pantry shortage, and saves task completion with optimistic concurrency. Completing prep never changes stock or meal-consumption ledgers. Sessions are snapshots of the saved-plan revision; times are clearly estimates.
- Nutrition label upload/manual-review UI at /scan/label, linked from A Little Extra. Provider interfaces exist in lib/scanning/providers.ts; current adapters explicitly report unavailable with no fabricated fields. Reviewed serving values normalize to per-100g; required confirmation gates saving. save_reviewed_label creates private Food/FoodNutrition once per upload. Private food references are guarded even through older definer RPCs. Source says manually entered/user-reviewed. Sugar and sodium supported; unknown optional fields stay null. Export format 4 includes measurements/uploads/prep/private foods.
- Receipt provider interface and deterministic name matching tested; receipt confirmation flow is NOT implemented. No receipt-scanner purchase/budget/pantry mutation exists yet. Avatar is not implemented (optional).

## Migrations and checks

Forward migrations 202609060014_body_measurements, 015_private_uploads, 016_meal_prep, 017_reviewed_labels applied; all 001–017 matched linked Supabase history. Existing applied migrations were not changed.

111 automated tests across 10 files passed. Lint, TypeScript and production build passed before the final small upload-form fix; the final lint, TypeScript and production build also passed after that fix. New database tests cover private buckets, measurements, private label nutrition, mandatory confirmation and repeat saves. Live supabase/tests/phase78_security.sql passed and rolled back its fixtures. Older browser workflows passed in the initial run. No administrative runtime credentials were introduced; QA helper uses the CLI admin key only in process memory and now removes private files during cleanup.

## Browser status / exact next steps

1. Final browser run: both Phase 6.5 scenarios passed; the new progress/photo/prep scenario was deliberately interrupted at the usage stop while awaiting the seventh prep checkbox update. This interruption is not evidence of a failed transaction. The label scenario did not run in that final suite. Rerun the complete suite on a fresh isolated QA account; do not assume full acceptance.
2. Progress logging, chart/goal rendering and measurement add/edit/delete were exercised. The SVG goal line was visibly present; the test now checks its stroke and visible Goal label rather than a zero-height SVG group. Weight fixture precision was corrected to one decimal.
3. Photo upload, two-photo comparison, owner media access, anonymous denial and deletion passed before the prep test stopped. Review final desktop/mobile artifacts under ignored test-results; comprehensive visual acceptance remains incomplete.
4. Prep test initially failed because a controlled checkbox changes after a server roundtrip. Test now clicks and waits for checked state; verify all tasks complete and pantry/ledger remain unchanged.
5. Label test initially found upload disabled after file selection. Final form fix reads the actual File from submitted FormData rather than depending on state hydration; native required validation remains. Verify upload → unavailable-provider message → mandatory editable review → private food/nutrition save, retries and cross-user protection end to end.
6. Finish receipt upload/review/matching/confirmation with atomic, idempotent purchase, budget, pantry and shopping updates. Do not reuse manual receipt save in a way that double-stocks pantry or bypasses shopping-ledger semantics. Add meaningful transaction and browser tests before claiming Phase 8 complete.
7. Recheck storage policies and earlier live security suites after new receipt work. Review private-food references on any new write path. FoodNutrition is per 100g; portion conversions need an explicit known gram weight, never invented volume density.
8. Review remaining UX limitations: All weight history can be long; weekly comparison uses current targets/budget, not historical snapshots. Prep holds snapshots and aggregates available stock per ingredient without reserving or deducting it. Pending failed-upload metadata may remain; final receipt/photo cleanup needs lifecycle consideration. No OCR provider is configured; images are not sent to an external OCR service.

QA cleanup completed: the test account, private files and records were removed. Phase 7 implementation is present but final acceptance is pending. Phase 8 is partial. The next task must resume this checkpoint, not begin Phase 9.

---

## Historical Phase 6.5 checkpoint (superseded scope)

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

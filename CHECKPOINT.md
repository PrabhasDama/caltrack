# CalTrack Phase 1–6 checkpoint

Phases 4–6 are implemented on top of the existing, preserved Phase 1–3 foundation. Work stops here as requested. No Phase 7–10 work or advanced price optimization has started. Internal and visible branding remains CalTrack; the Fuelwise rename is deferred.

## Completed this run

- `/plan`: deterministic ingredient-based nutrition, template filtering, bounded portion adjustment toward saved targets, seven-day generation, day regeneration, swap preview with macro deltas, target comparison, instructions, draft/save states, optimistic revision checks, protected completed days, and generated meals integrated into Today.
- Reference catalog: 36 normalized foods with per-100g nutrition, serving/piece weights, aliases, food form, tags and source disclosures; 12 reusable meal templates. No AI macro arithmetic.
- `/pantry`: known-food entry, g/kg/oz/lb and supported piece/serving conversions, editing, deletion/depletion, purchase/expiry dates, low-stock state, search/filter, serving estimates and optimistic updates.
- `/groceries`: uneaten meal requirements minus usable pantry, shopping period, required/pantry/to-buy quantities, manual additions, amount edits, purchased checkoffs, safe clearing, and explicitly labeled demo package offers/history.
- Meal completion: transactionally consumes usable stock once; repeated concurrent requests are idempotent. Undo restores actual quantities deducted; expired stock is not consumed.
- `/budget`: ongoing monthly target in USD or CAD, receipt and line-item create/edit/delete, matched food/product or manual items, monthly totals, remaining budget, conditional projection, basic history, paginated receipts and nutrition-cost metrics only where conversions are known.
- Separate food, retail-product, store-location, offer, price-history and deal models. US/Canadian chain/location architecture, modular PriceProvider, DemoPriceProvider, normalized unit costs and history helpers. No FX assumption or live-price claims.
- Navigation and private JSON export include the new features. Existing auth, onboarding and daily tracking remain intact.

## Applied migrations

Connected project: `pafgnztyzwbtvfcsmbor`. Local and remote migration history match for all 8 migrations.

- `202609050001_foundation.sql` — existing foundation, unchanged.
- `202609050002_onboarding.sql` — existing onboarding, unchanged.
- `202609050003_tracking_hardening.sql` — existing tracking, unchanged.
- `202609050004_meal_planning.sql` — normalized nutrition/templates, private plan/day/entry tables, atomic save RPC.
- `202609050005_food_reference.sql` — reference foods and template seeds.
- `202609050006_pantry_groceries.sql` — pantry dates/units, private shopping tables, requirement refresh, expiry-aware meal completion.
- `202609050007_budget_pricing.sql` — normalized retail/location/offer/history/deals, private purchases/items, atomic receipt saves and monthly aggregate RPC.
- `202609050008_demo_offers.sql` — clearly simulated US/Canadian pricing samples.

Old applied migrations were not rewritten. New shared tables are read-only to authenticated users; private rows use owner RLS, with composite owner foreign keys where appropriate. Elevated mutations check the caller and anonymous execution is revoked.

## Verification

- TypeScript: PASS.
- ESLint: PASS.
- Vitest: **59 tests pass across 6 files**, including actual PostgreSQL migrations/RLS in PGlite, deterministic meal math/portions/exclusions, shopping and pantry calculations, inventory idempotency, unit conversions, receipt math/ownership/idempotency, separate currencies, price metrics and history.
- Production build: PASS (`npm run build`, Next.js 16.3.4). A cached sandbox process error was resolved by clearing only generated Turbopack cache and rebuilding with required process access; no source workaround was needed.
- Playwright: **1 complete workflow passes**. Login → saved onboarding resume → dashboard controls → generate/swap/save week → grocery requirements → add/edit pantry → recalculate groceries → complete meal → three concurrent duplicate completions → exactly one stock deduction → matched purchase → budget total → logout/login → persisted plans, inventory, shopping and receipt. Existing tracking/export checks retained. Desktop and 390px mobile layouts checked; screenshots in ignored `test-results/`.
- Live Supabase SQL: Phase 4–6 save/recalculation/receipt idempotency, cross-user isolation, catalog write rejection, all-public-table RLS and anonymous RPC rejection PASS. Fixtures rolled back. Prior live Phase 1–3 checks remain recorded in README and `supabase/tests/security.sql`.

## Known limitations and deferred scope

- Nutrition is a labeled development reference estimate, not a verified packaged-product database. The heuristic may miss individual targets; deviations are displayed. No guarantee every restriction/target combination has a viable template.
- All offer prices, histories and promotions are simulated and say “Demo pricing.” There is no live retailer integration, cart optimizer, distance routing, predictive price recommendation, advanced Smart Swap or predictive inventory.
- Pantry is one aggregate row per ingredient, not multiple expiring lots. Grocery availability conservatively excludes stock expiring before the selected shopping period ends. Volumes without reliable density are unsupported.
- Pantry stocking, grocery checkoffs and purchase logging are separate explicit actions.
- USD and CAD are kept separate. Original US onboarding ZIP/store preferences are preserved; broader Canadian onboarding is not added. Changing the monthly budget sets the ongoing target; historical targets are not snapshotted.
- Real SMTP/inbox confirmation/recovery testing and Vercel deployment remain pending from the foundation. This run did not deploy or add photos/storage/notifications.

## Exact next step

**Stop.** When the user explicitly resumes: **Phase 7 — progress analytics, charts and weekly summaries**, per the master specification. Do not start Phase 8 (photos/storage/meal prep), Phase 9 (advanced optimization), or Phase 10 (deployment) without the appropriate requested scope.

Local preview: http://127.0.0.1:3000. Runtime environment uses only the supplied public Supabase configuration; no service-role key is exposed to the app.

## Cleanup and usage stop

Temporary QA account and all its records were removed after the passing browser test; `.env.qa` no longer exists. SQL fixtures were rolled back. Final whitespace check passed.

Last account check: **91% of the five-hour allowance used**, with the credit balance unchanged at **2,500**. No credits consumed and no reset redeemed. Stopped with a usage buffer; no speculative follow-up work.

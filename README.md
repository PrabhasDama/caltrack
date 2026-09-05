# CalTrack

Eat better. Spend smarter. Reach your goal.

A real Next.js / Supabase application implementing **Phases 1–6** of the CalTrack specification. Accounts, onboarding, and daily tracking persist in PostgreSQL with per-user row-level security. The advanced pricing engine has deliberately not been started.

## Implemented scope

- **Phase 1:** Next.js App Router, React, TypeScript, Tailwind, shadcn-style Radix components, Lucide, email/password authentication, sign-up confirmation, login/logout, password recovery/reset, protected layouts/actions, schema migrations, RLS, and light/dark/system themes.
- **Phase 2:** Nine-step onboarding, resume after a saved step, normalized goals/macros/preferences/budget/store selections, metric/imperial conversion, transparent calorie estimates, manual target comparison, validation and warning acknowledgment. Final onboarding writes are atomic.
- **Phase 3:** Today dashboard, local-calendar daily logs, historical date selection, eight quick check-ins, water increments/undo/goal completion, one editable workout and weigh-in per local day, Monday–Sunday workout progress, weight history and a sparkline, meal entries/completion/skip/undo/delete, extra food, inferred nutrition, private JSON export, and responsive navigation.

- **Phase 4:** A deterministic template generator; 36 normalized reference foods and 12 reusable meals; nutrition calculated per ingredient; saved weekly plans; day regeneration; meal swaps with macro deltas; strict exclusions and restriction filters; practical quantity bounds; concurrent-save protection. Generated meals appear on Today alongside manual entries.
- **Phase 5:** Pantry quantity/unit/date management; low-stock, depleted and expired states; grocery requirements from uneaten saved meals minus usable pantry; manual shopping items, quantity edits, checkoffs and safe clearing. Meal completion consumes usable stock transactionally and repeated requests do not consume it twice.
- **Phase 6:** Editable monthly budgets; receipt and line-item creation/edit/delete; paginated purchase history; complete monthly spending totals and conservative projections; USD/CAD separation; food/product/location/offer relationships; a provider interface and clearly labeled demo offers; unit-price, nutrition-cost and price-history helpers.

Real accounts receive no fake progress, pantry stock, plans or purchases. Shared food and pricing seeds are development reference data. Advanced optimization, predictive inventory, progress photos and expanded analytics remain deferred.

## Local setup

Use Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
```

Set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The publishable key is designed for app use. **Never add a service-role/secret key to a `NEXT_PUBLIC_` variable.** This application needs no service-role credential at runtime. `.env.local`, `.env.qa`, build files, and test output are excluded from Git.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --linked
npm run dev
```

Alternatively, run each SQL migration in `supabase/migrations/` in filename order in Supabase's SQL Editor. All tables, constraints, indexes, triggers, and policies are created by the migrations. Applying with the CLI is preferred because it tracks migration history. Do not rerun already-applied migrations manually.

The connected development project has migrations `202609050001` through `202609050008` applied. Never use `supabase db reset --linked` against an account with real data.

## Authentication configuration

In Supabase **Authentication → URL Configuration**, set the Site URL to your application origin and allow these redirect URLs for each actual local/deployed origin:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=/reset-password`
- `http://127.0.0.1:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback?next=/reset-password`
- Your production origin with the same callback paths.

Use a consistent origin in the browser and `NEXT_PUBLIC_APP_URL` for PKCE flows. Keep email confirmation enabled. Configure a real SMTP provider before opening registration to the public; Supabase's built-in email service has recipient and rate restrictions. Configure Auth rate limits and optionally CAPTCHA in Supabase for public deployment.

The default Supabase confirmation template works with `/auth/callback` (PKCE, same browser). For confirmation links that should also work on another device, use this link in the Confirm signup template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your account</a>
```

And in Reset password:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

`/auth/confirm` allowlists supported OTP types; callback redirects never accept arbitrary external URLs. Protected pages and every mutation validate the user with Supabase. The proxy refreshes tokens; private pages and export responses are not publicly cached.

## Deployment on Vercel

This project uses the requested official Next.js runtime and Supabase stack. It is ready for Vercel's Next.js preset; it is not converted to a static mockup or a different backend to fit a hosting starter.

1. Push this repository to your Git provider and import it into Vercel.
2. Set the three environment variables above. `NEXT_PUBLIC_APP_URL` must be the exact HTTPS deployment origin.
3. Use Node.js 24, install `npm ci`, build `npm run build` (defaults are sufficient).
4. Apply pending Supabase migrations, configure allowed redirects and production SMTP, then deploy.
5. Run the login/onboarding/tracking flow against the deployed origin before sharing publicly.

The public frontend is **not deployed by this workspace build**. The local preview connects to the live Supabase database. Vercel credentials and production SMTP are not stored in this repository.

## Data and security

- Private tables key every row to `auth.users` through `profiles`. RLS policies restrict both reads and writes to the authenticated owner.
- `handle_new_user` creates an empty profile on signup. It cannot be executed by browser roles.
- Food/store reference tables are readable only by authenticated users; there are no client write policies for the shared catalog.
- `save_onboarding` runs as the caller under RLS and atomically saves normalized profile, goals, macros, food preferences, stores, and budget.
- `add_water` performs a database upsert/increment, so concurrent increments don't lose each other. Completing the water goal preserves a higher existing intake.
- `set_meal_status` is an authenticated elevated API function. It explicitly verifies ownership, locks the meal, groups/locks ingredients in UUID order, and records exactly how much stock was deducted. Duplicate completions do nothing. Undo/skip/delete restore only actual deductions, including when stock was initially insufficient. Inventory never becomes negative.
- Direct client updates/deletion of meal statuses and writes to the consumption ledger are revoked. All statuses pass through that transaction.
- The intentionally authenticated `SECURITY DEFINER` functions `set_meal_status`, `save_meal_plan`, and `save_purchase` explicitly check ownership and have transaction/RLS tests. Shared catalog writes and direct private plan writes are revoked. Receipt writes use a stable request UUID and optimistic edit timestamps. No anonymous elevated RPC is intentional.
- Zod validates every server action. Date mutations are limited to today or the prior year in the profile's time zone. Weeks start Monday. Weight is stored in kilograms; height and pantry quantities use centimeters and grams.
- No photos, storage buckets, sharing policies, external LLMs, notification delivery, or live retailer APIs are enabled.
- JSON export includes plans, grocery lists, pantry movements, purchases and receipt items (format version 2).

## Nutrition assumptions

`lib/nutrition/macros.ts` contains the deterministic calculations, separate from UI components.

- [Mifflin–St Jeor resting-energy equation](https://pubmed.ncbi.nlm.nih.gov/2305711/), followed by a stated activity multiplier. Omitting the optional sex input uses the midpoint of the equation constants and is disclosed as a rougher estimate.
- Product defaults: modest goal adjustments, protein 1.4 g/kg for maintenance or 1.6 g/kg otherwise (capped at 30% of energy), fat 28%, carbohydrate from remaining energy, fiber 14 g/1,000 kcal. The fiber convention is documented by [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html).
- Recommendation floor: 1,500 kcal; manual entry floor: 1,200 kcal with acknowledgment below 1,500. These are application guardrails, not evidence that those intakes suit every user. Adults only; no medical, pregnancy, or breastfeeding recommendations.
- Manual targets are checked for very low calories/fat/fiber, unusually high protein/calories, and mismatched energy totals. Aggressive pace also requires acknowledgment.
- Grocery budget is a spending allowance, not an invented cost estimate. Actual estimated meal cost only comes from amounts the user enters.

The meal generator uses a bounded template heuristic rather than advanced optimization. It attempts calorie/protein/fiber targets and displays deviations. Exclusions, dislikes, cooking limits and dietary restrictions filter eligible templates. Halal/kosher preferences use conservative plant-only choices and disclose the need to verify certification.

Food nutrition is labeled as a development estimate; it is not claimed to be verified branded-package nutrition. Quantities consistently use each food’s raw/dry/prepared form. Pantry stores one combined row per ingredient; use the earliest expiry when combining batches. Weight units convert directly; piece/serving conversions require a reference weight. No cup/volume density is invented.

The demo provider includes illustrative US/Canadian locations and simulated package offers, observations and deals. Every visible offer says **Demo pricing**. Prices are not live, checkout estimates or retailer quotes. Currency amounts are never combined through an invented exchange rate. Onboarding retains the original US ZIP/store-selection flow; the price schema supports US and Canadian locations and budgets support both currencies. Purchases do not automatically restock pantry. Monthly budget edits set the ongoing target; historical monthly target snapshots are not stored.

The weight chart explicitly labels its seven-entry average. It does not claim a seven-day trend when days are missing. Goal ETAs and plateau detection are deferred.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Vitest runs real PostgreSQL semantics using PGlite, including migration application, RLS policies, forged ownership, idempotent completion, partial stock consumption/restoration, calendar rollover, formula calculations, and onboarding validation.

For an additional check on a connected Supabase project:

```sh
supabase db query --linked --file supabase/tests/security.sql --output json
supabase db query --linked --file supabase/tests/phases_4_6_security.sql --output json
```

This creates isolated fixtures inside a transaction, tests live RLS/meal transactions, and rolls everything back. It never writes sample progress into existing accounts.

### End-to-end browser tests

Run the app locally, then:

```sh
node scripts/qa-account.mjs
npm run test:e2e
node scripts/qa-account.mjs --cleanup
```

The helper requires an authenticated Supabase CLI. It creates a temporary confirmed QA account **without sending email**, reads administrative credentials only into process memory, writes disposable test-login details to an ignored file, and deletes the account and its records on cleanup. The browser test covers route protection, login, resumable onboarding, daily controls, desktop/mobile layout, dark mode, export, and logout/login persistence. It also generates/swaps/saves a week, recalculates groceries after pantry edits, completes a meal with three concurrent repeated completion requests, logs a matched purchase and verifies the budget and persisted records. Always run cleanup even if a test fails. The default test configuration uses local Google Chrome on macOS; change `launchOptions.executablePath` or install Playwright Chromium on another platform.

Email delivery itself must be tested with an inbox you control after configuring SMTP. The QA suite does not send mail to other people.

## Project map

- `app/`: routes, server actions, authenticated route group, auth callbacks, error/loading states.
- `components/onboarding/steps/`: independent onboarding steps and shared controls.
- `components/dashboard/`: daily cards, tracking forms, lazy-loaded charts.
- `lib/services/`: authenticated data loading; no scattered Supabase calls in UI components.
- `lib/nutrition/`, `lib/date/`, `lib/analytics/`, `lib/validation/`: calculations and validation.
- `supabase/migrations/`, `supabase/tests/`: database definition and live verification.
- `tests/`: deterministic/PostgreSQL tests and browser acceptance tests.

Verified at this checkpoint: **59 automated domain/Postgres tests**, **1 complete browser workflow**, TypeScript, lint and production build. All 8 migrations are applied and live RLS checks pass.

Next implementation milestone, only when requested: **Phase 7 — progress analytics, charts and weekly summaries.** Phase 8 covers progress photos/storage/meal prep; advanced swaps, shopping optimization and predictive inventory remain Phase 9. This run stops at Phase 6.

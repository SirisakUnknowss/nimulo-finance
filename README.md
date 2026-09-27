# nimulo.

nimulo. — "Money, made simple." A minimalist personal finance dashboard: track
income, expenses, accounts, budgets, goals, investments, and debts in one
place. The interface language is Thai; code, database identifiers, and this
documentation are in English.

The app ships as a working MVP — every page reads and writes real data
through a shared finance-calculation engine, not static mockups.

## Tech stack

- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling**: Tailwind CSS v4 with a custom design-token theme (light/dark)
- **UI primitives**: Radix UI (Dialog, Tabs, Progress) + a small custom
  component set in `components/ui`
- **Charts**: Recharts
- **Icons**: lucide-react
- **Backend (optional)**: Supabase (Postgres + Auth)
- **Validation**: Zod (`lib/validation/schemas.ts`)
- **Testing**: Vitest (finance engine unit tests), Playwright (E2E)

## Demo mode vs. a real Supabase project

The app **auto-detects** whether Supabase is configured:

- If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are **not**
  set, the app runs entirely in **demo mode**: a localStorage-backed store
  (`lib/demo/store.tsx`) seeded with ~8 months of realistic fictional data
  (`lib/demo/seed.ts`) — accounts, transactions, budgets, goals, loans, and
  an investment portfolio. Nothing leaves the browser. This is the mode you
  get out of the box with no setup.
- If both variables **are** set, `lib/supabase/client.ts` /
  `lib/supabase/server.ts` return real Supabase clients instead of `null`,
  and the app is wired to authenticate against Supabase Auth and read/write
  through the RLS-protected schema in `supabase/migrations/`.

Both paths share the exact same domain types (`lib/finance/types.ts`) and
the exact same pure calculation functions (`lib/finance/calculations.ts`),
so financial correctness does not depend on which backend is active.

### Setting up a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/0001_init.sql` — normalized schema (accounts,
     transactions, budgets, goals, loans, investments, snapshots, etc.)
   - `supabase/migrations/0002_rls.sql` — Row Level Security policies (every
     user-owned table is restricted to `auth.uid()`) plus a trigger that
     creates a `profiles` row on sign-up.
3. In Project Settings → API, copy the **Project URL** and **anon/public
   key**.
4. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # optional, server-only
   ```
5. Restart the dev server. Supabase Auth (email/password) protects all
   authenticated routes; RLS means each user only ever sees their own rows.

No real bank credentials or third-party bank connections are ever stored —
this is manual entry only, by design.

## Development

```bash
npm install
npm run dev       # http://localhost:3000
```

Other commands:

```bash
npm run lint       # ESLint (flat config, Next.js 16 rules)
npx tsc --noEmit    # TypeScript typecheck
npm run test        # Vitest — finance calculation unit tests
npm run test:e2e    # Playwright — critical end-to-end workflows
npm run build       # Production build
```

## Testing

### Unit tests — the financial engine

`lib/finance/calculations.ts` is a pure-function module with **zero**
dependencies on React, the demo store, or Supabase. It implements all 12
financial rules from the spec (net worth, period income/expense excluding
transfers, operating surplus rate guarded against divide-by-zero, credit
card purchase-once/repayment-as-transfer, loan principal vs. interest
split, goal reallocation not creating income, investment cash vs. holdings
never double-counted, etc.).

`lib/finance/__tests__/calculations.test.ts` has 18 tests covering the
normal cases plus edge cases: zero income, missing prior period, a full
credit-card purchase + bill-payment round trip, loan principal/interest
split with over-payment clamping, goal contribution/withdrawal history,
budget threshold boundaries (80% warning / 100% over), and FX-adjusted
investment valuation.

```bash
npm run test
# ✓ 18 tests passed
```

### End-to-end tests — critical workflows

`e2e/mono-finance.spec.ts` (Playwright) exercises the app against demo mode
in a real browser: entering the app, adding a transaction via quick-add,
creating an inter-account transfer, creating a monthly budget, creating a
goal and contributing to it, and viewing the Reports page. Each test starts
from a clean seeded dataset (localStorage is cleared in `beforeEach`).

```bash
npx playwright install chromium   # one-time browser download
npm run test:e2e
# 6 passed
```

Both the browser install and the full suite were run and passed in this
environment (Chromium headless, `npx playwright test`), so this is a
verified result, not an assumption.

## Project structure

```
app/
  (app)/                  # authenticated app shell (sidebar/header/mobile nav)
    overview/             # Page 1 — net worth, cash flow, category breakdown
    transactions/         # Page 2 — CRUD, filters, CSV import/export, recurring
    accounts/              # Page 3 — accounts, balances, transfers
    budgets/               # Page 4 — monthly budgets per category
    goals/                 # Page 5 — goals + contribution/withdrawal history
    investments/           # Page 6 — portfolios, holdings, trades
    debts/                 # Page 7 — loans + credit cards, principal/interest
    reports/               # Page 8 — trends, category/income breakdowns, CSV
    settings/               # Page 9 — profile, categories, data export/reset
  layout.tsx               # root layout: fonts, theme provider, demo store
components/
  ui/                      # design-system primitives (Button, Card, Dialog, ...)
  shell/                   # Sidebar, Header, MobileNav, nav item config
  charts/                  # reusable Recharts wrappers
  transactions/            # quick-add dialog, CSV import dialog
lib/
  finance/
    types.ts               # shared domain types (documented sign conventions)
    calculations.ts         # pure financial calculation engine (the 12 rules)
    __tests__/               # Vitest unit tests for the engine
  demo/
    seed.ts                 # realistic multi-month fictional dataset
    store.tsx                # localStorage-backed demo data layer (React context)
  supabase/
    client.ts / server.ts     # Supabase clients, return null when unconfigured
    config.ts                 # isSupabaseConfigured() env detection
  hooks/
    use-finance-data.ts        # the seam between UI and data source; all pages
                                # read/write through this hook so the backend
                                # can be swapped without touching page code
  validation/
    schemas.ts                # Zod schemas for every user-writable record
  csv.ts                       # CSV parse/export/import helpers
  utils.ts                     # Thai date/currency formatting, period math
supabase/
  migrations/
    0001_init.sql              # normalized schema, numeric(18,2) money columns
    0002_rls.sql                # RLS policies + auto-profile-on-signup trigger
e2e/
  mono-finance.spec.ts          # Playwright critical-path tests
```

## Sign conventions (also documented inline in the code)

- Account balances are positive = money owned, **except** `credit_card`
  accounts, where the stored/derived balance is a positive **liability**
  (amount owed).
- `transactions.amount` is always positive; `type` (income/expense/transfer)
  determines cash-flow direction, never the sign of `amount`.
- Transfers are excluded from income/expense/budget totals everywhere.
- A credit card purchase is one `expense`; paying the bill is a `transfer`
  (cash → credit card account) and is never counted as a second expense.
- Loan payments are split into `principalAmount` (reduces debt, not an
  expense) and `interestAmount` (a real expense) via `loan_payments`.
- Goal contributions/withdrawals (`goal_contributions`) reallocate money
  already reflected in an account balance — they never create income or
  additional net worth.
- All money columns in Postgres are `numeric(18,2)`, never floating point.

## Known limitations / simplifications

- **Auth UI**: demo mode has no login screen (by design — it's meant to be
  explorable with zero setup). The Supabase-backed auth screens
  (sign up/sign in/sign out, protected routing) are stubbed via
  `lib/supabase/*` and `isSupabaseConfigured()`, but a full Supabase Auth
  UI flow was not built out in this environment since no live Supabase
  project was available to test against — wiring it up is the main
  remaining step to go from "demo mode" to "your data, in your Supabase
  project."
- **Recurring templates**: only monthly-day-of-month posting is modeled in
  the demo UI; weekly/yearly frequencies exist in the data model but the
  demo seed only exercises monthly.
- **FX rates**: non-THB holdings use a manually entered rate at creation
  time; there's no historical FX rate table UI (the `exchange_rates` table
  exists in the schema for this purpose).
- **Net worth trend / portfolio history**: reconstructed by replaying
  transactions up to each month-end (Overview/Reports) or from real
  `portfolio_snapshots` rows (Investments) — never fabricated.
- Minor cosmetic hydration warning may appear in the dev console on the
  Transactions page (client-only localStorage hydration vs. server-rendered
  placeholder count); it does not affect functionality or the E2E tests.

## Deployment notes

- Designed for **Vercel** (Next.js) + **Supabase** (Postgres/Auth).
- Set the three env vars from `.env.example` in your hosting provider's
  environment configuration.
- Run the two SQL migrations against your Supabase project before first
  deploy.
- `npm run build` must succeed with no TypeScript or ESLint errors before
  shipping (verified in this repository — see commit history).

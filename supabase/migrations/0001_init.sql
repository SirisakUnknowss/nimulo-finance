-- MONO Finance initial schema
-- Sign conventions:
--   * All money columns are numeric(18,2), never floating point.
--   * accounts.opening_balance: positive = amount owned for cash/bank/
--     e_wallet/investment_cash accounts. For credit_card accounts it is the
--     amount OWED (a positive liability) at account creation.
--   * transactions.amount is always >= 0. transactions.type determines cash
--     flow direction ('income' | 'expense' | 'transfer'). Transfers are
--     never counted as income or expense.
--   * loan_accounts.opening_principal is the original loan amount; the
--     remaining balance is derived by subtracting the sum of
--     loan_payments.principal_amount (never stored redundantly).
--   * holdings market value = quantity * latest_price (* fx_rate_to_base
--     when currency != profiles.base_currency).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  base_currency text not null default 'THB',
  timezone text not null default 'Asia/Bangkok',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','e_wallet','investment_cash','credit_card')),
  currency text not null default 'THB',
  opening_balance numeric(18,2) not null default 0,
  opening_date date not null default current_date,
  credit_limit numeric(18,2),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_accounts_user on accounts(user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  color text not null default '#467A64',
  icon text,
  archived boolean not null default false
);
create index if not exists idx_categories_user on categories(user_id);

-- ---------------------------------------------------------------------------
-- recurring_templates
-- ---------------------------------------------------------------------------
create table if not exists recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(18,2) not null check (amount >= 0),
  account_id uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  merchant text,
  note text,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  day_of_month int,
  start_date date not null,
  end_date date,
  last_posted_period text,
  active boolean not null default true
);
create index if not exists idx_recurring_user on recurring_templates(user_id);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(18,2) not null check (amount >= 0),
  date date not null,
  account_id uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  merchant text,
  note text,
  tags text[] not null default '{}',
  recurring_template_id uuid references recurring_templates(id) on delete set null,
  transfer_group_id uuid,
  is_loan_principal_repayment boolean not null default false,
  loan_account_id uuid,
  created_at timestamptz not null default now(),
  constraint chk_transfer_has_to_account check (
    (type <> 'transfer') or (to_account_id is not null)
  ),
  constraint chk_income_expense_has_category check (
    (type = 'transfer') or (category_id is not null)
  )
);
create index if not exists idx_transactions_user_date on transactions(user_id, date desc);
create index if not exists idx_transactions_account on transactions(account_id);
create index if not exists idx_transactions_category on transactions(category_id);

-- ---------------------------------------------------------------------------
-- budgets (one row per category per month)
-- ---------------------------------------------------------------------------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  "limit" numeric(18,2) not null check ("limit" >= 0),
  unique (user_id, category_id, period)
);
create index if not exists idx_budgets_user_period on budgets(user_id, period);

-- ---------------------------------------------------------------------------
-- goals + contributions
-- ---------------------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('emergency_fund','travel','vehicle','home','custom')),
  target_amount numeric(18,2) not null check (target_amount >= 0),
  target_date date,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_goals_user on goals(user_id);

create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,2) not null, -- positive = contribution, negative = withdrawal
  date date not null,
  account_id uuid references accounts(id) on delete set null,
  note text
);
create index if not exists idx_goal_contrib_goal on goal_contributions(goal_id);

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------
create table if not exists loan_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('installment_loan','credit_card')),
  opening_principal numeric(18,2) not null check (opening_principal >= 0),
  interest_rate numeric(6,3) not null default 0,
  minimum_payment numeric(18,2),
  due_day_of_month int,
  start_date date not null,
  archived boolean not null default false
);
create index if not exists idx_loans_user on loan_accounts(user_id);

create table if not exists loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_account_id uuid not null references loan_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  principal_amount numeric(18,2) not null check (principal_amount >= 0),
  interest_amount numeric(18,2) not null check (interest_amount >= 0),
  transaction_id uuid references transactions(id) on delete set null
);
create index if not exists idx_loan_payments_loan on loan_payments(loan_account_id);

-- ---------------------------------------------------------------------------
-- investments
-- ---------------------------------------------------------------------------
create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'THB',
  cash_account_id uuid references accounts(id) on delete set null
);
create index if not exists idx_portfolios_user on portfolios(user_id);

create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  asset_type text not null check (asset_type in ('stock','etf','mutual_fund','other')),
  quantity numeric(18,6) not null default 0,
  avg_cost numeric(18,4) not null default 0,
  currency text not null default 'THB',
  latest_price numeric(18,4) not null default 0,
  latest_price_date date not null default current_date,
  fx_rate_to_base numeric(18,6),
  fx_rate_date date
);
create index if not exists idx_holdings_portfolio on holdings(portfolio_id);

create table if not exists investment_trades (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references holdings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('buy','sell','dividend')),
  quantity numeric(18,6) not null default 0,
  price numeric(18,4) not null default 0,
  amount numeric(18,2) not null check (amount >= 0),
  date date not null,
  transaction_id uuid references transactions(id) on delete set null
);
create index if not exists idx_trades_holding on investment_trades(holding_id);

create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  market_value numeric(18,2) not null,
  invested_capital numeric(18,2) not null,
  unique (portfolio_id, date)
);
create index if not exists idx_snapshots_portfolio on portfolio_snapshots(portfolio_id, date);

-- ---------------------------------------------------------------------------
-- exchange rates (manual)
-- ---------------------------------------------------------------------------
create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null,
  rate_to_base numeric(18,6) not null,
  effective_date date not null,
  unique (user_id, currency, effective_date)
);

-- ---------------------------------------------------------------------------
-- net worth snapshots (for historical reconstruction without recompute)
-- ---------------------------------------------------------------------------
create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_assets numeric(18,2) not null,
  total_liabilities numeric(18,2) not null,
  net_worth numeric(18,2) not null,
  unique (user_id, date)
);

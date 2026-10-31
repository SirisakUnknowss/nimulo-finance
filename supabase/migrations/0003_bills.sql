-- Bills & Fixed Costs.
--
-- A monthly bill is an obligation, not a ledger entry: creating one never
-- touches transactions or an account balance. Only record_bill_payment does,
-- and it writes the payment, its ledger rows and their links in one database
-- transaction. lib/finance/bills.ts is the demo-mode twin of these functions;
-- change the two together.
--
-- bill_payments and bill_payment_postings have no write policies, so the two
-- RPCs are the only way to change them.
--
-- Reversal never edits or deletes the ledger. It appends contra entries dated
-- like the originals: a swapped transfer, or an equal negative expense or loan
-- payment, so every existing total nets out with no change to how it is
-- computed. That is the one case amounts may be negative, enforced below.

-- ---------------------------------------------------------------------------
-- Existing ledger tables
-- ---------------------------------------------------------------------------
alter table transactions
  add column if not exists bill_payment_id uuid,
  add column if not exists reversal_of_transaction_id uuid references transactions(id) on delete set null;

alter table transactions drop constraint if exists transactions_amount_check;
alter table transactions add constraint transactions_amount_check
  check (amount >= 0 or reversal_of_transaction_id is not null);

-- Loan principal is a flagged expense with no category. The original constraint
-- rejected those rows, which the app has always created.
alter table transactions drop constraint if exists chk_income_expense_has_category;
alter table transactions add constraint chk_income_expense_has_category check (
  type = 'transfer' or category_id is not null or is_loan_principal_repayment
);

alter table loan_payments
  add column if not exists reversal_of_loan_payment_id uuid references loan_payments(id) on delete set null;

alter table loan_payments drop constraint if exists loan_payments_principal_amount_check;
alter table loan_payments drop constraint if exists loan_payments_interest_amount_check;
alter table loan_payments add constraint loan_payments_amounts_check
  check ((principal_amount >= 0 and interest_amount >= 0) or reversal_of_loan_payment_id is not null);

-- ---------------------------------------------------------------------------
-- fixed_cost_rules
-- ---------------------------------------------------------------------------
create table if not exists fixed_cost_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cashflow_kind text not null check (cashflow_kind in ('expense','loan_payment','credit_card_payment','transfer','saving','investment')),
  default_amount numeric(18,2) not null check (default_amount >= 0),
  -- [{"fromPeriod":"YYYY-MM","amount":850}]: dated so a month generated late
  -- still gets the amount that applied to it.
  amount_changes jsonb not null default '[]',
  amount_mode text not null default 'fixed' check (amount_mode in ('fixed','estimate')),
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  due_rule text not null default 'day_of_month' check (due_rule in ('day_of_month','last_day')),
  due_day int check (due_day between 1 and 31),
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid references categories(id) on delete set null,
  default_account_id uuid references accounts(id) on delete set null,
  target_account_id uuid references accounts(id) on delete set null,
  loan_account_id uuid references loan_accounts(id) on delete set null,
  note text,
  is_active boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_rule_due check (due_rule = 'last_day' or due_day is not null),
  constraint chk_rule_months check (end_month is null or end_month >= start_month)
);
create index if not exists idx_fixed_cost_rules_user on fixed_cost_rules(user_id);

-- ---------------------------------------------------------------------------
-- monthly_bills
-- ---------------------------------------------------------------------------
create table if not exists monthly_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixed_cost_rule_id uuid references fixed_cost_rules(id) on delete set null,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'), -- Asia/Bangkok
  name_snapshot text not null,
  cashflow_kind_snapshot text not null check (cashflow_kind_snapshot in ('expense','loan_payment','credit_card_payment','transfer','saving','investment')),
  amount_due numeric(18,2) not null check (amount_due >= 0),
  user_edited boolean not null default false,
  due_date date not null,
  planned_account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  target_account_id uuid references accounts(id) on delete set null,
  loan_account_id uuid references loan_accounts(id) on delete set null,
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active','skipped','cancelled')),
  note text,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NULLs are distinct, so one-time bills (no rule) can repeat within a month.
  unique (user_id, fixed_cost_rule_id, period)
);
create index if not exists idx_monthly_bills_user_period on monthly_bills(user_id, period);

-- ---------------------------------------------------------------------------
-- bill_payments
-- ---------------------------------------------------------------------------
create table if not exists bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_id uuid not null references monthly_bills(id),
  amount numeric(18,2) not null check (amount > 0),
  paid_at timestamptz not null,
  source_account_id uuid not null references accounts(id),
  posting_group_id uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  reversed_at timestamptz,
  reversal_reason text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists idx_bill_payments_bill on bill_payments(user_id, bill_id, paid_at);

alter table transactions drop constraint if exists transactions_bill_payment_id_fkey;
alter table transactions add constraint transactions_bill_payment_id_fkey
  foreign key (bill_payment_id) references bill_payments(id) deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- bill_payment_postings: one payment can post several ledger rows
-- ---------------------------------------------------------------------------
create table if not exists bill_payment_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_payment_id uuid not null references bill_payments(id),
  transaction_id uuid unique references transactions(id),
  loan_payment_id uuid unique references loan_payments(id),
  is_reversal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chk_posting_one_target check (num_nonnulls(transaction_id, loan_payment_id) = 1)
);
create index if not exists idx_bill_postings_payment on bill_payment_postings(bill_payment_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fixed_cost_rules enable row level security;
alter table monthly_bills enable row level security;
alter table bill_payments enable row level security;
alter table bill_payment_postings enable row level security;

create policy "fixed_cost_rules_owner" on fixed_cost_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "monthly_bills_owner" on monthly_bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bill_payments_read" on bill_payments
  for select using (user_id = auth.uid());

create policy "bill_payment_postings_read" on bill_payment_postings
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Foreign keys ignore RLS, so without this a row could point at another user's
-- account. Runs as the caller, so another user's rows are simply not visible.
create or replace function public.assert_bill_refs_owned()
returns trigger as $$
declare
  j jsonb := to_jsonb(new);
  account_ids uuid[] := array_remove(array[
    (j->>'default_account_id')::uuid,
    (j->>'planned_account_id')::uuid,
    (j->>'target_account_id')::uuid
  ], null);
begin
  if exists (
    select 1 from unnest(account_ids) as ref(id)
    where not exists (select 1 from public.accounts a where a.id = ref.id and a.user_id = new.user_id)
  ) then
    raise exception 'BILL_FOREIGN_ACCOUNT';
  end if;
  if new.category_id is not null
    and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
    raise exception 'BILL_FOREIGN_CATEGORY';
  end if;
  if new.loan_account_id is not null
    and not exists (select 1 from public.loan_accounts l where l.id = new.loan_account_id and l.user_id = new.user_id) then
    raise exception 'BILL_FOREIGN_LOAN';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_fixed_cost_rules_refs before insert or update on fixed_cost_rules
  for each row execute procedure public.assert_bill_refs_owned();
create trigger trg_monthly_bills_refs before insert or update on monthly_bills
  for each row execute procedure public.assert_bill_refs_owned();

create or replace function public.guard_monthly_bill()
returns trigger as $$
declare
  paid numeric(18,2);
begin
  select coalesce(sum(amount), 0) into paid from public.bill_payments
  where bill_id = new.id and reversed_at is null;
  if new.amount_due < paid then
    raise exception 'BILL_AMOUNT_BELOW_PAID';
  end if;
  if new.lifecycle_state <> 'active' and paid > 0 then
    raise exception 'BILL_HAS_PAYMENTS';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_monthly_bills_guard before update on monthly_bills
  for each row execute procedure public.guard_monthly_bill();

-- Rows posted by a payment change only through reversal. Delete is already
-- blocked by the postings foreign key. Columns that foreign keys null out are
-- left out so deleting an account or category elsewhere still works.
create or replace function public.guard_posted_transaction()
returns trigger as $$
begin
  if (old.amount, old.date, old.account_id, old.type) is distinct from (new.amount, new.date, new.account_id, new.type) then
    raise exception 'BILL_POSTING_READ_ONLY';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_transactions_posted before update on transactions
  for each row when (old.bill_payment_id is not null)
  execute procedure public.guard_posted_transaction();

create or replace function public.guard_posted_loan_payment()
returns trigger as $$
begin
  if exists (select 1 from public.bill_payment_postings where loan_payment_id = old.id)
    and (old.principal_amount, old.interest_amount, old.date) is distinct from (new.principal_amount, new.interest_amount, new.date) then
    raise exception 'BILL_POSTING_READ_ONLY';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_loan_payments_posted before update on loan_payments
  for each row execute procedure public.guard_posted_loan_payment();

-- ---------------------------------------------------------------------------
-- record_bill_payment: all-or-nothing, and safe to retry with the same key.
-- SECURITY DEFINER because callers have no write policy on bill_payments, so
-- every lookup below checks ownership against auth.uid() explicitly.
-- ---------------------------------------------------------------------------
create or replace function public.record_bill_payment(
  p_bill_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_source_account_id uuid,
  p_idempotency_key text,
  p_target_account_id uuid default null,
  p_principal_amount numeric default null,
  p_interest_amount numeric default null,
  p_reference text default null,
  p_note text default null
)
returns public.bill_payments as $$
declare
  v_user uuid := auth.uid();
  v_bill public.monthly_bills;
  v_source public.accounts;
  v_target public.accounts;
  v_loan public.loan_accounts;
  v_payment public.bill_payments;
  v_kind text;
  v_date date := (p_paid_at at time zone 'Asia/Bangkok')::date;
  v_paid numeric(18,2);
  v_principal numeric(18,2) := coalesce(p_principal_amount, 0);
  v_interest numeric(18,2) := coalesce(p_interest_amount, 0);
  v_remaining_principal numeric(18,2);
  v_tx uuid;
  v_first_tx uuid;
  v_loan_payment uuid;
begin
  if v_user is null then raise exception 'BILL_NOT_AUTHENTICATED'; end if;
  if p_amount is null or round(p_amount, 2) <> p_amount or p_amount <= 0 then raise exception 'BILL_INVALID_AMOUNT'; end if;
  if coalesce(p_idempotency_key, '') = '' then raise exception 'BILL_MISSING_KEY'; end if;

  -- Serialises payments on one bill, so the checks below see a settled total.
  select * into v_bill from public.monthly_bills
  where id = p_bill_id and user_id = v_user for update;
  if not found then raise exception 'BILL_NOT_FOUND'; end if;

  select * into v_payment from public.bill_payments
  where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_payment.bill_id <> p_bill_id then raise exception 'BILL_KEY_REUSED'; end if;
    return v_payment;
  end if;

  if v_bill.lifecycle_state <> 'active' then raise exception 'BILL_NOT_ACTIVE'; end if;

  select coalesce(sum(amount), 0) into v_paid from public.bill_payments
  where bill_id = p_bill_id and reversed_at is null;
  if p_amount > v_bill.amount_due - v_paid then raise exception 'BILL_OVERPAYMENT'; end if;

  select * into v_source from public.accounts
  where id = p_source_account_id and user_id = v_user and not archived;
  if not found then raise exception 'BILL_INVALID_SOURCE'; end if;

  v_kind := v_bill.cashflow_kind_snapshot;
  if v_kind <> 'expense' and v_source.type = 'credit_card' then raise exception 'BILL_SOURCE_IS_CARD'; end if;

  insert into public.bill_payments (user_id, bill_id, amount, paid_at, source_account_id, idempotency_key, reference, note)
  values (v_user, p_bill_id, p_amount, p_paid_at, p_source_account_id, p_idempotency_key, p_reference, p_note)
  returning * into v_payment;

  if v_kind = 'expense' then
    if v_bill.category_id is null then raise exception 'BILL_MISSING_CATEGORY'; end if;
    insert into public.transactions (user_id, type, amount, date, account_id, category_id, merchant, note, bill_payment_id)
    values (v_user, 'expense', p_amount, v_date, v_source.id, v_bill.category_id, v_bill.name_snapshot, p_note, v_payment.id)
    returning id into v_tx;
    insert into public.bill_payment_postings (user_id, bill_payment_id, transaction_id) values (v_user, v_payment.id, v_tx);

  elsif v_kind = 'loan_payment' then
    select * into v_loan from public.loan_accounts
    where id = v_bill.loan_account_id and user_id = v_user and not archived for update;
    if not found then raise exception 'BILL_MISSING_LOAN'; end if;
    if v_principal < 0 or v_interest < 0 or v_principal + v_interest <> p_amount then raise exception 'BILL_SPLIT_MISMATCH'; end if;
    select v_loan.opening_principal - coalesce(sum(principal_amount), 0) into v_remaining_principal
    from public.loan_payments where loan_account_id = v_loan.id;
    if v_principal > v_remaining_principal then raise exception 'BILL_PRINCIPAL_EXCEEDS_DEBT'; end if;

    if v_principal > 0 then
      insert into public.transactions (user_id, type, amount, date, account_id, merchant, note, is_loan_principal_repayment, loan_account_id, bill_payment_id)
      values (v_user, 'expense', v_principal, v_date, v_source.id, v_bill.name_snapshot, p_note, true, v_loan.id, v_payment.id)
      returning id into v_tx;
      v_first_tx := v_tx;
      insert into public.bill_payment_postings (user_id, bill_payment_id, transaction_id) values (v_user, v_payment.id, v_tx);
    end if;
    if v_interest > 0 then
      if v_bill.category_id is null then raise exception 'BILL_MISSING_CATEGORY'; end if;
      insert into public.transactions (user_id, type, amount, date, account_id, category_id, merchant, note, loan_account_id, bill_payment_id)
      values (v_user, 'expense', v_interest, v_date, v_source.id, v_bill.category_id, v_bill.name_snapshot, p_note, v_loan.id, v_payment.id)
      returning id into v_tx;
      v_first_tx := coalesce(v_first_tx, v_tx);
      insert into public.bill_payment_postings (user_id, bill_payment_id, transaction_id) values (v_user, v_payment.id, v_tx);
    end if;

    insert into public.loan_payments (loan_account_id, user_id, date, principal_amount, interest_amount, transaction_id)
    values (v_loan.id, v_user, v_date, v_principal, v_interest, v_first_tx)
    returning id into v_loan_payment;
    insert into public.bill_payment_postings (user_id, bill_payment_id, loan_payment_id) values (v_user, v_payment.id, v_loan_payment);

  else
    select * into v_target from public.accounts
    where id = coalesce(p_target_account_id, v_bill.target_account_id) and user_id = v_user and not archived;
    if not found then raise exception 'BILL_INVALID_TARGET'; end if;
    if v_target.id = v_source.id then raise exception 'BILL_SAME_ACCOUNT'; end if;
    if v_kind = 'credit_card_payment' and v_target.type <> 'credit_card' then raise exception 'BILL_TARGET_NOT_CARD'; end if;
    insert into public.transactions (user_id, type, amount, date, account_id, to_account_id, merchant, note, transfer_group_id, bill_payment_id)
    values (v_user, 'transfer', p_amount, v_date, v_source.id, v_target.id, v_bill.name_snapshot, p_note, v_payment.posting_group_id, v_payment.id)
    returning id into v_tx;
    insert into public.bill_payment_postings (user_id, bill_payment_id, transaction_id) values (v_user, v_payment.id, v_tx);
  end if;

  return v_payment;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- reverse_bill_payment: undoes every posting of a payment together.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_bill_payment(p_payment_id uuid, p_reason text)
returns public.bill_payments as $$
declare
  v_user uuid := auth.uid();
  v_payment public.bill_payments;
  v_tx public.transactions;
  v_lp public.loan_payments;
  v_new uuid;
  v_posting record;
begin
  if v_user is null then raise exception 'BILL_NOT_AUTHENTICATED'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'BILL_MISSING_REASON'; end if;

  select p.* into v_payment from public.bill_payments p
  where p.id = p_payment_id and p.user_id = v_user;
  if not found then raise exception 'BILL_PAYMENT_NOT_FOUND'; end if;

  perform 1 from public.monthly_bills where id = v_payment.bill_id for update;
  select * into v_payment from public.bill_payments where id = p_payment_id;
  if v_payment.reversed_at is not null then raise exception 'BILL_ALREADY_REVERSED'; end if;

  for v_posting in
    select transaction_id, loan_payment_id from public.bill_payment_postings
    where bill_payment_id = p_payment_id and not is_reversal
  loop
    if v_posting.transaction_id is not null then
      select * into v_tx from public.transactions where id = v_posting.transaction_id;
      if v_tx.type = 'transfer' then
        insert into public.transactions (user_id, type, amount, date, account_id, to_account_id, merchant, note, transfer_group_id, bill_payment_id, reversal_of_transaction_id)
        values (v_user, 'transfer', v_tx.amount, v_tx.date, v_tx.to_account_id, v_tx.account_id, 'ย้อนรายการ: ' || coalesce(v_tx.merchant, ''), v_tx.note, v_tx.transfer_group_id, p_payment_id, v_tx.id)
        returning id into v_new;
      else
        insert into public.transactions (user_id, type, amount, date, account_id, category_id, merchant, note, is_loan_principal_repayment, loan_account_id, bill_payment_id, reversal_of_transaction_id)
        values (v_user, v_tx.type, -v_tx.amount, v_tx.date, v_tx.account_id, v_tx.category_id, 'ย้อนรายการ: ' || coalesce(v_tx.merchant, ''), v_tx.note, v_tx.is_loan_principal_repayment, v_tx.loan_account_id, p_payment_id, v_tx.id)
        returning id into v_new;
      end if;
      insert into public.bill_payment_postings (user_id, bill_payment_id, transaction_id, is_reversal) values (v_user, p_payment_id, v_new, true);
    else
      select * into v_lp from public.loan_payments where id = v_posting.loan_payment_id;
      insert into public.loan_payments (loan_account_id, user_id, date, principal_amount, interest_amount, reversal_of_loan_payment_id)
      values (v_lp.loan_account_id, v_user, v_lp.date, -v_lp.principal_amount, -v_lp.interest_amount, v_lp.id)
      returning id into v_new;
      insert into public.bill_payment_postings (user_id, bill_payment_id, loan_payment_id, is_reversal) values (v_user, p_payment_id, v_new, true);
    end if;
  end loop;

  update public.bill_payments set reversed_at = now(), reversal_reason = btrim(p_reason)
  where id = p_payment_id
  returning * into v_payment;
  return v_payment;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.record_bill_payment(uuid, numeric, timestamptz, uuid, text, uuid, numeric, numeric, text, text) from public, anon;
revoke all on function public.reverse_bill_payment(uuid, text) from public, anon;
grant execute on function public.record_bill_payment(uuid, numeric, timestamptz, uuid, text, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.reverse_bill_payment(uuid, text) to authenticated;

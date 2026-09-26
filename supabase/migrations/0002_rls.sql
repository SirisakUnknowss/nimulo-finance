-- Row Level Security: every user-owned table restricts all operations to
-- rows whose user_id (or, for child tables, whose parent's user_id) equals
-- auth.uid(). This is the only access path once RLS is enabled - the
-- anon/publishable key can never see another user's data.

alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table recurring_templates enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table goal_contributions enable row level security;
alter table loan_accounts enable row level security;
alter table loan_payments enable row level security;
alter table portfolios enable row level security;
alter table holdings enable row level security;
alter table investment_trades enable row level security;
alter table portfolio_snapshots enable row level security;
alter table exchange_rates enable row level security;
alter table net_worth_snapshots enable row level security;

create policy "profiles_self" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "accounts_owner" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_owner" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recurring_owner" on recurring_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions_owner" on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budgets_owner" on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals_owner" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goal_contributions_owner" on goal_contributions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "loan_accounts_owner" on loan_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "loan_payments_owner" on loan_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "portfolios_owner" on portfolios
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "holdings_owner" on holdings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "investment_trades_owner" on investment_trades
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "portfolio_snapshots_owner" on portfolio_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "exchange_rates_owner" on exchange_rates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "net_worth_snapshots_owner" on net_worth_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

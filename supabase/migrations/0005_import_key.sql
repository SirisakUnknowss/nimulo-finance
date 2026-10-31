-- Identifies the source row of an imported transaction, so re-importing a newer
-- export adds nothing twice.
alter table transactions add column if not exists import_key text;
create unique index if not exists idx_transactions_import_key
  on transactions(user_id, import_key) where import_key is not null;

-- Total installments on a loan, counting any already paid here. The remaining
-- count is derived (see computeRemainingInstallments), never stored.
alter table loan_accounts
  add column if not exists installments_planned int check (installments_planned >= 0);

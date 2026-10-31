import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Runs the real migrations in an in-process Postgres, as the `authenticated`
 * role, so RLS, constraints and the RPCs are exercised for real. Supabase's
 * auth schema is stubbed; auth.uid() reads a session setting.
 */

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []) {
  return db.query<T>(query, params).then((r) => r.rows);
}

async function asUser(id: string) {
  await db.exec(`set role authenticated; select set_config('test.uid', '${id}', false);`);
}

async function asAdmin() {
  await db.exec("reset role;");
}

const migration = (name: string) =>
  readFileSync(path.resolve(__dirname, "../../../supabase/migrations", name), "utf8").replace('create extension if not exists "pgcrypto";', "");

interface Fixture {
  bankA: string;
  bankB: string;
  card: string;
  food: string;
  loan: string;
}
let f: Fixture;

async function insertId(query: string, params: unknown[]) {
  return (await sql<{ id: string }>(`${query} returning id`, params))[0].id;
}

async function addBill(kind: string, amount: number, extra: { target?: string | null; loan?: string | null; category?: string | null; rule?: string | null; period?: string } = {}) {
  return insertId(
    `insert into monthly_bills (user_id, fixed_cost_rule_id, period, name_snapshot, cashflow_kind_snapshot, amount_due, due_date, category_id, target_account_id, loan_account_id)
     values ($1,$2,$3,'บิล',$4,$5,'2026-11-05',$6,$7,$8)`,
    [ALICE, extra.rule ?? null, extra.period ?? "2026-11", kind, amount, extra.category === undefined ? f.food : extra.category, extra.target ?? null, extra.loan ?? null],
  );
}

interface PayArgs {
  amount: number;
  source?: string;
  key?: string;
  principal?: number;
  interest?: number;
  paidAt?: string;
}

async function pay(billId: string, { amount, source, key, principal, interest, paidAt }: PayArgs) {
  const rows = await sql<{ id: string }>(
    `select id from record_bill_payment($1,$2,$3,$4,$5,null,$6,$7)`,
    [billId, amount, paidAt ?? "2026-11-05T03:00:00Z", source ?? f.bankA, key ?? crypto.randomUUID(), principal ?? null, interest ?? null],
  );
  return rows[0].id;
}

const count = async (table: string) => Number((await sql<{ n: string }>(`select count(*) as n from ${table}`))[0].n);

/** Same formula as computeAccountBalance. */
async function balance(accountId: string) {
  const rows = await sql<{ b: string }>(
    `select a.opening_balance + coalesce(sum(case
        when t.type = 'income' and t.account_id = a.id then t.amount
        when t.type = 'expense' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.to_account_id = a.id then t.amount
        else 0 end), 0) as b
     from accounts a left join transactions t on t.account_id = a.id or t.to_account_id = a.id
     where a.id = $1 group by a.id`,
    [accountId],
  );
  return Number(rows[0].b);
}

const expenses = async () =>
  Number((await sql<{ s: string }>(`select coalesce(sum(amount),0) as s from transactions where type='expense' and not is_loan_principal_repayment`))[0].s);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.exec(migration("0001_init.sql"));
  await db.exec(migration("0002_rls.sql"));
  await db.exec(migration("0003_bills.sql"));
  await db.exec(migration("0004_loan_installments.sql"));
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
  `);
}, 60_000);

beforeEach(async () => {
  await asAdmin();
  await db.exec(`
    truncate bill_payment_postings, bill_payments, monthly_bills, fixed_cost_rules, loan_payments, transactions, loan_accounts, categories, accounts cascade;
  `);
  const account = (user: string, name: string, type: string, opening: number) =>
    insertId(`insert into accounts (user_id, name, type, opening_balance) values ($1,$2,$3,$4)`, [user, name, type, opening]);
  f = {
    bankA: await account(ALICE, "A", "bank", 20000),
    bankB: await account(ALICE, "B", "bank", 15000),
    card: await account(ALICE, "Card", "credit_card", 0),
    food: await insertId(`insert into categories (user_id, name, kind) values ($1,'อาหาร','expense')`, [ALICE]),
    loan: await insertId(`insert into loan_accounts (user_id, name, kind, opening_principal, start_date) values ($1,'รถ','installment_loan',100000,'2026-01-01')`, [ALICE]),
  };
  await asUser(ALICE);
});

describe("record_bill_payment", () => {
  it("pays in full: one ledger row, balance down", async () => {
    const bill = await addBill("expense", 9200);
    await pay(bill, { amount: 9200 });
    expect(await balance(f.bankA)).toBe(10800);
    expect(await count("transactions")).toBe(1);
    expect(await count("bill_payment_postings")).toBe(1);
  });

  it("creating a bill alone posts nothing", async () => {
    await addBill("expense", 9200);
    expect(await count("transactions")).toBe(0);
    expect(await balance(f.bankA)).toBe(20000);
  });

  it("is idempotent for a repeated key", async () => {
    const bill = await addBill("expense", 9200);
    const first = await pay(bill, { amount: 9200, key: "same" });
    const second = await pay(bill, { amount: 9200, key: "same" });
    expect(second).toBe(first);
    expect(await count("bill_payments")).toBe(1);
    expect(await count("transactions")).toBe(1);
  });

  it("supports partial payments from two accounts and refuses overpayment", async () => {
    const bill = await addBill("expense", 6000);
    await pay(bill, { amount: 2000 });
    await expect(pay(bill, { amount: 4000.01, source: f.bankB })).rejects.toThrow("BILL_OVERPAYMENT");
    await pay(bill, { amount: 4000, source: f.bankB });
    expect(await balance(f.bankA)).toBe(18000);
    expect(await balance(f.bankB)).toBe(11000);
  });

  it("rolls everything back when a later step fails", async () => {
    // The payment row is inserted before the category check fails.
    const bill = await addBill("expense", 100, { category: null });
    await expect(pay(bill, { amount: 100 })).rejects.toThrow("BILL_MISSING_CATEGORY");
    expect(await count("bill_payments")).toBe(0);
    expect(await count("transactions")).toBe(0);
  });

  it("rolls back a loan payment whose split does not add up", async () => {
    const bill = await addBill("loan_payment", 9200, { loan: f.loan });
    await expect(pay(bill, { amount: 9200, principal: 8000, interest: 1000 })).rejects.toThrow("BILL_SPLIT_MISMATCH");
    expect(await count("bill_payments")).toBe(0);
    expect(await count("loan_payments")).toBe(0);
  });

  it("splits a loan payment, including the flagged principal row with no category", async () => {
    const bill = await addBill("loan_payment", 9200, { loan: f.loan });
    await pay(bill, { amount: 9200, principal: 8000, interest: 1200 });
    expect(await balance(f.bankA)).toBe(10800);
    expect(await expenses()).toBe(1200);
    expect(await count("bill_payment_postings")).toBe(3);
  });

  it("posts a card repayment as a transfer with no expense", async () => {
    const bill = await addBill("credit_card_payment", 750, { target: f.card, category: null });
    await pay(bill, { amount: 750 });
    expect(await expenses()).toBe(0);
    expect(await balance(f.bankA)).toBe(19250);
  });

  it("dates the ledger row in Bangkok", async () => {
    const bill = await addBill("expense", 100);
    await pay(bill, { amount: 100, paidAt: "2026-11-30T18:00:00Z" });
    const [row] = await sql<{ d: string }>(`select date::text as d from transactions`);
    expect(row.d).toBe("2026-12-01");
  });

  it("refuses skipped bills", async () => {
    const bill = await addBill("expense", 100);
    await sql(`update monthly_bills set lifecycle_state = 'skipped' where id = $1`, [bill]);
    await expect(pay(bill, { amount: 100 })).rejects.toThrow("BILL_NOT_ACTIVE");
  });
});

describe("reverse_bill_payment", () => {
  it("restores balance and expense totals and keeps the audit trail", async () => {
    const bill = await addBill("expense", 9200);
    const payment = await pay(bill, { amount: 9200 });
    await sql(`select reverse_bill_payment($1, 'กดผิด')`, [payment]);
    expect(await balance(f.bankA)).toBe(20000);
    expect(await expenses()).toBe(0);
    expect(await count("transactions")).toBe(2);
    const [row] = await sql<{ reversal_reason: string }>(`select reversal_reason from bill_payments`);
    expect(row.reversal_reason).toBe("กดผิด");
    await pay(bill, { amount: 9200 }); // the bill can be paid again
    expect(await balance(f.bankA)).toBe(10800);
  });

  it("undoes every posting of a loan payment", async () => {
    const bill = await addBill("loan_payment", 9200, { loan: f.loan });
    const payment = await pay(bill, { amount: 9200, principal: 8000, interest: 1200 });
    await sql(`select reverse_bill_payment($1, 'x')`, [payment]);
    expect(await balance(f.bankA)).toBe(20000);
    expect(await expenses()).toBe(0);
    const [{ s }] = await sql<{ s: string }>(`select sum(principal_amount) as s from loan_payments`);
    expect(Number(s)).toBe(0);
  });

  it("reverses a transfer by swapping direction", async () => {
    const bill = await addBill("transfer", 3000, { target: f.bankB, category: null });
    const payment = await pay(bill, { amount: 3000 });
    await sql(`select reverse_bill_payment($1, 'x')`, [payment]);
    expect(await balance(f.bankA)).toBe(20000);
    expect(await balance(f.bankB)).toBe(15000);
  });

  it("refuses to reverse twice or with no reason", async () => {
    const bill = await addBill("expense", 100);
    const payment = await pay(bill, { amount: 100 });
    await expect(sql(`select reverse_bill_payment($1, ' ')`, [payment])).rejects.toThrow("BILL_MISSING_REASON");
    await sql(`select reverse_bill_payment($1, 'x')`, [payment]);
    await expect(sql(`select reverse_bill_payment($1, 'x')`, [payment])).rejects.toThrow("BILL_ALREADY_REVERSED");
  });
});

describe("constraints", () => {
  it("allows only one bill per rule and month, but many one-time bills", async () => {
    const rule = await insertId(
      `insert into fixed_cost_rules (user_id, name, cashflow_kind, default_amount, due_day, start_month) values ($1,'r','expense',1,5,'2026-11')`,
      [ALICE],
    );
    await addBill("expense", 1, { rule });
    await expect(addBill("expense", 1, { rule })).rejects.toThrow(/unique/);
    await addBill("expense", 1);
    await addBill("expense", 1);
    expect(await count("monthly_bills")).toBe(3);
  });

  it("refuses dropping a bill's amount below what is paid, or skipping it", async () => {
    const bill = await addBill("expense", 6000);
    await pay(bill, { amount: 2000 });
    await expect(sql(`update monthly_bills set amount_due = 1999 where id = $1`, [bill])).rejects.toThrow("BILL_AMOUNT_BELOW_PAID");
    await expect(sql(`update monthly_bills set lifecycle_state = 'skipped' where id = $1`, [bill])).rejects.toThrow("BILL_HAS_PAYMENTS");
  });

  it("protects posted ledger rows from edits and deletes", async () => {
    const bill = await addBill("expense", 100);
    await pay(bill, { amount: 100 });
    await expect(sql(`update transactions set amount = 1`)).rejects.toThrow("BILL_POSTING_READ_ONLY");
    await expect(sql(`delete from transactions`)).rejects.toThrow(/foreign key/);
    await expect(sql(`delete from monthly_bills where id = $1`, [bill])).rejects.toThrow(/foreign key/);
  });

  it("still rejects negative amounts on ordinary transactions", async () => {
    await expect(
      sql(`insert into transactions (user_id, type, amount, date, account_id, category_id) values ($1,'expense',-1,'2026-11-01',$2,$3)`, [ALICE, f.bankA, f.food]),
    ).rejects.toThrow(/transactions_amount_check/);
  });

  it("still lets a user be deleted with all their data", async () => {
    const bill = await addBill("saving", 100, { target: f.bankB, category: null });
    await pay(bill, { amount: 100 });
    await asAdmin();
    await sql(`delete from auth.users where id = $1`, [ALICE]);
    expect(await count("bill_payments")).toBe(0);
    await sql(`insert into auth.users (id) values ($1)`, [ALICE]);
  });
});

describe("loan installments", () => {
  it("is optional and refuses a negative count", async () => {
    await sql(`update loan_accounts set installments_planned = 48 where id = $1`, [f.loan]);
    await expect(sql(`update loan_accounts set installments_planned = -1 where id = $1`, [f.loan])).rejects.toThrow(/loan_accounts_installments_planned_check/);
  });
});

describe("ownership", () => {
  it("hides one user's bills and payments from another", async () => {
    const bill = await addBill("expense", 100);
    await pay(bill, { amount: 100 });
    await asUser(BOB);
    expect(await count("monthly_bills")).toBe(0);
    expect(await count("bill_payments")).toBe(0);
    expect(await count("bill_payment_postings")).toBe(0);
  });

  it("refuses paying or reversing another user's bill", async () => {
    const bill = await addBill("expense", 100);
    const payment = await pay(bill, { amount: 50 });
    await asUser(BOB);
    await expect(pay(bill, { amount: 50 })).rejects.toThrow("BILL_NOT_FOUND");
    await expect(sql(`select reverse_bill_payment($1, 'x')`, [payment])).rejects.toThrow("BILL_PAYMENT_NOT_FOUND");
  });

  it("refuses paying from another user's account", async () => {
    await asAdmin();
    const bobAccount = await insertId(`insert into accounts (user_id, name, type) values ($1,'B','bank')`, [BOB]);
    await asUser(ALICE);
    const bill = await addBill("expense", 100);
    await expect(pay(bill, { amount: 100, source: bobAccount })).rejects.toThrow("BILL_INVALID_SOURCE");
  });

  it("refuses a bill or rule pointing at another user's account", async () => {
    await asAdmin();
    const bobAccount = await insertId(`insert into accounts (user_id, name, type) values ($1,'B','bank')`, [BOB]);
    await asUser(ALICE);
    await expect(addBill("transfer", 1, { target: bobAccount, category: null })).rejects.toThrow("BILL_FOREIGN_ACCOUNT");
    await expect(
      sql(`insert into fixed_cost_rules (user_id, name, cashflow_kind, default_amount, due_day, start_month, default_account_id) values ($1,'r','expense',1,5,'2026-11',$2)`, [ALICE, bobAccount]),
    ).rejects.toThrow("BILL_FOREIGN_ACCOUNT");
  });

  it("blocks writing payments directly", async () => {
    const bill = await addBill("expense", 100);
    await expect(
      sql(`insert into bill_payments (user_id, bill_id, amount, paid_at, source_account_id, idempotency_key) values ($1,$2,1,now(),$3,'k')`, [ALICE, bill, f.bankA]),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let the anonymous role run the RPCs", async () => {
    const bill = await addBill("expense", 100);
    await db.exec("set role anon;");
    await expect(pay(bill, { amount: 100 })).rejects.toThrow(/permission denied/);
  });
});

/**
 * Import from a Wallet Story export: the "all data" zip, the transaction CSV,
 * or both. Pure apart from generating ids, so a plan can be previewed before
 * anything is saved.
 *
 * What the export does and doesn't contain shaped these rules:
 * - The zip is the record of what happened, with account balances. The
 *   standalone CSV adds links from a row to its debt, but also lists scheduled
 *   installments that never happened, so with both files only the zip's rows
 *   are imported and the CSV just supplies links.
 * - `Transfer` rows name one account and not the other, so they can't be posted
 *   and are left out. Each account's opening balance is instead solved so its
 *   balance equals the exported BALANCE: current balances are exact, but a past
 *   month's balance for one account is not.
 * - `Withdraw money` is positive and `Deposit` negative because they are
 *   written from the cash wallet's side; the named bank moves the other way.
 * - A row with no account, or the other side of a loan or lending row, uses an
 *   archived catch-all account that ends at zero. Borrowed money is therefore a
 *   transfer, not income, and a debt repayment follows rule 9 in calculations.ts.
 */

import { strFromU8, unzipSync } from "fflate";
import { parseCsv } from "@/lib/csv";
import { computeAccountBalance } from "@/lib/finance/calculations";
import type { BillState } from "@/lib/finance/bills";
import type { Account, AccountType, Category, LoanAccount, LoanPayment, Transaction } from "@/lib/finance/types";
import { uid } from "@/lib/utils";

const USER = "demo-user";
const CATCH_ALL_ACCOUNT = "ไม่ระบุบัญชี (นำเข้า)";
const MAX_UNZIPPED_BYTES = 50_000_000;

export class WalletImportError extends Error {}

type Row = Record<string, string>;

function toRows(text: string): Row[] {
  const { headers, rows } = parseCsv(text);
  return rows.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
}

const num = (value: string | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const money = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Reading files
// ---------------------------------------------------------------------------

export interface WalletExport {
  /** Rows to import. Null when no transaction file was supplied. */
  transactions: Row[] | null;
  /** True when the rows came from the zip, which has no schedule rows or debt links. */
  fromZip: boolean;
  links: Row[];
  bankAccounts: Row[] | null;
  debts: Row[];
  receivables: Row[];
  assetCount: number;
  investmentCount: number;
}

export function readWalletFiles(files: { name: string; bytes: Uint8Array }[]): WalletExport {
  const result: WalletExport = {
    transactions: null,
    fromZip: false,
    links: [],
    bankAccounts: null,
    debts: [],
    receivables: [],
    assetCount: 0,
    investmentCount: 0,
  };
  let standalone: Row[] | null = null;

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      let entries;
      try {
        let total = 0;
        entries = unzipSync(file.bytes, {
          filter: (f) => {
            total += f.originalSize;
            return f.name.endsWith(".csv") && total <= MAX_UNZIPPED_BYTES;
          },
        });
      } catch {
        throw new WalletImportError("เปิดไฟล์ zip ไม่สำเร็จ");
      }
      for (const [name, bytes] of Object.entries(entries)) {
        const rows = toRows(strFromU8(bytes));
        if (name.endsWith("-Transactions.csv")) {
          result.transactions = rows;
          result.fromZip = true;
        } else if (name.endsWith("-Bank account.csv")) result.bankAccounts = rows;
        else if (name.endsWith("-Debt.csv")) result.debts = rows;
        else if (name.endsWith("-Revenue receivable.csv")) result.receivables = rows;
        else if (name.endsWith("-Asset.csv")) result.assetCount = rows.length;
        else if (name.endsWith("-Investment.csv")) result.investmentCount = rows.length;
      }
    } else {
      standalone = toRows(new TextDecoder().decode(file.bytes));
    }
  }

  if (standalone) {
    if (standalone.length > 0 && !("CATEGORY" in standalone[0] && "BANK_ACCOUNT" in standalone[0])) {
      throw new WalletImportError("ไฟล์นี้ไม่ใช่ไฟล์ส่งออกจาก Wallet Story");
    }
    if (result.fromZip) result.links = standalone;
    else result.transactions = standalone;
  }
  if (!result.transactions) throw new WalletImportError("ไม่พบรายการในไฟล์ที่เลือก");
  if (result.fromZip && !("BANK_ACCOUNT" in (result.transactions[0] ?? { BANK_ACCOUNT: "" }))) {
    throw new WalletImportError("ไฟล์นี้ไม่ใช่ไฟล์ส่งออกจาก Wallet Story");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** Export names that have a direct equivalent among the app's starter categories. */
const CATEGORY_IDS: Record<string, string> = {
  "expense:Food": "cat_food",
  "expense:Transport": "cat_transport",
  "expense:Utilities": "cat_utilities",
  "expense:Entertainment": "cat_entertainment",
  "expense:Medical expenses": "cat_health",
  "expense:Accommodation": "cat_rent",
  "expense:Others": "cat_other_expense",
  "income:Earnings": "cat_salary",
  "income:Business income": "cat_freelance",
};

const PALETTE = ["#467A64", "#C97B4A", "#5B7DB1", "#9A4A4A", "#8A6FB0", "#B59B3D", "#4A9A9A", "#B56A8D"];

function accountTypeFor(name: string): AccountType {
  if (/true money|wallet|เป๋า/i.test(name)) return "e_wallet";
  if (/fund|inovest|invest/i.test(name)) return "investment_cash";
  if (/เงินสด|cash/i.test(name)) return "cash";
  return "bank";
}

const stripNote = (note: string) => note.trim().replace(/^\(/, "").replace(/\)$/, "").trim();

export interface AccountCheck {
  name: string;
  isNew: boolean;
  exported: number | null;
  after: number;
}

export interface WalletImportPlan {
  accounts: Account[];
  categories: Category[];
  loans: LoanAccount[];
  transactions: Transaction[];
  loanPayments: LoanPayment[];
  counts: { income: number; expense: number; transfer: number; loanPayment: number };
  skipped: { reason: string; count: number }[];
  alreadyImported: number;
  accountChecks: AccountCheck[];
  notes: string[];
}

export function buildImportPlan(state: BillState, wallet: WalletExport, today: string, now: Date = new Date()): WalletImportPlan {
  const at = now.toISOString();
  const existingKeys = new Set(state.transactions.flatMap((t) => (t.importKey ? [t.importKey] : [])));
  const hasBalances = wallet.bankAccounts !== null;

  const skip = new Map<string, number>();
  const skipRow = (reason: string) => skip.set(reason, (skip.get(reason) ?? 0) + 1);

  // Accounts
  const newAccounts: Account[] = [];
  const accountIds = new Map(state.accounts.map((a) => [a.name.trim().toLowerCase(), a.id]));
  function accountId(name: string): string {
    const key = name.trim().toLowerCase();
    let id = accountIds.get(key);
    if (!id) {
      id = uid("acc");
      accountIds.set(key, id);
      newAccounts.push({
        id,
        userId: USER,
        name: name.trim(),
        type: accountTypeFor(name),
        currency: "THB",
        openingBalance: 0,
        openingDate: "2000-01-01",
        archived: name === CATCH_ALL_ACCOUNT,
        createdAt: at,
      });
    }
    return id;
  }
  for (const bank of wallet.bankAccounts ?? []) accountId(bank.NAME);

  // Categories
  const newCategories: Category[] = [];
  const categoryIds = new Map(state.categories.map((c) => [`${c.kind}:${c.name.trim().toLowerCase()}`, c.id]));
  const knownIds = new Set(state.categories.map((c) => c.id));
  function categoryId(name: string, kind: Category["kind"]): string {
    const mapped = CATEGORY_IDS[`${kind}:${name}`];
    if (mapped && knownIds.has(mapped)) return mapped;
    const key = `${kind}:${name.trim().toLowerCase()}`;
    let id = categoryIds.get(key);
    if (!id) {
      id = uid("cat");
      categoryIds.set(key, id);
      newCategories.push({ id, userId: USER, name: name.trim() || "ไม่ระบุหมวดหมู่", kind, color: PALETTE[newCategories.length % PALETTE.length], archived: false });
    }
    return id;
  }

  // Debts: names repeat when someone lends more than once, so keep them by date.
  const debts = wallet.debts.filter((d) => num(d.PRINCIPLE_AMOUNT) > 0).sort((a, b) => a.DATE.localeCompare(b.DATE));
  const debtPaid = new Map<Row, { principal: number; count: number; loanId: string }>();
  function findDebt(name: string, date: string): Row | undefined {
    const named = debts.filter((d) => d.NAME.trim() === name.trim());
    return named.filter((d) => d.DATE <= date).at(-1) ?? named[0];
  }
  const existingLoans = new Map(state.loans.map((l) => [l.name.trim(), l.id]));
  function debtEntry(debt: Row) {
    let entry = debtPaid.get(debt);
    if (!entry) {
      entry = { principal: 0, count: 0, loanId: existingLoans.get(debt.NAME.trim()) ?? uid("loan") };
      debtPaid.set(debt, entry);
    }
    return entry;
  }
  const receivableNames = new Set(wallet.receivables.map((r) => r.NAME.trim()));

  // Links, from the standalone CSV, keyed to the matching row.
  const links = new Map<string, Row>();
  for (const row of wallet.links) {
    if (row.DEBT || row.REVENUE_RECEIVABLE) links.set(`${row.DATE}|${row.CATEGORY}|${row.AMOUNT}`, row);
  }

  // Rows, oldest first so repeated rows keep a stable numbering across exports.
  const transactions: Transaction[] = [];
  const loanPayments: LoanPayment[] = [];
  const counts = { income: 0, expense: 0, transfer: 0, loanPayment: 0 };
  const seen = new Map<string, number>();
  let alreadyImported = 0;

  const rows = [...wallet.transactions!].sort((a, b) => a.DATE.localeCompare(b.DATE));
  for (const row of rows) {
    const amount = money(num(row.AMOUNT));
    const category = row.CATEGORY.trim();
    const date = row.DATE.slice(0, 10);
    const account = (row.BANK_ACCOUNT || row.CREDIT_CARD || "").trim();
    const note = row.NOTE?.trim() ?? "";

    const isSchedule = !wallet.fromZip && (row.DATE.length === 10 || date > today || /\[(Principle|Interest) \d+\/\d+\]/.test(note));
    if (isSchedule) { skipRow("งวดล่วงหน้าที่ยังไม่เกิดขึ้นจริง"); continue; }
    if (amount === 0) { skipRow("ยอดเป็นศูนย์"); continue; }
    if (category === "Transfer") { skipRow("รายการโอนที่ไฟล์ไม่บอกบัญชีปลายทาง"); continue; }
    if (row.CURRENCY && !["THB", "null"].includes(row.CURRENCY)) { skipRow("สกุลเงินอื่นที่ไม่ใช่บาท"); continue; }

    const key = `${row.DATE}|${category}|${row.AMOUNT}|${account}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const importKey = `wallet:${key}|${occurrence}`;
    if (existingKeys.has(importKey)) { alreadyImported++; continue; }

    const link = links.get(`${row.DATE}|${row.CATEGORY}|${row.AMOUNT}`);
    const debtName = row.DEBT || link?.DEBT || stripNote(note);
    const debt = findDebt(debtName, date);
    const isReceivable = !!(row.REVENUE_RECEIVABLE || link?.REVENUE_RECEIVABLE) || receivableNames.has(stripNote(note));

    const base = {
      userId: USER,
      date,
      merchant: row.SUB_CATEGORY?.trim() || null,
      note: note || null,
      tags: (row.TAG ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      importKey,
      createdAt: at,
    };

    const transfer = (from: string, to: string) => {
      if (from === to) { skipRow("ไม่มีผลกับยอดบัญชีใด"); return; }
      counts.transfer++;
      transactions.push({ ...base, id: uid("tx"), type: "transfer", amount: Math.abs(amount), accountId: accountId(from), toAccountId: accountId(to), categoryId: null, merchant: base.merchant ?? category });
    };
    const named = account || CATCH_ALL_ACCOUNT;

    if (category === "Withdraw money") transfer(named, CATCH_ALL_ACCOUNT);
    else if (category === "Deposit") transfer(CATCH_ALL_ACCOUNT, named);
    else if (debt && amount < 0) {
      const entry = debtEntry(debt);
      const id = uid("tx");
      transactions.push({ ...base, id, type: "expense", amount: -amount, accountId: accountId(named), categoryId: null, merchant: base.merchant ?? debt.NAME.trim(), isLoanPrincipalRepayment: true, loanAccountId: entry.loanId });
      loanPayments.push({ id: uid("lp"), loanAccountId: entry.loanId, userId: USER, date, principalAmount: -amount, interestAmount: 0, transactionId: id });
      entry.principal = money(entry.principal - amount);
      entry.count++;
      counts.loanPayment++;
    } else if (category === "Borrow" || (debt && amount > 0)) transfer(CATCH_ALL_ACCOUNT, named);
    else if (category === "Borrowed") transfer(named, CATCH_ALL_ACCOUNT);
    else if (category === "Refund" && isReceivable) {
      if (amount > 0) transfer(CATCH_ALL_ACCOUNT, named);
      else transfer(named, CATCH_ALL_ACCOUNT);
    } else {
      const kind = amount > 0 ? "income" : "expense";
      counts[kind]++;
      transactions.push({ ...base, id: uid("tx"), type: kind, amount: Math.abs(amount), accountId: accountId(named), categoryId: categoryId(category, kind) });
    }
  }

  // Loans
  const newLoans: LoanAccount[] = [];
  for (const debt of debts) {
    if (existingLoans.has(debt.NAME.trim())) continue;
    const paid = debtEntry(debt);
    const remaining = money(Math.max(num(debt.PRINCIPLE_AMOUNT) - num(debt.PRINCIPLE_PAID), 0));
    const perInstallment = num(debt.PRINCIPLE_PER_INSTALLMENT);
    const installmentsLeft = remaining > 0 && perInstallment > 0 ? Math.ceil(money(remaining / perInstallment)) : null;
    newLoans.push({
      id: paid.loanId,
      userId: USER,
      name: debt.NAME.trim(),
      kind: "installment_loan",
      // Solved so the remaining debt equals the export whatever was linked above.
      openingPrincipal: money(remaining + paid.principal),
      interestRate: num(debt.INTEREST_RATE),
      minimumPayment: perInstallment > 0 ? money(perInstallment + num(debt.INTEREST_PER_INSTALLMENT)) : null,
      dueDayOfMonth: null,
      startDate: debt.DATE.slice(0, 10),
      installmentsPlanned: installmentsLeft === null ? null : installmentsLeft + paid.count,
      accountId: null,
      archived: remaining === 0,
    });
  }

  // Solve new accounts' opening balances, now that every row is known.
  const exported = new Map((wallet.bankAccounts ?? []).map((b) => [b.NAME.trim().toLowerCase(), money(num(b.BALANCE))]));
  for (const account of newAccounts) {
    const target = exported.get(account.name.toLowerCase()) ?? 0;
    if (hasBalances || account.name === CATCH_ALL_ACCOUNT) {
      account.openingBalance = money(target - computeAccountBalance(account, transactions));
    }
  }

  const allAccounts = [...state.accounts, ...newAccounts];
  const allTransactions = [...state.transactions, ...transactions];
  const accountChecks = allAccounts
    .filter((a) => !a.archived && (exported.has(a.name.trim().toLowerCase()) || newAccounts.includes(a)))
    .map((account) => ({
      name: account.name,
      isNew: newAccounts.includes(account),
      exported: exported.get(account.name.trim().toLowerCase()) ?? null,
      after: money(computeAccountBalance(account, allTransactions)),
    }));

  const notes: string[] = [];
  if (!hasBalances) notes.push("ไฟล์นี้ไม่มียอดบัญชี ยอดเงินจะเริ่มจาก 0 จึงไม่ตรงกับยอดจริง ควรใช้ไฟล์ zip ร่วมด้วย");
  if (wallet.fromZip && wallet.links.length === 0) notes.push("ไม่มีไฟล์ CSV รายการ จึงจับคู่การจ่ายหนี้ได้เฉพาะแถวที่หมายเหตุตรงกับชื่อหนี้");
  if (wallet.assetCount > 0) notes.push(`ทรัพย์สิน ${wallet.assetCount} รายการไม่ได้นำเข้า เพราะแอปยังไม่มีที่เก็บทรัพย์สิน`);
  if (wallet.investmentCount > 0) notes.push(`การลงทุน ${wallet.investmentCount} รายการไม่ได้นำเข้า เพราะไฟล์ไม่มีราคาทุน`);
  const owed = wallet.receivables.filter((r) => num(r.PRINCIPLE_AMOUNT) > num(r.PRINCIPLE_RECEIVED)).length;
  if (owed > 0) notes.push(`เงินที่คนอื่นค้างคุณ ${owed} รายการไม่ได้นับเป็นทรัพย์สิน เพราะแอปยังไม่มีลูกหนี้`);

  return {
    accounts: newAccounts,
    categories: newCategories,
    loans: newLoans,
    transactions,
    loanPayments,
    counts,
    skipped: [...skip].map(([reason, count]) => ({ reason, count })),
    alreadyImported,
    accountChecks,
    notes,
  };
}

/** All-or-nothing, and safe to repeat: rows already present are not added again. */
export function applyImportPlan<S extends BillState>(state: S, plan: WalletImportPlan): S {
  const has = new Set(state.transactions.flatMap((t) => (t.importKey ? [t.importKey] : [])));
  if (plan.transactions.some((t) => t.importKey && has.has(t.importKey))) return state;
  return {
    ...state,
    accounts: [...state.accounts, ...plan.accounts],
    categories: [...state.categories, ...plan.categories],
    loans: [...state.loans, ...plan.loans],
    transactions: [...plan.transactions, ...state.transactions],
    loanPayments: [...state.loanPayments, ...plan.loanPayments],
  };
}

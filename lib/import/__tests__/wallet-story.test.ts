import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { buildEmptyDemoData, type DemoData } from "@/lib/demo/seed";
import { computeAccountBalance, computeNetWorth, computePeriodTotals, computeRemainingPrincipal } from "@/lib/finance/calculations";
import { computeRemainingInstallments } from "@/lib/finance/bill-calculations";
import { applyImportPlan, buildImportPlan, readWalletFiles, WalletImportError } from "../wallet-story";

const HEAD = "DATE,CATEGORY,AMOUNT,CURRENCY,NOTE,SUB_CATEGORY,TAG,BANK_ACCOUNT,CREDIT_CARD,DEBT,REVENUE_RECEIVABLE";
const row = (date: string, category: string, amount: number, over: Partial<Record<"note" | "sub" | "tag" | "bank" | "debt" | "rr", string>> = {}) =>
  [date, category, amount, "THB", `"${over.note ?? ""}"`, over.sub ?? "", `"${over.tag ?? ""}"`, over.bank ?? "", "", over.debt ?? "", over.rr ?? ""].join(",");
const csv = (...rows: string[]) => [HEAD, ...rows].join("\n");

const BANKS = 'NAME,BALANCE,CURRENCY,NOTE\n"Bank A","1000","",""\n"True Money","-50","",""\n"Fund","0","",""';
const DEBTS = [
  "NAME,PRINCIPLE_AMOUNT,PRINCIPLE_PAID,PRINCIPLE_COUNT_INSTALLMENT,PRINCIPLE_PER_INSTALLMENT,INTEREST_RATE,INTEREST_PER_INSTALLMENT,DATE",
  "งวดรถ,10000,4000,10,1000,5,,2026-01-01",
  "ยืมแม่,500,500,,,,,2026-02-01",
].join("\n");

function zipOf(transactions: string, extra: Record<string, string> = {}) {
  const entry = (name: string, text: string) => [`x-${name}.csv`, strToU8(`﻿${text}`)] as const;
  return {
    name: "wallet.zip",
    bytes: zipSync(Object.fromEntries([
      entry("Transactions", transactions),
      entry("Bank account", BANKS),
      entry("Debt", DEBTS),
      entry("Revenue receivable", "NAME,PRINCIPLE_AMOUNT,PRINCIPLE_RECEIVED\nเพื่อนยืม,300,100"),
      entry("Asset", "NAME\nรถ"),
      entry("Investment", "SYMBOL\nGOOGL"),
      ...Object.entries(extra).map(([k, v]) => entry(k, v)),
    ])),
  };
}
const csvFile = (text: string) => ({ name: "transaction_all.csv", bytes: strToU8(text) });

const TODAY = "2026-10-30";
const NOW = new Date("2026-10-30T05:00:00Z");

function run(files: { name: string; bytes: Uint8Array }[], state: DemoData = buildEmptyDemoData()) {
  const plan = buildImportPlan(state, readWalletFiles(files), TODAY, NOW);
  return { plan, state: applyImportPlan(state, plan) };
}
const balance = (s: DemoData, name: string) => computeAccountBalance(s.accounts.find((a) => a.name === name)!, s.transactions);
const year = (s: DemoData) => computePeriodTotals(s.transactions, "2026-01-01", "2026-12-31");

describe("parseCsv", () => {
  it("keeps newlines and quotes inside a field", () => {
    const { rows } = parseCsv('A,B\n"line 1\nline 2","say ""hi"""\n1,2');
    expect(rows).toEqual([["line 1\nline 2", 'say "hi"'], ["1", "2"]]);
  });

  it("handles a BOM, CRLF and a last row with no newline", () => {
    expect(parseCsv("﻿A,B\r\n1,2\r\n3,4")).toEqual({ headers: ["A", "B"], rows: [["1", "2"], ["3", "4"]] });
  });

  it("ignores blank lines", () => {
    expect(parseCsv("A\n1\n\n2\n").rows).toEqual([["1"], ["2"]]);
  });
});

describe("balances", () => {
  it("makes every account's balance equal the export, whatever rows are missing", () => {
    const { state } = run([zipOf(csv(
      row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" }),
      row("2026-03-02 09:00:00", "Earnings", 5000, { bank: "Bank A" }),
      row("2026-03-03 09:00:00", "Food", -30, { bank: "True Money" }),
    ))]);
    expect(balance(state, "Bank A")).toBe(1000);
    expect(balance(state, "True Money")).toBe(-50);
    expect(balance(state, "Fund")).toBe(0);
  });

  it("does not count opening balances as income", () => {
    const { state } = run([zipOf(csv(row("2026-03-02 09:00:00", "Earnings", 5000, { bank: "Bank A" })))]);
    expect(year(state).income).toBe(5000);
  });

  it("puts rows with no account on an archived account that ends at zero", () => {
    const { state } = run([zipOf(csv(row("2026-03-01 09:00:00", "Food", -100)))]);
    const catchAll = state.accounts.find((a) => a.name.includes("ไม่ระบุบัญชี"))!;
    expect(catchAll.archived).toBe(true);
    expect(computeAccountBalance(catchAll, state.transactions)).toBe(0);
    expect(year(state).expenses).toBe(100);
  });

  it("gives net worth from the exported balances and remaining debt", () => {
    const { state } = run([zipOf(csv(row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" })))]);
    const { netWorth } = computeNetWorth({ ...state, baseCurrency: "THB" });
    expect(netWorth).toBe(1000 - 50 - 6000);
  });
});

describe("row meanings", () => {
  it("reads Withdraw money and Deposit as moves, opposite to their sign on the bank", () => {
    const { state, plan } = run([zipOf(csv(
      row("2026-03-01 09:00:00", "Withdraw money", 500, { bank: "Bank A" }),
      row("2026-03-02 09:00:00", "Deposit", -200, { bank: "Bank A" }),
    ))]);
    const [withdraw, deposit] = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date));
    const bank = state.accounts.find((a) => a.name === "Bank A")!.id;
    expect(withdraw).toMatchObject({ type: "transfer", amount: 500, accountId: bank });
    expect(deposit).toMatchObject({ type: "transfer", amount: 200, toAccountId: bank });
    expect(plan.counts).toMatchObject({ transfer: 2, income: 0, expense: 0 });
    expect(year(state).expenses).toBe(0);
  });

  it("leaves one-sided Transfer rows out and says so", () => {
    const { plan } = run([zipOf(csv(row("2026-03-01 09:00:00", "Transfer", 500, { bank: "Bank A" })))]);
    expect(plan.transactions).toEqual([]);
    expect(plan.skipped[0].count).toBe(1);
  });

  it("does not count money borrowed or lent as income or expense", () => {
    const { state } = run([zipOf(csv(
      row("2026-03-01 09:00:00", "Borrow", 3000, { bank: "Bank A" }),
      row("2026-03-02 09:00:00", "Borrowed", -500, { bank: "Bank A" }),
    ))]);
    expect(year(state)).toMatchObject({ income: 0, expenses: 0 });
  });

  it("keeps plain Refund rows as income or expense by sign, in separate categories", () => {
    const { state } = run([zipOf(csv(
      row("2026-03-01 09:00:00", "Refund", 400, { bank: "Bank A", note: "หารกับเพื่อน" }),
      row("2026-03-02 09:00:00", "Refund", -100, { bank: "Bank A", note: "หารกับเพื่อน" }),
    ))]);
    expect(year(state)).toMatchObject({ income: 400, expenses: 100 });
    expect(state.categories.filter((c) => c.name === "Refund").map((c) => c.kind).sort()).toEqual(["expense", "income"]);
  });

  it("treats a receivable being repaid as a transfer, matched by note", () => {
    const { state } = run([zipOf(csv(row("2026-03-01 09:00:00", "Refund", 100, { bank: "Bank A", note: "(เพื่อนยืม) " })))]);
    expect(state.transactions[0].type).toBe("transfer");
    expect(year(state).income).toBe(0);
  });

  it("keeps a receivable's business income as income", () => {
    const { state } = run([zipOf(csv(row("2026-03-01 09:00:00", "Business income", 3000, { bank: "Bank A", note: "(ค่าเว็บ) " })))]);
    expect(year(state).income).toBe(3000);
    expect(state.categories.find((c) => c.id === state.transactions[0].categoryId)?.name).toBe("รายได้เสริม");
  });

  it("maps equivalent categories, reuses them, and keeps sub-category, note and tags", () => {
    const { state } = run([zipOf(csv(
      row("2026-03-01 09:00:00", "Food", -10, { bank: "Bank A", sub: "โลตัส", note: "มื้อเย็น", tag: "Needs, Wants" }),
      row("2026-03-01 10:00:00", "Software", -20, { bank: "Bank A" }),
      row("2026-03-01 11:00:00", "Software", -20, { bank: "Bank A" }),
    ))]);
    const food = state.transactions.find((t) => t.merchant === "โลตัส")!;
    expect(food).toMatchObject({ categoryId: "cat_food", note: "มื้อเย็น", tags: ["Needs", "Wants"], date: "2026-03-01" });
    expect(state.categories.filter((c) => c.name === "Software")).toHaveLength(1);
  });

  it("skips zero amounts and other currencies", () => {
    const foreign = row("2026-03-02 09:00:00", "Food", -5, { bank: "Bank A" }).replace("THB", "USD");
    const { plan } = run([zipOf(csv(row("2026-03-01 09:00:00", "Food", 0, { bank: "Bank A" }), foreign))]);
    expect(plan.transactions).toEqual([]);
    expect(plan.skipped).toHaveLength(2);
  });
});

describe("debts", () => {
  const payment = row("2026-03-01 09:00:00", "Vehicles", -1000, { bank: "Bank A", note: "(งวดรถ) " });

  it("posts a linked payment as principal: cash down, debt down, no expense", () => {
    const { state, plan } = run([zipOf(csv(payment))]);
    const loan = state.loans.find((l) => l.name === "งวดรถ")!;
    expect(plan.counts.loanPayment).toBe(1);
    expect(year(state).expenses).toBe(0);
    expect(state.transactions[0]).toMatchObject({ isLoanPrincipalRepayment: true, loanAccountId: loan.id, categoryId: null });
    expect(computeRemainingPrincipal(loan, state.loanPayments)).toBe(6000);
  });

  it("uses the CSV's DEBT column when the note does not match the name", () => {
    const zipRow = row("2026-03-01 09:00:00", "Vehicles", -1000, { bank: "Bank A", note: "งวดเดือนมีนา" });
    const linked = row("2026-03-01 09:00:00", "Vehicles", -1000, { bank: "Bank A", note: "งวดเดือนมีนา", debt: "งวดรถ" });
    expect(run([zipOf(csv(zipRow))]).plan.counts.loanPayment).toBe(0);
    expect(run([zipOf(csv(zipRow)), csvFile(csv(linked))]).plan.counts.loanPayment).toBe(1);
  });

  it("imports only the zip's rows when both files are given", () => {
    const schedule = row("2034-06-05", "Education", -1755, { note: "กยศ [Principle 108/108]", debt: "งวดรถ" });
    const { plan } = run([zipOf(csv(payment)), csvFile(csv(schedule))]);
    expect(plan.transactions).toHaveLength(1);
  });

  it("works out remaining installments and archives settled debts", () => {
    const { state } = run([zipOf(csv(payment))]);
    const car = state.loans.find((l) => l.name === "งวดรถ")!;
    expect(computeRemainingInstallments(car, state)).toBe(6);
    expect(car).toMatchObject({ archived: false, minimumPayment: 1000, interestRate: 5 });
    expect(state.loans.find((l) => l.name === "ยืมแม่")!.archived).toBe(true);
  });

  it("does not create a loan the user already has", () => {
    const start = buildEmptyDemoData();
    start.loans.push({ id: "mine", userId: "demo-user", name: "งวดรถ", kind: "installment_loan", openingPrincipal: 9000, interestRate: 0, startDate: "2026-01-01", archived: false });
    const { state } = run([zipOf(csv(payment))], start);
    expect(state.loans.filter((l) => l.name === "งวดรถ")).toHaveLength(1);
    expect(state.loanPayments[0].loanAccountId).toBe("mine");
  });
});

describe("standalone CSV", () => {
  it("drops scheduled installments and warns there are no balances", () => {
    const { plan } = run([csvFile(csv(
      row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" }),
      row("2026-05-01", "Education", -500, { note: "กยศ [Principle 23/78]", debt: "กยศ" }),
      row("2026-11-01 11:07:00", "Vehicles", -8822, { note: "รถ [Principle 40/60]", debt: "รถ" }),
      row("2023-08-28 13:27:54", "Education", -182610, { note: "กยศ [Principle 1/1]", debt: "กยศ" }),
    ))]);
    expect(plan.transactions).toHaveLength(1);
    expect(plan.skipped[0].count).toBe(3);
    expect(plan.notes.join()).toContain("ไม่มียอดบัญชี");
  });
});

describe("re-importing", () => {
  const rows = csv(row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" }), row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" }));

  it("keeps identical rows from one file as separate transactions", () => {
    expect(run([zipOf(rows)]).state.transactions).toHaveLength(2);
  });

  it("adds nothing the second time", () => {
    const first = run([zipOf(rows)]);
    const second = run([zipOf(rows)], first.state);
    expect(second.plan.transactions).toEqual([]);
    expect(second.plan.alreadyImported).toBe(2);
    expect(second.state.transactions).toHaveLength(2);
    expect(second.state.accounts).toHaveLength(first.state.accounts.length);
  });

  it("adds only new rows from a later export", () => {
    const first = run([zipOf(rows)]);
    const later = rows + "\n" + row("2026-04-01 09:00:00", "Food", -7, { bank: "Bank A" });
    expect(run([zipOf(later)], first.state).plan.transactions).toHaveLength(1);
  });

  it("does nothing if the same plan is applied twice", () => {
    const { plan, state } = run([zipOf(rows)]);
    expect(applyImportPlan(state, plan)).toBe(state);
  });

  it("leaves an existing account's opening balance alone and shows the difference", () => {
    const start = buildEmptyDemoData();
    start.accounts.push({ id: "a", userId: "demo-user", name: "bank a", type: "bank", currency: "THB", openingBalance: 200, openingDate: "2026-01-01", archived: false, createdAt: "2026-01-01" });
    const { plan, state } = run([zipOf(csv(row("2026-03-01 09:00:00", "Food", -100, { bank: "Bank A" })))], start);
    expect(state.accounts.find((a) => a.id === "a")!.openingBalance).toBe(200);
    expect(plan.accountChecks.find((c) => c.name === "bank a")).toMatchObject({ isNew: false, exported: 1000, after: 100 });
  });
});

describe("bad files", () => {
  it("rejects a file that is not an export", () => {
    expect(() => readWalletFiles([csvFile("date,amount\n2026-01-01,5")])).toThrow(WalletImportError);
    expect(() => readWalletFiles([{ name: "x.zip", bytes: strToU8("not a zip") }])).toThrow(WalletImportError);
  });

  it("rejects a zip with no transactions", () => {
    const bytes = zipSync({ "x-Tag.csv": strToU8("NAME\nDebts") });
    expect(() => readWalletFiles([{ name: "x.zip", bytes }])).toThrow(WalletImportError);
  });

  it("does not list assets or investments as imported", () => {
    const { plan } = run([zipOf(csv(row("2026-03-01 09:00:00", "Food", -1, { bank: "Bank A" })))]);
    expect(plan.notes.join()).toContain("ทรัพย์สิน 1 รายการไม่ได้นำเข้า");
    expect(plan.notes.join()).toContain("การลงทุน 1 รายการไม่ได้นำเข้า");
    expect(plan.notes.join()).toContain("เงินที่คนอื่นค้างคุณ 1 รายการ");
  });
});

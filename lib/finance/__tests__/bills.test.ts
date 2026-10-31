import { describe, expect, it } from "vitest";
import { computeAccountBalance, computeNetWorth, computePeriodTotals, computeRemainingPrincipal, computeBudgetStatus } from "../calculations";
import {
  accountBalances,
  amountForPeriod,
  bangkokDate,
  computeAccountCashPlan,
  computeBillsSummary,
  computeRemainingInstallments,
  deriveBill,
  deriveBills,
  dueDateFor,
  sumMoney,
} from "../bill-calculations";
import {
  BillError,
  cancelBill,
  createOneTimeBill,
  createRule,
  ensureBills,
  recordBillPayment,
  reopenBill,
  reverseBillPayment,
  setLoanInstallments,
  setRuleStatus,
  skipBill,
  updateBill,
  updateRule,
  type BillState,
  type RecordPaymentInput,
  type RuleInput,
} from "../bills";
import type { Account, CashflowKind, LoanAccount, MonthlyBill } from "../types";

const NOV = "2026-11";
const DEC = "2026-12";
const NOW = new Date("2026-10-31T05:00:00Z");
const PAID_AT = "2026-11-05T03:00:00.000Z";

function account(id: string, type: Account["type"], openingBalance: number): Account {
  return { id, userId: "demo-user", name: id, type, currency: "THB", openingBalance, openingDate: "2026-01-01", archived: false, createdAt: "2026-01-01" };
}

const carLoan: LoanAccount = {
  id: "loan_car", userId: "demo-user", name: "ผ่อนรถ", kind: "installment_loan",
  openingPrincipal: 100000, interestRate: 5, startDate: "2026-01-01", archived: false,
};

function baseState(): BillState {
  return {
    accounts: [account("bank_a", "bank", 20000), account("bank_b", "bank", 15000), account("savings", "bank", 1000), account("card", "credit_card", 0), account("port", "investment_cash", 0)],
    categories: [
      { id: "cat_food", userId: "demo-user", name: "อาหาร", kind: "expense", color: "#000", archived: false },
      { id: "cat_interest", userId: "demo-user", name: "ดอกเบี้ย", kind: "expense", color: "#000", archived: false },
    ],
    transactions: [],
    loans: [carLoan],
    loanPayments: [],
    fixedCostRules: [],
    monthlyBills: [],
    billPayments: [],
    billPaymentPostings: [],
  };
}

function ruleInput(over: Partial<RuleInput> = {}): RuleInput {
  return {
    name: "งวดรถ", cashflowKind: "expense", defaultAmount: 9200, amountMode: "fixed",
    dueRule: "day_of_month", dueDay: 5, startMonth: NOV, endMonth: null,
    categoryId: "cat_food", defaultAccountId: "bank_a", targetAccountId: null, loanAccountId: null, note: null,
    ...over,
  };
}

/** One rule, one generated November bill. */
function withBill(over: Partial<RuleInput> = {}): { state: BillState; bill: MonthlyBill } {
  const state = ensureBills(createRule(baseState(), ruleInput(over), NOW), [NOV], NOW);
  return { state, bill: state.monthlyBills[0] };
}

function pay(state: BillState, bill: MonthlyBill, over: Partial<RecordPaymentInput> = {}) {
  return recordBillPayment(state, { billId: bill.id, amount: bill.amountDue, paidAt: PAID_AT, sourceAccountId: "bank_a", idempotencyKey: `key-${Math.random()}`, ...over }, NOW).state;
}

const balance = (state: BillState, id: string) => computeAccountBalance(state.accounts.find((a) => a.id === id)!, state.transactions);
const novTotals = (state: BillState) => computePeriodTotals(state.transactions, "2026-11-01", "2026-11-30");
const netWorth = (state: BillState) =>
  computeNetWorth({ accounts: state.accounts, transactions: state.transactions, holdings: [], loans: state.loans, loanPayments: state.loanPayments, baseCurrency: "THB" }).netWorth;
const billOf = (state: BillState, id: string) => state.monthlyBills.find((b) => b.id === id)!;
const derived = (state: BillState, id: string, today = "2026-11-01") => deriveBill(billOf(state, id), state.billPayments, today);

describe("due dates", () => {
  it("uses the chosen day", () => expect(dueDateFor(NOV, "day_of_month", 5)).toBe("2026-11-05"));
  it("clamps day 31 to a 30-day month", () => expect(dueDateFor("2026-11", "day_of_month", 31)).toBe("2026-11-30"));
  it("clamps to February", () => expect(dueDateFor("2026-02", "day_of_month", 31)).toBe("2026-02-28"));
  it("handles leap-year February", () => {
    expect(dueDateFor("2028-02", "day_of_month", 30)).toBe("2028-02-29");
    expect(dueDateFor("2028-02", "last_day")).toBe("2028-02-29");
  });
  it("treats last_day as month end", () => expect(dueDateFor("2026-12", "last_day")).toBe("2026-12-31"));
  it("reads the calendar day in Bangkok, not UTC", () => {
    expect(bangkokDate("2026-11-30T18:00:00Z")).toBe("2026-12-01");
  });
});

describe("money", () => {
  it("does not drift when summing", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(Array(10).fill(0.1))).toBe(1);
  });

  it("lands exactly on zero after fractional partial payments", () => {
    let { state, bill } = withBill({ defaultAmount: 100.1 });
    state = pay(state, bill, { amount: 33.37 });
    state = pay(state, bill, { amount: 33.37 });
    state = pay(state, bill, { amount: 33.36 });
    void (bill = billOf(state, bill.id));
    expect(derived(state, bill.id).remaining).toBe(0);
    expect(derived(state, bill.id).status).toBe("paid");
  });
});

describe("bill generation", () => {
  it("creates the bill without touching any balance (AC-01)", () => {
    const { state, bill } = withBill();
    expect(bill).toMatchObject({ amountDue: 9200, dueDate: "2026-11-05", period: NOV, lifecycleState: "active" });
    expect(state.transactions).toEqual([]);
    expect(balance(state, "bank_a")).toBe(20000);
  });

  it("does not duplicate a rule + month (AC-02)", () => {
    const { state } = withBill();
    const again = ensureBills(state, [NOV, NOV], NOW);
    expect(again).toBe(state);
  });

  it("respects start and end months", () => {
    const state = createRule(baseState(), ruleInput({ startMonth: NOV, endMonth: NOV }), NOW);
    const next = ensureBills(state, ["2026-10", NOV, DEC], NOW);
    expect(next.monthlyBills.map((b) => b.period)).toEqual([NOV]);
  });

  it("ignores malformed periods", () => {
    const state = createRule(baseState(), ruleInput({ startMonth: "2020-01" }), NOW);
    expect(ensureBills(state, ["2026-13", "nope"], NOW).monthlyBills).toEqual([]);
  });
});

describe("derived status", () => {
  it("is unpaid, then overdue once past due (AC-05)", () => {
    const { state, bill } = withBill();
    expect(derived(state, bill.id, "2026-11-05")).toMatchObject({ status: "unpaid", isOverdue: false });
    expect(derived(state, bill.id, "2026-11-06")).toMatchObject({ status: "unpaid", isOverdue: true });
  });

  it("keeps overdue alongside partially paid", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill, { amount: 100 });
    expect(derived(paid, bill.id, "2026-12-01")).toMatchObject({ status: "partially_paid", isOverdue: true });
  });

  it("is never overdue once paid, skipped or cancelled", () => {
    const { state, bill } = withBill();
    expect(derived(pay(state, bill), bill.id, "2027-01-01")).toMatchObject({ status: "paid", isOverdue: false });
    expect(derived(skipBill(state, bill.id, "ไม่ใช้เดือนนี้", NOW), bill.id, "2027-01-01")).toMatchObject({ status: "skipped", isOverdue: false });
    expect(derived(cancelBill(state, bill.id, NOW), bill.id, "2027-01-01")).toMatchObject({ status: "cancelled", isOverdue: false });
  });

  it("does not call a zero-amount estimate paid", () => {
    const { state, bill } = withBill({ defaultAmount: 0, amountMode: "estimate" });
    expect(derived(state, bill.id).status).toBe("unpaid");
  });
});

describe("recording payments", () => {
  it("pays in full exactly once (US-02, AC-03, BDD scenario)", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    expect(derived(paid, bill.id)).toMatchObject({ status: "paid", remaining: 0 });
    expect(balance(paid, "bank_a")).toBe(10800);
    expect(paid.transactions).toHaveLength(1);
    expect(paid.billPaymentPostings).toHaveLength(1);
    expect(paid.billPaymentPostings[0].transactionId).toBe(paid.transactions[0].id);
  });

  it("supports partial payments from several accounts (US-03, AC-04)", () => {
    const { state, bill } = withBill({ defaultAmount: 6000 });
    const first = pay(state, bill, { amount: 2000 });
    expect(derived(first, bill.id)).toMatchObject({ status: "partially_paid", paid: 2000, remaining: 4000 });
    const second = pay(first, bill, { amount: 4000, sourceAccountId: "bank_b" });
    expect(derived(second, bill.id)).toMatchObject({ status: "paid", remaining: 0 });
    expect(second.billPayments.map((p) => p.sourceAccountId)).toEqual(["bank_a", "bank_b"]);
    expect(balance(second, "bank_a")).toBe(18000);
    expect(balance(second, "bank_b")).toBe(11000);
  });

  it("posts once for a repeated idempotency key (AC-07)", () => {
    const { state, bill } = withBill();
    const input = { billId: bill.id, amount: 9200, paidAt: PAID_AT, sourceAccountId: "bank_a", idempotencyKey: "same" };
    const first = recordBillPayment(state, input, NOW);
    const second = recordBillPayment(first.state, input, NOW);
    expect(second.duplicate).toBe(true);
    expect(second.state).toBe(first.state);
    expect(second.payment.id).toBe(first.payment.id);
  });

  it("refuses a key already used for another bill", () => {
    const { state, bill } = withBill();
    const withOther = createOneTimeBill(state, { nameSnapshot: "x", cashflowKindSnapshot: "expense", amountDue: 10, dueDate: "2026-11-09", categoryId: "cat_food" }, NOW);
    const other = withOther.monthlyBills[1];
    const first = recordBillPayment(withOther, { billId: bill.id, amount: 1, paidAt: PAID_AT, sourceAccountId: "bank_a", idempotencyKey: "k" }, NOW);
    expect(() => recordBillPayment(first.state, { billId: other.id, amount: 1, paidAt: PAID_AT, sourceAccountId: "bank_a", idempotencyKey: "k" }, NOW)).toThrow(BillError);
  });

  it("uses the Bangkok date for the ledger date", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill, { paidAt: "2026-11-30T18:00:00Z" });
    expect(paid.transactions[0].date).toBe("2026-12-01");
  });

  it.each([
    ["over the remaining amount", { amount: 9200.01 }],
    ["zero", { amount: 0 }],
    ["negative", { amount: -1 }],
    ["an archived or unknown account", { sourceAccountId: "nope" }],
  ])("rejects %s and writes nothing", (_label, over) => {
    const { state, bill } = withBill();
    expect(() => pay(state, bill, over)).toThrow(BillError);
    expect(state.transactions).toEqual([]);
    expect(state.billPayments).toEqual([]);
  });

  it("rejects paying a skipped or cancelled bill", () => {
    const { state, bill } = withBill();
    expect(() => pay(skipBill(state, bill.id, "x", NOW), bill)).toThrow(BillError);
    expect(() => pay(cancelBill(state, bill.id, NOW), bill)).toThrow(BillError);
  });

  it("writes nothing at all when ledger building fails part-way", () => {
    const { state, bill } = withBill({ cashflowKind: "loan_payment", loanAccountId: "loan_car", defaultAmount: 9200 });
    expect(() => pay(state, bill, { principalAmount: 8000, interestAmount: 1000 })).toThrow(BillError);
    expect(state.billPayments).toEqual([]);
    expect(state.loanPayments).toEqual([]);
    expect(state.transactions).toEqual([]);
  });
});

describe("posting rules", () => {
  it("counts a card purchase as an expense and debt, not cash (US-06)", () => {
    const { state, bill } = withBill({ defaultAmount: 750 });
    const paid = pay(state, bill, { sourceAccountId: "card" });
    expect(novTotals(paid).expenses).toBe(750);
    expect(balance(paid, "card")).toBe(750);
    expect(balance(paid, "bank_a")).toBe(20000);
  });

  it("does not count a card repayment as a second expense (AC-08)", () => {
    const { state, bill } = withBill({ defaultAmount: 750 });
    let paid = pay(state, bill, { sourceAccountId: "card" });
    const statement = ensureBills(createRule(paid, ruleInput({ name: "จ่ายบัตร", cashflowKind: "credit_card_payment", defaultAmount: 750, targetAccountId: "card", categoryId: null }), NOW), [NOV], NOW);
    paid = pay(statement, statement.monthlyBills[1]);
    expect(novTotals(paid).expenses).toBe(750);
    expect(balance(paid, "card")).toBe(0);
    expect(balance(paid, "bank_a")).toBe(19250);
  });

  it("requires a credit card as the card repayment target", () => {
    const { state, bill } = withBill({ cashflowKind: "credit_card_payment", targetAccountId: "savings", categoryId: null });
    expect(() => pay(state, bill)).toThrow(BillError);
  });

  it("splits a loan payment into principal and interest (US-07, AC-09)", () => {
    const { state, bill } = withBill({ cashflowKind: "loan_payment", loanAccountId: "loan_car", categoryId: null });
    const before = netWorth(state);
    const paid = pay(state, bill, { principalAmount: 8000, interestAmount: 1200 });
    expect(balance(paid, "bank_a")).toBe(10800);
    expect(computeRemainingPrincipal(carLoan, paid.loanPayments)).toBe(92000);
    expect(novTotals(paid).expenses).toBe(1200);
    expect(netWorth(paid)).toBe(before - 1200);
    expect(paid.billPaymentPostings).toHaveLength(3); // principal tx, interest tx, loan payment
  });

  it("rejects principal + interest that do not match, and principal over the debt", () => {
    const { state, bill } = withBill({ cashflowKind: "loan_payment", loanAccountId: "loan_car", categoryId: null });
    expect(() => pay(state, bill, { principalAmount: 8000, interestAmount: 1000 })).toThrow(BillError);
    const small = { ...state, loans: [{ ...carLoan, openingPrincipal: 100 }] };
    expect(() => pay(small, bill, { principalAmount: 9200, interestAmount: 0 })).toThrow(BillError);
  });

  it.each<[CashflowKind, string]>([
    ["saving", "savings"],
    ["transfer", "bank_b"],
    ["investment", "port"],
  ])("does not treat %s as an expense or lose net worth (US-08, AC-10)", (cashflowKind, target) => {
    const { state, bill } = withBill({ cashflowKind, defaultAmount: 3000, targetAccountId: target, categoryId: null });
    const before = netWorth(state);
    const start = balance(state, target);
    const paid = pay(state, bill);
    expect(balance(paid, "bank_a")).toBe(17000);
    expect(balance(paid, target)).toBe(start + 3000);
    expect(novTotals(paid).expenses).toBe(0);
    expect(netWorth(paid)).toBe(before);
  });

  it("refuses non-expense bills paid from a credit card or to the same account", () => {
    const { state, bill } = withBill({ cashflowKind: "saving", targetAccountId: "savings", categoryId: null });
    expect(() => pay(state, bill, { sourceAccountId: "card" })).toThrow(BillError);
    expect(() => pay(state, bill, { sourceAccountId: "savings" })).toThrow(BillError);
  });

  it("accepts a destination chosen at payment time", () => {
    const { state, bill } = withBill({ cashflowKind: "transfer", categoryId: null });
    const paid = pay(state, bill, { targetAccountId: "bank_b", amount: 100 });
    expect(balance(paid, "bank_b")).toBe(15100);
  });
});

describe("reversal (AC-16)", () => {
  const paymentOf = (s: BillState) => s.billPayments[0];

  it("restores balance, totals, budget and the bill for an expense", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    const reversed = reverseBillPayment(paid, paymentOf(paid).id, "กดผิด", NOW);
    expect(derived(reversed, bill.id)).toMatchObject({ status: "unpaid", remaining: 9200 });
    expect(balance(reversed, "bank_a")).toBe(20000);
    expect(novTotals(reversed).expenses).toBe(0);
    const budget = { id: "b", userId: "demo-user", categoryId: "cat_food", period: NOV, limit: 10000 };
    expect(computeBudgetStatus(budget, reversed.transactions).spent).toBe(0);
  });

  it("keeps the audit trail rather than deleting anything", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    const reversed = reverseBillPayment(paid, paymentOf(paid).id, "กดผิด", NOW);
    expect(reversed.transactions).toHaveLength(2);
    expect(reversed.transactions.find((t) => t.reversalOfTransactionId === paid.transactions[0].id)).toBeTruthy();
    expect(paymentOf(reversed)).toMatchObject({ reversalReason: "กดผิด", reversedAt: NOW.toISOString() });
    expect(reversed.billPaymentPostings.filter((p) => p.isReversal)).toHaveLength(1);
  });

  it("undoes every posting of a loan payment together", () => {
    const { state, bill } = withBill({ cashflowKind: "loan_payment", loanAccountId: "loan_car", categoryId: null });
    const before = netWorth(state);
    const paid = pay(state, bill, { principalAmount: 8000, interestAmount: 1200 });
    const reversed = reverseBillPayment(paid, paymentOf(paid).id, "x", NOW);
    expect(balance(reversed, "bank_a")).toBe(20000);
    expect(computeRemainingPrincipal(carLoan, reversed.loanPayments)).toBe(100000);
    expect(novTotals(reversed).expenses).toBe(0);
    expect(netWorth(reversed)).toBe(before);
  });

  it("reverses a transfer by swapping direction", () => {
    const { state, bill } = withBill({ cashflowKind: "saving", defaultAmount: 3000, targetAccountId: "savings", categoryId: null });
    const paid = pay(state, bill);
    const reversed = reverseBillPayment(paid, paymentOf(paid).id, "x", NOW);
    expect(balance(reversed, "bank_a")).toBe(20000);
    expect(balance(reversed, "savings")).toBe(1000);
    expect(reversed.transactions.every((t) => t.amount > 0)).toBe(true);
  });

  it("restores card debt", () => {
    const { state, bill } = withBill({ defaultAmount: 750 });
    const paid = pay(state, bill, { sourceAccountId: "card" });
    expect(balance(reverseBillPayment(paid, paymentOf(paid).id, "x", NOW), "card")).toBe(0);
  });

  it("only reverses once, and needs a reason", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    expect(() => reverseBillPayment(paid, paymentOf(paid).id, "  ", NOW)).toThrow(BillError);
    const reversed = reverseBillPayment(paid, paymentOf(paid).id, "x", NOW);
    expect(() => reverseBillPayment(reversed, paymentOf(reversed).id, "x", NOW)).toThrow(BillError);
  });

  it("allows paying again after a reversal", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    const again = pay(reverseBillPayment(paid, paymentOf(paid).id, "x", NOW), bill);
    expect(derived(again, bill.id).status).toBe("paid");
    expect(balance(again, "bank_a")).toBe(10800);
  });

  it("refuses when a ledger row has gone missing rather than half-reversing", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill);
    expect(() => reverseBillPayment({ ...paid, transactions: [] }, paymentOf(paid).id, "x", NOW)).toThrow(BillError);
  });
});

describe("changing amounts", () => {
  it("overrides one month only (US-04, AC-06)", () => {
    const state = ensureBills(createRule(baseState(), ruleInput({ defaultAmount: 1500 }), NOW), [NOV, DEC], NOW);
    const [nov, dec] = state.monthlyBills;
    const next = updateBill(state, nov.id, { amountDue: 1650 }, NOW);
    expect(billOf(next, nov.id).amountDue).toBe(1650);
    expect(billOf(next, dec.id).amountDue).toBe(1500);
    expect(amountForPeriod(next.fixedCostRules[0], NOV)).toBe(1500);
  });

  it("refuses an amount below what is already paid", () => {
    const { state, bill } = withBill({ defaultAmount: 6000 });
    const paid = pay(state, bill, { amount: 2000 });
    expect(() => updateBill(paid, bill.id, { amountDue: 1999 }, NOW)).toThrow(BillError);
    expect(billOf(updateBill(paid, bill.id, { amountDue: 2000 }, NOW), bill.id).amountDue).toBe(2000);
  });

  it("applies a rule change from its effective month (US-05)", () => {
    const state = ensureBills(createRule(baseState(), ruleInput({ defaultAmount: 750 }), NOW), [NOV, DEC], NOW);
    const next = updateRule(state, state.fixedCostRules[0].id, ruleInput({ defaultAmount: 850 }), DEC, NOW);
    expect(next.monthlyBills.map((b) => b.amountDue)).toEqual([750, 850]);
  });

  it("keeps the old amount for an earlier month generated after the edit", () => {
    const rule = createRule(baseState(), ruleInput({ defaultAmount: 750 }), NOW);
    const edited = updateRule(rule, rule.fixedCostRules[0].id, ruleInput({ defaultAmount: 850 }), DEC, NOW);
    const later = ensureBills(edited, [NOV, DEC, "2027-01"], NOW);
    expect(later.monthlyBills.map((b) => b.amountDue)).toEqual([750, 850, 850]);
  });

  it("supersedes later scheduled changes when editing an earlier month", () => {
    const rule = createRule(baseState(), ruleInput({ defaultAmount: 750 }), NOW);
    const id = rule.fixedCostRules[0].id;
    const s1 = updateRule(rule, id, ruleInput({ defaultAmount: 900 }), "2027-02", NOW);
    const s2 = updateRule(s1, id, ruleInput({ defaultAmount: 800 }), DEC, NOW);
    expect(amountForPeriod(s2.fixedCostRules[0], "2027-03")).toBe(800);
  });

  it("does not rewrite paid, hand-edited or skipped bills", () => {
    const state = ensureBills(createRule(baseState(), ruleInput({ defaultAmount: 750 }), NOW), [NOV, DEC, "2027-01"], NOW);
    const [nov, dec, jan] = state.monthlyBills;
    const touched = skipBill(updateBill(pay(state, nov), dec.id, { amountDue: 700 }, NOW), jan.id, "x", NOW);
    const next = updateRule(touched, state.fixedCostRules[0].id, ruleInput({ defaultAmount: 850, name: "ใหม่" }), NOV, NOW);
    expect(next.monthlyBills.map((b) => [b.nameSnapshot, b.amountDue])).toEqual([["งวดรถ", 750], ["งวดรถ", 700], ["งวดรถ", 750]]);
  });

  it("does not rewrite a bill whose only payment was reversed", () => {
    const { state, bill } = withBill({ defaultAmount: 750 });
    const paid = pay(state, bill);
    const reversed = reverseBillPayment(paid, paid.billPayments[0].id, "x", NOW);
    const next = updateRule(reversed, state.fixedCostRules[0].id, ruleInput({ defaultAmount: 850 }), NOV, NOW);
    expect(billOf(next, bill.id).amountDue).toBe(750);
  });
});

describe("rule lifecycle", () => {
  const now = new Date("2026-11-10T05:00:00Z");

  it("stops future bills when paused and resumes them, keeping the current month", () => {
    const state = ensureBills(createRule(baseState(), ruleInput(), now), [NOV, DEC, "2027-01"], now);
    const id = state.fixedCostRules[0].id;
    const paused = setRuleStatus(state, id, { isActive: false }, now);
    expect(paused.monthlyBills.map((b) => b.period)).toEqual([NOV]);
    expect(ensureBills(paused, [DEC], now).monthlyBills).toHaveLength(1);
    const resumed = ensureBills(setRuleStatus(paused, id, { isActive: true }, now), [DEC], now);
    expect(resumed.monthlyBills.map((b) => b.period)).toEqual([NOV, DEC]);
  });

  it("keeps paid future bills and history when archived", () => {
    const state = ensureBills(createRule(baseState(), ruleInput(), now), [NOV, DEC], now);
    const dec = state.monthlyBills[1];
    const paid = pay(state, dec);
    const archived = setRuleStatus(paid, state.fixedCostRules[0].id, { archived: true }, now);
    expect(archived.monthlyBills).toHaveLength(2);
    expect(balance(archived, "bank_a")).toBe(10800);
  });
});

describe("skipping and cancelling", () => {
  it("needs a reason to skip, and can be reopened", () => {
    const { state, bill } = withBill();
    expect(() => skipBill(state, bill.id, " ", NOW)).toThrow(BillError);
    const skipped = skipBill(state, bill.id, "ย้ายแพ็กเกจ", NOW);
    expect(billOf(skipped, bill.id).skipReason).toBe("ย้ายแพ็กเกจ");
    expect(derived(reopenBill(skipped, bill.id, NOW), bill.id).status).toBe("unpaid");
  });

  it("refuses to skip or cancel a bill with net payments", () => {
    const { state, bill } = withBill();
    const paid = pay(state, bill, { amount: 1 });
    expect(() => skipBill(paid, bill.id, "x", NOW)).toThrow(BillError);
    expect(() => cancelBill(paid, bill.id, NOW)).toThrow(BillError);
  });

  it("creates one-time bills, several in a month, with no rule", () => {
    const input = { nameSnapshot: "ค่าซ่อม", cashflowKindSnapshot: "expense" as const, amountDue: 500, dueDate: "2026-11-20", categoryId: "cat_food" };
    const state = createOneTimeBill(createOneTimeBill(baseState(), input, NOW), input, NOW);
    expect(state.monthlyBills.map((b) => [b.period, b.fixedCostRuleId])).toEqual([[NOV, null], [NOV, null]]);
    expect(state.transactions).toEqual([]);
  });
});

describe("summary", () => {
  function month() {
    let state = baseState();
    state = createRule(state, ruleInput({ name: "ค่าเช่า", defaultAmount: 12000 }), NOW);
    state = createRule(state, ruleInput({ name: "ค่าเน็ต", defaultAmount: 1000, defaultAccountId: "card" }), NOW);
    state = createRule(state, ruleInput({ name: "ออม", cashflowKind: "saving", defaultAmount: 3000, targetAccountId: "savings", categoryId: null }), NOW);
    state = createRule(state, ruleInput({ name: "ลงทุน", cashflowKind: "investment", defaultAmount: 2000, targetAccountId: "port", categoryId: null }), NOW);
    state = createRule(state, ruleInput({ name: "ไม่ระบุบัญชี", defaultAmount: 500, defaultAccountId: null }), NOW);
    return ensureBills(state, [NOV], NOW);
  }
  const summarize = (s: BillState, accountId?: string) =>
    computeBillsSummary(deriveBills(s.monthlyBills, s.billPayments, "2026-11-01"), accountBalances(s.accounts, s.transactions), accountId);

  it("adds up to the rows (AC-11)", () => {
    const s = month();
    expect(summarize(s)).toMatchObject({ planned: 18500, plannedExpense: 13500, plannedCommitment: 5000, paid: 0, remaining: 18500, unallocatedRemaining: 500 });
  });

  it("excludes skipped and cancelled bills", () => {
    const s = month();
    const next = cancelBill(skipBill(s, s.monthlyBills[0].id, "x", NOW), s.monthlyBills[1].id, NOW);
    expect(summarize(next).planned).toBe(5500);
  });

  it("treats card purchases and moves between liquid accounts as no cash out", () => {
    const s = month();
    // cash 36,000 - rent 12,000 - investment 2,000 - unallocated 500. The card
    // purchase and the transfer to another bank account take nothing from the total.
    expect(summarize(s)).toMatchObject({ cashNow: 36000, availableAfterBills: 21500 });
  });

  it("does not change after paying, because paying only converts plan into balance", () => {
    const s = month();
    const rent = s.monthlyBills[0];
    expect(summarize(pay(s, rent)).availableAfterBills).toBe(21500);
    expect(summarize(pay(s, rent)).remaining).toBe(6500);
  });

  it("narrows to one account, counting transfers out of it", () => {
    const s = month();
    expect(summarize(s, "bank_a")).toMatchObject({ planned: 17000, cashNow: 20000 });
    // rent, saving and investment leave bank_a; so does the unallocated bill, which could come from anywhere.
    expect(summarize(s, "bank_a").availableAfterBills).toBe(2500);
  });

  it("flags overdue value", () => {
    const s = month();
    const items = deriveBills(s.monthlyBills, s.billPayments, "2026-11-06");
    expect(computeBillsSummary(items, accountBalances(s.accounts, s.transactions))).toMatchObject({ overdueCount: 5, overdueAmount: 18500 });
  });

  it("builds a per-account plan that keeps unallocated bills visible (AC-12)", () => {
    const s = month();
    const plan = computeAccountCashPlan(deriveBills(s.monthlyBills, s.billPayments, "2026-11-01"), accountBalances(s.accounts, s.transactions));
    const row = (id: string) => plan.rows.find((r) => r.account.id === id)!;
    expect(plan.unallocated).toBe(500);
    expect(row("bank_a")).toMatchObject({ balance: 20000, outgoing: 17000, projected: 3000 });
    expect(row("savings")).toMatchObject({ incoming: 3000, projected: 4000 });
    expect(row("card")).toMatchObject({ balance: 0, outgoing: 1000, projected: 1000 });
    expect(row("port")).toMatchObject({ incoming: 2000, projected: 2000 });
  });
});

describe("loan installments", () => {
  const loanRule = { cashflowKind: "loan_payment" as const, loanAccountId: "loan_car", categoryId: null, defaultAmount: 1000 };
  const split = { principalAmount: 900, interestAmount: 100 };
  const remaining = (s: BillState) => computeRemainingInstallments(s.loans[0], s);

  function withCount(count: number, periods = [NOV]) {
    const start = setLoanInstallments(baseState(), "loan_car", count);
    return ensureBills(createRule(start, ruleInput(loanRule), NOW), periods, NOW);
  }

  it("is null until a count is set", () => {
    expect(remaining(baseState())).toBeNull();
  });

  it("drops by one when a bill is paid in full", () => {
    const s = withCount(3);
    expect(remaining(s)).toBe(3);
    expect(remaining(pay(s, s.monthlyBills[0], split))).toBe(2);
  });

  it("counts a bill paid in two parts as one installment, once it is complete", () => {
    const s = withCount(3);
    const bill = s.monthlyBills[0];
    const first = pay(s, bill, { amount: 400, principalAmount: 400, interestAmount: 0 });
    expect(remaining(first)).toBe(3);
    expect(remaining(pay(first, bill, { amount: 600, principalAmount: 500, interestAmount: 100 }))).toBe(2);
  });

  it("gives the installment back when a payment is reversed", () => {
    const s = withCount(3);
    const paid = pay(s, s.monthlyBills[0], split);
    expect(remaining(reverseBillPayment(paid, paid.billPayments[0].id, "x", NOW))).toBe(3);
  });

  it("does not count a skipped month", () => {
    const s = withCount(3);
    expect(remaining(skipBill(s, s.monthlyBills[0].id, "พักชำระ", NOW))).toBe(3);
  });

  it("counts a payment recorded directly on the debts page", () => {
    const s = withCount(3);
    const direct = { id: "lp1", loanAccountId: "loan_car", userId: "demo-user", date: "2026-11-01", principalAmount: 900, interestAmount: 100 };
    expect(remaining({ ...s, loanPayments: [direct] })).toBe(2);
  });

  it("stops creating bills once the installments are covered", () => {
    const s = withCount(2, [NOV, DEC, "2027-01", "2027-02"]);
    expect(s.monthlyBills.map((b) => b.period)).toEqual([NOV, DEC]);
  });

  it("uses the earliest months first, whatever order they are asked for", () => {
    const s = withCount(1, ["2027-02", NOV]);
    expect(s.monthlyBills.map((b) => b.period)).toEqual([NOV]);
  });

  it("creates no more after the last installment is paid", () => {
    const s = withCount(1);
    const paid = pay(s, s.monthlyBills[0], split);
    expect(remaining(paid)).toBe(0);
    expect(ensureBills(paid, [DEC], NOW).monthlyBills).toHaveLength(1);
  });

  it("keeps generating with no limit when no count is set", () => {
    const s = ensureBills(createRule(baseState(), ruleInput(loanRule), NOW), [NOV, DEC, "2027-01"], NOW);
    expect(s.monthlyBills).toHaveLength(3);
  });

  it("treats an edit as what is left from now, keeping payments already made", () => {
    const s = withCount(3);
    const paid = pay(s, s.monthlyBills[0], split);
    const edited = setLoanInstallments(paid, "loan_car", 10);
    expect(remaining(edited)).toBe(10);
    expect(edited.loans[0].installmentsPlanned).toBe(11);
  });

  it("clears the count, and rejects anything but a whole non-negative number", () => {
    const s = withCount(3);
    expect(remaining(setLoanInstallments(s, "loan_car", null))).toBeNull();
    expect(() => setLoanInstallments(s, "loan_car", -1)).toThrow(BillError);
    expect(() => setLoanInstallments(s, "loan_car", 1.5)).toThrow(BillError);
  });
});

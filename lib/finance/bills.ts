/**
 * State transitions for Bills & Fixed Costs.
 *
 * Each function takes the current data and returns the next data, or throws a
 * BillError (with a Thai message the UI can show as-is) leaving the input
 * untouched. A transition is therefore all-or-nothing: the bill, payment,
 * postings and ledger rows all land in one returned state or none do. The
 * Supabase equivalent is the record_bill_payment / reverse_bill_payment RPCs
 * in supabase/migrations/0003_bills.sql, which must stay in step with this.
 *
 * Posting follows the rules in lib/finance/calculations.ts: a card repayment
 * is a transfer, loan principal is a flagged expense excluded from totals with
 * only the interest a real expense, and savings or investment moves are
 * transfers. Reversal appends contra entries and never edits the ledger.
 */

import { computeRemainingPrincipal } from "./calculations";
import {
  amountForPeriod,
  bangkokDate,
  bangkokPeriod,
  computeBillPaidNet,
  dueDateFor,
  fromSatang,
  isValidPeriod,
  ruleAppliesTo,
  toSatang,
} from "./bill-calculations";
import type {
  Account,
  BillPayment,
  BillPaymentPosting,
  Category,
  CashflowKind,
  FixedCostRule,
  LoanAccount,
  LoanPayment,
  MonthlyBill,
  Transaction,
} from "./types";
import { shiftPeriod, uid } from "@/lib/utils";

const USER = "demo-user";

export class BillError extends Error {}

export interface BillState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  loans: LoanAccount[];
  loanPayments: LoanPayment[];
  fixedCostRules: FixedCostRule[];
  monthlyBills: MonthlyBill[];
  billPayments: BillPayment[];
  billPaymentPostings: BillPaymentPosting[];
}

/** Bills of these kinds move money to another account the user owns. */
export const TRANSFER_KINDS: CashflowKind[] = ["credit_card_payment", "transfer", "saving", "investment"];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function billFromRule(rule: FixedCostRule, period: string, now: string): MonthlyBill {
  return {
    id: uid("bill"),
    userId: rule.userId,
    fixedCostRuleId: rule.id,
    period,
    nameSnapshot: rule.name,
    cashflowKindSnapshot: rule.cashflowKind,
    amountDue: amountForPeriod(rule, period),
    userEdited: false,
    dueDate: dueDateFor(period, rule.dueRule, rule.dueDay),
    plannedAccountId: rule.defaultAccountId ?? null,
    categoryId: rule.categoryId ?? null,
    targetAccountId: rule.targetAccountId ?? null,
    loanAccountId: rule.loanAccountId ?? null,
    lifecycleState: "active",
    note: rule.note ?? null,
    skipReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Creates any missing bills for these months. Never writes to the ledger. Returns the same object when nothing was missing. */
export function ensureBills<S extends BillState>(state: S, periods: string[], now: Date = new Date()): S {
  const existing = new Set(state.monthlyBills.map((b) => `${b.fixedCostRuleId}|${b.period}`));
  const added: MonthlyBill[] = [];
  for (const period of periods) {
    if (!isValidPeriod(period)) continue;
    for (const rule of state.fixedCostRules) {
      const key = `${rule.id}|${period}`;
      if (!ruleAppliesTo(rule, period) || existing.has(key)) continue;
      existing.add(key);
      added.push(billFromRule(rule, period, now.toISOString()));
    }
  }
  return added.length ? { ...state, monthlyBills: [...state.monthlyBills, ...added] } : state;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RuleInput = Pick<
  FixedCostRule,
  | "name"
  | "cashflowKind"
  | "defaultAmount"
  | "amountMode"
  | "dueRule"
  | "dueDay"
  | "startMonth"
  | "endMonth"
  | "categoryId"
  | "defaultAccountId"
  | "targetAccountId"
  | "loanAccountId"
  | "note"
>;

export function createRule<S extends BillState>(state: S, input: RuleInput, now: Date = new Date()): S {
  const at = now.toISOString();
  const rule: FixedCostRule = {
    ...input,
    id: uid("rule"),
    userId: USER,
    frequency: "monthly",
    amountChanges: [],
    isActive: true,
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
  return { ...state, fixedCostRules: [...state.fixedCostRules, rule] };
}

/**
 * Brings generated bills from `fromPeriod` on back in line with the rule. Only
 * untouched bills change: anything with a payment record, a hand edit or a
 * skip/cancel stays exactly as the user left it. A bill the rule no longer
 * covers is removed, which is safe because it has no history.
 */
function reconcileRuleBills<S extends BillState>(state: S, rule: FixedCostRule, fromPeriod: string, at: string): S {
  const hasPayment = new Set(state.billPayments.map((p) => p.billId));
  const monthlyBills: MonthlyBill[] = [];
  for (const bill of state.monthlyBills) {
    const untouched =
      bill.fixedCostRuleId === rule.id &&
      bill.period >= fromPeriod &&
      bill.lifecycleState === "active" &&
      !bill.userEdited &&
      !hasPayment.has(bill.id);
    if (!untouched) monthlyBills.push(bill);
    else if (ruleAppliesTo(rule, bill.period)) {
      monthlyBills.push({ ...billFromRule(rule, bill.period, at), id: bill.id, createdAt: bill.createdAt });
    }
  }
  return { ...state, monthlyBills };
}

function requireRule(state: BillState, ruleId: string): FixedCostRule {
  const rule = state.fixedCostRules.find((r) => r.id === ruleId);
  if (!rule) throw new BillError("ไม่พบรายการประจำนี้");
  return rule;
}

/** Applies an edit from `effectiveFrom` onward. Earlier months keep what they had. */
export function updateRule<S extends BillState>(
  state: S,
  ruleId: string,
  input: RuleInput,
  effectiveFrom: string,
  now: Date = new Date(),
): S {
  const current = requireRule(state, ruleId);
  if (!isValidPeriod(effectiveFrom)) throw new BillError("รูปแบบเดือนไม่ถูกต้อง");
  const at = now.toISOString();

  const { defaultAmount, ...rest } = input;
  const amountChanges =
    defaultAmount === amountForPeriod(current, effectiveFrom)
      ? current.amountChanges
      : [
          ...current.amountChanges.filter((c) => c.fromPeriod < effectiveFrom),
          { fromPeriod: effectiveFrom, amount: defaultAmount },
        ];
  const rule: FixedCostRule = { ...current, ...rest, amountChanges, updatedAt: at };
  const next = { ...state, fixedCostRules: state.fixedCostRules.map((r) => (r.id === ruleId ? rule : r)) };
  return reconcileRuleBills(next, rule, effectiveFrom, at);
}

/** Pausing or archiving stops future bills; the current month and all history stay. */
export function setRuleStatus<S extends BillState>(
  state: S,
  ruleId: string,
  status: { isActive?: boolean; archived?: boolean },
  now: Date = new Date(),
): S {
  const at = now.toISOString();
  const rule = { ...requireRule(state, ruleId), ...status, updatedAt: at };
  const next = { ...state, fixedCostRules: state.fixedCostRules.map((r) => (r.id === ruleId ? rule : r)) };
  return reconcileRuleBills(next, rule, shiftPeriod(bangkokPeriod(now), 1), at);
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export type OneTimeBillInput = Pick<
  MonthlyBill,
  "nameSnapshot" | "cashflowKindSnapshot" | "amountDue" | "dueDate" | "plannedAccountId" | "categoryId" | "targetAccountId" | "loanAccountId" | "note"
>;

export function createOneTimeBill<S extends BillState>(state: S, input: OneTimeBillInput, now: Date = new Date()): S {
  const at = now.toISOString();
  const bill: MonthlyBill = {
    ...input,
    id: uid("bill"),
    userId: USER,
    fixedCostRuleId: null,
    period: input.dueDate.slice(0, 7),
    userEdited: true,
    lifecycleState: "active",
    skipReason: null,
    createdAt: at,
    updatedAt: at,
  };
  return { ...state, monthlyBills: [...state.monthlyBills, bill] };
}

function requireBill(state: BillState, billId: string): MonthlyBill {
  const bill = state.monthlyBills.find((b) => b.id === billId);
  if (!bill) throw new BillError("ไม่พบบิลนี้");
  return bill;
}

function replaceBill<S extends BillState>(state: S, bill: MonthlyBill, now: Date): S {
  const next = { ...bill, updatedAt: now.toISOString() };
  return { ...state, monthlyBills: state.monthlyBills.map((b) => (b.id === bill.id ? next : b)) };
}

export type BillPatch = Partial<Pick<MonthlyBill, "amountDue" | "dueDate" | "plannedAccountId" | "note">>;

/** Changes this month only: the rule and every other month are left alone. */
export function updateBill<S extends BillState>(state: S, billId: string, patch: BillPatch, now: Date = new Date()): S {
  const bill = requireBill(state, billId);
  const next = { ...bill, ...patch, userEdited: true };
  if (patch.amountDue !== undefined && patch.amountDue !== bill.amountDue) {
    if (!(patch.amountDue >= 0)) throw new BillError("จำนวนเงินต้องไม่ติดลบ");
    if (toSatang(patch.amountDue) < toSatang(computeBillPaidNet(billId, state.billPayments))) {
      throw new BillError("ยอดนี้ต่ำกว่ายอดที่จ่ายไปแล้ว กรุณาย้อนรายการชำระก่อน");
    }
  }
  return replaceBill(state, next, now);
}

function closeBill<S extends BillState>(state: S, bill: MonthlyBill, patch: Partial<MonthlyBill>, now: Date): S {
  if (computeBillPaidNet(bill.id, state.billPayments) > 0) {
    throw new BillError("บิลนี้มีการชำระแล้ว กรุณาย้อนรายการชำระก่อน");
  }
  return replaceBill(state, { ...bill, ...patch }, now);
}

export function skipBill<S extends BillState>(state: S, billId: string, reason: string, now: Date = new Date()): S {
  if (!reason.trim()) throw new BillError("กรุณาระบุเหตุผลที่ข้ามงวดนี้");
  return closeBill(state, requireBill(state, billId), { lifecycleState: "skipped", skipReason: reason.trim() }, now);
}

export function cancelBill<S extends BillState>(state: S, billId: string, now: Date = new Date()): S {
  return closeBill(state, requireBill(state, billId), { lifecycleState: "cancelled" }, now);
}

export function reopenBill<S extends BillState>(state: S, billId: string, now: Date = new Date()): S {
  return replaceBill(state, { ...requireBill(state, billId), lifecycleState: "active", skipReason: null }, now);
}

// ---------------------------------------------------------------------------
// Recording a payment
// ---------------------------------------------------------------------------

export interface RecordPaymentInput {
  billId: string;
  amount: number;
  paidAt: string; // ISO timestamp
  sourceAccountId: string;
  /** Destination, for a transfer-like bill that has none planned. */
  targetAccountId?: string | null;
  /** Required for loan_payment; must add up to `amount`. */
  principalAmount?: number;
  interestAmount?: number;
  reference?: string | null;
  note?: string | null;
  /** The same key always produces the same single payment, so a retry cannot pay twice. */
  idempotencyKey: string;
}

export interface RecordPaymentResult<S> {
  state: S;
  payment: BillPayment;
  duplicate: boolean;
}

function usableAccount(state: BillState, id: string | null | undefined, message: string): Account {
  const account = state.accounts.find((a) => a.id === id && !a.archived);
  if (!account) throw new BillError(message);
  return account;
}

interface Ledger {
  transactions: Transaction[];
  loanPayments: LoanPayment[];
}

function buildLedger(
  state: BillState,
  bill: MonthlyBill,
  input: RecordPaymentInput,
  source: Account,
  paymentId: string,
  groupId: string,
  at: string,
): Ledger {
  const kind = bill.cashflowKindSnapshot;
  const date = bangkokDate(input.paidAt);
  const base = {
    userId: USER,
    date,
    accountId: source.id,
    merchant: bill.nameSnapshot,
    note: input.note ?? null,
    tags: [],
    billPaymentId: paymentId,
    createdAt: at,
  };

  if (kind !== "expense" && source.type === "credit_card") {
    throw new BillError("รายการประเภทนี้ต้องจ่ายจากบัญชีเงินสด ไม่ใช่บัตรเครดิต");
  }

  if (kind === "expense") {
    if (!bill.categoryId) throw new BillError("กรุณาระบุหมวดหมู่ของบิลนี้ก่อนบันทึกการชำระ");
    return {
      transactions: [{ ...base, id: uid("tx"), type: "expense", amount: input.amount, categoryId: bill.categoryId }],
      loanPayments: [],
    };
  }

  if (kind === "loan_payment") return buildLoanLedger(state, bill, input, base);

  const target = usableAccount(state, input.targetAccountId ?? bill.targetAccountId, "กรุณาเลือกบัญชีปลายทาง");
  if (target.id === source.id) throw new BillError("บัญชีต้นทางและปลายทางต้องต่างกัน");
  if (kind === "credit_card_payment" && target.type !== "credit_card") {
    throw new BillError("บัญชีปลายทางของการชำระบัตรต้องเป็นบัตรเครดิต");
  }
  return {
    transactions: [
      {
        ...base,
        id: uid("tx"),
        type: "transfer",
        amount: input.amount,
        toAccountId: target.id,
        categoryId: null,
        transferGroupId: groupId,
      },
    ],
    loanPayments: [],
  };
}

function buildLoanLedger(
  state: BillState,
  bill: MonthlyBill,
  input: RecordPaymentInput,
  base: Omit<Transaction, "id" | "type" | "amount">,
): Ledger {
  const loan = state.loans.find((l) => l.id === bill.loanAccountId && !l.archived);
  if (!loan) throw new BillError("กรุณาเลือกสินเชื่อของบิลนี้ก่อนบันทึกการชำระ");

  const principal = input.principalAmount ?? 0;
  const interest = input.interestAmount ?? 0;
  if (principal < 0 || interest < 0) throw new BillError("จำนวนเงินต้องไม่ติดลบ");
  if (toSatang(principal) + toSatang(interest) !== toSatang(input.amount)) {
    throw new BillError("เงินต้นรวมดอกเบี้ยต้องเท่ากับยอดที่จ่าย");
  }
  if (toSatang(principal) > toSatang(computeRemainingPrincipal(loan, state.loanPayments))) {
    throw new BillError("เงินต้นมากกว่ายอดหนี้คงเหลือ");
  }

  const transactions: Transaction[] = [];
  if (principal > 0) {
    transactions.push({
      ...base,
      id: uid("tx"),
      type: "expense",
      amount: principal,
      categoryId: null,
      isLoanPrincipalRepayment: true,
      loanAccountId: loan.id,
    });
  }
  if (interest > 0) {
    const category =
      state.categories.find((c) => c.id === bill.categoryId) ??
      state.categories.find((c) => c.id === "cat_interest") ??
      state.categories.find((c) => c.kind === "expense");
    if (!category) throw new BillError("ไม่พบหมวดหมู่สำหรับดอกเบี้ย");
    transactions.push({ ...base, id: uid("tx"), type: "expense", amount: interest, categoryId: category.id, loanAccountId: loan.id });
  }

  const loanPayment: LoanPayment = {
    id: uid("lp"),
    loanAccountId: loan.id,
    userId: USER,
    date: base.date,
    principalAmount: principal,
    interestAmount: interest,
    transactionId: transactions[0]?.id ?? null,
  };
  return { transactions, loanPayments: [loanPayment] };
}

export function recordBillPayment<S extends BillState>(
  state: S,
  input: RecordPaymentInput,
  now: Date = new Date(),
): RecordPaymentResult<S> {
  const existing = state.billPayments.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existing) {
    if (existing.billId !== input.billId) throw new BillError("รหัสคำขอนี้ถูกใช้กับบิลอื่นแล้ว");
    return { state, payment: existing, duplicate: true };
  }

  const bill = requireBill(state, input.billId);
  if (bill.lifecycleState !== "active") throw new BillError("บิลนี้ถูกข้ามหรือยกเลิกแล้ว");
  const amount = toSatang(input.amount);
  if (!(amount > 0)) throw new BillError("จำนวนเงินต้องมากกว่า 0");
  const remaining = toSatang(bill.amountDue) - toSatang(computeBillPaidNet(bill.id, state.billPayments));
  if (amount > remaining) throw new BillError("จำนวนเงินมากกว่ายอดค้าง หากยอดจริงสูงกว่า ให้แก้ยอดบิลก่อน");
  const source = usableAccount(state, input.sourceAccountId, "กรุณาเลือกบัญชีที่จ่าย");

  const at = now.toISOString();
  const paymentId = uid("bpay");
  const groupId = uid("grp");
  const ledger = buildLedger(state, bill, { ...input, amount: fromSatang(amount) }, source, paymentId, groupId, at);

  const payment: BillPayment = {
    id: paymentId,
    userId: USER,
    billId: bill.id,
    amount: fromSatang(amount),
    paidAt: input.paidAt,
    sourceAccountId: source.id,
    postingGroupId: groupId,
    idempotencyKey: input.idempotencyKey,
    reversedAt: null,
    reversalReason: null,
    reference: input.reference ?? null,
    note: input.note ?? null,
    createdAt: at,
  };

  return {
    state: {
      ...state,
      transactions: [...ledger.transactions, ...state.transactions],
      loanPayments: [...state.loanPayments, ...ledger.loanPayments],
      billPayments: [...state.billPayments, payment],
      billPaymentPostings: [...state.billPaymentPostings, ...postingsFor(paymentId, ledger, false, at)],
    },
    payment,
    duplicate: false,
  };
}

function postingsFor(paymentId: string, ledger: Ledger, isReversal: boolean, at: string): BillPaymentPosting[] {
  const link = (ids: Partial<BillPaymentPosting>): BillPaymentPosting => ({
    id: uid("bpp"),
    userId: USER,
    billPaymentId: paymentId,
    isReversal,
    createdAt: at,
    ...ids,
  });
  return [
    ...ledger.transactions.map((t) => link({ transactionId: t.id, loanPaymentId: null })),
    ...ledger.loanPayments.map((l) => link({ transactionId: null, loanPaymentId: l.id })),
  ];
}

// ---------------------------------------------------------------------------
// Reversing a payment
// ---------------------------------------------------------------------------

function contraTransaction(tx: Transaction, at: string): Transaction {
  const contra = {
    ...tx,
    id: uid("tx"),
    merchant: `ย้อนรายการ: ${tx.merchant ?? ""}`.trim(),
    reversalOfTransactionId: tx.id,
    createdAt: at,
  };
  if (tx.type === "transfer") return { ...contra, accountId: tx.toAccountId!, toAccountId: tx.accountId };
  return { ...contra, amount: -tx.amount };
}

/**
 * Undoes every ledger effect of a payment with contra entries dated the same
 * day as the original, so each month's totals net to zero. The payment stays
 * on record, marked reversed, as the audit trail.
 */
export function reverseBillPayment<S extends BillState>(
  state: S,
  paymentId: string,
  reason: string,
  now: Date = new Date(),
): S {
  const payment = state.billPayments.find((p) => p.id === paymentId);
  if (!payment) throw new BillError("ไม่พบรายการชำระนี้");
  if (payment.reversedAt) throw new BillError("รายการชำระนี้ถูกย้อนไปแล้ว");
  if (!reason.trim()) throw new BillError("กรุณาระบุเหตุผลในการย้อนรายการ");

  const at = now.toISOString();
  const postings = state.billPaymentPostings.filter((p) => p.billPaymentId === paymentId && !p.isReversal);
  const originalTx = postings.flatMap((p) => state.transactions.filter((t) => t.id === p.transactionId));
  const originalLoan = postings.flatMap((p) => state.loanPayments.filter((l) => l.id === p.loanPaymentId));
  if (originalTx.length + originalLoan.length !== postings.length) {
    throw new BillError("ข้อมูลการชำระไม่ครบ ไม่สามารถย้อนรายการได้");
  }

  const ledger: Ledger = {
    transactions: originalTx.map((t) => contraTransaction(t, at)),
    loanPayments: originalLoan.map((l) => ({
      ...l,
      id: uid("lp"),
      principalAmount: -l.principalAmount,
      interestAmount: -l.interestAmount,
      transactionId: null,
      reversalOfLoanPaymentId: l.id,
    })),
  };

  return {
    ...state,
    transactions: [...ledger.transactions, ...state.transactions],
    loanPayments: [...state.loanPayments, ...ledger.loanPayments],
    billPayments: state.billPayments.map((p) =>
      p.id === paymentId ? { ...p, reversedAt: at, reversalReason: reason.trim() } : p,
    ),
    billPaymentPostings: [...state.billPaymentPostings, ...postingsFor(paymentId, ledger, true, at)],
  };
}

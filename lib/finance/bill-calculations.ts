/**
 * Pure calculations for Bills & Fixed Costs: due dates, derived bill status,
 * the monthly summary and the per-account cash plan.
 *
 * Nothing here posts to the ledger. Figures are computed in whole satang so
 * repeated partial payments cannot drift (0.1 + 0.2 style) and a bill always
 * lands exactly on zero remaining.
 *
 * "Commitment" vs "expense": everything on a bill is cash to prepare, but only
 * some of it is an expense. Credit card repayments, loan principal, savings
 * and investment transfers are commitments and never count as expenses.
 */

import { computeAccountBalance } from "./calculations";
import type {
  Account,
  AccountType,
  BillPayment,
  CashflowKind,
  FixedCostRule,
  MonthlyBill,
  Transaction,
} from "./types";

export const BILL_TIME_ZONE = "Asia/Bangkok";

/** Accounts counted as spendable cash. Investment cash and card debt are not. */
export const LIQUID_ACCOUNT_TYPES: AccountType[] = ["cash", "bank", "e_wallet"];

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function toSatang(amount: number): number {
  return Math.round(amount * 100);
}

export function fromSatang(satang: number): number {
  return satang / 100;
}

export function sumMoney(amounts: number[]): number {
  return fromSatang(amounts.reduce((sum, a) => sum + toSatang(a), 0));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function isValidPeriod(period: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** The Asia/Bangkok calendar date ("YYYY-MM-DD") of an instant. */
export function bangkokDate(instant: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

export function bangkokPeriod(instant: Date | string = new Date()): string {
  return bangkokDate(instant).slice(0, 7);
}

/** Days past the end of a shorter month clamp to its last day. */
export function dueDateFor(
  period: string,
  dueRule: FixedCostRule["dueRule"],
  dueDay?: number | null,
): string {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = dueRule === "last_day" ? lastDay : Math.min(dueDay ?? lastDay, lastDay);
  return `${period}-${String(day).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function ruleAppliesTo(rule: FixedCostRule, period: string): boolean {
  if (rule.archived || !rule.isActive) return false;
  if (period < rule.startMonth) return false;
  return !rule.endMonth || period <= rule.endMonth;
}

export function amountForPeriod(rule: FixedCostRule, period: string): number {
  let amount = rule.defaultAmount;
  let from = "";
  for (const change of rule.amountChanges) {
    if (change.fromPeriod <= period && change.fromPeriod >= from) {
      amount = change.amount;
      from = change.fromPeriod;
    }
  }
  return amount;
}

// ---------------------------------------------------------------------------
// Derived bill status
// ---------------------------------------------------------------------------

export type BillStatus = "unpaid" | "partially_paid" | "paid" | "skipped" | "cancelled";

export interface DerivedBill {
  bill: MonthlyBill;
  paid: number;
  remaining: number;
  status: BillStatus;
  /** A flag on top of the status: a bill can be both partially paid and overdue. */
  isOverdue: boolean;
  payments: BillPayment[];
}

export function computeBillPaidNet(billId: string, payments: BillPayment[]): number {
  return sumMoney(payments.filter((p) => p.billId === billId && !p.reversedAt).map((p) => p.amount));
}

export function deriveBill(bill: MonthlyBill, payments: BillPayment[], today: string): DerivedBill {
  const own = payments.filter((p) => p.billId === bill.id);
  const paid = computeBillPaidNet(bill.id, own);
  const remaining = fromSatang(Math.max(toSatang(bill.amountDue) - toSatang(paid), 0));

  let status: BillStatus;
  if (bill.lifecycleState !== "active") status = bill.lifecycleState;
  else if (bill.amountDue > 0 && remaining === 0) status = "paid";
  else if (paid > 0) status = "partially_paid";
  else status = "unpaid";

  const isOverdue = bill.lifecycleState === "active" && remaining > 0 && today > bill.dueDate;
  return { bill, paid, remaining, status, isOverdue, payments: own };
}

export function deriveBills(bills: MonthlyBill[], payments: BillPayment[], today: string): DerivedBill[] {
  return bills.map((b) => deriveBill(b, payments, today));
}

// ---------------------------------------------------------------------------
// Monthly summary
// ---------------------------------------------------------------------------

export interface AccountBalance {
  account: Account;
  balance: number;
}

export function accountBalances(accounts: Account[], transactions: Transaction[]): AccountBalance[] {
  return accounts
    .filter((a) => !a.archived)
    .map((account) => ({ account, balance: computeAccountBalance(account, transactions) }));
}

/** Net cash a bill's unpaid part takes out of `included` accounts (negative = brings cash in). */
function cashEffect(item: DerivedBill, included: Set<string>, accountById: Map<string, Account>): number {
  const { plannedAccountId, targetAccountId, cashflowKindSnapshot } = item.bill;
  const source = plannedAccountId ? accountById.get(plannedAccountId) : undefined;
  // A card purchase adds debt now; the cash only leaves when the statement is paid.
  if (cashflowKindSnapshot === "expense" && source?.type === "credit_card") return 0;
  // An unallocated bill still has to be funded from somewhere, so it counts against the cash shown.
  const sourceIn = !plannedAccountId || included.has(plannedAccountId);
  const targetIn = !!targetAccountId && included.has(targetAccountId);
  if (sourceIn === targetIn) return 0; // a move between counted accounts leaves their total unchanged
  return sourceIn ? item.remaining : -item.remaining;
}

export interface BillsSummary {
  planned: number;
  plannedExpense: number;
  plannedCommitment: number;
  paid: number;
  remaining: number;
  unallocatedRemaining: number;
  cashNow: number;
  availableAfterBills: number;
  overdueCount: number;
  overdueAmount: number;
}

/**
 * Totals for one month's bills. Only active bills count. With `accountId`, the
 * bill totals narrow to bills planned from that account and the cash figures
 * to that account alone.
 */
export function computeBillsSummary(
  items: DerivedBill[],
  balances: AccountBalance[],
  accountId?: string | null,
): BillsSummary {
  const active = items.filter((i) => i.bill.lifecycleState === "active");
  const scope = accountId ? active.filter((i) => i.bill.plannedAccountId === accountId) : active;
  const cashAccounts = balances.filter(({ account }) =>
    accountId ? account.id === accountId : LIQUID_ACCOUNT_TYPES.includes(account.type),
  );
  const included = new Set(cashAccounts.map(({ account }) => account.id));
  const accountById = new Map(balances.map(({ account }) => [account.id, account]));

  const cashNow = sumMoney(cashAccounts.map((a) => a.balance));
  const outflow = sumMoney(active.map((i) => cashEffect(i, included, accountById)));
  const overdue = scope.filter((i) => i.isOverdue);
  const isExpense = (kind: CashflowKind) => kind === "expense";

  return {
    planned: sumMoney(scope.map((i) => i.bill.amountDue)),
    plannedExpense: sumMoney(scope.filter((i) => isExpense(i.bill.cashflowKindSnapshot)).map((i) => i.bill.amountDue)),
    plannedCommitment: sumMoney(scope.filter((i) => !isExpense(i.bill.cashflowKindSnapshot)).map((i) => i.bill.amountDue)),
    paid: sumMoney(scope.map((i) => i.paid)),
    remaining: sumMoney(scope.map((i) => i.remaining)),
    unallocatedRemaining: sumMoney(active.filter((i) => !i.bill.plannedAccountId).map((i) => i.remaining)),
    cashNow,
    availableAfterBills: fromSatang(toSatang(cashNow) - toSatang(outflow)),
    overdueCount: overdue.length,
    overdueAmount: sumMoney(overdue.map((i) => i.remaining)),
  };
}

// ---------------------------------------------------------------------------
// Account cash plan
// ---------------------------------------------------------------------------

export interface AccountPlanRow {
  account: Account;
  balance: number;
  outgoing: number; // planned to leave (for a card: new debt to be charged)
  incoming: number; // planned to arrive (for a card: repayments)
  projected: number; // an estimate, never a real balance
}

export interface AccountCashPlan {
  rows: AccountPlanRow[];
  /** Unpaid bills with no account chosen; shown separately so they never vanish from the total. */
  unallocated: number;
}

export function computeAccountCashPlan(items: DerivedBill[], balances: AccountBalance[]): AccountCashPlan {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, amount: number) =>
    map.set(id, sumMoney([map.get(id) ?? 0, amount]));

  let unallocated = 0;
  for (const item of items) {
    if (item.bill.lifecycleState !== "active" || item.remaining === 0) continue;
    if (item.bill.plannedAccountId) add(outgoing, item.bill.plannedAccountId, item.remaining);
    else unallocated = sumMoney([unallocated, item.remaining]);
    if (item.bill.targetAccountId) add(incoming, item.bill.targetAccountId, item.remaining);
  }

  const rows = balances
    .filter(({ account }) => LIQUID_ACCOUNT_TYPES.includes(account.type) || outgoing.has(account.id) || incoming.has(account.id))
    .map(({ account, balance }) => {
      const out = outgoing.get(account.id) ?? 0;
      const into = incoming.get(account.id) ?? 0;
      const delta = account.type === "credit_card" ? out - into : into - out;
      return { account, balance, outgoing: out, incoming: into, projected: sumMoney([balance, delta]) };
    });

  return { rows, unallocated };
}

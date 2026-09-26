/**
 * Pure, side-effect-free financial calculation functions.
 *
 * These implement the 12 financial calculation rules from the MONO
 * Finance spec. Every function here is deterministic and takes plain
 * data in, plain data out, so it can be unit tested in isolation from
 * the database / demo-store layer and reused identically by both.
 *
 * SIGN / ACCOUNTING CONVENTIONS
 * 1. Net worth = total assets - total liabilities.
 * 2. Income/expense totals for a period use `transactions` of type
 *    "income"/"expense" only; type "transfer" is always excluded.
 * 3. Operating surplus = income - expenses (can be negative).
 * 4. Operating surplus rate = surplus / income, defined ONLY when
 *    income > 0; otherwise returns null (never divide by zero).
 * 5. Account `openingBalance` is never treated as income.
 * 6. Transfers move money between the user's own accounts and are
 *    excluded from income/expense/budget totals.
 * 7. A credit card purchase is recorded as a single `expense`
 *    transaction against the credit_card account category budget.
 * 8. Paying a credit card bill is recorded as a `transfer` (cash
 *    account -> credit_card account), so it must NOT be counted again
 *    as an expense.
 * 9. Loan principal repayment reduces cash and reduces debt (modeled
 *    as an expense-type transaction flagged `isLoanPrincipalRepayment`,
 *    or better, split into a transfer for principal + a real expense
 *    for interest). This module treats principal and interest
 *    separately via `LoanPayment` records: interest is an expense,
 *    principal is not.
 * 10. Investment cash (an `investment_cash` account) and investment
 *     holdings market value are summed separately and never merged as
 *     the same figure - holdings are valued via Holding.quantity *
 *     latestPrice, cash via the account balance.
 * 11. Goal contributions reallocate money already reflected in an
 *     account balance; they never create income or additional assets.
 * 12. All aggregate figures here are derived purely from transactions/
 *     snapshots passed in - nothing is fabricated.
 */

import type {
  Account,
  Budget,
  Goal,
  GoalContribution,
  Holding,
  LoanAccount,
  LoanPayment,
  Transaction,
} from "./types";

// ---------------------------------------------------------------------------
// Account balances
// ---------------------------------------------------------------------------

/** Net effect (positive = increases account balance) of one transaction on
 *  a given account, from that account's point of view. */
function transactionEffectOnAccount(tx: Transaction, accountId: string): number {
  if (tx.type === "income" && tx.accountId === accountId) return tx.amount;
  if (tx.type === "expense" && tx.accountId === accountId) return -tx.amount;
  if (tx.type === "transfer") {
    if (tx.accountId === accountId) return -tx.amount;
    if (tx.toAccountId === accountId) return tx.amount;
  }
  return 0;
}

/**
 * Computes an account's current balance from its opening balance plus all
 * transactions touching it. For credit_card accounts the returned value is
 * POSITIVE = amount owed (a liability), by convention: purchases (expenses)
 * increase what's owed, payments (transfers in) decrease it.
 */
export function computeAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  const delta = transactions.reduce(
    (sum, tx) => sum + transactionEffectOnAccount(tx, account.id),
    0,
  );

  if (account.type === "credit_card") {
    // openingBalance for a credit card is entered as the amount owed at
    // start (a positive liability). Expenses (purchases) increase the
    // amount owed; transfers-in (bill payments) decrease it. Since
    // transactionEffectOnAccount treats the credit card like an asset
    // account (expense = -amount), we flip the sign to express it as a
    // liability that grows with purchases.
    return account.openingBalance - delta;
  }

  return account.openingBalance + delta;
}

// ---------------------------------------------------------------------------
// Rule 1: Net worth
// ---------------------------------------------------------------------------

export interface HoldingValuation {
  marketValue: number; // in base currency
}

export function computeHoldingMarketValue(
  holding: Holding,
  baseCurrency: string,
): number {
  const raw = holding.quantity * holding.latestPrice;
  if (holding.currency === baseCurrency) return raw;
  const fx = holding.fxRateToBase ?? 0;
  return raw * fx;
}

export interface NetWorthInput {
  accounts: Account[];
  transactions: Transaction[];
  holdings: Holding[];
  loans: LoanAccount[];
  loanPayments: LoanPayment[];
  baseCurrency: string;
}

export interface NetWorthResult {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function computeNetWorth(input: NetWorthInput): NetWorthResult {
  const { accounts, transactions, holdings, loans, loanPayments, baseCurrency } = input;

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const account of accounts) {
    if (account.archived) continue;
    const balance = computeAccountBalance(account, transactions);
    if (account.type === "credit_card") {
      totalLiabilities += Math.max(balance, 0);
    } else {
      totalAssets += balance;
    }
  }

  for (const holding of holdings) {
    totalAssets += computeHoldingMarketValue(holding, baseCurrency);
  }

  for (const loan of loans) {
    if (loan.archived) continue;
    if (loan.kind === "credit_card") continue; // already counted via account
    totalLiabilities += computeRemainingPrincipal(loan, loanPayments);
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

// ---------------------------------------------------------------------------
// Rules 2-4: Income / expense / surplus for a period
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  income: number;
  expenses: number;
  operatingSurplus: number;
  operatingSurplusRate: number | null;
}

export function isWithinPeriod(dateIso: string, start: string, end: string): boolean {
  return dateIso >= start && dateIso <= end;
}

/**
 * Sums income/expenses within [start, end] (inclusive, ISO date strings).
 * Transfers are always excluded (rule 6). Loan principal repayments
 * (flagged isLoanPrincipalRepayment) are excluded from expenses (rule 9) -
 * only interest, recorded as a normal category expense, counts.
 */
export function computePeriodTotals(
  transactions: Transaction[],
  start: string,
  end: string,
): PeriodTotals {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    if (!isWithinPeriod(tx.date, start, end)) continue;
    if (tx.type === "income") {
      income += tx.amount;
    } else if (tx.type === "expense" && !tx.isLoanPrincipalRepayment) {
      expenses += tx.amount;
    }
  }

  const operatingSurplus = income - expenses;
  const operatingSurplusRate = income > 0 ? operatingSurplus / income : null;

  return { income, expenses, operatingSurplus, operatingSurplusRate };
}

// ---------------------------------------------------------------------------
// Rule 9: Loan principal vs interest
// ---------------------------------------------------------------------------

export function computeRemainingPrincipal(
  loan: LoanAccount,
  payments: LoanPayment[],
): number {
  const paid = payments
    .filter((p) => p.loanAccountId === loan.id)
    .reduce((sum, p) => sum + p.principalAmount, 0);
  return Math.max(loan.openingPrincipal - paid, 0);
}

export function computeLoanInterestPaid(
  loanId: string,
  payments: LoanPayment[],
  start?: string,
  end?: string,
): number {
  return payments
    .filter((p) => p.loanAccountId === loanId)
    .filter((p) => (start && end ? isWithinPeriod(p.date, start, end) : true))
    .reduce((sum, p) => sum + p.interestAmount, 0);
}

// ---------------------------------------------------------------------------
// Rule 11: Goal progress (allocation is a reallocation, not income)
// ---------------------------------------------------------------------------

export function computeGoalAllocated(
  goalId: string,
  contributions: GoalContribution[],
): number {
  return contributions
    .filter((c) => c.goalId === goalId)
    .reduce((sum, c) => sum + c.amount, 0);
}

export interface GoalProgress {
  allocated: number;
  remaining: number;
  progressRatio: number; // 0..1+ (can exceed 1 if over-funded)
  projectedCompletionDate: string | null; // null when not enough data
}

/**
 * Projects a completion date from the historical average monthly
 * contribution rate. Returns null (labeled "estimate unavailable" by the
 * UI) when there isn't enough contribution history or the goal is already
 * funded, per spec: "labeled as estimate" only when computable.
 */
export function computeGoalProgress(
  goal: Goal,
  contributions: GoalContribution[],
): GoalProgress {
  const allocated = computeGoalAllocated(goal.id, contributions);
  const remaining = Math.max(goal.targetAmount - allocated, 0);
  const progressRatio = goal.targetAmount > 0 ? allocated / goal.targetAmount : 0;

  let projectedCompletionDate: string | null = null;
  const relevant = contributions
    .filter((c) => c.goalId === goal.id && c.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (remaining > 0 && relevant.length >= 2) {
    const first = new Date(relevant[0].date).getTime();
    const last = new Date(relevant[relevant.length - 1].date).getTime();
    const monthsSpan = Math.max((last - first) / (1000 * 60 * 60 * 24 * 30.44), 1);
    const totalContributed = relevant.reduce((s, c) => s + c.amount, 0);
    const monthlyRate = totalContributed / monthsSpan;
    if (monthlyRate > 0) {
      const monthsNeeded = remaining / monthlyRate;
      const projected = new Date(last);
      projected.setDate(projected.getDate() + Math.ceil(monthsNeeded * 30.44));
      projectedCompletionDate = projected.toISOString().slice(0, 10);
    }
  }

  return { allocated, remaining, progressRatio, projectedCompletionDate };
}

// ---------------------------------------------------------------------------
// Budgets (rule 6, 7, 8, 9 interplay: transfers & principal excluded)
// ---------------------------------------------------------------------------

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: "ok" | "warning" | "over";
}

export function computeBudgetStatus(
  budget: Budget,
  transactions: Transaction[],
): BudgetStatus {
  const [year, month] = budget.period.split("-").map(Number);
  const start = `${budget.period}-01`;
  const endDate = new Date(year, month, 0).getDate();
  const end = `${budget.period}-${String(endDate).padStart(2, "0")}`;

  const spent = transactions
    .filter((tx) => tx.type === "expense")
    .filter((tx) => !tx.isLoanPrincipalRepayment)
    .filter((tx) => tx.categoryId === budget.categoryId)
    .filter((tx) => isWithinPeriod(tx.date, start, end))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const remaining = budget.limit - spent;
  const percentUsed = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
  const status = percentUsed >= 100 ? "over" : percentUsed >= 80 ? "warning" : "ok";

  return { budget, spent, remaining, percentUsed, status };
}

// ---------------------------------------------------------------------------
// Investment portfolio (rule 10, 12)
// ---------------------------------------------------------------------------

export interface PortfolioMetrics {
  investedCapital: number;
  marketValue: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number | null;
}

export function computePortfolioMetrics(
  holdings: Holding[],
  baseCurrency: string,
): PortfolioMetrics {
  let investedCapital = 0;
  let marketValue = 0;

  for (const h of holdings) {
    const costRaw = h.quantity * h.avgCost;
    const cost = h.currency === baseCurrency ? costRaw : costRaw * (h.fxRateToBase ?? 0);
    investedCapital += cost;
    marketValue += computeHoldingMarketValue(h, baseCurrency);
  }

  const unrealizedGainLoss = marketValue - investedCapital;
  const unrealizedGainLossPercent =
    investedCapital > 0 ? (unrealizedGainLoss / investedCapital) * 100 : null;

  return { investedCapital, marketValue, unrealizedGainLoss, unrealizedGainLossPercent };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function sumByCategory(
  transactions: Transaction[],
  type: "income" | "expense",
  start: string,
  end: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    if (type === "expense" && tx.isLoanPrincipalRepayment) continue;
    if (!isWithinPeriod(tx.date, start, end)) continue;
    const key = tx.categoryId ?? "uncategorized";
    result[key] = (result[key] ?? 0) + tx.amount;
  }
  return result;
}

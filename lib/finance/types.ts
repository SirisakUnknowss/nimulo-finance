/**
 * Core domain types shared between the demo (local) data layer and the
 * Supabase-backed data layer. Money amounts are represented as plain
 * `number` in TypeScript but are ALWAYS stored as PostgreSQL `numeric`
 * in the database (see supabase/migrations) to avoid floating point
 * drift. All monetary values in this app are denominated in minor-unit
 * free decimal (e.g. 1234.56 THB), never integers-as-cents, to match
 * how Thai Baht amounts are naturally entered by users.
 *
 * SIGN CONVENTIONS (see also lib/finance/calculations.ts header):
 * - Asset account balances: positive = money owned.
 * - Credit card accounts: balance is stored as a POSITIVE liability
 *   amount owed (i.e. `creditCardBalance` = amount you owe). It is
 *   subtracted when computing net worth.
 * - Loan accounts: `remainingPrincipal` is always >= 0, representing
 *   the outstanding liability.
 * - Transaction `amount` is always a positive number; the transaction
 *   `type` (income | expense | transfer) determines its cash-flow
 *   direction, not the sign of `amount`. The one exception is a contra
 *   entry reversing a bill payment (`reversalOfTransactionId` set): an
 *   expense is undone by an equal negative expense on the same date, so
 *   every existing total nets out without changing how it is calculated.
 */

export type AccountType =
  | "cash"
  | "bank"
  | "e_wallet"
  | "investment_cash"
  | "credit_card";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string; // ISO 4217, default THB
  openingBalance: number;
  openingDate: string; // ISO date
  creditLimit?: number | null; // only for credit_card
  archived: boolean;
  createdAt: string;
}

export type TransactionType = "income" | "expense" | "transfer";

export type CategoryKind = "income" | "expense";

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon?: string;
  archived: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // always positive
  date: string; // ISO date
  accountId: string; // for transfer: source account
  toAccountId?: string | null; // for transfer: destination account
  categoryId?: string | null; // required for income/expense, null for transfer
  merchant?: string | null;
  note?: string | null;
  tags: string[];
  recurringTemplateId?: string | null;
  transferGroupId?: string | null; // links the paired transfer legs
  /** true when this expense is a loan principal repayment (excluded from budgets) */
  isLoanPrincipalRepayment?: boolean;
  loanAccountId?: string | null;
  /** Set when this row was posted by a bill payment; such rows are read-only. */
  billPaymentId?: string | null;
  /** Set on a contra entry: the transaction this row reverses. */
  reversalOfTransactionId?: string | null;
  createdAt: string;
}

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringTemplate {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  merchant?: string | null;
  note?: string | null;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
  lastPostedPeriod?: string | null; // e.g. "2025-06" to prevent double posting
  active: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  period: string; // "YYYY-MM"
  limit: number;
}

export type GoalType =
  | "emergency_fund"
  | "travel"
  | "vehicle"
  | "home"
  | "custom";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  type: GoalType;
  targetAmount: number;
  targetDate?: string | null;
  notes?: string | null;
  archived: boolean;
  createdAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number; // positive = contribution, negative = withdrawal
  date: string;
  accountId?: string | null; // account the money was reallocated from/to
  note?: string | null;
}

export type LoanKind = "installment_loan" | "credit_card";

export interface LoanAccount {
  id: string;
  userId: string;
  accountId?: string | null; // linked credit_card account, if kind = credit_card
  name: string;
  kind: LoanKind;
  openingPrincipal: number;
  interestRate: number; // annual %, e.g. 12.5
  minimumPayment?: number | null;
  dueDayOfMonth?: number | null;
  startDate: string;
  archived: boolean;
}

export interface LoanPayment {
  id: string;
  loanAccountId: string;
  userId: string;
  date: string;
  principalAmount: number;
  interestAmount: number;
  transactionId?: string | null;
  /** Set on a contra entry: the loan payment this row reverses (amounts are negative). */
  reversalOfLoanPaymentId?: string | null;
}

export type InvestmentAssetType = "stock" | "etf" | "mutual_fund" | "other";

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  currency: string;
  cashAccountId?: string | null; // linked investment_cash account
}

export interface Holding {
  id: string;
  portfolioId: string;
  userId: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  quantity: number;
  avgCost: number;
  currency: string;
  latestPrice: number;
  latestPriceDate: string;
  fxRateToBase?: number | null; // required if currency !== base currency
  fxRateDate?: string | null;
}

export type TradeType = "buy" | "sell" | "dividend";

export interface InvestmentTrade {
  id: string;
  holdingId: string;
  userId: string;
  type: TradeType;
  quantity: number;
  price: number;
  amount: number; // total cash effect, positive
  date: string;
  transactionId?: string | null; // linked cash transaction, if any
}

export interface PortfolioSnapshot {
  id: string;
  portfolioId: string;
  userId: string;
  date: string;
  marketValue: number;
  investedCapital: number;
}

export interface ExchangeRate {
  id: string;
  userId: string;
  currency: string;
  rateToBase: number;
  effectiveDate: string;
}

/**
 * Bills & Fixed Costs. A bill is an obligation, not money moving: nothing here
 * touches an account balance until a BillPayment posts to the ledger.
 *
 *   FixedCostRule 1-N MonthlyBill 1-N BillPayment 1-N BillPaymentPosting
 */
export type CashflowKind =
  | "expense"
  | "loan_payment"
  | "credit_card_payment"
  | "transfer"
  | "saving"
  | "investment";

export type BillAmountMode = "fixed" | "estimate";
export type BillDueRule = "day_of_month" | "last_day";
export type BillLifecycle = "active" | "skipped" | "cancelled";

/** Takes effect from `fromPeriod`; earlier months keep the previous amount. */
export interface RuleAmountChange {
  fromPeriod: string; // "YYYY-MM"
  amount: number;
}

export interface FixedCostRule {
  id: string;
  userId: string;
  name: string;
  cashflowKind: CashflowKind;
  defaultAmount: number; // amount at startMonth; see amountChanges
  amountChanges: RuleAmountChange[];
  amountMode: BillAmountMode;
  frequency: "monthly";
  dueRule: BillDueRule;
  dueDay?: number | null; // 1-31, for day_of_month
  startMonth: string; // "YYYY-MM"
  endMonth?: string | null;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  targetAccountId?: string | null;
  loanAccountId?: string | null;
  note?: string | null;
  isActive: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBill {
  id: string;
  userId: string;
  fixedCostRuleId?: string | null; // null for a one-time bill
  period: string; // "YYYY-MM", Asia/Bangkok
  nameSnapshot: string;
  cashflowKindSnapshot: CashflowKind;
  amountDue: number;
  /** True once the user edited this month by hand; later rule edits leave it alone. */
  userEdited: boolean;
  dueDate: string; // ISO date
  plannedAccountId?: string | null;
  categoryId?: string | null;
  targetAccountId?: string | null;
  loanAccountId?: string | null;
  lifecycleState: BillLifecycle;
  note?: string | null;
  skipReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillPayment {
  id: string;
  userId: string;
  billId: string;
  amount: number;
  paidAt: string; // ISO timestamp
  sourceAccountId: string;
  postingGroupId: string;
  idempotencyKey: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
}

/** Links a payment to exactly one ledger record (a transaction or a loan payment). */
export interface BillPaymentPosting {
  id: string;
  userId: string;
  billPaymentId: string;
  transactionId?: string | null;
  loanPaymentId?: string | null;
  isReversal: boolean;
  createdAt: string;
}

export interface Profile {
  id: string;
  displayName: string;
  baseCurrency: string; // THB default
  timezone: string; // Asia/Bangkok default
  theme: "light" | "dark" | "system";
}

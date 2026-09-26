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
 *   direction, not the sign of `amount`.
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

export interface Profile {
  id: string;
  displayName: string;
  baseCurrency: string; // THB default
  timezone: string; // Asia/Bangkok default
  theme: "light" | "dark" | "system";
}

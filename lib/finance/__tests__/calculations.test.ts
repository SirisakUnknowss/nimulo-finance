import { describe, it, expect } from "vitest";
import {
  computeAccountBalance,
  computeNetWorth,
  computePeriodTotals,
  computeRemainingPrincipal,
  computeLoanInterestPaid,
  computeGoalAllocated,
  computeGoalProgress,
  computeBudgetStatus,
  computePortfolioMetrics,
  computeHoldingMarketValue,
} from "../calculations";
import type {
  Account,
  Transaction,
  LoanAccount,
  LoanPayment,
  Goal,
  GoalContribution,
  Budget,
  Holding,
} from "../types";

const BASE = "THB";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc1",
    userId: "u1",
    name: "Wallet",
    type: "cash",
    currency: BASE,
    openingBalance: 1000,
    openingDate: "2025-01-01",
    archived: false,
    createdAt: "2025-01-01",
    ...overrides,
  };
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    userId: "u1",
    type: "expense",
    amount: 100,
    date: "2025-06-15",
    accountId: "acc1",
    categoryId: "cat1",
    tags: [],
    createdAt: "2025-06-15",
    ...overrides,
  };
}

describe("Rule 5: opening balances are not income", () => {
  it("account balance starts from opening balance with zero transactions", () => {
    expect(computeAccountBalance(account({ openingBalance: 5000 }), [])).toBe(5000);
  });
});

describe("Rule 2 & 6: income/expense exclude transfers", () => {
  it("excludes transfer transactions from period totals", () => {
    const txs: Transaction[] = [
      tx({ id: "1", type: "income", amount: 30000, date: "2025-06-01" }),
      tx({ id: "2", type: "expense", amount: 5000, date: "2025-06-05" }),
      tx({
        id: "3",
        type: "transfer",
        amount: 10000,
        date: "2025-06-10",
        accountId: "acc1",
        toAccountId: "acc2",
      }),
    ];
    const totals = computePeriodTotals(txs, "2025-06-01", "2025-06-30");
    expect(totals.income).toBe(30000);
    expect(totals.expenses).toBe(5000);
    expect(totals.operatingSurplus).toBe(25000);
  });

  it("filters out-of-period transactions", () => {
    const txs = [tx({ type: "income", amount: 100, date: "2025-05-01" })];
    const totals = computePeriodTotals(txs, "2025-06-01", "2025-06-30");
    expect(totals.income).toBe(0);
  });
});

describe("Rule 4: operating surplus rate only defined when income > 0", () => {
  it("returns null when income is zero", () => {
    const txs = [tx({ type: "expense", amount: 100, date: "2025-06-01" })];
    const totals = computePeriodTotals(txs, "2025-06-01", "2025-06-30");
    expect(totals.operatingSurplusRate).toBeNull();
  });

  it("computes rate correctly when income > 0", () => {
    const txs = [
      tx({ id: "1", type: "income", amount: 1000, date: "2025-06-01" }),
      tx({ id: "2", type: "expense", amount: 400, date: "2025-06-02" }),
    ];
    const totals = computePeriodTotals(txs, "2025-06-01", "2025-06-30");
    expect(totals.operatingSurplusRate).toBeCloseTo(0.6);
  });

  it("handles missing prior period gracefully (empty array in, zero out, no throw)", () => {
    expect(() => computePeriodTotals([], "2025-01-01", "2025-01-31")).not.toThrow();
    const totals = computePeriodTotals([], "2025-01-01", "2025-01-31");
    expect(totals.income).toBe(0);
    expect(totals.operatingSurplusRate).toBeNull();
  });
});

describe("Rule 7 & 8: credit card purchase once, repayment is a transfer", () => {
  it("counts a CC purchase as an expense exactly once, and CC bill payment is a transfer excluded from expenses", () => {
    const cash = account({ id: "cash", type: "bank", openingBalance: 20000 });
    const cc = account({ id: "cc", type: "credit_card", openingBalance: 0 });

    const txs: Transaction[] = [
      tx({ id: "1", type: "expense", amount: 1500, date: "2025-06-03", accountId: "cc" }),
      tx({
        id: "2",
        type: "transfer",
        amount: 1500,
        date: "2025-06-20",
        accountId: "cash",
        toAccountId: "cc",
      }),
    ];

    const totals = computePeriodTotals(txs, "2025-06-01", "2025-06-30");
    expect(totals.expenses).toBe(1500); // counted once

    const cashBalance = computeAccountBalance(cash, txs);
    expect(cashBalance).toBe(20000 - 1500); // paid the bill

    const ccBalance = computeAccountBalance(cc, txs);
    expect(ccBalance).toBe(0); // purchase +1500 owed, payment -1500 owed
  });
});

describe("Rule 9: loan principal vs interest split", () => {
  const loan: LoanAccount = {
    id: "loan1",
    userId: "u1",
    name: "Car loan",
    kind: "installment_loan",
    openingPrincipal: 100000,
    interestRate: 5,
    startDate: "2025-01-01",
    archived: false,
  };

  it("reduces remaining principal only by principal portion of payments", () => {
    const payments: LoanPayment[] = [
      { id: "p1", loanAccountId: "loan1", userId: "u1", date: "2025-02-01", principalAmount: 3000, interestAmount: 400 },
      { id: "p2", loanAccountId: "loan1", userId: "u1", date: "2025-03-01", principalAmount: 3050, interestAmount: 380 },
    ];
    expect(computeRemainingPrincipal(loan, payments)).toBe(100000 - 3000 - 3050);
    expect(computeLoanInterestPaid("loan1", payments)).toBe(780);
  });

  it("never goes negative even if over-paid", () => {
    const payments: LoanPayment[] = [
      { id: "p1", loanAccountId: "loan1", userId: "u1", date: "2025-02-01", principalAmount: 500000, interestAmount: 0 },
    ];
    expect(computeRemainingPrincipal(loan, payments)).toBe(0);
  });
});

describe("Rule 11: goal allocation does not create income or assets", () => {
  const goal: Goal = {
    id: "g1",
    userId: "u1",
    title: "Emergency fund",
    type: "emergency_fund",
    targetAmount: 50000,
    archived: false,
    createdAt: "2025-01-01",
  };

  it("computes allocated total from contribution records only", () => {
    const contributions: GoalContribution[] = [
      { id: "c1", goalId: "g1", userId: "u1", amount: 5000, date: "2025-01-15" },
      { id: "c2", goalId: "g1", userId: "u1", amount: 3000, date: "2025-02-15" },
    ];
    expect(computeGoalAllocated("g1", contributions)).toBe(8000);
    const progress = computeGoalProgress(goal, contributions);
    expect(progress.allocated).toBe(8000);
    expect(progress.remaining).toBe(42000);
  });

  it("withdrawals (negative amounts) reduce allocation", () => {
    const contributions: GoalContribution[] = [
      { id: "c1", goalId: "g1", userId: "u1", amount: 5000, date: "2025-01-15" },
      { id: "c2", goalId: "g1", userId: "u1", amount: -2000, date: "2025-02-15" },
    ];
    expect(computeGoalAllocated("g1", contributions)).toBe(3000);
  });

  it("does not project a completion date without enough history", () => {
    const contributions: GoalContribution[] = [
      { id: "c1", goalId: "g1", userId: "u1", amount: 5000, date: "2025-01-15" },
    ];
    const progress = computeGoalProgress(goal, contributions);
    expect(progress.projectedCompletionDate).toBeNull();
  });
});

describe("Rule 1: net worth = assets - liabilities", () => {
  it("combines cash, credit card debt, holdings, and loans", () => {
    const cash = account({ id: "cash", type: "bank", openingBalance: 50000 });
    const cc = account({ id: "cc", type: "credit_card", openingBalance: 2000 });
    const loan: LoanAccount = {
      id: "loan1",
      userId: "u1",
      name: "Home loan",
      kind: "installment_loan",
      openingPrincipal: 1000000,
      interestRate: 3,
      startDate: "2020-01-01",
      archived: false,
    };
    const holdings: Holding[] = [
      {
        id: "h1",
        portfolioId: "p1",
        userId: "u1",
        symbol: "PTT",
        name: "PTT PLC",
        assetType: "stock",
        quantity: 100,
        avgCost: 30,
        currency: BASE,
        latestPrice: 35,
        latestPriceDate: "2025-06-01",
      },
    ];
    const loanPayments: LoanPayment[] = [
      { id: "p1", loanAccountId: "loan1", userId: "u1", date: "2025-02-01", principalAmount: 20000, interestAmount: 2500 },
    ];

    const result = computeNetWorth({
      accounts: [cash, cc],
      transactions: [],
      holdings,
      loans: [loan],
      loanPayments,
      baseCurrency: BASE,
    });

    expect(result.totalAssets).toBe(50000 + 3500); // cash + holdings market value
    expect(result.totalLiabilities).toBe(2000 + (1000000 - 20000)); // CC + remaining loan principal
    expect(result.netWorth).toBe(result.totalAssets - result.totalLiabilities);
  });
});

describe("Rule 10: investment cash and holdings never double-counted", () => {
  it("portfolio metrics use only holdings, not the linked cash account balance", () => {
    const holdings: Holding[] = [
      {
        id: "h1",
        portfolioId: "p1",
        userId: "u1",
        symbol: "SCB",
        name: "SCB",
        assetType: "stock",
        quantity: 200,
        avgCost: 100,
        currency: BASE,
        latestPrice: 110,
        latestPriceDate: "2025-06-01",
      },
    ];
    const metrics = computePortfolioMetrics(holdings, BASE);
    expect(metrics.investedCapital).toBe(20000);
    expect(metrics.marketValue).toBe(22000);
    expect(metrics.unrealizedGainLoss).toBe(2000);
    expect(metrics.unrealizedGainLossPercent).toBeCloseTo(10);
  });

  it("applies FX rate for non-base-currency holdings", () => {
    const holding: Holding = {
      id: "h1",
      portfolioId: "p1",
      userId: "u1",
      symbol: "AAPL",
      name: "Apple",
      assetType: "stock",
      quantity: 10,
      avgCost: 150,
      currency: "USD",
      latestPrice: 180,
      latestPriceDate: "2025-06-01",
      fxRateToBase: 36,
      fxRateDate: "2025-06-01",
    };
    expect(computeHoldingMarketValue(holding, BASE)).toBe(10 * 180 * 36);
  });
});

describe("Budgets: transfers and principal repayments excluded", () => {
  it("does not count a transfer or a flagged loan principal repayment as spending", () => {
    const budget: Budget = { id: "b1", userId: "u1", categoryId: "cat1", period: "2025-06", limit: 5000 };
    const txs: Transaction[] = [
      tx({ id: "1", type: "expense", amount: 2000, date: "2025-06-05", categoryId: "cat1" }),
      tx({ id: "2", type: "transfer", amount: 9999, date: "2025-06-06", accountId: "acc1", toAccountId: "acc2" }),
      tx({ id: "3", type: "expense", amount: 3000, date: "2025-06-07", categoryId: "cat1", isLoanPrincipalRepayment: true }),
    ];
    const status = computeBudgetStatus(budget, txs);
    expect(status.spent).toBe(2000);
    expect(status.status).toBe("ok");
  });

  it("flags warning at >=80% and over at >=100%", () => {
    const budget: Budget = { id: "b1", userId: "u1", categoryId: "cat1", period: "2025-06", limit: 1000 };
    const warn = computeBudgetStatus(budget, [tx({ amount: 850, date: "2025-06-01", categoryId: "cat1" })]);
    expect(warn.status).toBe("warning");
    const over = computeBudgetStatus(budget, [tx({ amount: 1200, date: "2025-06-01", categoryId: "cat1" })]);
    expect(over.status).toBe("over");
  });
});

describe("Transfer round-trip does not affect net worth same-day", () => {
  it("moving money between two owned accounts leaves total assets unchanged", () => {
    const a = account({ id: "a", type: "bank", openingBalance: 10000 });
    const b = account({ id: "b", type: "bank", openingBalance: 0 });
    const txs: Transaction[] = [
      tx({ id: "1", type: "transfer", amount: 4000, date: "2025-06-01", accountId: "a", toAccountId: "b" }),
    ];
    const result = computeNetWorth({
      accounts: [a, b],
      transactions: txs,
      holdings: [],
      loans: [],
      loanPayments: [],
      baseCurrency: BASE,
    });
    expect(result.totalAssets).toBe(10000);
  });
});

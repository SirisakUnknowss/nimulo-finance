"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/lib/demo/store";
import {
  computeAccountBalance,
  computeBudgetStatus,
  computeGoalProgress,
  computeLoanInterestPaid,
  computeNetWorth,
  computePeriodTotals,
  computePortfolioMetrics,
  computeRemainingPrincipal,
  sumByCategory,
} from "@/lib/finance/calculations";
import type { Account } from "@/lib/finance/types";

/**
 * Central data-access + derived-metrics hook. This is the seam between the
 * UI and the underlying store (demo today; would call Supabase-backed
 * server actions/queries when NEXT_PUBLIC_SUPABASE_URL is configured -
 * see lib/supabase/*). All pages should read through this hook rather than
 * touching lib/demo/store or lib/finance/calculations directly, so the
 * data source can be swapped without touching page components.
 */
export function useFinanceData() {
  const store = useDemoStore();
  const { data } = store;

  const accountsWithBalances = useMemo(
    () =>
      data.accounts.map((account: Account) => ({
        account,
        balance: computeAccountBalance(account, data.transactions),
      })),
    [data.accounts, data.transactions],
  );

  const netWorth = useMemo(
    () =>
      computeNetWorth({
        accounts: data.accounts,
        transactions: data.transactions,
        holdings: data.holdings,
        loans: data.loans,
        loanPayments: data.loanPayments,
        baseCurrency: data.profile.baseCurrency,
      }),
    [data.accounts, data.transactions, data.holdings, data.loans, data.loanPayments, data.profile.baseCurrency],
  );

  function periodTotals(start: string, end: string) {
    return computePeriodTotals(data.transactions, start, end);
  }

  function expenseByCategory(start: string, end: string) {
    return sumByCategory(data.transactions, "expense", start, end);
  }

  function incomeByCategory(start: string, end: string) {
    return sumByCategory(data.transactions, "income", start, end);
  }

  const budgetStatuses = useMemo(
    () => (period: string) =>
      data.budgets.filter((b) => b.period === period).map((b) => computeBudgetStatus(b, data.transactions)),
    [data.budgets, data.transactions],
  );

  const goalsWithProgress = useMemo(
    () => data.goals.map((g) => ({ goal: g, progress: computeGoalProgress(g, data.goalContributions) })),
    [data.goals, data.goalContributions],
  );

  const loansWithSummary = useMemo(
    () =>
      data.loans.map((loan) => ({
        loan,
        remainingPrincipal: computeRemainingPrincipal(loan, data.loanPayments),
        interestPaidTotal: computeLoanInterestPaid(loan.id, data.loanPayments),
        payments: data.loanPayments.filter((p) => p.loanAccountId === loan.id),
      })),
    [data.loans, data.loanPayments],
  );

  const portfoliosWithMetrics = useMemo(
    () =>
      data.portfolios.map((p) => {
        const holdings = data.holdings.filter((h) => h.portfolioId === p.id);
        return {
          portfolio: p,
          holdings,
          metrics: computePortfolioMetrics(holdings, data.profile.baseCurrency),
          trades: data.trades.filter((t) => holdings.some((h) => h.id === t.holdingId)),
          snapshots: data.snapshots.filter((s) => s.portfolioId === p.id).sort((a, b) => a.date.localeCompare(b.date)),
        };
      }),
    [data.portfolios, data.holdings, data.trades, data.snapshots, data.profile.baseCurrency],
  );

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const accountById = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  return {
    ...store,
    accountsWithBalances,
    netWorth,
    periodTotals,
    expenseByCategory,
    incomeByCategory,
    budgetStatuses,
    goalsWithProgress,
    loansWithSummary,
    portfoliosWithMetrics,
    categoryById,
    accountById,
  };
}

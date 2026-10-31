"use client";

import { useEffect, useMemo } from "react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import {
  accountBalances,
  bangkokDate,
  bangkokPeriod,
  computeAccountCashPlan,
  computeBillsSummary,
  deriveBills,
  type AccountBalance,
  type DerivedBill,
} from "@/lib/finance/bill-calculations";
import { shiftPeriod } from "@/lib/utils";

/** How many months, counting this one, are generated ahead for planning. */
const MONTHS_AHEAD = 3;

/**
 * Bills for one month, on top of useFinanceData. Opening a month generates its
 * bills (and the next few, for planning). Generation only creates obligations,
 * so it is safe to repeat and never moves money.
 */
export function useBills(period: string) {
  const finance = useFinanceData();
  const { data, hydrated, ensureBills } = finance;

  useEffect(() => {
    if (!hydrated) return;
    const current = bangkokPeriod();
    const ahead = Array.from({ length: MONTHS_AHEAD }, (_, i) => shiftPeriod(current, i));
    ensureBills([period, ...ahead]);
  }, [hydrated, period, data.fixedCostRules, ensureBills]);

  const today = bangkokDate();

  const allItems: DerivedBill[] = useMemo(
    () => deriveBills(data.monthlyBills, data.billPayments, today),
    [data.monthlyBills, data.billPayments, today],
  );

  const items = useMemo(
    () => allItems.filter((i) => i.bill.period === period).sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate)),
    [allItems, period],
  );

  const balances: AccountBalance[] = useMemo(
    () => accountBalances(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );

  const cashPlan = useMemo(() => computeAccountCashPlan(items, balances), [items, balances]);

  const overdueElsewhere = useMemo(
    () => allItems.filter((i) => i.isOverdue && i.bill.period !== period),
    [allItems, period],
  );

  function summary(accountId?: string | null) {
    return computeBillsSummary(items, balances, accountId);
  }

  return { ...finance, today, items, allItems, balances, cashPlan, overdueElsewhere, summary };
}

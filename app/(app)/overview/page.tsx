"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { formatTHB, monthLabelThai, periodBounds, currentPeriod, shiftPeriod } from "@/lib/utils";
import { computeNetWorth, computePeriodTotals } from "@/lib/finance/calculations";

type RangeOption = "this_month" | "prev_month" | "6m" | "12m";

export default function OverviewPage() {
  const finance = useFinanceData();
  const { data, netWorth, accountsWithBalances, budgetStatuses, goalsWithProgress } = finance;
  const [range, setRange] = useState<RangeOption>("this_month");

  const nowPeriod = currentPeriod();
  const activePeriod = range === "prev_month" ? shiftPeriod(nowPeriod, -1) : nowPeriod;
  const { start, end } = periodBounds(activePeriod);
  const totals = finance.periodTotals(start, end);

  const priorPeriod = shiftPeriod(activePeriod, -1);
  const priorBounds = periodBounds(priorPeriod);
  const priorTotals = finance.periodTotals(priorBounds.start, priorBounds.end);
  const hasPriorData = data.transactions.some((t) => t.date >= priorBounds.start && t.date <= priorBounds.end);

  const monthsBack = range === "12m" ? 12 : 6;
  const cashFlowData = useMemo(() => {
    if (range !== "6m" && range !== "12m") return [];
    const points = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const p = shiftPeriod(nowPeriod, -i);
      const b = periodBounds(p);
      const t = computePeriodTotals(data.transactions, b.start, b.end);
      points.push({ label: monthLabelThai(p).slice(0, 3), income: t.income, expenses: t.expenses });
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, monthsBack, data.transactions]);

  const netWorthTrend = useMemo(() => {
    const points = [];
    for (let i = 5; i >= 0; i--) {
      const p = shiftPeriod(nowPeriod, -i);
      const b = periodBounds(p);
      const txsUpTo = data.transactions.filter((t) => t.date <= b.end);
      const nw = computeNetWorth({
        accounts: data.accounts,
        transactions: txsUpTo,
        holdings: data.holdings,
        loans: data.loans,
        loanPayments: data.loanPayments.filter((lp) => lp.date <= b.end),
        baseCurrency: data.profile.baseCurrency,
      });
      points.push({ label: monthLabelThai(p).slice(0, 3), value: nw.netWorth });
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const expenseSlices = useMemo(() => {
    const byCategory = finance.expenseByCategory(start, end);
    return Object.entries(byCategory)
      .map(([catId, value]) => {
        const cat = finance.categoryById.get(catId);
        return { name: cat?.name ?? "ไม่ระบุหมวดหมู่", value, color: cat?.color ?? "#999" };
      })
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, data.transactions]);

  const surplusRatePct = totals.operatingSurplusRate !== null ? (totals.operatingSurplusRate * 100).toFixed(1) : null;
  const incomeDelta = hasPriorData && priorTotals.income > 0 ? ((totals.income - priorTotals.income) / priorTotals.income) * 100 : null;

  const currentPeriodBudgets = budgetStatuses(nowPeriod);
  const warningBudgets = currentPeriodBudgets.filter((b) => b.status !== "ok");

  const recentTransactions = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">สวัสดี, {data.profile.displayName}</p>
        </div>
        <Select value={range} onChange={(e) => setRange(e.target.value as RangeOption)} className="w-48">
          <option value="this_month">เดือนนี้</option>
          <option value="prev_month">เดือนที่แล้ว</option>
          <option value="6m">6 เดือนล่าสุด</option>
          <option value="12m">12 เดือนล่าสุด</option>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>มูลค่าสุทธิ (Net Worth)</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <CardValue className="text-4xl">{formatTHB(netWorth.netWorth)}</CardValue>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">สินทรัพย์รวม</p>
              <p className="font-medium text-success">{formatTHB(netWorth.totalAssets)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">หนี้สินรวม</p>
              <p className="font-medium text-danger">{formatTHB(netWorth.totalLiabilities)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>รายรับ</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <CardValue>{formatTHB(totals.income)}</CardValue>
            {incomeDelta !== null && (
              <p className={`mt-1 text-xs ${incomeDelta >= 0 ? "text-success" : "text-danger"}`}>
                {incomeDelta >= 0 ? "+" : ""}{incomeDelta.toFixed(1)}% เทียบเดือนก่อน
              </p>
            )}
            {!hasPriorData && <p className="mt-1 text-xs text-muted-foreground">ไม่มีข้อมูลช่วงก่อนหน้าเพื่อเปรียบเทียบ</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>รายจ่าย</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <CardValue>{formatTHB(totals.expenses)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>ส่วนต่างดำเนินงาน (Surplus)</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <CardValue className={totals.operatingSurplus >= 0 ? "text-success" : "text-danger"}>
              {formatTHB(totals.operatingSurplus)}
            </CardValue>
            <p className="mt-1 text-xs text-muted-foreground">
              {surplusRatePct !== null ? `อัตราการออม ${surplusRatePct}%` : "ยังไม่มีรายรับในช่วงนี้"}
            </p>
          </CardContent>
        </Card>
      </div>

      {(range === "6m" || range === "12m") && (
        <Card>
          <CardHeader><CardTitle>กระแสเงินสดรายเดือน</CardTitle></CardHeader>
          <CardContent><CashFlowChart data={cashFlowData} /></CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>สัดส่วนรายจ่ายตามหมวดหมู่</CardTitle></CardHeader>
          <CardContent>
            {expenseSlices.length ? <CategoryPieChart data={expenseSlices} /> : <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีรายจ่ายในช่วงนี้</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>แนวโน้มมูลค่าสุทธิ (6 เดือน)</CardTitle></CardHeader>
          <CardContent><TrendLineChart data={netWorthTrend} /></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>บัญชีของฉัน</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-2">
            {accountsWithBalances.filter(({ account }) => !account.archived).map(({ account, balance }) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{accountTypeLabel(account.type)}</p>
                </div>
                <p className={`text-sm font-semibold ${account.type === "credit_card" ? "text-danger" : ""}`}>
                  {formatTHB(balance)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ความคืบหน้าเป้าหมาย</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-2">
            {goalsWithProgress.filter((g) => !g.goal.archived).map(({ goal, progress }) => (
              <div key={goal.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{goal.title}</span>
                  <span className="text-muted-foreground">{Math.min(progress.progressRatio * 100, 100).toFixed(0)}%</span>
                </div>
                <Progress value={progress.progressRatio * 100} className="mt-2" />
              </div>
            ))}
            <Link href="/goals" className="block text-center text-xs text-accent hover:underline">ดูเป้าหมายทั้งหมด</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>รายการล่าสุด</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-2">
            {recentTransactions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>}
            {recentTransactions.map((t) => {
              const cat = finance.categoryById.get(t.categoryId ?? "");
              return (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{t.merchant || cat?.name || (t.type === "transfer" ? "โอนเงิน" : "รายการ")}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <p className={t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-muted-foreground"}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{formatTHB(t.amount)}
                  </p>
                </div>
              );
            })}
            <Link href="/transactions" className="block text-center text-xs text-accent hover:underline pt-1">ดูรายการทั้งหมด</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>แจ้งเตือนงบประมาณ</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-2">
            {warningBudgets.length === 0 && <p className="text-sm text-muted-foreground">งบประมาณทุกหมวดยังอยู่ในเกณฑ์ปกติ</p>}
            {warningBudgets.map((b) => {
              const cat = finance.categoryById.get(b.budget.categoryId);
              return (
                <div key={b.budget.id} className="flex items-center justify-between text-sm">
                  <span>{cat?.name}</span>
                  <Badge variant={b.status === "over" ? "danger" : "warning"}>{b.percentUsed.toFixed(0)}%</Badge>
                </div>
              );
            })}
            <Link href="/budgets" className="block text-center text-xs text-accent hover:underline pt-1">จัดการงบประมาณ</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function accountTypeLabel(type: string) {
  const map: Record<string, string> = {
    cash: "เงินสด",
    bank: "บัญชีธนาคาร",
    e_wallet: "กระเป๋าเงินอิเล็กทรอนิกส์",
    investment_cash: "เงินสดในพอร์ตลงทุน",
    credit_card: "บัตรเครดิต",
  };
  return map[type] ?? type;
}

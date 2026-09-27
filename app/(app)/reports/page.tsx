"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Download } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { formatTHB, monthLabelThai, periodBounds, currentPeriod, shiftPeriod } from "@/lib/utils";
import { computeNetWorth, computePeriodTotals } from "@/lib/finance/calculations";
import { downloadCsv } from "@/lib/csv";

const PALETTE = ["#467A64", "#6FA88A", "#C97B4A", "#5A7FB0", "#A0699E", "#C9A24A", "#4AA0A0", "#B0745A"];

export default function ReportsPage() {
  const finance = useFinanceData();
  const { data, categoryById } = finance;
  const [months, setMonths] = useState(12);
  const nowPeriod = currentPeriod();

  const monthlySeries = useMemo(() => {
    const points = [];
    for (let i = months - 1; i >= 0; i--) {
      const p = shiftPeriod(nowPeriod, -i);
      const b = periodBounds(p);
      const t = computePeriodTotals(data.transactions, b.start, b.end);
      points.push({ period: p, label: monthLabelThai(p).slice(0, 3), income: t.income, expenses: t.expenses, surplus: t.operatingSurplus });
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, data.transactions]);

  const netWorthSeries = useMemo(() => {
    const points = [];
    for (let i = months - 1; i >= 0; i--) {
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
  }, [months, data]);

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const yearEnd = `${new Date().getFullYear()}-12-31`;
  const expenseByCategory = finance.expenseByCategory(yearStart, yearEnd);
  const incomeByCategory = finance.incomeByCategory(yearStart, yearEnd);
  const expenseSlices = Object.entries(expenseByCategory).map(([id, value], i) => ({ name: categoryById.get(id)?.name ?? "อื่นๆ", value, color: PALETTE[i % PALETTE.length] }));
  const incomeSlices = Object.entries(incomeByCategory).map(([id, value], i) => ({ name: categoryById.get(id)?.name ?? "อื่นๆ", value, color: PALETTE[i % PALETTE.length] }));

  const currentBudgetStatuses = finance.budgetStatuses(nowPeriod);
  const totalOutstandingDebt = finance.loansWithSummary.reduce((s, l) => s + l.remainingPrincipal, 0);
  const portfolioTotals = finance.portfoliosWithMetrics.reduce(
    (acc, p) => ({ invested: acc.invested + p.metrics.investedCapital, market: acc.market + p.metrics.marketValue }),
    { invested: 0, market: 0 },
  );

  function handleExportSummary() {
    const header = ["period", "income", "expenses", "surplus"];
    const rows = monthlySeries.map((m) => [m.period, m.income, m.expenses, m.surplus]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    downloadCsv(`mono-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">รายงานการเงิน</h2>
        <div className="flex gap-2">
          <Select value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} className="w-40">
            <option value="6">6 เดือนล่าสุด</option>
            <option value="12">12 เดือนล่าสุด</option>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportSummary}><Download className="h-4 w-4" />ส่งออก CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardHeader><CardTitle>หนี้สินคงเหลือ</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg text-danger">{formatTHB(totalOutstandingDebt)}</CardValue></CardContent></Card>
        <Card><CardHeader><CardTitle>เงินลงทุนสะสม</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg">{formatTHB(portfolioTotals.invested)}</CardValue></CardContent></Card>
        <Card><CardHeader><CardTitle>มูลค่าพอร์ตปัจจุบัน</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg">{formatTHB(portfolioTotals.market)}</CardValue></CardContent></Card>
        <Card><CardHeader><CardTitle>งบประมาณเกินกำหนด</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg">{currentBudgetStatuses.filter((b) => b.status === "over").length}</CardValue></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>สรุปรายรับ-รายจ่ายรายเดือน</CardTitle></CardHeader>
        <CardContent><CashFlowChart data={monthlySeries} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>แนวโน้มทรัพย์สินสุทธิ</CardTitle></CardHeader>
        <CardContent><TrendLineChart data={netWorthSeries} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>รายจ่ายตามหมวดหมู่ (ปีนี้)</CardTitle></CardHeader>
          <CardContent>{expenseSlices.length ? <CategoryPieChart data={expenseSlices} /> : <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>แหล่งรายได้ (ปีนี้)</CardTitle></CardHeader>
          <CardContent>{incomeSlices.length ? <CategoryPieChart data={incomeSlices} /> : <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>งบประมาณเทียบกับยอดใช้จริง (เดือนนี้)</CardTitle></CardHeader>
        <CardContent className="pt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">หมวดหมู่</th>
                <th className="py-2 pr-2 text-right">งบประมาณ</th>
                <th className="py-2 pr-2 text-right">ใช้จริง</th>
                <th className="py-2 pr-2 text-right">ผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {currentBudgetStatuses.map((s) => (
                <tr key={s.budget.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">{categoryById.get(s.budget.categoryId)?.name}</td>
                  <td className="py-2 pr-2 text-right">{formatTHB(s.budget.limit)}</td>
                  <td className="py-2 pr-2 text-right">{formatTHB(s.spent)}</td>
                  <td className={`py-2 pr-2 text-right ${s.remaining >= 0 ? "text-success" : "text-danger"}`}>{formatTHB(s.remaining)}</td>
                </tr>
              ))}
              {currentBudgetStatuses.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">ยังไม่มีงบประมาณในเดือนนี้</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

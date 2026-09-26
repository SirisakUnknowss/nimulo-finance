"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Plus, Trash2 } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, monthLabelThai, currentPeriod, shiftPeriod } from "@/lib/utils";

export default function BudgetsPage() {
  const { data, budgetStatuses, upsertBudget, deleteBudget, categoryById } = useFinanceData();
  const [period, setPeriod] = useState(currentPeriod());
  const [addOpen, setAddOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const statuses = budgetStatuses(period);
  const usedCategoryIds = new Set(statuses.map((s) => s.budget.categoryId));
  const availableCategories = data.categories.filter((c) => c.kind === "expense" && !usedCategoryIds.has(c.id));

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const lim = Number(limit);
    if (!categoryId || !lim || lim <= 0) return;
    upsertBudget({ categoryId, period, limit: lim });
    setCategoryId("");
    setLimit("");
    setAddOpen(false);
  }

  const totalLimit = statuses.reduce((s, b) => s + b.budget.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>←</Button>
          <h2 className="text-lg font-semibold w-40 text-center">{monthLabelThai(period)}</h2>
          <Button size="sm" variant="outline" onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>→</Button>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />เพิ่มงบประมาณ</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>สรุปงบประมาณเดือนนี้</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>ใช้ไปแล้ว {formatTHB(totalSpent)} จาก {formatTHB(totalLimit)}</span>
            <span className="text-muted-foreground">{totalLimit > 0 ? ((totalSpent / totalLimit) * 100).toFixed(0) : 0}%</span>
          </div>
          <Progress value={totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0} />
        </CardContent>
      </Card>

      {statuses.length === 0 ? (
        <EmptyState title="ยังไม่มีงบประมาณในเดือนนี้" description="เพิ่มงบประมาณตามหมวดหมู่รายจ่ายเพื่อควบคุมค่าใช้จ่าย" action={<Button onClick={() => setAddOpen(true)}>เพิ่มงบประมาณ</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => {
            const cat = categoryById.get(s.budget.categoryId);
            return (
              <Card key={s.budget.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-foreground text-sm font-medium">{cat?.name}</CardTitle>
                  <button onClick={() => deleteBudget(s.budget.id)} className="text-muted-foreground hover:text-danger" aria-label="ลบงบประมาณ">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="pt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{formatTHB(s.spent)} / {formatTHB(s.budget.limit)}</span>
                    <Badge variant={s.status === "over" ? "danger" : s.status === "warning" ? "warning" : "success"}>
                      {s.percentUsed.toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress
                    value={s.percentUsed}
                    indicatorClassName={s.status === "over" ? "bg-danger" : s.status === "warning" ? "bg-warning" : undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    {s.remaining >= 0 ? `เหลือ ${formatTHB(s.remaining)}` : `เกินงบ ${formatTHB(-s.remaining)}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มงบประมาณ ({monthLabelThai(period)})</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>หมวดหมู่</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">เลือกหมวดหมู่</option>
                {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>วงเงินงบประมาณ (บาท)</Label>
              <Input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

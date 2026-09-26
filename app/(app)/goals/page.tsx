"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Plus, Minus, Archive } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, formatDateThai } from "@/lib/utils";
import type { GoalType } from "@/lib/finance/types";

const TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "กองทุนฉุกเฉิน",
  travel: "ท่องเที่ยว",
  vehicle: "ยานพาหนะ",
  home: "บ้าน",
  custom: "กำหนดเอง",
};

export default function GoalsPage() {
  const { goalsWithProgress, addGoal, archiveGoal, addGoalContribution, data } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<string | null>(null);
  const [contribMode, setContribMode] = useState<"add" | "withdraw">("add");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<GoalType>("custom");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [contribAmount, setContribAmount] = useState("");
  const [contribAccount, setContribAccount] = useState(data.accounts[0]?.id ?? "");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !targetAmount) return;
    addGoal({ title, type, targetAmount: Number(targetAmount), targetDate: targetDate || null, notes: notes || null });
    setTitle(""); setTargetAmount(""); setTargetDate(""); setNotes("");
    setAddOpen(false);
  }

  function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!contribGoal) return;
    const amt = Number(contribAmount);
    if (!amt || amt <= 0) return;
    addGoalContribution({
      goalId: contribGoal,
      amount: contribMode === "add" ? amt : -amt,
      date: new Date().toISOString().slice(0, 10),
      accountId: contribAccount,
      note: null,
    });
    setContribAmount("");
    setContribGoal(null);
  }

  const active = goalsWithProgress.filter((g) => !g.goal.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">เป้าหมายทางการเงิน</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />เพิ่มเป้าหมาย</Button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="ยังไม่มีเป้าหมาย" description="ตั้งเป้าหมายทางการเงิน เช่น กองทุนฉุกเฉิน หรือทริปท่องเที่ยว" action={<Button onClick={() => setAddOpen(true)}>เพิ่มเป้าหมาย</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(({ goal, progress }) => (
            <Card key={goal.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-foreground text-base font-semibold">{goal.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[goal.type]}{goal.targetDate ? ` · เป้าหมาย ${formatDateThai(goal.targetDate)}` : ""}</p>
                </div>
                <button onClick={() => confirm("เก็บเป้าหมายนี้เข้าคลังหรือไม่?") && archiveGoal(goal.id)} className="text-muted-foreground hover:text-danger" aria-label="เก็บเป้าหมาย">
                  <Archive className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent className="pt-2 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{formatTHB(progress.allocated)}</span>
                    <span className="text-muted-foreground">/ {formatTHB(goal.targetAmount)}</span>
                  </div>
                  <Progress value={progress.progressRatio * 100} />
                </div>
                <p className="text-xs text-muted-foreground">เหลืออีก {formatTHB(progress.remaining)}</p>
                {progress.projectedCompletionDate ? (
                  <p className="text-xs text-accent">คาดว่าจะถึงเป้าหมายประมาณ {formatDateThai(progress.projectedCompletionDate)} (ประมาณการ)</p>
                ) : (
                  <p className="text-xs text-muted-foreground">ยังมีข้อมูลไม่พอสำหรับประมาณการวันที่สำเร็จ</p>
                )}
                {goal.notes && <p className="text-xs text-muted-foreground">{goal.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setContribGoal(goal.id); setContribMode("add"); }}><Plus className="h-3.5 w-3.5" />สมทบเงิน</Button>
                  <Button size="sm" variant="outline" onClick={() => { setContribGoal(goal.id); setContribMode("withdraw"); }}><Minus className="h-3.5 w-3.5" />ถอนเงิน</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มเป้าหมายใหม่</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>ชื่อเป้าหมาย</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภท</Label>
                <Select value={type} onChange={(e) => setType(e.target.value as GoalType)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>เป้าหมาย (บาท)</Label>
                <Input type="number" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>วันที่เป้าหมาย (ไม่บังคับ)</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <Label>โน้ต</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contribGoal} onOpenChange={(o) => !o && setContribGoal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{contribMode === "add" ? "สมทบเงินเข้าเป้าหมาย" : "ถอนเงินจากเป้าหมาย"}</DialogTitle></DialogHeader>
          <form onSubmit={handleContribute} className="space-y-3">
            <p className="text-xs text-muted-foreground">การสมทบ/ถอนเงินเป็นการจัดสรรเงินที่มีอยู่แล้วในบัญชี ไม่ถือเป็นรายรับหรือรายจ่ายใหม่</p>
            <div>
              <Label>จำนวนเงิน</Label>
              <Input type="number" min="0" step="0.01" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} required />
            </div>
            <div>
              <Label>บัญชีที่เกี่ยวข้อง</Label>
              <Select value={contribAccount} onChange={(e) => setContribAccount(e.target.value)}>
                {data.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContribGoal(null)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

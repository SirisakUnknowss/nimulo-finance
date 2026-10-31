"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { BillClassificationFields, EMPTY_CLASSIFICATION } from "@/components/bills/bill-classification-fields";
import { oneTimeBillSchema } from "@/lib/validation/schemas";
import { useFinanceData } from "@/lib/hooks/use-finance-data";

export function OneTimeBillDialog({ defaultDueDate, onClose }: { defaultDueDate: string; onClose: () => void }) {
  const { createOneTimeBill } = useFinanceData();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [classification, setClassification] = useState(EMPTY_CLASSIFICATION);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = oneTimeBillSchema.safeParse({ ...classification, name, amount: amount === "" ? Number.NaN : Number(amount), dueDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const value = parsed.data;
    createOneTimeBill({
      nameSnapshot: value.name,
      cashflowKindSnapshot: value.cashflowKind,
      amountDue: value.amount,
      dueDate: value.dueDate,
      plannedAccountId: value.sourceAccountId || null,
      categoryId: value.categoryId || null,
      targetAccountId: value.targetAccountId || null,
      loanAccountId: value.loanAccountId || null,
      note: null,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มบิลครั้งเดียว</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="once-name">ชื่อรายการ</Label>
            <Input id="once-name" placeholder="เช่น ค่าซ่อมรถ, ค่าประกัน" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="once-amount">จำนวนเงิน (บาท)</Label>
              <Input id="once-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="once-due">ครบกำหนด</Label>
              <Input id="once-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
          <BillClassificationFields value={classification} onChange={(patch) => setClassification((c) => ({ ...c, ...patch }))} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit">บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

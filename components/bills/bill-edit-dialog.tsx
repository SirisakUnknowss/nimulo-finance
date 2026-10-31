"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { DerivedBill } from "@/lib/finance/bill-calculations";
import { BillError } from "@/lib/finance/bills";
import { useFinanceData } from "@/lib/hooks/use-finance-data";

/** Edits one month's bill. The rule and other months stay as they are. */
export function BillEditDialog({ item, onClose }: { item: DerivedBill; onClose: () => void }) {
  const { data, updateMonthlyBill, skipBill, cancelBill, reopenBill } = useFinanceData();
  const { bill, paid } = item;
  const [amount, setAmount] = useState(String(bill.amountDue));
  const [dueDate, setDueDate] = useState(bill.dueDate);
  const [plannedAccountId, setPlannedAccountId] = useState(bill.plannedAccountId ?? "");
  const [note, setNote] = useState(bill.note ?? "");
  const [skipReason, setSkipReason] = useState("");
  const [error, setError] = useState("");

  const closed = bill.lifecycleState !== "active";
  const accounts = data.accounts.filter(
    (a) => !a.archived && (bill.cashflowKindSnapshot === "expense" || a.type !== "credit_card"),
  );

  function run(action: () => void) {
    setError("");
    try {
      action();
      onClose();
    } catch (err) {
      setError(err instanceof BillError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    run(() =>
      updateMonthlyBill(bill.id, {
        amountDue: Number(amount),
        dueDate,
        plannedAccountId: plannedAccountId || null,
        note: note.trim() || null,
      }),
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bill.nameSnapshot}</DialogTitle>
          <p className="text-sm text-muted-foreground">แก้เฉพาะเดือนนี้ รายการประจำและเดือนอื่นจะไม่เปลี่ยน</p>
        </DialogHeader>
        {closed ? (
          <div className="space-y-3">
            <p className="text-sm">
              {bill.lifecycleState === "skipped" ? `ข้ามงวดนี้แล้ว: ${bill.skipReason ?? ""}` : "ยกเลิกบิลนี้แล้ว"}
            </p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>ปิด</Button>
              <Button onClick={() => run(() => reopenBill(bill.id))}>เปิดบิลนี้อีกครั้ง</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-amount">ยอดเดือนนี้</Label>
                <Input id="edit-amount" type="number" min={paid} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="edit-due">ครบกำหนด</Label>
                <Input id="edit-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-account">บัญชีที่ตั้งใจจ่าย</Label>
              <Select id="edit-account" value={plannedAccountId} onChange={(e) => setPlannedAccountId(e.target.value)}>
                <option value="">ยังไม่ระบุ</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-note">หมายเหตุ</Label>
              <Input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {paid === 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label htmlFor="edit-skip">ไม่ต้องจ่ายงวดนี้?</Label>
                <Input id="edit-skip" placeholder="เหตุผลที่ข้าม" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => run(() => skipBill(bill.id, skipReason))}>ข้ามงวดนี้</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => run(() => cancelBill(bill.id))}>ยกเลิกบิล</Button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

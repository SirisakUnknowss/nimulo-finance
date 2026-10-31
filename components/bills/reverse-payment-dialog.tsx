"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { BillError } from "@/lib/finance/bills";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB } from "@/lib/utils";
import type { BillPayment } from "@/lib/finance/types";

export function ReversePaymentDialog({ payment, onClose }: { payment: BillPayment; onClose: () => void }) {
  const { reverseBillPayment } = useFinanceData();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      reverseBillPayment(payment.id, reason);
      onClose();
    } catch (err) {
      setError(err instanceof BillError ? err.message : "ย้อนรายการไม่สำเร็จ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ย้อนรายการชำระ {formatTHB(payment.amount)}</DialogTitle>
          <p className="text-sm text-muted-foreground">ยอดบัญชี หนี้ และยอดค้างของบิลจะกลับเป็นเหมือนก่อนจ่าย โดยรายการเดิมยังเก็บไว้เป็นประวัติ</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="reverse-reason">เหตุผล</Label>
            <Input id="reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="danger">ย้อนรายการ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

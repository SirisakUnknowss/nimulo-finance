"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { fromSatang, toSatang, type DerivedBill } from "@/lib/finance/bill-calculations";
import { BillError, TRANSFER_KINDS } from "@/lib/finance/bills";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, uid } from "@/lib/utils";

/** The current moment in the format a datetime-local input expects. */
function localDateTime(now: Date) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Mount with a `key` per open. The idempotency key is made once per mount, so
 * a repeated submit from this dialog can only ever post one payment.
 */
export function BillPaymentDialog({ item, onClose }: { item: DerivedBill; onClose: () => void }) {
  const { accountsWithBalances, recordBillPayment } = useFinanceData();
  const { bill, remaining } = item;
  const kind = bill.cashflowKindSnapshot;
  const isLoan = kind === "loan_payment";
  const isTransfer = TRANSFER_KINDS.includes(kind);

  const accounts = accountsWithBalances.filter(({ account }) => !account.archived);
  const sources = kind === "expense" ? accounts : accounts.filter(({ account }) => account.type !== "credit_card");

  const [idempotencyKey] = useState(() => uid("req"));
  const [amount, setAmount] = useState(String(remaining));
  const [interest, setInterest] = useState("");
  const [paidAt, setPaidAt] = useState(() => localDateTime(new Date()));
  const [sourceAccountId, setSourceAccountId] = useState(
    sources.some(({ account }) => account.id === bill.plannedAccountId) ? bill.plannedAccountId! : sources[0]?.account.id ?? "",
  );
  const [targetAccountId, setTargetAccountId] = useState(bill.targetAccountId ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const targets = accounts.filter(({ account }) =>
    account.id !== sourceAccountId && (kind === "credit_card_payment" ? account.type === "credit_card" : account.type !== "credit_card"),
  );

  const paying = Number(amount) || 0;
  const interestPaid = Number(interest) || 0;
  const principal = fromSatang(toSatang(paying) - toSatang(interestPaid));
  const source = accounts.find(({ account }) => account.id === sourceAccountId);
  const isCard = source?.account.type === "credit_card";
  const sourceAfter = source ? fromSatang(toSatang(source.balance) + toSatang(isCard ? paying : -paying)) : 0;
  const billAfter = fromSatang(Math.max(toSatang(remaining) - toSatang(paying), 0));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      recordBillPayment({
        billId: bill.id,
        amount: paying,
        paidAt: new Date(paidAt).toISOString(),
        sourceAccountId,
        targetAccountId: isTransfer ? targetAccountId || null : null,
        principalAmount: isLoan ? principal : undefined,
        interestAmount: isLoan ? interestPaid : undefined,
        reference: reference.trim() || null,
        note: note.trim() || null,
        idempotencyKey,
      });
      onClose();
    } catch (err) {
      setError(err instanceof BillError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>บันทึกการชำระ</DialogTitle>
          <p className="text-sm text-muted-foreground">{bill.nameSnapshot} · ยอดค้าง {formatTHB(remaining)}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pay-amount">จำนวนที่ชำระ</Label>
              <Input id="pay-amount" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="pay-at">วันที่และเวลาที่จ่าย</Label>
              <Input id="pay-at" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label htmlFor="pay-source">จ่ายจากบัญชี</Label>
            <Select id="pay-source" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} required>
              {sources.length === 0 && <option value="">ยังไม่มีบัญชี เพิ่มได้ที่หน้าบัญชี</option>}
              {sources.map(({ account, balance }) => <option key={account.id} value={account.id}>{account.name} ({formatTHB(balance)})</option>)}
            </Select>
          </div>
          {isTransfer && (
            <div>
              <Label htmlFor="pay-target">{kind === "credit_card_payment" ? "ชำระให้บัตร" : "โอนเข้าบัญชี"}</Label>
              <Select id="pay-target" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} required>
                <option value="">เลือกบัญชี</option>
                {targets.map(({ account }) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </Select>
            </div>
          )}
          {isLoan && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-interest">ดอกเบี้ย</Label>
                <Input id="pay-interest" type="number" min="0" max={paying} step="0.01" value={interest} onChange={(e) => setInterest(e.target.value)} />
              </div>
              <div>
                <Label>เงินต้น</Label>
                <p className="flex h-10 items-center text-sm font-medium">{formatTHB(principal)}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pay-reference">เลขอ้างอิง (ไม่บังคับ)</Label>
              <Input id="pay-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-note">โน้ต (ไม่บังคับ)</Label>
              <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {source && (
            <div className="space-y-1 rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{isCard ? "หนี้บัตร" : "ยอดบัญชี"}</span>
                <span>{formatTHB(source.balance)} → <span className="font-medium">{formatTHB(sourceAfter)}</span></span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ยอดค้างของบิล</span>
                <span>{formatTHB(remaining)} → <span className="font-medium">{formatTHB(billAfter)}</span></span>
              </div>
            </div>
          )}
          {!isCard && sourceAfter < 0 && <p className="text-sm text-warning">หลังจ่ายแล้วยอดบัญชีนี้จะติดลบ ตรวจสอบบัญชีที่เลือกก่อนบันทึก</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit">ยืนยันการชำระ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

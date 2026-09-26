"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { transactionSchema } from "@/lib/validation/schemas";
import type { TransactionType } from "@/lib/finance/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function QuickAddTransactionDialog({ open, onOpenChange }: Props) {
  const { data, addTransaction, addTransfer } = useFinanceData();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(data.accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categories = data.categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));
  const activeAccounts = data.accounts.filter((a) => !a.archived);

  function reset() {
    setAmount("");
    setMerchant("");
    setNote("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = transactionSchema.safeParse({
      type,
      amount: Number(amount),
      date,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      categoryId: type === "transfer" ? null : categoryId,
      merchant: merchant || null,
      note: note || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    const v = parsed.data;
    if (v.type === "transfer") {
      addTransfer({ amount: v.amount, date: v.date, fromAccountId: v.accountId, toAccountId: v.toAccountId!, note: v.note ?? undefined });
    } else {
      addTransaction({
        type: v.type,
        amount: v.amount,
        date: v.date,
        accountId: v.accountId,
        categoryId: v.categoryId ?? null,
        merchant: v.merchant ?? null,
        note: v.note ?? null,
      });
    }
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มรายการใหม่</DialogTitle>
        </DialogHeader>
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="expense" className="flex-1">รายจ่าย</TabsTrigger>
            <TabsTrigger value="income" className="flex-1">รายรับ</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1">โอนเงิน</TabsTrigger>
          </TabsList>
        </Tabs>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>จำนวนเงิน (บาท)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div>
              <Label>วันที่</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>{type === "transfer" ? "บัญชีต้นทาง" : "บัญชี"}</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>

          {type === "transfer" ? (
            <div>
              <Label>บัญชีปลายทาง</Label>
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label>หมวดหมู่</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}

          {type !== "transfer" && (
            <div>
              <Label>ร้านค้า/ผู้รับเงิน (ไม่บังคับ)</Label>
              <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="เช่น ร้านอาหาร, บริษัท ABC" />
            </div>
          )}

          <div>
            <Label>โน้ต (ไม่บังคับ)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit">บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

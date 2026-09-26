"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Plus, ArrowLeftRight, Archive } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB } from "@/lib/utils";
import type { AccountType } from "@/lib/finance/types";

const TYPE_LABELS: Record<AccountType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  e_wallet: "กระเป๋าเงินอิเล็กทรอนิกส์",
  investment_cash: "เงินสดในพอร์ตลงทุน",
  credit_card: "บัตรเครดิต",
};

export default function AccountsPage() {
  const { accountsWithBalances, addAccount, archiveAccount, addTransfer, data } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));

  const [transferAmount, setTransferAmount] = useState("");
  const [fromAccount, setFromAccount] = useState(data.accounts[0]?.id ?? "");
  const [toAccount, setToAccount] = useState(data.accounts[1]?.id ?? "");

  function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addAccount({ name, type, currency: "THB", openingBalance: Number(openingBalance) || 0, openingDate });
    setName("");
    setOpeningBalance("0");
    setAddOpen(false);
  }

  function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(transferAmount);
    if (!amt || amt <= 0 || fromAccount === toAccount) return;
    addTransfer({ amount: amt, date: new Date().toISOString().slice(0, 10), fromAccountId: fromAccount, toAccountId: toAccount, note: "โอนเงินระหว่างบัญชี" });
    setTransferAmount("");
    setTransferOpen(false);
  }

  const active = accountsWithBalances.filter((a) => !a.account.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">บัญชีของฉัน</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="h-4 w-4" />โอนเงิน</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />เพิ่มบัญชี</Button>
        </div>
      </div>

      {active.length === 0 ? (
        <EmptyState title="ยังไม่มีบัญชี" description="เพิ่มบัญชีแรกของคุณเพื่อเริ่มบันทึกธุรกรรม" action={<Button onClick={() => setAddOpen(true)}>เพิ่มบัญชี</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(({ account, balance }) => (
            <Card key={account.id} className="cursor-pointer" onClick={() => setSelectedAccount(account.id === selectedAccount ? null : account.id)}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{account.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{TYPE_LABELS[account.type]}</Badge>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("เก็บบัญชีนี้เข้าคลังหรือไม่?")) archiveAccount(account.id); }}
                  className="rounded p-1 text-muted-foreground hover:bg-accent-soft"
                  aria-label="เก็บบัญชี"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent>
                <CardValue className={account.type === "credit_card" ? "text-danger" : ""}>{formatTHB(balance)}</CardValue>
                {account.type === "credit_card" && account.creditLimit && (
                  <p className="mt-1 text-xs text-muted-foreground">วงเงิน {formatTHB(account.creditLimit)}</p>
                )}
                {selectedAccount === account.id && (
                  <div className="mt-3 max-h-56 space-y-1 overflow-y-auto border-t border-border pt-3 scroll-thin">
                    {data.transactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id).slice(0, 20).map((t) => (
                      <div key={t.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t.date} {t.merchant || t.note || t.type}</span>
                        <span>{formatTHB(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มบัญชีใหม่</DialogTitle></DialogHeader>
          <form onSubmit={handleAddAccount} className="space-y-3">
            <div>
              <Label>ชื่อบัญชี</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>ประเภทบัญชี</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ยอดยกมา</Label>
                <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
              </div>
              <div>
                <Label>วันที่เปิดบัญชี</Label>
                <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>โอนเงินระหว่างบัญชี</DialogTitle></DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div>
              <Label>จำนวนเงิน</Label>
              <Input type="number" min="0" step="0.01" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} required />
            </div>
            <div>
              <Label>จากบัญชี</Label>
              <Select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
                {data.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>ไปยังบัญชี</Label>
              <Select value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
                {data.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>ยกเลิก</Button>
              <Button type="submit">โอนเงิน</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

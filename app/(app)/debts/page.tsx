"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Plus } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, formatDateThai } from "@/lib/utils";

export default function DebtsPage() {
  const { loansWithSummary, addLoanPayment, addTransaction, data } = useFinanceData();
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");

  const interestCategory = data.categories.find((c) => c.id === "cat_interest") ?? data.categories.find((c) => c.kind === "expense");
  const totalOutstanding = loansWithSummary.reduce((s, l) => s + l.remainingPrincipal, 0);

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payOpen) return;
    const p = Number(principal) || 0;
    const i = Number(interest) || 0;
    if (p <= 0 && i <= 0) return;
    const date = new Date().toISOString().slice(0, 10);
    addLoanPayment({ loanAccountId: payOpen, date, principalAmount: p, interestAmount: i });
    if (i > 0 && interestCategory) {
      addTransaction({
        type: "expense",
        amount: i,
        date,
        accountId: data.accounts[0]?.id ?? "",
        categoryId: interestCategory.id,
        merchant: "ดอกเบี้ยเงินกู้",
        note: null,
      });
    }
    setPrincipal(""); setInterest("");
    setPayOpen(null);
  }

  if (loansWithSummary.length === 0) {
    return <EmptyState title="ยังไม่มีหนี้สินที่บันทึกไว้" description="เพิ่มสินเชื่อหรือบัตรเครดิตเพื่อติดตามยอดหนี้คงเหลือ" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>ยอดหนี้คงเหลือรวม</CardTitle></CardHeader>
        <CardContent><CardValue className="text-3xl text-danger">{formatTHB(totalOutstanding)}</CardValue></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loansWithSummary.map(({ loan, remainingPrincipal, interestPaidTotal, payments }) => {
          const progressPaid = loan.openingPrincipal > 0 ? ((loan.openingPrincipal - remainingPrincipal) / loan.openingPrincipal) * 100 : 0;
          return (
            <Card key={loan.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-foreground text-base font-semibold">{loan.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{loan.kind === "credit_card" ? "บัตรเครดิต" : "สินเชื่อผ่อนชำระ"}</Badge>
                </div>
                {loan.kind === "installment_loan" && (
                  <Button size="sm" variant="outline" onClick={() => setPayOpen(loan.id)}><Plus className="h-4 w-4" />บันทึกการชำระ</Button>
                )}
              </CardHeader>
              <CardContent className="pt-2 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">คงเหลือ {formatTHB(remainingPrincipal)}</span>
                    <span className="text-muted-foreground">จาก {formatTHB(loan.openingPrincipal)}</span>
                  </div>
                  {loan.kind === "installment_loan" && <Progress value={progressPaid} />}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>อัตราดอกเบี้ย {loan.interestRate}% ต่อปี</p>
                  {loan.minimumPayment && <p>ยอดขั้นต่ำ {formatTHB(loan.minimumPayment)}</p>}
                  {loan.dueDayOfMonth && <p>ครบกำหนดทุกวันที่ {loan.dueDayOfMonth}</p>}
                  <p>ดอกเบี้ยจ่ายสะสม {formatTHB(interestPaidTotal)}</p>
                </div>
                {payments.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border-t border-border pt-2 scroll-thin">
                    {payments.slice(-5).reverse().map((p) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{formatDateThai(p.date)}</span>
                        <span>เงินต้น {formatTHB(p.principalAmount)} · ดอกเบี้ย {formatTHB(p.interestAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>บันทึกการชำระสินเชื่อ</DialogTitle></DialogHeader>
          <form onSubmit={handlePay} className="space-y-3">
            <p className="text-xs text-muted-foreground">เงินต้นจะลดยอดหนี้และเงินสด ส่วนดอกเบี้ยจะถูกบันทึกเป็นเงินที่ใช้ไปแยกต่างหาก</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เงินต้น</Label><Input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
              <div><Label>ดอกเบี้ย</Label><Input type="number" min="0" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(null)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

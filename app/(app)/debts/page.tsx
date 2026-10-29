"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Plus } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, formatDateThai } from "@/lib/utils";

export default function DebtsPage() {
  const { loansWithSummary, addLoan, addLoanPayment, addTransaction, accountsWithBalances, data } = useFinanceData();
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [payAccountId, setPayAccountId] = useState("");

  const [loanOpen, setLoanOpen] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [openingPrincipal, setOpeningPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const interestCategory = data.categories.find((c) => c.id === "cat_interest") ?? data.categories.find((c) => c.kind === "expense");
  const totalOutstanding = loansWithSummary.reduce((s, l) => s + l.remainingPrincipal, 0);
  // Credit cards are tracked as accounts, so loan payments come from cash-like accounts only.
  const payFromAccounts = accountsWithBalances.filter((a) => !a.account.archived && a.account.type !== "credit_card");

  function openPay(loanId: string) {
    setPayAccountId(payFromAccounts[0]?.account.id ?? "");
    setPayOpen(loanId);
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payOpen || !payAccountId) return;
    const p = Number(principal) || 0;
    const i = Number(interest) || 0;
    if (p <= 0 && i <= 0) return;
    const date = new Date().toISOString().slice(0, 10);
    addLoanPayment({ loanAccountId: payOpen, date, principalAmount: p, interestAmount: i });
    // Rule 9: principal leaves the account but is not an expense; interest is.
    if (p > 0) {
      addTransaction({
        type: "expense",
        amount: p,
        date,
        accountId: payAccountId,
        categoryId: null,
        merchant: "ชำระเงินต้นสินเชื่อ",
        note: null,
        isLoanPrincipalRepayment: true,
        loanAccountId: payOpen,
      });
    }
    if (i > 0 && interestCategory) {
      addTransaction({
        type: "expense",
        amount: i,
        date,
        accountId: payAccountId,
        categoryId: interestCategory.id,
        merchant: "ดอกเบี้ยเงินกู้",
        note: null,
        loanAccountId: payOpen,
      });
    }
    setPrincipal(""); setInterest("");
    setPayOpen(null);
  }

  function handleAddLoan(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(openingPrincipal);
    if (!loanName.trim() || !(amount > 0)) return;
    addLoan({
      name: loanName.trim(),
      kind: "installment_loan",
      openingPrincipal: amount,
      interestRate: Number(interestRate) || 0,
      minimumPayment: Number(minimumPayment) > 0 ? Number(minimumPayment) : null,
      dueDayOfMonth: Number(dueDay) >= 1 && Number(dueDay) <= 31 ? Number(dueDay) : null,
      startDate,
      accountId: null,
    });
    setLoanName(""); setOpeningPrincipal(""); setInterestRate(""); setMinimumPayment(""); setDueDay("");
    setLoanOpen(false);
  }

  const loanDialog = (
    <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มสินเชื่อผ่อนชำระ</DialogTitle></DialogHeader>
        <form onSubmit={handleAddLoan} className="space-y-3">
          <div>
            <Label>ชื่อสินเชื่อ</Label>
            <Input placeholder="เช่น ผ่อนรถ, สินเชื่อบ้าน, กยศ." value={loanName} onChange={(e) => setLoanName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ยอดหนี้คงเหลือตอนเริ่มบันทึก</Label><Input type="number" min="0" step="any" value={openingPrincipal} onChange={(e) => setOpeningPrincipal(e.target.value)} required /></div>
            <div><Label>ดอกเบี้ย (% ต่อปี)</Label><Input type="number" min="0" step="any" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ยอดผ่อนต่อเดือน (ไม่บังคับ)</Label><Input type="number" min="0" step="any" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} /></div>
            <div><Label>ครบกำหนดทุกวันที่ (ไม่บังคับ)</Label><Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></div>
          </div>
          <div>
            <Label>วันที่เริ่มบันทึก</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <p className="text-xs text-muted-foreground">บัตรเครดิตให้เพิ่มเป็นบัญชีประเภท &quot;บัตรเครดิต&quot; ที่หน้าบัญชี ยอดหนี้จะคำนวณจากการใช้จ่ายและการชำระบิล</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoanOpen(false)}>ยกเลิก</Button>
            <Button type="submit">บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (loansWithSummary.length === 0) {
    return (
      <>
        <EmptyState
          title="ยังไม่มีหนี้สินที่บันทึกไว้"
          description="เพิ่มสินเชื่อผ่อนชำระเพื่อติดตามยอดหนี้คงเหลือ"
          action={<Button size="sm" className="mt-2" onClick={() => setLoanOpen(true)}><Plus className="h-4 w-4" />เพิ่มสินเชื่อ</Button>}
        />
        {loanDialog}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <CardTitle>ยอดหนี้คงเหลือรวม</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLoanOpen(true)}><Plus className="h-4 w-4" />เพิ่มสินเชื่อ</Button>
        </CardHeader>
        <CardContent><CardValue className="text-3xl text-danger">{formatTHB(totalOutstanding)}</CardValue></CardContent>
      </Card>
      {loanDialog}

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
                  <Button size="sm" variant="outline" onClick={() => openPay(loan.id)}><Plus className="h-4 w-4" />บันทึกการชำระ</Button>
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
            <p className="text-xs text-muted-foreground">เงินต้นจะลดยอดหนี้และเงินในบัญชีที่เลือก ส่วนดอกเบี้ยจะถูกบันทึกเป็นเงินที่ใช้ไปแยกต่างหาก</p>
            <div>
              <Label>ชำระจากบัญชี</Label>
              <Select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} required>
                {payFromAccounts.length === 0 && <option value="">ยังไม่มีบัญชี เพิ่มได้ที่หน้าบัญชี</option>}
                {payFromAccounts.map(({ account }) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เงินต้น</Label><Input type="number" min="0" step="any" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
              <div><Label>ดอกเบี้ย</Label><Input type="number" min="0" step="any" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
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

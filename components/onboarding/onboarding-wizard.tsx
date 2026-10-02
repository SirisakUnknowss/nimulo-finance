"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { accountSchema, transactionSchema } from "@/lib/validation/schemas";
import { formatTHB } from "@/lib/utils";
import type { AccountType } from "@/lib/finance/types";
import { Check, Wallet, TrendingUp, TrendingDown, PartyPopper } from "lucide-react";

/**
 * Step-by-step first-run flow per the brand guide, section 15 (Onboarding
 * Experience). Demo mode has no real sign-up step (15.3 Step 1), so this
 * starts at "add your first financial account" and treats budgets, goals,
 * debts, investments, and recurring transactions as optional setup (15.4)
 * offered only after the user can already see their dashboard.
 */

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  e_wallet: "กระเป๋าเงินอิเล็กทรอนิกส์",
  investment_cash: "เงินสดในพอร์ตลงทุน",
  credit_card: "บัตรเครดิต",
};

const today = () => new Date().toISOString().slice(0, 10);

type Step = "welcome" | "account" | "income" | "expense" | "done";

const STEP_ORDER: Step[] = ["welcome", "account", "income", "expense", "done"];
const STEP_LABELS: Record<Step, string> = {
  welcome: "เริ่มต้น",
  account: "บัญชีแรกของคุณ",
  income: "เงินที่ได้รับ",
  expense: "เงินที่ใช้ไป",
  done: "ภาพรวมของคุณ",
};

export function OnboardingWizard({ onFinish }: { onFinish: () => void }) {
  const { data, addAccount, addTransaction, updateProfile } = useFinanceData();
  const [name, setName] = useState(data.profile.displayName);
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState<string | null>(null);

  // Step: first account
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(today());
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  // Step: income
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(today());
  const [incomeCategoryId, setIncomeCategoryId] = useState("");
  const [incomeMerchant, setIncomeMerchant] = useState("");
  const [incomeAdded, setIncomeAdded] = useState(false);

  // Step: expense
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseMerchant, setExpenseMerchant] = useState("");
  const [expenseAdded, setExpenseAdded] = useState(false);

  const incomeCategories = data.categories.filter((c) => c.kind === "income" && !c.archived);
  const expenseCategories = data.categories.filter((c) => c.kind === "expense" && !c.archived);

  const stepIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length - 1; // exclude "welcome" from the counter

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    const parsed = accountSchema.safeParse({
      name: accountName,
      type: accountType,
      currency: "THB",
      openingBalance: Number(openingBalance) || 0,
      openingDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    const account = addAccount(parsed.data);
    setCreatedAccountId(account.id);
    goTo("income");
  }

  function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!createdAccountId) return;
    const parsed = transactionSchema.safeParse({
      type: "income",
      amount: Number(incomeAmount),
      date: incomeDate,
      accountId: createdAccountId,
      categoryId: incomeCategoryId || null,
      merchant: incomeMerchant || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    addTransaction({
      type: "income",
      amount: parsed.data.amount,
      date: parsed.data.date,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      merchant: parsed.data.merchant ?? null,
      note: null,
    });
    setIncomeAdded(true);
    goTo("expense");
  }

  function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!createdAccountId) return;
    const parsed = transactionSchema.safeParse({
      type: "expense",
      amount: Number(expenseAmount),
      date: expenseDate,
      accountId: createdAccountId,
      categoryId: expenseCategoryId || null,
      merchant: expenseMerchant || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    addTransaction({
      type: "expense",
      amount: parsed.data.amount,
      date: parsed.data.date,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      merchant: parsed.data.merchant ?? null,
      note: null,
    });
    setExpenseAdded(true);
    goTo("done");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      {step !== "welcome" && (
        <div className="flex items-center gap-2">
          {STEP_ORDER.slice(1).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex - 1 ? "bg-accent" : "bg-accent-soft"}`}
              aria-hidden
            />
          ))}
        </div>
      )}
      {step !== "welcome" && (
        <p className="text-xs text-muted-foreground">
          ขั้นตอน {stepIndex} จาก {totalSteps} · {STEP_LABELS[step]}
        </p>
      )}

      {step === "welcome" && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">เริ่มต้นเข้าใจเงินของคุณไปด้วยกัน</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                เพิ่มข้อมูลเพียงเล็กน้อย แล้วเราจะช่วยแสดงภาพรวมการเงินของคุณ ไม่จำเป็นต้องมีความรู้ทางการเงินมาก่อน
              </p>
            </div>
            <div className="text-left">
              <Label>ชื่อของคุณ</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่ต้องการให้เรียก" autoFocus />
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                if (name.trim()) updateProfile({ displayName: name.trim() });
                goTo("account");
              }}
            >
              เริ่มต้น
            </Button>
            <button type="button" onClick={onFinish} className="text-xs text-muted-foreground underline underline-offset-2">
              ข้ามและดูภาพรวมแบบว่างเปล่า
            </button>
          </CardContent>
        </Card>
      )}

      {step === "account" && (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มบัญชีเงินสดหรือบัญชีธนาคารแรกของคุณ</CardTitle>
            <p className="text-sm text-muted-foreground">บอกเราว่าตอนนี้คุณมีเงินอยู่ที่ไหนบ้าง เริ่มจากบัญชีเดียวก่อนก็ได้</p>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <Label>ชื่อบัญชี</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="เช่น บัญชีออมทรัพย์, เงินสด"
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label>ประเภทบัญชี</Label>
                <Select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                    <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ยอดเงินเริ่มต้น (บาท)</Label>
                  <Input type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>วันที่เริ่มต้น</Label>
                  <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} required />
                </div>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" className="w-full">ถัดไป</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "income" && (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มเงินที่ได้รับ</CardTitle>
            <p className="text-sm text-muted-foreground">เงินเดือนล่าสุด หรือรายรับอื่นๆ ที่เข้าบัญชีนี้</p>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleAddIncome} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input type="number" min="0" step="0.01" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="0.00" required autoFocus />
                </div>
                <div>
                  <Label>วันที่</Label>
                  <Input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={incomeCategoryId} onChange={(e) => setIncomeCategoryId(e.target.value)}>
                  <option value="">เลือกหมวดหมู่</option>
                  {incomeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>แหล่งที่มา (ไม่บังคับ)</Label>
                <Input value={incomeMerchant} onChange={(e) => setIncomeMerchant(e.target.value)} placeholder="เช่น เงินเดือนจากบริษัท" />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => goTo("expense")}>
                  ข้ามขั้นตอนนี้
                </Button>
                <Button type="submit" className="flex-1">ถัดไป</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "expense" && (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มเงินที่ใช้ไป</CardTitle>
            <p className="text-sm text-muted-foreground">รายจ่ายล่าสุดสักรายการ เช่น ค่าอาหารหรือค่าเดินทาง</p>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input type="number" min="0" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="0.00" required autoFocus />
                </div>
                <div>
                  <Label>วันที่</Label>
                  <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={expenseCategoryId} onChange={(e) => setExpenseCategoryId(e.target.value)}>
                  <option value="">เลือกหมวดหมู่</option>
                  {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>ร้านค้า/ผู้รับเงิน (ไม่บังคับ)</Label>
                <Input value={expenseMerchant} onChange={(e) => setExpenseMerchant(e.target.value)} placeholder="เช่น ร้านอาหาร" />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => goTo("done")}>
                  ข้ามขั้นตอนนี้
                </Button>
                <Button type="submit" className="flex-1">ถัดไป</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">พร้อมแล้ว!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                นี่คือสิ่งที่เราบันทึกไว้ให้คุณแล้ว คุณสามารถเพิ่มงบประมาณ เป้าหมาย หนี้สิน หรือการลงทุนได้ทีหลัง
                ไม่จำเป็นต้องตั้งค่าทุกอย่างตอนนี้
              </p>
            </div>
            <div className="space-y-2 text-left text-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Check className="h-4 w-4 shrink-0 text-success" />
                <span>เพิ่มบัญชี &ldquo;{accountName}&rdquo; แล้ว</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                {incomeAdded ? <TrendingUp className="h-4 w-4 shrink-0 text-success" /> : <span className="h-4 w-4 shrink-0" />}
                <span>{incomeAdded ? `บันทึกเงินที่ได้รับ ${formatTHB(Number(incomeAmount) || 0)} แล้ว` : "ยังไม่ได้บันทึกเงินที่ได้รับ (เพิ่มทีหลังได้)"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                {expenseAdded ? <TrendingDown className="h-4 w-4 shrink-0 text-danger" /> : <span className="h-4 w-4 shrink-0" />}
                <span>{expenseAdded ? `บันทึกเงินที่ใช้ไป ${formatTHB(Number(expenseAmount) || 0)} แล้ว` : "ยังไม่ได้บันทึกเงินที่ใช้ไป (เพิ่มทีหลังได้)"}</span>
              </div>
            </div>
            <Button size="lg" className="w-full" onClick={onFinish}>ดูภาพรวมของคุณ</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

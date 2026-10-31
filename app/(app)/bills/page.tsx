"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Archive, Pause, Pencil, Play, Plus } from "lucide-react";
import { BILL_STATUS_LABELS, BillStatusBadge, CASHFLOW_KIND_LABELS } from "@/components/bills/bill-status-badge";
import { BillEditDialog } from "@/components/bills/bill-edit-dialog";
import { BillPaymentDialog } from "@/components/bills/bill-payment-dialog";
import { FixedCostRuleDialog } from "@/components/bills/fixed-cost-rule-dialog";
import { OneTimeBillDialog } from "@/components/bills/one-time-bill-dialog";
import { ReversePaymentDialog } from "@/components/bills/reverse-payment-dialog";
import { useBills } from "@/lib/hooks/use-bills";
import { amountForPeriod, bangkokPeriod, type BillStatus, type DerivedBill } from "@/lib/finance/bill-calculations";
import { BillError } from "@/lib/finance/bills";
import { formatDateThai, formatTHB, monthLabelThai, shiftPeriod } from "@/lib/utils";
import type { BillPayment, FixedCostRule } from "@/lib/finance/types";

type StatusFilter = "all" | "open" | "overdue" | BillStatus;

export default function BillsPage() {
  const [period, setPeriod] = useState(() => bangkokPeriod());
  const finance = useBills(period);
  const { data, items, summary, cashPlan, overdueElsewhere, categoryById, accountById, setFixedCostRuleStatus } = finance;

  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [paying, setPaying] = useState<DerivedBill | null>(null);
  const [editing, setEditing] = useState<DerivedBill | null>(null);
  const [ruleDialog, setRuleDialog] = useState<{ rule: FixedCostRule | null } | null>(null);
  const [oneTimeOpen, setOneTimeOpen] = useState(false);
  const [reversing, setReversing] = useState<BillPayment | null>(null);
  const [ruleError, setRuleError] = useState("");

  const totals = summary(accountFilter === "all" ? null : accountFilter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ bill, status, isOverdue }) => {
      if (accountFilter !== "all" && bill.plannedAccountId !== accountFilter) return false;
      if (categoryFilter !== "all" && bill.categoryId !== categoryFilter) return false;
      if (statusFilter === "open" && status !== "unpaid" && status !== "partially_paid") return false;
      if (statusFilter === "overdue" && !isOverdue) return false;
      if (statusFilter !== "all" && statusFilter !== "open" && statusFilter !== "overdue" && status !== statusFilter) return false;
      return !q || bill.nameSnapshot.toLowerCase().includes(q);
    });
  }, [items, accountFilter, categoryFilter, statusFilter, search]);

  const rules = data.fixedCostRules.filter((r) => !r.archived);
  const installmentsByLoan = new Map(finance.loansWithSummary.map((l) => [l.loan.id, l.installmentsRemaining]));
  const payments = useMemo(
    () => [...data.billPayments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [data.billPayments],
  );
  const billById = useMemo(() => new Map(data.monthlyBills.map((b) => [b.id, b])), [data.monthlyBills]);

  function changeRuleStatus(rule: FixedCostRule, status: { isActive?: boolean; archived?: boolean }) {
    setRuleError("");
    try {
      setFixedCostRuleStatus(rule.id, status);
    } catch (err) {
      setRuleError(err instanceof BillError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setOneTimeOpen(true)}><Plus className="h-4 w-4" />บิลครั้งเดียว</Button>
      <Button size="sm" onClick={() => setRuleDialog({ rule: null })}><Plus className="h-4 w-4" />รายการประจำ</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" aria-label="เดือนก่อนหน้า" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>←</Button>
          <h2 className="w-40 text-center text-lg font-semibold">{monthLabelThai(period)}</h2>
          <Button size="sm" variant="outline" aria-label="เดือนถัดไป" onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>→</Button>
        </div>
        {addButtons}
      </div>

      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="monthly">บิลเดือนนี้</TabsTrigger>
          <TabsTrigger value="rules">รายการประจำ</TabsTrigger>
          <TabsTrigger value="history">ประวัติการชำระ</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Kpi title="ภาระเดือนนี้" value={formatTHB(totals.planned)} hint={`ค่าใช้จ่าย ${formatTHB(totals.plannedExpense)} · เงินที่ต้องกัน ${formatTHB(totals.plannedCommitment)}`} />
            <Kpi title="จ่ายแล้ว" value={formatTHB(totals.paid)} valueClassName="text-success" />
            <Kpi title="เหลือต้องเตรียม" value={formatTHB(totals.remaining)} />
            <Kpi title="เงินในบัญชีตอนนี้" value={formatTHB(totals.cashNow)} hint={accountFilter === "all" ? "เงินสด บัญชีธนาคาร และกระเป๋าเงิน" : undefined} />
            <Kpi title="คาดว่าจะเหลือหลังจ่าย" value={formatTHB(totals.availableAfterBills)} valueClassName={totals.availableAfterBills < 0 ? "text-danger" : undefined} hint="ประมาณการ ไม่ใช่ยอดเงินจริง" />
            <Kpi title="เกินกำหนด" value={`${totals.overdueCount} รายการ`} valueClassName={totals.overdueCount > 0 ? "text-danger" : undefined} hint={formatTHB(totals.overdueAmount)} />
          </div>

          {overdueElsewhere.length > 0 && (
            <p className="text-sm text-danger">มีบิลเกินกำหนดในเดือนอื่นอีก {overdueElsewhere.length} รายการ</p>
          )}

          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Input aria-label="ค้นหาบิล" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} className="col-span-2 lg:col-span-1" />
                <Select aria-label="กรองตามบัญชี" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                  <option value="all">ทุกบัญชี</option>
                  {data.accounts.filter((a) => !a.archived && a.type !== "credit_card").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <Select aria-label="กรองตามหมวดหมู่" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">ทุกหมวดหมู่</option>
                  {data.categories.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Select aria-label="กรองตามสถานะ" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="col-span-2 lg:col-span-1">
                  <option value="all">ทุกสถานะ</option>
                  <option value="open">ยังจ่ายไม่ครบ</option>
                  <option value="overdue">เกินกำหนด</option>
                  {Object.entries(BILL_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Select>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีบิลในเดือนนี้"
                  description="ตั้งรายการประจำครั้งเดียว แล้วบิลจะมาเองทุกเดือน โดยยังไม่หักเงินจนกว่าจะบันทึกการชำระ"
                  action={<div className="mt-2">{addButtons}</div>}
                />
              ) : filtered.length === 0 ? (
                <EmptyState title="ไม่พบบิล" description="ลองปรับตัวกรอง" />
              ) : (
                <div className="space-y-2">
                  {filtered.map((item) => {
                    const { bill, paid, remaining, status } = item;
                    const canPay = status === "unpaid" || status === "partially_paid";
                    const category = categoryById.get(bill.categoryId ?? "");
                    const planned = accountById.get(bill.plannedAccountId ?? "");
                    const paidFrom = [...new Set(item.payments.filter((p) => !p.reversedAt).map((p) => accountById.get(p.sourceAccountId)?.name))];
                    return (
                      <div key={bill.id} data-testid="bill-row" className="rounded-lg border border-border px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{bill.nameSnapshot}</p>
                            <p className="text-xs text-muted-foreground">
                              {CASHFLOW_KIND_LABELS[bill.cashflowKindSnapshot]}{category ? ` · ${category.name}` : ""} · ครบกำหนด {formatDateThai(bill.dueDate)}
                            </p>
                          </div>
                          <BillStatusBadge item={item} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                            <span><span className="text-xs text-muted-foreground">ต้องจ่าย </span>{formatTHB(bill.amountDue)}</span>
                            <span><span className="text-xs text-muted-foreground">จ่ายแล้ว </span>{formatTHB(paid)}</span>
                            <span className="font-medium"><span className="text-xs font-normal text-muted-foreground">ค้าง </span>{formatTHB(remaining)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" aria-label={`แก้ไข ${bill.nameSnapshot}`} onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></Button>
                            {canPay && <Button size="sm" onClick={() => setPaying(item)}>บันทึกชำระ</Button>}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {paidFrom.length > 0 ? `จ่ายจาก ${paidFrom.join(", ")}` : planned ? `ตั้งใจจ่ายจาก ${planned.name}` : "ยังไม่ระบุบัญชี"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>แผนเงินรายบัญชี</CardTitle>
                <p className="text-xs text-muted-foreground">ยอดคาดการณ์คำนวณจากบิลที่ยังค้าง ไม่ใช่ยอดเงินจริง</p>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2">บัญชี</th>
                        <th className="py-2 pr-2 text-right">ยอดปัจจุบัน</th>
                        <th className="py-2 pr-2 text-right">จะจ่ายออก</th>
                        <th className="py-2 pr-2 text-right">จะรับเข้า</th>
                        <th className="py-2 pr-2 text-right">คาดว่าจะเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashPlan.rows.map(({ account, balance, outgoing, incoming, projected }) => {
                        const isCard = account.type === "credit_card";
                        return (
                          <tr key={account.id} className="border-b border-border/60">
                            <td className="py-2 pr-2">{account.name}{isCard && <span className="text-xs text-muted-foreground"> (ยอดหนี้)</span>}</td>
                            <td className="py-2 pr-2 text-right">{formatTHB(balance)}</td>
                            <td className="py-2 pr-2 text-right">{formatTHB(outgoing)}</td>
                            <td className="py-2 pr-2 text-right">{formatTHB(incoming)}</td>
                            <td className={`py-2 pr-2 text-right font-medium ${!isCard && projected < 0 ? "text-danger" : ""}`}>{formatTHB(projected)}</td>
                          </tr>
                        );
                      })}
                      {cashPlan.unallocated > 0 && (
                        <tr className="border-b border-border/60 text-muted-foreground">
                          <td className="py-2 pr-2">ยังไม่จัดสรรบัญชี</td>
                          <td className="py-2 pr-2 text-right">-</td>
                          <td className="py-2 pr-2 text-right">{formatTHB(cashPlan.unallocated)}</td>
                          <td className="py-2 pr-2 text-right">-</td>
                          <td className="py-2 pr-2 text-right">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-3">
          {ruleError && <p role="alert" className="text-sm text-danger">{ruleError}</p>}
          {rules.length === 0 ? (
            <EmptyState title="ยังไม่มีรายการประจำ" description="เช่น งวดรถ ค่าเน็ต ให้ที่บ้าน" action={<Button size="sm" className="mt-2" onClick={() => setRuleDialog({ rule: null })}><Plus className="h-4 w-4" />รายการประจำ</Button>} />
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} data-testid="rule-row">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {rule.name}
                      {!rule.isActive && <Badge variant="outline">หยุดชั่วคราว</Badge>}
                      {rule.amountMode === "estimate" && <Badge variant="outline">ยอดประมาณ</Badge>}
                      {typeof installmentsByLoan.get(rule.loanAccountId ?? "") === "number" && (
                        <Badge variant="outline">เหลือ {installmentsByLoan.get(rule.loanAccountId ?? "")} งวด</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTHB(amountForPeriod(rule, period))} · {CASHFLOW_KIND_LABELS[rule.cashflowKind]} · {rule.dueRule === "last_day" ? "วันสุดท้ายของเดือน" : `ทุกวันที่ ${rule.dueDay}`}
                      {rule.endMonth ? ` · ถึง ${monthLabelThai(rule.endMonth)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" aria-label={`แก้ไข ${rule.name}`} onClick={() => setRuleDialog({ rule })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" aria-label={rule.isActive ? `หยุด ${rule.name}` : `เริ่มต่อ ${rule.name}`} onClick={() => changeRuleStatus(rule, { isActive: !rule.isActive })}>
                      {rule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`เก็บ ${rule.name}`}
                      onClick={() => confirm("เก็บรายการนี้หรือไม่? จะไม่สร้างบิลใหม่ ส่วนประวัติยังอยู่ครบ") && changeRuleStatus(rule, { archived: true })}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history">
          {payments.length === 0 ? (
            <EmptyState title="ยังไม่มีประวัติการชำระ" />
          ) : (
            <Card>
              <CardContent className="space-y-2 pt-5">
                {payments.map((payment) => (
                  <div key={payment.id} data-testid="payment-row" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${payment.reversedAt ? "text-muted-foreground line-through" : ""}`}>
                        {billById.get(payment.billId)?.nameSnapshot ?? "บิล"} · {formatTHB(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateThai(payment.paidAt)} · {accountById.get(payment.sourceAccountId)?.name ?? "-"}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                        {payment.reversedAt ? ` · ย้อนแล้ว: ${payment.reversalReason ?? ""}` : ""}
                      </p>
                    </div>
                    {payment.reversedAt ? <Badge variant="outline">ย้อนรายการแล้ว</Badge> : <Button size="sm" variant="outline" onClick={() => setReversing(payment)}>ย้อนรายการ</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {paying && <BillPaymentDialog key={paying.bill.id} item={paying} onClose={() => setPaying(null)} />}
      {editing && <BillEditDialog key={editing.bill.id} item={editing} onClose={() => setEditing(null)} />}
      {ruleDialog && <FixedCostRuleDialog key={ruleDialog.rule?.id ?? "new"} rule={ruleDialog.rule} onClose={() => setRuleDialog(null)} />}
      {oneTimeOpen && <OneTimeBillDialog defaultDueDate={`${period}-01`} onClose={() => setOneTimeOpen(false)} />}
      {reversing && <ReversePaymentDialog key={reversing.id} payment={reversing} onClose={() => setReversing(null)} />}
    </div>
  );
}

function Kpi({ title, value, hint, valueClassName }: { title: string; value: string; hint?: string; valueClassName?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="pt-2">
        <CardValue className={`text-xl sm:text-2xl ${valueClassName ?? ""}`}>{value}</CardValue>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

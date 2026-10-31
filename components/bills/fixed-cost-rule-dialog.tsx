"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { BillClassificationFields, EMPTY_CLASSIFICATION, type BillClassification } from "@/components/bills/bill-classification-fields";
import { amountForPeriod, bangkokPeriod } from "@/lib/finance/bill-calculations";
import { BillError, type RuleInput } from "@/lib/finance/bills";
import { fixedCostRuleSchema } from "@/lib/validation/schemas";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import type { BillAmountMode, BillDueRule, FixedCostRule } from "@/lib/finance/types";

/** Mount with a `key` per open so the form starts from `rule` (or blank) each time. */
export function FixedCostRuleDialog({ rule, onClose }: { rule: FixedCostRule | null; onClose: () => void }) {
  const { createFixedCostRule, updateFixedCostRule } = useFinanceData();
  const [period] = useState(() => bangkokPeriod());

  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(rule ? String(amountForPeriod(rule, period)) : "");
  const [amountMode, setAmountMode] = useState<BillAmountMode>(rule?.amountMode ?? "fixed");
  const [dueRule, setDueRule] = useState<BillDueRule>(rule?.dueRule ?? "day_of_month");
  const [dueDay, setDueDay] = useState(rule?.dueDay ? String(rule.dueDay) : "");
  const [startMonth, setStartMonth] = useState(rule?.startMonth ?? period);
  const [endMonth, setEndMonth] = useState(rule?.endMonth ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(period);
  const [note, setNote] = useState(rule?.note ?? "");
  const [classification, setClassification] = useState<BillClassification>(
    rule
      ? {
          cashflowKind: rule.cashflowKind,
          categoryId: rule.categoryId ?? "",
          sourceAccountId: rule.defaultAccountId ?? "",
          targetAccountId: rule.targetAccountId ?? "",
          loanAccountId: rule.loanAccountId ?? "",
        }
      : EMPTY_CLASSIFICATION,
  );
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = fixedCostRuleSchema.safeParse({
      ...classification,
      name,
      amount: amount === "" ? Number.NaN : Number(amount),
      amountMode,
      dueRule,
      dueDay: dueRule === "day_of_month" && dueDay !== "" ? Number(dueDay) : null,
      startMonth,
      endMonth: endMonth || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const value = parsed.data;
    const input: RuleInput = {
      name: value.name,
      cashflowKind: value.cashflowKind,
      defaultAmount: value.amount,
      amountMode: value.amountMode,
      dueRule: value.dueRule,
      dueDay: value.dueDay,
      startMonth: value.startMonth,
      endMonth: value.endMonth ?? null,
      categoryId: value.categoryId || null,
      defaultAccountId: value.sourceAccountId || null,
      targetAccountId: value.targetAccountId || null,
      loanAccountId: value.loanAccountId || null,
      note: note.trim() || null,
    };
    try {
      if (rule) updateFixedCostRule(rule.id, input, effectiveFrom);
      else createFixedCostRule(input);
      onClose();
    } catch (err) {
      setError(err instanceof BillError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{rule ? "แก้ไขรายการประจำ" : "เพิ่มรายการประจำ"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="rule-name">ชื่อรายการ</Label>
            <Input id="rule-name" placeholder="เช่น งวดรถ, ค่าเน็ต, ให้ที่บ้าน" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rule-amount">ยอดต่อเดือน (บาท)</Label>
              <Input id="rule-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="rule-mode">รูปแบบยอด</Label>
              <Select id="rule-mode" value={amountMode} onChange={(e) => setAmountMode(e.target.value as BillAmountMode)}>
                <option value="fixed">ยอดคงที่</option>
                <option value="estimate">ยอดประมาณ (แก้ตามบิลจริง)</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rule-due-rule">ครบกำหนด</Label>
              <Select id="rule-due-rule" value={dueRule} onChange={(e) => setDueRule(e.target.value as BillDueRule)}>
                <option value="day_of_month">ทุกวันที่</option>
                <option value="last_day">วันสุดท้ายของเดือน</option>
              </Select>
            </div>
            {dueRule === "day_of_month" && (
              <div>
                <Label htmlFor="rule-due-day">วันที่ (1-31)</Label>
                <Input id="rule-due-day" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rule-start">เดือนเริ่มต้น</Label>
              <Input id="rule-start" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="rule-end">เดือนสิ้นสุด (ไม่บังคับ)</Label>
              <Input id="rule-end" type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
            </div>
          </div>
          <BillClassificationFields value={classification} onChange={(patch) => setClassification((c) => ({ ...c, ...patch }))} />
          <div>
            <Label htmlFor="rule-note">หมายเหตุ (ไม่บังคับ)</Label>
            <Input id="rule-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {rule && (
            <div>
              <Label htmlFor="rule-effective">มีผลตั้งแต่เดือน</Label>
              <Input id="rule-effective" type="month" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
              <p className="mt-1 text-xs text-muted-foreground">เดือนก่อนหน้า บิลที่จ่ายแล้ว และบิลที่แก้ไขเองจะไม่เปลี่ยน</p>
            </div>
          )}
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

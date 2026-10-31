"use client";

import Link from "next/link";
import { Label, Select } from "@/components/ui/input";
import { CASHFLOW_KIND_LABELS } from "@/components/bills/bill-status-badge";
import { TRANSFER_KINDS } from "@/lib/finance/bills";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import type { CashflowKind } from "@/lib/finance/types";

export interface BillClassification {
  cashflowKind: CashflowKind;
  categoryId: string;
  sourceAccountId: string;
  targetAccountId: string;
  loanAccountId: string;
}

export const EMPTY_CLASSIFICATION: BillClassification = {
  cashflowKind: "expense",
  categoryId: "",
  sourceAccountId: "",
  targetAccountId: "",
  loanAccountId: "",
};

/** Type, category, accounts and loan. Which of these show depends on the type. */
export function BillClassificationFields({
  value,
  onChange,
}: {
  value: BillClassification;
  onChange: (patch: Partial<BillClassification>) => void;
}) {
  const { data } = useFinanceData();
  const kind = value.cashflowKind;
  const accounts = data.accounts.filter((a) => !a.archived);
  const categories = data.categories.filter((c) => c.kind === "expense" && !c.archived);
  const loans = data.loans.filter((l) => !l.archived && l.kind === "installment_loan");
  const isTransfer = TRANSFER_KINDS.includes(kind);
  const sources = kind === "expense" ? accounts : accounts.filter((a) => a.type !== "credit_card");
  const targets = kind === "credit_card_payment"
    ? accounts.filter((a) => a.type === "credit_card")
    : accounts.filter((a) => a.type !== "credit_card" && a.id !== value.sourceAccountId);

  return (
    <>
      <div>
        <Label htmlFor="bill-kind">ประเภท</Label>
        <Select
          id="bill-kind"
          value={kind}
          onChange={(e) => onChange({ cashflowKind: e.target.value as CashflowKind, sourceAccountId: "", targetAccountId: "" })}
        >
          {Object.entries(CASHFLOW_KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
        {kind !== "expense" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {kind === "loan_payment" ? "นับเป็นค่าใช้จ่ายเฉพาะส่วนดอกเบี้ย" : "เป็นเงินที่ต้องเตรียม แต่ไม่นับเป็นค่าใช้จ่าย"}
          </p>
        )}
      </div>

      {kind === "loan_payment" && (
        <div>
          <Label htmlFor="bill-loan">สินเชื่อ</Label>
          <Select id="bill-loan" value={value.loanAccountId} onChange={(e) => onChange({ loanAccountId: e.target.value })}>
            <option value="">เลือกสินเชื่อ</option>
            {loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          {loans.length === 0 && <p className="mt-1 text-xs text-muted-foreground">ยังไม่มีสินเชื่อ <Link href="/debts" className="text-accent underline underline-offset-2">เพิ่มได้ที่หน้าหนี้สิน</Link></p>}
        </div>
      )}

      {(kind === "expense" || kind === "loan_payment") && (
        <div>
          <Label htmlFor="bill-category">{kind === "expense" ? "หมวดหมู่" : "หมวดหมู่ดอกเบี้ย (ไม่บังคับ)"}</Label>
          <Select id="bill-category" value={value.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
            <option value="">เลือกหมวดหมู่</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      )}

      <div className={isTransfer ? "grid grid-cols-2 gap-3" : undefined}>
        <div>
          <Label htmlFor="bill-source">บัญชีที่ตั้งใจจ่าย (ไม่บังคับ)</Label>
          <Select id="bill-source" value={value.sourceAccountId} onChange={(e) => onChange({ sourceAccountId: e.target.value })}>
            <option value="">ยังไม่ระบุ</option>
            {sources.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        {isTransfer && (
          <div>
            <Label htmlFor="bill-target">{kind === "credit_card_payment" ? "บัตรเครดิต" : "บัญชีปลายทาง"}</Label>
            <Select id="bill-target" value={value.targetAccountId} onChange={(e) => onChange({ targetAccountId: e.target.value })}>
              <option value="">เลือกบัญชี</option>
              {targets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        )}
      </div>
    </>
  );
}

import { Badge } from "@/components/ui/misc";
import type { BillStatus, DerivedBill } from "@/lib/finance/bill-calculations";
import type { CashflowKind } from "@/lib/finance/types";

export const CASHFLOW_KIND_LABELS: Record<CashflowKind, string> = {
  expense: "ค่าใช้จ่าย",
  loan_payment: "ผ่อนชำระหนี้",
  credit_card_payment: "ชำระบัตรเครดิต",
  transfer: "โอนระหว่างบัญชี",
  saving: "เก็บเงิน",
  investment: "ลงทุน",
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  unpaid: "ยังไม่จ่าย",
  partially_paid: "จ่ายบางส่วน",
  paid: "จ่ายครบ",
  skipped: "ข้าม",
  cancelled: "ยกเลิก",
};

const VARIANTS: Record<BillStatus, "default" | "success" | "warning" | "outline"> = {
  unpaid: "default",
  partially_paid: "warning",
  paid: "success",
  skipped: "outline",
  cancelled: "outline",
};

export function BillStatusBadge({ item }: { item: DerivedBill }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={VARIANTS[item.status]}>{BILL_STATUS_LABELS[item.status]}</Badge>
      {item.isOverdue && <Badge variant="danger">เกินกำหนด</Badge>}
    </span>
  );
}

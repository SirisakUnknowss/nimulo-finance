"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { useBills } from "@/lib/hooks/use-bills";
import { bangkokPeriod } from "@/lib/finance/bill-calculations";
import { formatDateThai, formatTHB } from "@/lib/utils";

const UPCOMING_LIMIT = 4;

export function BillsOverviewCard() {
  const { allItems, items, overdueElsewhere, summary } = useBills(bangkokPeriod());
  if (items.length === 0 && overdueElsewhere.length === 0) return null;

  const totals = summary();
  const overdueCount = totals.overdueCount + overdueElsewhere.length;
  const upcoming = allItems
    .filter((i) => i.remaining > 0 && i.bill.lifecycleState === "active")
    .sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate))
    .slice(0, UPCOMING_LIMIT);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle>บิลเดือนนี้</CardTitle>
        {overdueCount > 0 && <Badge variant="danger">เกินกำหนด {overdueCount} รายการ</Badge>}
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">เหลือต้องเตรียม</p>
            <p className="text-lg font-semibold">{formatTHB(totals.remaining)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">จ่ายแล้ว</p>
            <p className="text-lg font-semibold text-success">{formatTHB(totals.paid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">คาดว่าจะเหลือหลังจ่าย</p>
            <p className={`text-lg font-semibold ${totals.availableAfterBills < 0 ? "text-danger" : ""}`}>{formatTHB(totals.availableAfterBills)}</p>
          </div>
        </div>
        {upcoming.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-border pt-3">
            {upcoming.map(({ bill, remaining, isOverdue }) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{bill.nameSnapshot}</span>
                <span className="shrink-0 text-muted-foreground">
                  <span className={isOverdue ? "text-danger" : ""}>{formatDateThai(bill.dueDate)}</span> · {formatTHB(remaining)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/bills" className="mt-3 block text-center text-xs text-accent hover:underline">จัดการบิล</Link>
      </CardContent>
    </Card>
  );
}

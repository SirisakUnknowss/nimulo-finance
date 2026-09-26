"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { parseCsv } from "@/lib/csv";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import type { TransactionType } from "@/lib/finance/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldKey = "date" | "type" | "amount" | "account" | "category" | "merchant" | "note";

export function ImportTransactionsDialog({ open, onOpenChange }: Props) {
  const { data, importTransactions } = useFinanceData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    date: "",
    type: "",
    amount: "",
    account: "",
    category: "",
    merchant: "",
    note: "",
  });
  const [result, setResult] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCsv(String(reader.result));
      setHeaders(h);
      setRows(r);
      setResult(null);
      // naive auto-map by matching header names
      const auto: Record<FieldKey, string> = { date: "", type: "", amount: "", account: "", category: "", merchant: "", note: "" };
      for (const key of Object.keys(auto) as FieldKey[]) {
        const found = h.find((col) => col.toLowerCase().includes(key));
        if (found) auto[key] = found;
      }
      setMapping(auto);
    };
    reader.readAsText(file);
  }

  function accountIdByName(name: string): string | null {
    const acc = data.accounts.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
    return acc?.id ?? null;
  }
  function categoryIdByName(name: string): string | null {
    const cat = data.categories.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    return cat?.id ?? null;
  }

  function handleImport() {
    if (!mapping.date || !mapping.type || !mapping.amount || !mapping.account) {
      setResult("กรุณาระบุคอลัมน์ที่จำเป็นให้ครบ (วันที่, ประเภท, จำนวนเงิน, บัญชี)");
      return;
    }
    const idx = (field: FieldKey) => headers.indexOf(mapping[field]);
    const parsed = rows
      .map((row) => {
        const rawType = row[idx("type")]?.toLowerCase().trim();
        const type: TransactionType = rawType === "income" || rawType === "รายรับ" ? "income" : rawType === "transfer" || rawType === "โอนเงิน" ? "transfer" : "expense";
        const accountId = accountIdByName(row[idx("account")] ?? "");
        if (!accountId) return null;
        const amount = Number(row[idx("amount")]);
        if (!amount || amount <= 0) return null;
        const categoryName = mapping.category ? row[idx("category")] : "";
        return {
          type,
          amount,
          date: row[idx("date")],
          accountId,
          categoryId: type === "transfer" ? null : categoryIdByName(categoryName ?? ""),
          merchant: mapping.merchant ? row[idx("merchant")] : null,
          note: mapping.note ? row[idx("note")] : null,
          tags: [] as string[],
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const added = importTransactions(parsed);
    setResult(`นำเข้าสำเร็จ ${added} รายการ (ข้ามรายการซ้ำ/ไม่ถูกต้อง ${parsed.length - added + (rows.length - parsed.length)} รายการ)`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>นำเข้ารายการจาก CSV</DialogTitle>
          <DialogDescription>อัปโหลดไฟล์ CSV แล้วจับคู่คอลัมน์ให้ตรงกับข้อมูลที่ต้องการ</DialogDescription>
        </DialogHeader>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />

        {headers.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(["date", "type", "amount", "account", "category", "merchant", "note"] as FieldKey[]).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{fieldLabel(field)}</label>
                  <Select value={mapping[field]} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}>
                    <option value="">— ไม่ใช้ —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            <div className="max-h-48 overflow-auto rounded-lg border border-border scroll-thin">
              <table className="w-full text-xs">
                <thead className="bg-accent-soft/60">
                  <tr>{headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">แสดงตัวอย่าง 5 แถวแรกจากทั้งหมด {rows.length} แถว</p>
          </div>
        )}

        {result && <p className="mt-3 text-sm text-accent">{result}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button onClick={handleImport} disabled={!headers.length}>ยืนยันนำเข้า</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fieldLabel(field: FieldKey): string {
  const labels: Record<FieldKey, string> = {
    date: "วันที่ *",
    type: "ประเภท *",
    amount: "จำนวนเงิน *",
    account: "บัญชี *",
    category: "หมวดหมู่",
    merchant: "ร้านค้า",
    note: "โน้ต",
  };
  return labels[field];
}

"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Download, Upload, Plus, Trash2, RefreshCcw } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB } from "@/lib/utils";
import { transactionsToCsv, downloadCsv } from "@/lib/csv";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-dialog";
import { ImportTransactionsDialog } from "@/components/transactions/import-dialog";
import type { TransactionType } from "@/lib/finance/types";

const PAGE_SIZE = 15;

export default function TransactionsPage() {
  const finance = useFinanceData();
  const { data, categoryById, accountById, deleteTransaction, postRecurring } = finance;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...data.transactions];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.merchant?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          categoryById.get(t.categoryId ?? "")?.name.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (categoryFilter !== "all") list = list.filter((t) => t.categoryId === categoryFilter);
    if (dateFrom) list = list.filter((t) => t.date >= dateFrom);
    if (dateTo) list = list.filter((t) => t.date <= dateTo);
    list.sort((a, b) => (sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    return list;
  }, [data.transactions, search, typeFilter, categoryFilter, dateFrom, dateTo, sortDesc, categoryById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dueTemplates = useMemo(() => {
    const period = new Date().toISOString().slice(0, 7);
    return data.recurringTemplates.filter((t) => t.active && t.lastPostedPeriod !== period);
  }, [data.recurringTemplates]);

  function handleExport() {
    const csv = transactionsToCsv(
      filtered,
      (id) => categoryById.get(id ?? "")?.name ?? "",
      (id) => accountById.get(id)?.name ?? id,
    );
    downloadCsv(`mono-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" suppressHydrationWarning>รายการทั้งหมด ({filtered.length})</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />นำเข้า CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" />ส่งออก CSV</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />เพิ่มรายการ</Button>
        </div>
      </div>

      {dueTemplates.length > 0 && (
        <Card>
          <CardHeader><CardTitle>รายการประจำที่รอยืนยัน</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-2">
            {dueTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{t.merchant || (t.type === "income" ? "เงินเข้าประจำ" : "เงินออกประจำ")}</p>
                  <p className="text-xs text-muted-foreground">{formatTHB(t.amount)} · ทุกวันที่ {t.dayOfMonth ?? "-"} ของเดือน</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => postRecurring(t.id, new Date().toISOString().slice(0, 10))}>
                  <RefreshCcw className="h-4 w-4" />ยืนยันบันทึก
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Input placeholder="ค้นหา..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="col-span-2 lg:col-span-2" />
            <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as TransactionType | "all"); setPage(1); }}>
              <option value="all">ทุกประเภท</option>
              <option value="income">เงินเข้า</option>
              <option value="expense">เงินออก</option>
              <option value="transfer">โอนเงิน</option>
            </Select>
            <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="all">ทุกหมวดหมู่</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="ไม่พบรายการ" description="ลองปรับตัวกรอง หรือเพิ่มรายการใหม่" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="cursor-pointer select-none py-2 pr-2" onClick={() => setSortDesc((s) => !s)}>วันที่ {sortDesc ? "↓" : "↑"}</th>
                    <th className="py-2 pr-2">ประเภท</th>
                    <th className="py-2 pr-2">รายละเอียด</th>
                    <th className="py-2 pr-2">บัญชี</th>
                    <th className="py-2 pr-2 text-right">จำนวนเงิน</th>
                    <th className="py-2 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((t) => {
                    const cat = categoryById.get(t.categoryId ?? "");
                    const acc = accountById.get(t.accountId);
                    return (
                      <tr key={t.id} className="border-b border-border/60">
                        <td className="py-2 pr-2 whitespace-nowrap">{t.date}</td>
                        <td className="py-2 pr-2">
                          <Badge variant={t.type === "income" ? "success" : t.type === "expense" ? "danger" : "transfer"}>
                            {t.type === "income" ? "เงินเข้า" : t.type === "expense" ? "เงินออก" : "โอนเงิน"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-2">
                          <p className="font-medium">{t.merchant || cat?.name || t.note || "-"}</p>
                          {cat && t.type !== "transfer" && <p className="text-xs text-muted-foreground">{cat.name}</p>}
                        </td>
                        <td className="py-2 pr-2 text-muted-foreground">{acc?.name ?? "-"}</td>
                        <td className={`py-2 pr-2 text-right font-medium ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-transfer"}`}>
                          {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{formatTHB(t.amount)}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <button
                            aria-label="ลบรายการ"
                            onClick={() => confirm("ยืนยันลบรายการนี้หรือไม่?") && deleteTransaction(t.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent-soft hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">หน้า {page} จาก {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickAddTransactionDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportTransactionsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

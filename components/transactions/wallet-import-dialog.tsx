"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { bangkokDate } from "@/lib/finance/bill-calculations";
import { applyImportPlan, buildImportPlan, readWalletFiles, WalletImportError, type WalletImportPlan } from "@/lib/import/wallet-story";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB } from "@/lib/utils";

/** Near localStorage's limit of about 5 million characters per site. */
const MAX_STORED_CHARS = 4_800_000;

/** Mount only while open, so each import starts clean. */
export function WalletImportDialog({ onClose }: { onClose: () => void }) {
  const { data, applyWalletImport } = useFinanceData();
  const [plan, setPlan] = useState<WalletImportPlan | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])];
    setPlan(null);
    setError("");
    if (picked.length === 0) return;
    try {
      const files = await Promise.all(picked.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const next = buildImportPlan(data, readWalletFiles(files), bangkokDate());
      if (JSON.stringify(applyImportPlan(data, next)).length > MAX_STORED_CHARS) {
        setError("ข้อมูลมากเกินกว่าที่เบราว์เซอร์นี้จะเก็บได้ จึงยังไม่ได้นำเข้า");
        return;
      }
      setPlan(next);
    } catch (err) {
      setError(err instanceof WalletImportError ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  function handleImport() {
    if (!plan) return;
    applyWalletImport(plan);
    setDone(true);
  }

  const total = plan ? plan.transactions.length : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>นำเข้าจาก Wallet Story</DialogTitle>
          <DialogDescription>เลือกไฟล์ .zip และไฟล์ transaction .csv พร้อมกัน เพื่อให้จับคู่การจ่ายหนี้ได้ครบ ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น</DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <p role="status" className="text-sm">นำเข้าแล้ว {total.toLocaleString("th-TH")} รายการ</p>
            <DialogFooter><Button onClick={onClose}>ปิด</Button></DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="wallet-files">ไฟล์ส่งออก</Label>
              <Input id="wallet-files" type="file" accept=".zip,.csv" multiple onChange={handleFiles} />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            {plan && (
              <>
                <div data-testid="import-summary" className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Stat label="เงินเข้า" value={plan.counts.income} />
                  <Stat label="เงินออก" value={plan.counts.expense} />
                  <Stat label="โอนเงิน" value={plan.counts.transfer} />
                  <Stat label="จ่ายหนี้" value={plan.counts.loanPayment} />
                </div>
                <p className="text-sm text-muted-foreground">
                  จะสร้างบัญชีใหม่ {plan.accounts.filter((a) => !a.archived).length} บัญชี · หนี้ {plan.loans.length} รายการ · หมวดหมู่ใหม่ {plan.categories.length} หมวด
                </p>

                {plan.accountChecks.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-1.5 pr-2">บัญชี</th>
                          <th className="py-1.5 pr-2 text-right">ยอดในไฟล์</th>
                          <th className="py-1.5 pr-2 text-right">ยอดหลังนำเข้า</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.accountChecks.map((c) => {
                          const differs = c.exported !== null && c.exported !== c.after;
                          return (
                            <tr key={c.name} className="border-b border-border/60">
                              <td className="py-1.5 pr-2">{c.name}{!c.isNew && <span className="text-xs text-muted-foreground"> (มีอยู่แล้ว)</span>}</td>
                              <td className="py-1.5 pr-2 text-right">{c.exported === null ? "-" : formatTHB(c.exported)}</td>
                              <td className={`py-1.5 pr-2 text-right ${differs ? "text-warning" : ""}`}>{formatTHB(c.after)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {(plan.skipped.length > 0 || plan.alreadyImported > 0 || plan.notes.length > 0) && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {plan.alreadyImported > 0 && <li>ข้าม {plan.alreadyImported.toLocaleString("th-TH")} แถวที่เคยนำเข้าแล้ว</li>}
                    {plan.skipped.map((s) => <li key={s.reason}>ข้าม {s.count.toLocaleString("th-TH")} แถว: {s.reason}</li>)}
                    {plan.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
              <Button type="button" disabled={!plan || total === 0} onClick={handleImport}>นำเข้า {total > 0 ? `${total.toLocaleString("th-TH")} รายการ` : ""}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

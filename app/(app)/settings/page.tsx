"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Coffee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { downloadCsv, transactionsToCsv } from "@/lib/csv";
import { useTheme } from "@/components/theme-provider";
import { BackupError, downloadBackup, parseBackup, summarizeBackup } from "@/lib/backup";

export default function SettingsPage() {
  const finance = useFinanceData();
  const { data, updateProfile, addCategory, replaceAllData, categoryById, accountById } = finance;
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(data.profile.displayName);
  const [newCategory, setNewCategory] = useState("");
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    try {
      const restored = parseBackup(await file.text());
      const ok = confirm(
        `กู้คืนข้อมูลจากไฟล์นี้หรือไม่?\n\n${summarizeBackup(restored)}\n\nข้อมูลทั้งหมดที่อยู่ในเบราว์เซอร์นี้ตอนนี้จะถูกแทนที่`,
      );
      if (!ok) return;
      replaceAllData(restored);
      setDisplayName(restored.profile.displayName);
      setRestoreMessage({ ok: true, text: "กู้คืนข้อมูลเรียบร้อยแล้ว" });
    } catch (err) {
      setRestoreMessage({ ok: false, text: err instanceof BackupError ? err.message : "อ่านไฟล์ไม่สำเร็จ" });
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    updateProfile({ displayName });
  }

  function handleExportAll() {
    const csv = transactionsToCsv(
      data.transactions,
      (id) => categoryById.get(id ?? "")?.name ?? "",
      (id) => accountById.get(id)?.name ?? id,
    );
    downloadCsv(`nimulo-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/support"
        className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-accent-soft/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Coffee className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">เลี้ยงกาแฟ dev สักแก้ว ☕</span>
          <span className="block text-xs text-muted-foreground">nimulo ใช้ฟรีทุกฟีเจอร์ ร่วมสนับสนุนให้พัฒนาต่อได้</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <Card>
        <CardHeader><CardTitle>การจัดเก็บข้อมูล</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <Badge variant="outline">เก็บในเบราว์เซอร์นี้เท่านั้น</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            ข้อมูลของคุณไม่ถูกส่งออกไปที่ใด และไม่ซิงก์ข้ามเครื่องหรือข้ามเบราว์เซอร์ หากล้างข้อมูลเบราว์เซอร์ ข้อมูลในแอปจะหายไปด้วย แนะนำให้กด &quot;สำรองข้อมูลทั้งหมด&quot; ด้านล่างเก็บไว้เป็นระยะ
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ข้อมูลโปรไฟล์</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <Label>ชื่อที่แสดง</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>สกุลเงินหลัก</Label>
                <Select value={data.profile.baseCurrency} onChange={(e) => updateProfile({ baseCurrency: e.target.value })}>
                  <option value="THB">บาทไทย (THB)</option>
                </Select>
              </div>
              <div>
                <Label>เขตเวลา</Label>
                <Select value={data.profile.timezone} onChange={(e) => updateProfile({ timezone: e.target.value })}>
                  <option value="Asia/Bangkok">Asia/Bangkok</option>
                </Select>
              </div>
            </div>
            <Button type="submit" size="sm">บันทึกโปรไฟล์</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ธีม</CardTitle></CardHeader>
        <CardContent className="pt-2 flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <Button key={t} size="sm" variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>
              {t === "light" ? "สว่าง" : t === "dark" ? "มืด" : "ตามระบบ"}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>จัดการหมวดหมู่</CardTitle></CardHeader>
        <CardContent className="pt-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => (
              <Badge key={c.id} variant="outline">{c.name} ({c.kind === "income" ? "เงินเข้า" : "เงินออก"})</Badge>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCategory.trim()) return;
              addCategory({ name: newCategory, kind: "expense", color: "#777F79" });
              setNewCategory("");
            }}
          >
            <Input placeholder="ชื่อหมวดหมู่รายจ่ายใหม่" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <Button type="submit" size="sm">เพิ่ม</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ข้อมูลและความเป็นส่วนตัว</CardTitle></CardHeader>
        <CardContent className="pt-2 space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => downloadBackup(data)}>สำรองข้อมูลทั้งหมด</Button>
              <Button variant="outline" size="sm" onClick={() => restoreInputRef.current?.click()}>กู้คืนจากไฟล์สำรอง</Button>
              <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
            </div>
            <p className="text-xs text-muted-foreground">
              ไฟล์สำรองเก็บทุกอย่าง (บัญชี รายการเงิน งบประมาณ เป้าหมาย หนี้สิน การลงทุน) ใช้ย้ายไปเครื่องอื่นหรือกู้คืนหลังล้างข้อมูลเบราว์เซอร์ได้
            </p>
            {restoreMessage && (
              <p className={`text-xs ${restoreMessage.ok ? "text-success" : "text-danger"}`}>{restoreMessage.text}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll}>ส่งออกรายการเงิน (CSV)</Button>
          <div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm("ยืนยันลบข้อมูลทั้งหมดในเบราว์เซอร์นี้อย่างถาวรหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
                  window.localStorage.removeItem("mono-finance-demo-v1");
                  window.location.reload();
                }
              }}
            >
              ลบข้อมูลทั้งหมด
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            nimulo ไม่เก็บข้อมูลรับรองบัญชีธนาคารจริง และไม่เชื่อมต่อกับสถาบันการเงินใดๆ ข้อมูลทั้งหมดถูกจัดเก็บในเบราว์เซอร์ของคุณเท่านั้น
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

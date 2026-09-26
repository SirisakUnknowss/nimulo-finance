"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { downloadCsv, transactionsToCsv } from "@/lib/csv";
import { useTheme } from "@/components/theme-provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SettingsPage() {
  const finance = useFinanceData();
  const { data, updateProfile, addCategory, resetDemoData, categoryById, accountById } = finance;
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(data.profile.displayName);
  const [newCategory, setNewCategory] = useState("");
  const supabaseConfigured = isSupabaseConfigured();

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
    downloadCsv(`mono-finance-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader><CardTitle>สถานะการเชื่อมต่อ</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <Badge variant={supabaseConfigured ? "success" : "outline"}>
            {supabaseConfigured ? "เชื่อมต่อ Supabase แล้ว" : "โหมดสาธิต (Demo Mode) — ข้อมูลจัดเก็บในเบราว์เซอร์นี้เท่านั้น"}
          </Badge>
          {!supabaseConfigured && (
            <p className="mt-2 text-sm text-muted-foreground">
              ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local เพื่อเชื่อมต่อฐานข้อมูลจริง ดูรายละเอียดใน README.md
            </p>
          )}
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
              <Badge key={c.id} variant="outline">{c.name} ({c.kind === "income" ? "รายรับ" : "รายจ่าย"})</Badge>
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
          <Button variant="outline" size="sm" onClick={handleExportAll}>ส่งออกข้อมูลทั้งหมด (CSV)</Button>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => confirm("รีเซ็ตข้อมูลสาธิตกลับเป็นค่าเริ่มต้นหรือไม่?") && resetDemoData()}
            >
              รีเซ็ตข้อมูลสาธิต
            </Button>
          </div>
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
            MONO Finance ไม่เก็บข้อมูลรับรองบัญชีธนาคารจริง และไม่เชื่อมต่อกับสถาบันการเงินใดๆ ข้อมูลในโหมดสาธิตถูกจัดเก็บในเบราว์เซอร์ของคุณเท่านั้น
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

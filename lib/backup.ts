import { z } from "zod";
import type { DemoData } from "@/lib/demo/seed";

/**
 * Full-data backup file: everything the user has in this browser, so it can
 * be restored on another device or after browser data is cleared. Unlike the
 * transaction CSV export, this round-trips accounts, budgets, goals, loans,
 * and investments too.
 */

const BACKUP_APP = "nimulo";
// v2 added bills. Bumped so an older build refuses the file instead of
// restoring it and silently dropping them; v1 files still restore here.
const BACKUP_VERSION = 2;

// Records are checked for an id and otherwise kept as-is, so a backup from a
// slightly newer build with extra fields still restores.
const record = z.object({ id: z.string() }).passthrough();
const records = z.array(record).default([]);

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: z.string().optional(),
  data: z.object({
    profile: z.object({ displayName: z.string() }).passthrough(),
    accounts: records,
    categories: records,
    transactions: records,
    recurringTemplates: records,
    budgets: records,
    goals: records,
    goalContributions: records,
    loans: records,
    loanPayments: records,
    portfolios: records,
    holdings: records,
    trades: records,
    snapshots: records,
    fixedCostRules: records,
    monthlyBills: records,
    billPayments: records,
    billPaymentPostings: records,
  }),
});

export function serializeBackup(data: DemoData, now: Date = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data });
}

export function downloadBackup(data: DemoData, now: Date = new Date()) {
  const blob = new Blob([serializeBackup(data, now)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nimulo-backup-${now.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export class BackupError extends Error {}

/** Parses a backup file's text. Throws BackupError with a Thai message the UI can show as-is. */
export function parseBackup(text: string): DemoData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ nimulo");
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    throw new BackupError("ไฟล์สำรองข้อมูลไม่ถูกต้องหรือเสียหาย");
  }
  return result.data.data as unknown as DemoData;
}

export function summarizeBackup(data: DemoData): string {
  return `บัญชี ${data.accounts.length} · รายการเงิน ${data.transactions.length} · งบประมาณ ${data.budgets.length} · เป้าหมาย ${data.goals.length} · หนี้สิน ${data.loans.length} · พอร์ต ${data.portfolios.length} · บิล ${data.monthlyBills.length}`;
}

import { describe, expect, it } from "vitest";
import { BackupError, parseBackup, serializeBackup } from "@/lib/backup";
import { buildDemoData, buildEmptyDemoData } from "@/lib/demo/seed";

describe("backup", () => {
  it("round-trips the full dataset", () => {
    const data = buildDemoData();
    expect(parseBackup(serializeBackup(data))).toEqual(data);
  });

  it("round-trips an empty dataset", () => {
    const data = buildEmptyDemoData();
    expect(parseBackup(serializeBackup(data))).toEqual(data);
  });

  it("fills collections missing from older backups with empty arrays", () => {
    const data = buildEmptyDemoData();
    const { snapshots: _omit, ...rest } = data;
    void _omit;
    const text = JSON.stringify({ app: "nimulo", version: 1, data: rest });
    expect(parseBackup(text).snapshots).toEqual([]);
  });

  it("restores a v1 backup from before bills existed", () => {
    const { fixedCostRules, monthlyBills, billPayments, billPaymentPostings, ...rest } = buildEmptyDemoData();
    void [fixedCostRules, monthlyBills, billPayments, billPaymentPostings];
    const restored = parseBackup(JSON.stringify({ app: "nimulo", version: 1, data: rest }));
    expect(restored.fixedCostRules).toEqual([]);
    expect(restored.billPaymentPostings).toEqual([]);
  });

  it("rejects backups from a newer format", () => {
    expect(() => parseBackup(JSON.stringify({ app: "nimulo", version: 3, data: buildEmptyDemoData() }))).toThrow(BackupError);
  });

  it("rejects non-JSON, other apps' files, and malformed records", () => {
    expect(() => parseBackup("date,amount\n2026-01-01,100")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: "other", version: 1, data: {} }))).toThrow(BackupError);
    const bad = JSON.parse(serializeBackup(buildEmptyDemoData()));
    bad.data.accounts = [{ name: "no id" }];
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(BackupError);
  });
});

import type { Transaction } from "@/lib/finance/types";

export function transactionsToCsv(transactions: Transaction[], categoryName: (id: string | null | undefined) => string, accountName: (id: string) => string): string {
  const header = ["date", "type", "amount", "account", "to_account", "category", "merchant", "note", "tags"];
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    String(t.amount),
    accountName(t.accountId),
    t.toAccountId ? accountName(t.toAccountId) : "",
    t.type === "transfer" ? "" : categoryName(t.categoryId),
    t.merchant ?? "",
    t.note ?? "",
    t.tags.join("|"),
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedCsvRow {
  date: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  accountName: string;
  categoryName: string;
  merchant: string;
  note: string;
}

/** CSV parser for the import flows. Quoted fields may contain commas, quotes and newlines. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let record: string[] = [];
  let cur = "";
  let inQuotes = false;
  const source = text.replace(/^\ufeff/, "");

  const endRecord = () => {
    record.push(cur);
    cur = "";
    if (record.length > 1 || record[0] !== "") records.push(record);
    record = [];
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch !== '"') cur += ch;
      else if (source[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      record.push(cur);
      cur = "";
    } else if (ch === "\n") endRecord();
    else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || record.length > 0) endRecord();

  const [headers = [], ...rows] = records;
  return { headers, rows };
}

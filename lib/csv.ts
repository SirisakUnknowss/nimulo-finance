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

/** Simple CSV parser (handles quoted fields) for the import preview flow. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  };
  const [headerLine, ...rest] = lines;
  return { headers: parseLine(headerLine), rows: rest.map(parseLine) };
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTHB(amount: number, currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(amount);
}

export function formatDateThai(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function monthLabelThai(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric",
      month: "long",
      timeZone: "Asia/Bangkok",
    }).format(d);
  } catch {
    return period;
  }
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${period}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

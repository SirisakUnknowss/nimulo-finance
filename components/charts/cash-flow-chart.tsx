"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/utils";

export interface CashFlowPoint {
  label: string;
  income: number;
  expenses: number;
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip
          formatter={(v) => formatNumber(Number(v))}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="รายรับ" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="รายจ่าย" fill="var(--danger)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

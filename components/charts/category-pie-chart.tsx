"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/utils";

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatNumber(Number(v))}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

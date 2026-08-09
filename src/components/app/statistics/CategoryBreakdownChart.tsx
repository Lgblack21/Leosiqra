"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/context/ThemeContext";

export interface CategorySlice {
  category: string;
  amount: number;
}

interface CategoryBreakdownChartProps {
  data: CategorySlice[];
}

// Palet kategorikal 8-slot tervalidasi dari skill dataviz (urutan tetap,
// jangan diacak/di-cycle) — dipakai sama di light & dark, cukup kontras di
// keduanya (dicek manual, bukan cuma diasumsikan).
const CATEGORY_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red (dipakai buat slot "Lainnya" kalau ada)
];

const formatCompactIDR = (n: number) => {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}Rb`;
  return `Rp${n}`;
};

const formatFullIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

interface TooltipPayloadItem {
  payload: CategorySlice;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2">
      <p className="text-[11px] font-black text-slate-900 dark:text-white">{item.category}</p>
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{formatFullIDR(item.amount)}</p>
    </div>
  );
}

// Bar horizontal (bukan pie) — untuk data part-to-whole dengan nama kategori
// yang bisa panjang (Bahasa Indonesia), bar chart lebih terbaca di layar
// sempit daripada pie/donut (lihat dataviz skill: choosing-a-form.md).
export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const height = Math.max(data.length * 44, 120);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="category"
          width={92}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? "#cbd5e1" : "#52514e" }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }} />
        <Bar
          dataKey="amount"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{
            position: "right",
            fontSize: 11,
            fontWeight: 700,
            fill: isDark ? "#f1f5f9" : "#0b0b0b",
            formatter: (value: unknown) => formatCompactIDR(Number(value) || 0),
          }}
        >
          {data.map((entry, index) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Ritme pengeluaran: total kumulatif per tanggal bulan terpilih vs bulan
// sebelumnya, plus garis total anggaran bulanan (kalau ada). Nilai dalam IDR.
export type PacePoint = { day: number; now: number | null; prev: number | null };

const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(Math.round(n)));

export function SpendPaceChart({ data, budget, monthShort, prevShort }: { data: PacePoint[]; budget: number; monthShort: string; prevShort: string }) {
  return (
    <div className="h-52 w-full md:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} ticks={[1, 8, 15, 22, data.length]} tickFormatter={(d) => `${d}`} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, budget) * 1.08]} />
          {budget > 0 && (
            <ReferenceLine y={budget} stroke="#f43f5e" strokeDasharray="5 5" strokeOpacity={0.7} label={{ value: `Anggaran ${short(budget)}`, position: 'insideTopLeft', fontSize: 11, fill: '#f43f5e' }} />
          )}
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PacePoint;
              return (
                <div className="rounded-2xl bg-white px-3 py-2 text-[12px] shadow-lg ring-1 ring-slate-200">
                  <p className="font-bold text-slate-900">Tanggal {label}</p>
                  {p.now !== null && <p className="text-indigo-600">{monthShort}: Rp{short(p.now)}</p>}
                  {p.prev !== null && <p className="text-slate-500">{prevShort}: Rp{short(p.prev)}</p>}
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="prev" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="now" stroke="#6366f1" strokeWidth={3} fill="url(#paceFill)" dot={false} activeDot={{ r: 5 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

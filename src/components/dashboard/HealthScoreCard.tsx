"use client";

import { useState } from 'react';
import { ChevronDown, HeartPulse, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthResult } from '@/lib/healthScore';

const GRADE_STYLE: Record<string, { ring: string; chip: string }> = {
  Sehat: { ring: '#10b981', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  Cukup: { ring: '#6366f1', chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  'Perlu perhatian': { ring: '#f59e0b', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  Rawan: { ring: '#f43f5e', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
};
const barColor = (s: number) => (s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-indigo-500' : s >= 40 ? 'bg-amber-500' : 'bg-rose-500');

export function HealthScoreCard({ result, className, compact }: { result: HealthResult; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!result.ready) {
    return (
      <div className={cn('flex items-center gap-3 bg-white p-5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800', compact ? 'rounded-2xl p-4' : 'rounded-[24px]', className)}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-800"><HeartPulse size={20} /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">Skor kesehatan finansial</p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">{result.reason}</p>
        </div>
      </div>
    );
  }
  const st = GRADE_STYLE[result.grade];
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className={cn('bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800', compact ? 'rounded-3xl p-4' : 'rounded-[24px] p-5 md:p-6', className)}>
      <div className="flex items-center gap-4">
        <div className="relative h-[84px] w-[84px] shrink-0">
          <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="42" cy="42" r={r} fill="none" strokeWidth="9" className="stroke-slate-100 dark:stroke-slate-800" />
            <circle cx="42" cy="42" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={st.ring} strokeDasharray={circ} strokeDashoffset={circ * (1 - result.score / 100)} className="transition-[stroke-dashoffset] duration-700" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[24px] font-extrabold leading-none text-slate-900 tabular-nums dark:text-white">{result.score}</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">/100</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-slate-900 dark:text-white">
            Skor kesehatan finansial
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', st.chip)}>{result.grade}</span>
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <span><b className="font-semibold text-slate-800 dark:text-slate-100">{result.weakest.label}:</b> {result.weakest.tip}</span>
          </p>
        </div>
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">
        {open ? 'Sembunyikan rincian' : 'Lihat rincian'} <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="mt-3 space-y-3">
          {result.parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{p.label}</span>
                <span className="tabular-nums text-slate-500">{Math.round(p.score)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={cn('h-full rounded-full', barColor(p.score))} style={{ width: `${Math.max(3, p.score)}%` }} />
              </div>
              <p className="mt-1 text-[12px] text-slate-500">{p.detail}</p>
            </li>
          ))}
          <li className="pt-1 text-[11px] text-slate-400">Panduan kebiasaan dari catatanmu sendiri, bukan nasihat keuangan. Beli/jual investasi, transfer & cicilan hutang tidak dihitung sebagai pemasukan/pengeluaran.</li>
        </ul>
      )}
    </div>
  );
}

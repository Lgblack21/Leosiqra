'use client';

import { cn, toLocalDateString } from '@/lib/utils';
import { lightTap } from '@/lib/haptics';
import type { DebtDue } from '@/lib/debtDue';

// Pilihan jatuh tempo hutang/piutang (opsional): tanpa, sekali (tanggal), atau
// tiap bulan (tanggal 1–31, untuk cicilan). Dipakai form tambah & detail.
const MODES = [
  ['none', 'Tanpa'],
  ['once', 'Sekali'],
  ['monthly', 'Tiap bulan'],
] as const;

const inputClass =
  'w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500';

export function DueDateField({ value, onChange }: { value: DebtDue | null; onChange: (v: DebtDue | null) => void }) {
  const mode = !value ? 'none' : 'date' in value ? 'once' : 'monthly';
  const today = toLocalDateString();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-black text-slate-500 dark:text-slate-400">Jatuh tempo</span>
        <div className="flex gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                lightTap();
                if (m === 'none') onChange(null);
                else if (m === 'once') onChange({ date: value && 'date' in value ? value.date : today });
                else onChange({ day: value && 'day' in value ? value.day : Number(today.slice(8, 10)) });
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-black transition-colors',
                mode === m ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {value && 'date' in value && (
        <input
          type="date"
          value={value.date}
          min={today}
          onChange={(e) => e.target.value && onChange({ date: e.target.value })}
          className={inputClass}
          aria-label="Tanggal jatuh tempo"
        />
      )}
      {value && 'day' in value && (
        <select
          value={value.day}
          onChange={(e) => onChange({ day: Number(e.target.value) })}
          className={inputClass}
          aria-label="Tanggal jatuh tempo tiap bulan"
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Tiap tanggal {d}
            </option>
          ))}
        </select>
      )}
      {value && <p className="text-[11px] text-slate-400 px-1">Kamu diingatkan 3 hari & 1 hari sebelumnya.</p>}
    </div>
  );
}

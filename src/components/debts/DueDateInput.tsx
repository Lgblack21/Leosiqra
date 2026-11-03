"use client";

import { toLocalDateString } from '@/lib/utils';
import type { DebtDue } from '@/lib/debtDue';

// Jatuh tempo hutang/piutang untuk form web (DebtModal, panel Hutang): tanpa,
// sekali (tanggal), atau tiap bulan (tanggal 1–31). Versi app: components/app/debts/DueDateField.
const field = 'w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 transition-all';

export function DueDateInput({ value, onChange }: { value: DebtDue | null; onChange: (v: DebtDue | null) => void }) {
  const today = toLocalDateString();
  const mode = !value ? 'none' : 'date' in value ? 'once' : 'monthly';
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jatuh tempo (opsional)</label>
      <div className="grid grid-cols-2 gap-3">
        <select
          value={mode}
          aria-label="Jenis jatuh tempo"
          onChange={(e) => {
            const m = e.target.value;
            if (m === 'none') onChange(null);
            else if (m === 'once') onChange({ date: value && 'date' in value ? value.date : today });
            else onChange({ day: value && 'day' in value ? value.day : Number(today.slice(8, 10)) });
          }}
          className={field}
        >
          <option value="none">Tanpa jatuh tempo</option>
          <option value="once">Sekali (tanggal)</option>
          <option value="monthly">Tiap bulan</option>
        </select>
        {value && 'date' in value && (
          <input type="date" value={value.date} min={today} onChange={(e) => e.target.value && onChange({ date: e.target.value })} className={field} aria-label="Tanggal jatuh tempo" />
        )}
        {value && 'day' in value && (
          <select value={value.day} onChange={(e) => onChange({ day: Number(e.target.value) })} className={field} aria-label="Tanggal tiap bulan">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Tanggal {d}</option>
            ))}
          </select>
        )}
      </div>
      {value && <p className="text-[11px] text-slate-400 pl-1">Pengingat dikirim 3 hari & 1 hari sebelumnya.</p>}
    </div>
  );
}

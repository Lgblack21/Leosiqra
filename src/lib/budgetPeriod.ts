"use client";

import { useStoredValue } from '@/lib/hooks/useStoredValue';

// Awal periode anggaran (mis. tanggal gajian). Disimpan per perangkat, sama
// seperti preferensi fitur. 1 = bulan kalender biasa. Dibatasi 1–28 supaya
// tanggalnya ada di semua bulan.
export const BUDGET_START_KEY = 'leo-budget-start:v1';

export function useBudgetStart(): [number, (d: number) => void] {
  const [v, set] = useStoredValue(BUDGET_START_KEY);
  const n = Math.min(28, Math.max(1, Number(v) || 1));
  return [n, (d: number) => set(String(Math.min(28, Math.max(1, Math.round(d)))))];
}

// Periode ke-`offset` (0 = yang sedang berjalan) untuk tanggal mulai `start`.
export function budgetPeriod(now: Date, start: number, offset = 0) {
  const base = now.getDate() >= start ? new Date(now.getFullYear(), now.getMonth(), start) : new Date(now.getFullYear(), now.getMonth() - 1, start);
  const from = new Date(base.getFullYear(), base.getMonth() + offset, start);
  const to = new Date(base.getFullYear(), base.getMonth() + offset + 1, start); // eksklusif
  const days = Math.round((+to - +from) / 864e5);
  const isCurrent = offset === 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = isCurrent ? Math.floor((+today - +from) / 864e5) + 1 : days;
  const lastDay = new Date(+to - 864e5);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', o).format(d);
  const label = start === 1
    ? `1 – ${days} ${fmt(from, { month: 'short', year: 'numeric' })}`
    : `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(lastDay, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return { from, to, days, elapsed, daysLeft: isCurrent ? days - elapsed + 1 : 0, isCurrent, lastDay, label, contains: (d: Date) => d >= from && d < to };
}

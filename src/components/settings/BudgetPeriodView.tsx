"use client";

import { useState } from 'react';
import { CalendarRange, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currentBudgetPeriod, formatBudgetPeriod } from '@/lib/budget';
import { useBudgetStartDay } from '@/lib/useBudgetStartDay';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Awal periode anggaran. Grid tanggal 1–28 (29–31 tidak
// ada di setiap bulan); berlaku untuk anggaran bulanan di web, aplikasi HP,
// asisten AI & MCP. Laporan bulanan tetap per bulan kalender.

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export function BudgetPeriodView() {
  const { toast } = useFeedback();
  const { day, save } = useBudgetStartDay();
  const [busy, setBusy] = useState(false);
  const period = currentBudgetPeriod(day);
  const totalDays = Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000);
  const passed = Math.min(totalDays, Math.max(0, Math.floor((Date.now() - period.start.getTime()) / 86_400_000) + 1));

  const pick = async (d: number) => {
    if (busy || d === day) return;
    setBusy(true);
    try {
      await save(d);
      toast.success(d === 1 ? 'Periode anggaran kembali per bulan kalender.' : `Periode anggaran mulai tiap tanggal ${d}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
        <p className="flex items-center gap-2 text-[13px] text-white/80"><CalendarRange size={15} /> Periode berjalan</p>
        <p className="mt-1 text-[22px] font-extrabold">{formatBudgetPeriod(period)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${(passed / totalDays) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-white/80">Hari ke-{passed} dari {totalDays} · sisa {totalDays - passed} hari</p>
      </div>

      <p className="px-1 text-[14px] text-slate-600">Mulai hitung anggaran bulanan tiap tanggal berapa? Biasanya tanggal gajian.</p>

      <div className="grid grid-cols-7 gap-1.5 rounded-[24px] bg-slate-50 p-3">
        {DAYS.map((d) => {
          const on = d === day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => void pick(d)}
              disabled={busy}
              aria-pressed={on}
              aria-label={`Tanggal ${d}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-2xl text-[15px] font-semibold tabular-nums transition',
                on ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-300'
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ d: 1, label: 'Awal bulan' }, { d: 25, label: 'Gajian tgl 25' }, { d: 28, label: 'Akhir bulan (28)' }].map((p) => (
          <button key={p.d} type="button" onClick={() => void pick(p.d)} disabled={busy} className={cn('rounded-full px-3.5 py-2 text-[13px] transition', p.d === day ? 'bg-slate-900 font-semibold text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {p.label}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-slate-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        Berlaku untuk anggaran bulanan (web, aplikasi HP, asisten AI). Tanggal 29–31 tidak tersedia karena tidak ada di setiap bulan. Laporan bulanan tetap per bulan kalender.
      </p>
    </div>
  );
}

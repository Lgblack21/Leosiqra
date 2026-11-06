"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MOODS, moodOf, wibToday, type StoryYear } from '@/lib/stories';
import { cn } from '@/lib/utils';

// Setahun: 12 kalender bulan (Sen–Min), tiap hari = kotak berwarna. Mode "Mood" memakai warna
// cuaca hati; mode "Uang" memakai intensitas pengeluaran hari itu (kuartil setahun).
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const SPEND = ['#E0E7FF', '#A5B4FC', '#6366F1', '#3730A3'];

export function SetahunView({ year, data, onYear, onOpen }: { year: number; data: StoryYear | null; onYear: (y: number) => void; onOpen: (date: string) => void }) {
  const [mode, setMode] = useState<'mood' | 'uang'>('mood');
  const today = wibToday();
  const byDate = new Map((data?.items ?? []).map((i) => [i.date, i]));
  const spends = Object.values(data?.spend ?? {}).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => spends[Math.min(spends.length - 1, Math.floor(p * spends.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const spendColor = (v: number) => (v <= 0 ? null : SPEND[v <= cuts[0] ? 0 : v <= cuts[1] ? 1 : v <= cuts[2] ? 2 : 3]);
  const thisYear = Number(today.slice(0, 4));
  const doy = year === thisYear ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.UTC(year, 0, 1)) / 86400000) + 1 : null;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const written = (data?.items ?? []).length;
  // Tahun berjalan → gulir ke bulan ini (kalender Jan–Des, bulan ini sering di bawah).
  const nowMonth = useRef<HTMLDivElement>(null);
  useEffect(() => { if (year === thisYear) nowMonth.current?.scrollIntoView({ block: 'center' }); }, [year, thisYear]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <button type="button" onClick={() => onYear(year - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Tahun sebelumnya"><ChevronLeft size={16} /></button>
          <span className="w-12 text-center text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{year}</span>
          <button type="button" disabled={year >= thisYear} onClick={() => onYear(year + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Tahun berikutnya"><ChevronRight size={16} /></button>
        </div>
        <p className="text-[12px] text-slate-500">{written} hari bercerita{doy ? ` · hari ke-${doy} dari ${days}` : ''}</p>
        <div className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(['mood', 'uang'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={cn('rounded-full px-3 py-1 text-[12px] font-bold', mode === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500')}>{k === 'mood' ? 'Mood' : 'Uang'}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((name, mi) => {
          const first = new Date(Date.UTC(year, mi, 1));
          const lead = (first.getUTCDay() + 6) % 7; // Senin = 0
          const len = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
          return (
            <div key={name} ref={year === thisYear && mi === Number(today.slice(5, 7)) - 1 ? nowMonth : undefined} className="rounded-[20px] bg-white p-2.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <p className="mb-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-200">{name}</p>
              <div className="grid grid-cols-7 gap-[3px]">
                {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
                {Array.from({ length: len }, (_, di) => {
                  const d = `${year}-${String(mi + 1).padStart(2, '0')}-${String(di + 1).padStart(2, '0')}`;
                  const item = byDate.get(d);
                  const future = d > today;
                  const color = mode === 'mood' ? moodOf(item?.mood)?.color ?? (item ? '#C7D2FE' : null) : spendColor(data?.spend?.[d] ?? 0);
                  return (
                    <button key={d} type="button" disabled={future} onClick={() => onOpen(d)} title={d}
                      aria-label={`${di + 1} ${name}${item ? ' · ada cerita' : ''}`}
                      className={cn('aspect-square rounded-[4px] transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100', d === today && 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900', !color && (future ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-slate-100 dark:bg-slate-800'))}
                      style={color ? { background: color } : undefined} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 text-[11px] text-slate-500">
        {mode === 'mood' ? (
          <>{MOODS.map((m) => <span key={m.id} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: m.color }} />{m.emoji} {m.label}</span>)}<span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#C7D2FE]" />tanpa mood</span></>
        ) : (
          <>Pengeluaran:{SPEND.map((c, i) => <span key={c} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{['rendah', 'sedang', 'tinggi', 'paling tinggi'][i]}</span>)}</>
        )}
      </div>
    </div>
  );
}

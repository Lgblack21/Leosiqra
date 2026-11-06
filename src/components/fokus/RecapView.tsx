"use client";

import { useState } from 'react';
import { Flame, Timer, Trash2, TrendingUp } from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { FOCUS_KINDS, deleteSession, fmtMin, isServerReady, summarize, todayWib, type FocusSession } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

const card = 'rounded-[28px] bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800';
const KIND = new Map(FOCUS_KINDS.map((k) => [k.id, k]));

export function RecapView({ sessions, onStart }: { sessions: FocusSession[]; onStart: () => void }) {
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const sum = summarize(sessions);
  const max = Math.max(1500, ...sum.week.map((w) => w.sec));
  const today = todayWib();
  const ready = isServerReady();

  if (!sessions.length) {
    return (
      <section className={cn(card, 'flex flex-col items-center px-6 py-10 text-center')}>
        <LeoMascot mood="idle" size={130} />
        <p className="mt-2 text-[17px] font-bold text-slate-900 dark:text-white">Belum ada sesi fokus</p>
        <p className="mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">Mulai satu sesi — Leo yang mencatat berapa lama kamu fokus, beruntun berapa hari, dan buat apa saja.</p>
        <button type="button" onClick={onStart} className="mt-5 rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white dark:bg-white dark:text-slate-900">Mulai fokus</button>
      </section>
    );
  }

  const remove = async (id: string) => {
    setErr('');
    try { await deleteSession(id); setAsk(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal menghapus.'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5 md:gap-4">
        {[
          { icon: Timer, label: 'Hari ini', value: fmtMin(sum.todaySec), sub: `${sum.todayDone} sesi selesai`, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/15 dark:text-indigo-300' },
          { icon: TrendingUp, label: '7 hari', value: fmtMin(sum.weekSec), sub: `rata-rata ${fmtMin(sum.weekSec / 7)}/hari`, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300' },
          { icon: Flame, label: 'Beruntun', value: `${sum.streak} hari`, sub: 'min. 10 mnt/hari', tone: 'text-orange-600 bg-orange-50 dark:bg-orange-500/15 dark:text-orange-300' },
        ].map(({ icon: Icon, label, value, sub, tone }) => (
          <div key={label} className={cn(card, 'min-w-0 p-3.5 md:p-5')}>
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', tone)}><Icon size={16} /></span>
            <p className="mt-2 text-[12px] font-semibold text-slate-500">{label}</p>
            <p className="truncate text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[22px]">{value}</p>
            <p className="truncate text-[11px] text-slate-400 md:text-[12px]">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={cn(card, 'p-4 md:p-5')}>
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">7 hari terakhir</p>
          <div className="mt-4 flex h-40 items-end gap-2 md:gap-3">
            {sum.week.map((w) => (
              <div key={w.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-slate-400">{w.sec ? Math.round(w.sec / 60) : ''}</span>
                <div className={cn('w-full max-w-[38px] rounded-xl transition-[height] duration-500', w.date === today ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-500/40')} style={{ height: `${Math.max(w.sec ? 6 : 3, (w.sec / max) * 100)}%` }} />
                <span className={cn('text-[11px] font-semibold', w.date === today ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400')}>{w.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Angka di atas batang = menit fokus.</p>
        </section>

        <section className={cn(card, 'p-4 md:p-5')}>
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">Buat apa saja (7 hari)</p>
          <div className="mt-3 space-y-2.5">
            {sum.byKind.length === 0 && <p className="text-[13px] text-slate-400">Belum ada sesi minggu ini.</p>}
            {sum.byKind.map(([k, sec]) => (
              <div key={k}>
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{KIND.get(k)?.emoji} {KIND.get(k)?.label}</span>
                  <span className="tabular-nums text-slate-500">{fmtMin(sec)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(sec / Math.max(1, sum.weekSec)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={cn(card, 'p-4 md:p-5')}>
        <p className="text-[15px] font-bold text-slate-900 dark:text-white">Riwayat</p>
        {err && <p role="alert" className="mt-2 text-[12px] font-semibold text-rose-600">{err}</p>}
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {sessions.slice(0, 40).map((s) => {
            const k = KIND.get(s.kind);
            const d = new Date(s.started_at);
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[17px] dark:bg-slate-800" aria-hidden>{k?.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">{s.label || k?.label}</span>
                  <span className="block truncate text-[12px] text-slate-400">{d.toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{s.completed ? '' : ' · dihentikan'}</span>
                </span>
                <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', s.completed ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>{fmtMin(s.focus_sec)}</span>
                {ask === s.id ? (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setAsk(null)} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Batal</button>
                    <button type="button" onClick={() => remove(s.id)} className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">Hapus</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setAsk(s.id)} className="shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800" aria-label="Hapus sesi"><Trash2 size={15} /></button>
                )}
              </li>
            );
          })}
        </ul>
        {ready === false && <p className="mt-2 text-[11px] text-amber-600">Rekap disimpan di perangkat ini dulu — otomatis tersinkron setelah server siap.</p>}
      </section>
    </div>
  );
}

'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, X } from 'lucide-react';
import { HARI_LIBUR, hariKerjaSebelum, liburBerikutnya, parseYmd, rentangLibur, ymd } from '@/lib/hariLibur';
import { cn } from '@/lib/utils';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  d.toLocaleDateString('id-ID', o);
// Dihitung di browser saja (build statis tidak tahu "hari ini"); di-cache per tanggal supaya snapshot stabil.
let cache: { key: string; value: ReturnType<typeof liburBerikutnya> } | null = null;
const snapshot = () => {
  const key = ymd(new Date());
  if (cache?.key !== key) cache = { key, value: liburBerikutnya(new Date()) };
  return cache.value;
};
const noop = () => () => {};
const dayDiff = (a: Date, b: Date) => Math.round((parseYmd(ymd(b)).getTime() - parseYmd(ymd(a)).getTime()) / 86400_000);

// Kartu "Libur berikutnya" (Ringkasan web & Beranda HP): tanggal merah terdekat, libur panjang,
// saran keuangan (bayar sebelum bank libur, siapkan anggaran liburan), dan daftar setahun.
export function LiburCard({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const next = useSyncExternalStore(noop, snapshot, () => null);
  if (!next) return null;
  const n = dayDiff(now, next.mulai);
  const sedang = n <= 0;
  const kapan = sedang ? 'Sedang libur' : n === 1 ? 'Besok' : `${n} hari lagi`;
  const panjang = next.hari >= 3;
  const bayar = hariKerjaSebelum(next.mulai);
  const nama = next.libur.map((l) => l.nama).join(' · ');
  return (
    <>
      <section
        className={cn(
          'overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
          variant === 'app' ? 'p-4' : 'p-5',
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="fs-10 font-black uppercase leading-none">{fmt(next.mulai, { month: 'short' })}</span>
            <span className="fsh-20 font-black leading-tight">{next.mulai.getDate()}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="fs-11.5 font-bold uppercase tracking-wider text-slate-400">Libur berikutnya · {kapan}</p>
            <p className="truncate fs-15 font-black text-slate-900 dark:text-white">{nama}</p>
            <p className="fs-12.5 text-slate-500">
              {fmt(next.mulai)}
              {next.hari > 1 ? ` – ${fmt(next.selesai)}` : ''} · {next.hari} hari
              {panjang ? ' · libur panjang 🎉' : ''}
            </p>
          </div>
        </div>
        {!sedang ? (
          <ul className="mt-3 space-y-1.5 fs-12.5 text-slate-600 dark:text-slate-300">
            <li>🏦 Bank tutup — transfer & bayar tagihan paling aman sebelum {fmt(bayar)}.</li>
            {panjang && n <= 45 ? (
              <li>
                🧳 {next.hari} hari libur —{' '}
                <Link
                  href={variant === 'app' ? '/app/budget' : '/membership/budget'}
                  className="font-bold text-indigo-600"
                >
                  siapkan anggaran liburan
                </Link>{' '}
                biar tidak kebablasan.
              </li>
            ) : null}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 fs-12.5 font-bold text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
        >
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} /> Semua tanggal merah
          </span>
          <ChevronRight size={15} />
        </button>
      </section>
      {open ? <KalenderLibur onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function KalenderLibur({ onClose }: { onClose: () => void }) {
  const years = [...new Set(HARI_LIBUR.map((h) => Number(h.date.slice(0, 4))))];
  const [year, setYear] = useState(() =>
    years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years[0],
  );
  const list = HARI_LIBUR.filter((h) => h.date.startsWith(String(year)));
  const panjang = rentangLibur(new Date(year, 0, 1), new Date(year + 1, 0, 1)).filter((r) => r.hari >= 3);
  const today = ymd(new Date());
  const months = [...new Set(list.map((h) => h.date.slice(0, 7)))];
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#f6f5f1] sm:max-w-lg sm:rounded-[28px] dark:bg-slate-950"
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <p className="min-w-0 flex-1 fsh-20 font-black">Tanggal merah</p>
          <div className="flex rounded-full bg-slate-200/70 p-0.5 dark:bg-slate-800">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  'h-8 rounded-full px-3 fs-12.5 font-bold',
                  year === y ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500',
                )}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-200/70"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-1">
          <p className="fs-12.5 text-slate-500">
            {list.filter((h) => h.jenis === 'libur').length} libur nasional ·{' '}
            {list.filter((h) => h.jenis === 'cuti').length} cuti bersama · {panjang.length} libur panjang. Sesuai SKB 3
            Menteri {year}.
          </p>
          {panjang.length ? (
            <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <p className="mb-1.5 fs-12.5 font-black">🎉 Libur panjang</p>
              {panjang.map((r) => (
                <p key={ymd(r.mulai)} className="flex justify-between gap-2 py-0.5 fs-12.5">
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                    {r.libur.map((l) => l.nama).join(' + ')}
                  </span>
                  <span className="shrink-0 font-bold">
                    {fmt(r.mulai, { day: 'numeric', month: 'short' })}–
                    {fmt(r.selesai, { day: 'numeric', month: 'short' })} · {r.hari} hari
                  </span>
                </p>
              ))}
            </section>
          ) : null}
          {months.map((m) => (
            <section key={m}>
              <p className="mb-1.5 fs-12 font-black uppercase tracking-wider text-slate-400">
                {fmt(parseYmd(`${m}-01`), { month: 'long', year: 'numeric' })}
              </p>
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                {list
                  .filter((h) => h.date.startsWith(m))
                  .map((h) => (
                    <div
                      key={h.date + h.jenis}
                      className={cn(
                        'flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 dark:border-slate-800',
                        h.date < today && 'opacity-50',
                      )}
                    >
                      <span className="w-20 shrink-0 fs-12.5 font-bold">{fmt(parseYmd(h.date))}</span>
                      <span className="min-w-0 flex-1 fs-13">{h.nama}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 fs-11 font-bold',
                          h.jenis === 'libur' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {h.jenis === 'libur' ? 'Libur' : 'Cuti bersama'}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

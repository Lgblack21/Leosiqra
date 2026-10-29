"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Flame, Leaf } from 'lucide-react';
import type { Transaction } from '@/lib/services/transactionService';
import { categoryVisual } from '@/lib/categoryEmoji';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// Bagian tambahan Laporan: kalender gelembung (bulanan), pola mingguan, dan
// podium pengeluaran terbesar. Semua menerima daftar pengeluaran periode yang
// sudah disaring halaman (tanpa transfer/investasi), nominal dalam IDR.

const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt` : n >= 1e3 ? `${Math.round(n / 1e3)}rb` : `${Math.round(n)}`;
const rp = (n: number) => `Rp${short(n)}`;
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DOW_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayIdx = (d: Date) => (d.getDay() + 6) % 7; // Senin = 0

// ===== Kalender gelembung =====
export function BubbleCalendar({ spend, year, month, now }: { spend: Transaction[]; year: number; month: number; now: Date | null }) {
  const days = new Date(year, month + 1, 0).getDate();
  const isCurMonth = !!now && now.getFullYear() === year && now.getMonth() === month;
  const isFuture = !!now && (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth()));
  const lastDay = isFuture ? 0 : isCurMonth ? now!.getDate() : days;

  const byDay = Array.from({ length: days + 1 }, () => [] as Transaction[]);
  for (const t of spend) {
    const d = new Date(t.date);
    if (d.getFullYear() === year && d.getMonth() === month) byDay[d.getDate()].push(t);
  }
  const totals = byDay.map((l) => l.reduce((s, t) => s + idr(t), 0));
  const past = totals.slice(1, lastDay + 1);
  const avg = past.length ? past.reduce((s, v) => s + v, 0) / past.length : 0;
  const max = Math.max(1, ...past);
  const hemat = past.filter((v) => v === 0).length;
  const hot = past.filter((v) => avg > 0 && v > avg * 1.5).length;
  const peakDay = past.length ? past.indexOf(Math.max(...past)) + 1 : 0;

  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked && picked <= lastDay ? picked : (isCurMonth ? lastDay : peakDay || null);
  const offset = dayIdx(new Date(year, month, 1));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const selList = sel ? [...byDay[sel]].sort((a, b) => idr(b) - idr(a)) : [];
  const ymd = (d: number) => toLocalDateString(new Date(year, month, d));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Kalender belanja</h2>
          <p className="text-[14px] text-slate-500">Makin besar gelembung, makin besar belanja hari itu. Ketuk untuk rinciannya.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
        <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">Rata-rata {rp(avg)}/hari</span>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"><Leaf size={12} /> {hemat} hari hemat</span>
        {hot > 0 && <span className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700"><Flame size={12} /> {hot} hari boros</span>}
        {peakDay > 0 && totals[peakDay] > 0 && (
          <button type="button" onClick={() => setPicked(peakDay)} className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-100">
            Tertinggi tgl {peakDay} · {rp(totals[peakDay])}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-[24px] bg-white p-3 ring-1 ring-slate-100 md:p-5">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-semibold text-slate-400">
          {DOW.map((d, i) => <span key={d} className={cn(i >= 5 && 'text-indigo-400')}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />;
            const v = totals[d];
            const future = d > lastDay;
            const today = isCurMonth && d === lastDay;
            const size = v > 0 ? 34 + Math.sqrt(v / max) * 58 : 0; // % dari sel
            const hotDay = avg > 0 && v > avg * 1.5;
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                onClick={() => setPicked(d)}
                aria-label={`${d}: ${future ? 'belum lewat' : formatIDR(v)}`}
                className={cn(
                  'relative flex aspect-square items-center justify-center rounded-2xl transition-colors md:aspect-[1.25/1]',
                  sel === d ? 'bg-slate-900/[0.06] ring-2 ring-slate-900/70' : 'hover:bg-slate-50',
                  future && 'cursor-default opacity-40'
                )}
              >
                <span className={cn('absolute left-1.5 top-1 text-[10px] font-bold md:left-2 md:text-[11px]', today ? 'text-indigo-600' : 'text-slate-400')}>{d}</span>
                {future ? (
                  <span className="h-2 w-2 rounded-full border border-dashed border-slate-300" />
                ) : v === 0 ? (
                  <span className="flex aspect-square h-[38%] items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={12} strokeWidth={3} /></span>
                ) : (
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full text-white shadow-sm transition-transform',
                      hotDay ? 'bg-gradient-to-br from-rose-400 to-rose-600' : 'bg-gradient-to-br from-indigo-400 to-violet-600',
                      sel === d && 'scale-105'
                    )}
                    style={{ height: `${Math.min(92, size)}%`, aspectRatio: '1 / 1' }}
                  >
                    <span className="hidden text-[10px] font-bold tabular-nums md:inline">{short(v)}</span>
                  </span>
                )}
                {today && (
                  <>
                    <span className="pointer-events-none absolute inset-0.5 rounded-2xl ring-2 ring-indigo-500" aria-hidden />
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Rincian hari terpilih */}
        {sel && (
          <div className="mt-4 rounded-[20px] bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-bold text-slate-900">
                {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(year, month, sel))}
              </p>
              <p className={cn('text-[15px] font-extrabold tabular-nums', totals[sel] === 0 ? 'text-emerald-600' : 'text-slate-900')}>
                {totals[sel] === 0 ? 'Hari hemat 🌿' : formatIDR(totals[sel])}
              </p>
            </div>
            {avg > 0 && totals[sel] > 0 && (
              <p className={cn('text-[12px] font-semibold', totals[sel] > avg ? 'text-rose-600' : 'text-emerald-600')}>
                {totals[sel] > avg ? `${Math.round((totals[sel] / avg - 1) * 100)}% di atas rata-rata` : `${Math.round((1 - totals[sel] / avg) * 100)}% di bawah rata-rata`}
              </p>
            )}
            {selList.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {selList.slice(0, 4).map((t) => {
                  const v = categoryVisual(t.category, 'pengeluaran');
                  return (
                    <li key={t.id} className="flex items-center gap-2.5">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{t.note || t.category}</span>
                      <span className="text-[13px] font-semibold tabular-nums text-slate-900">{formatIDR(idr(t))}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {selList.length > 0 && (
              <Link href={`/membership/transactions/daily?tanggal=${ymd(sel)}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-indigo-600 hover:underline">
                {selList.length > 4 ? `Semua ${selList.length} transaksi` : 'Lihat di Transaksi'} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ===== Pola mingguan =====
export function WeekdayPattern({ spend }: { spend: Transaction[] }) {
  const data = useMemo(() => {
    const sum = Array(7).fill(0) as number[];
    const daysSeen = Array.from({ length: 7 }, () => new Set<string>());
    for (const t of spend) {
      const d = new Date(t.date);
      const i = dayIdx(d);
      sum[i] += idr(t);
      daysSeen[i].add(toLocalDateString(d));
    }
    // Rata-rata per hari yang ada belanjanya di hari itu.
    return sum.map((s, i) => (daysSeen[i].size ? s / daysSeen[i].size : 0));
  }, [spend]);
  const max = Math.max(1, ...data);
  if (data.every((v) => v === 0)) return null;
  const top = data.indexOf(Math.max(...data));
  const low = data.reduce((best, v, i) => (v > 0 && (data[best] === 0 || v < data[best]) ? i : best), 0);
  const weekend = (data[5] + data[6]) / 2;
  const weekday = data.slice(0, 5).reduce((s, v) => s + v, 0) / 5;

  return (
    <section>
      <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Pola mingguan</h2>
      <p className="text-[14px] text-slate-500">
        Paling boros hari <b className="text-slate-700">{DOW_LONG[top]}</b>, paling hemat hari <b className="text-slate-700">{DOW_LONG[low]}</b>
        {weekday > 0 && weekend > weekday * 1.2 ? ` · akhir pekan ${Math.round((weekend / weekday - 1) * 100)}% lebih boros` : ''}.
      </p>
      <div className="mt-4 flex h-44 items-end gap-2 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 md:gap-4 md:p-6">
        {data.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cn('text-[11px] font-bold tabular-nums', i === top ? 'text-rose-600' : 'text-slate-400')}>{v > 0 ? short(v) : ''}</span>
            <div
              className={cn('w-full max-w-[44px] rounded-t-xl rounded-b-md', i === top ? 'bg-gradient-to-t from-rose-500 to-orange-400' : i >= 5 ? 'bg-indigo-300' : 'bg-indigo-500')}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            />
            <span className={cn('text-[12px] font-semibold', i === top ? 'text-slate-900' : 'text-slate-500')}>{DOW[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== Podium pengeluaran terbesar =====
export function TopExpenses({ spend }: { spend: Transaction[] }) {
  const top = useMemo(() => [...spend].sort((a, b) => idr(b) - idr(a)).slice(0, 6), [spend]);
  if (top.length === 0) return null;
  const max = idr(top[0]);
  const medal = ['🥇', '🥈', '🥉'];
  const podium = [top[1], top[0], top[2]].filter(Boolean) as Transaction[];
  const when = (t: Transaction) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date));

  return (
    <section>
      <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Pengeluaran terbesar</h2>
      <p className="text-[14px] text-slate-500">Pembayaran tunggal paling besar di periode ini</p>
      <div className="mt-4 grid grid-cols-3 items-end gap-2 md:gap-4">
        {podium.map((t) => {
          const rank = top.indexOf(t);
          const v = categoryVisual(t.category, 'pengeluaran');
          return (
            <div
              key={t.id}
              className={cn(
                'flex flex-col items-center rounded-[24px] px-2 pb-4 text-center ring-1',
                rank === 0 ? 'bg-gradient-to-b from-amber-50 to-white pt-6 ring-amber-200 md:pt-8' : 'bg-white pt-4 ring-slate-100'
              )}
            >
              <span className="text-[26px] leading-none md:text-[30px]" aria-label={`Peringkat ${rank + 1}`}>{medal[rank]}</span>
              <span className={cn('mt-2 flex h-11 w-11 items-center justify-center rounded-2xl text-[20px] md:h-12 md:w-12', v.tile)} aria-hidden>{v.emoji}</span>
              <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900 md:text-[14px]">{t.note || t.category}</p>
              <p className="text-[11px] text-slate-500">{when(t)} · {t.category}</p>
              <p className={cn('mt-1.5 font-extrabold tabular-nums text-slate-900', rank === 0 ? 'text-[16px] md:text-[20px]' : 'text-[14px] md:text-[17px]')}>{formatIDR(idr(t))}</p>
            </div>
          );
        })}
      </div>
      {top.length > 3 && (
        <ul className="mt-3 space-y-2">
          {top.slice(3).map((t, i) => {
            const v = categoryVisual(t.category, 'pengeluaran');
            return (
              <li key={t.id} className="relative overflow-hidden rounded-[18px] bg-white px-4 py-2.5 ring-1 ring-slate-100">
                <span aria-hidden className="absolute inset-y-0 left-0 bg-indigo-50" style={{ width: `${(idr(t) / max) * 100}%` }} />
                <div className="relative flex items-center gap-3">
                  <span className="w-5 text-center text-[12px] font-bold text-slate-400">{i + 4}</span>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]', v.tile)} aria-hidden>{v.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">{t.note || t.category}</span>
                    <span className="block text-[12px] text-slate-500">{when(t)} · {t.category}</span>
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">{formatIDR(idr(t))}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

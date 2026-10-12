"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { budgetService, type Budget } from '@/lib/services/budgetService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { Skeleton } from '@/components/ui/Skeleton';

// Laporan bulanan: heatmap pengeluaran per hari, tren kumulatif vs bulan lalu
// (plus garis anggaran), kategori, tempat teratas, dan pengeluaran terbesar.
// Semua dihitung di browser dari transaksi yang sudah ada — baca saja.

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const HEAT = ['bg-slate-50 text-slate-400', 'bg-violet-100 text-violet-700', 'bg-violet-300 text-violet-900', 'bg-violet-500 text-white', 'bg-violet-700 text-white'];
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const isExpense = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category);
const short = (n: number) =>
  n >= 1e9 ? `Rp${(n / 1e9).toFixed(1).replace('.', ',')} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(1).replace('.', ',')} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : `Rp${Math.round(n)}`;

export default function LaporanPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setAll).catch(() => setAll([]));
    load();
    budgetService.getUserBudgets('session').then(setBudgets).catch(() => {});
    return subscribeToCollectionChanges('transactions', load);
  }, []);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setSelectedDay(null);
  };

  const r = useMemo(() => {
    const inMonth = (t: Transaction, y: number, m: number) => {
      const d = new Date(t.date);
      return d.getFullYear() === y && d.getMonth() === m;
    };
    const prev = new Date(year, month - 1, 1);
    const cur = (all ?? []).filter((t) => inMonth(t, year, month));
    const prv = (all ?? []).filter((t) => inMonth(t, prev.getFullYear(), prev.getMonth()));
    const curExp = cur.filter(isExpense);
    const prvExp = prv.filter(isExpense);
    const days = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    const isCurrent = year === now.getFullYear() && month === now.getMonth();
    const elapsed = isCurrent ? now.getDate() : days;

    const daily = Array.from({ length: days }, () => 0);
    for (const t of curExp) daily[new Date(t.date).getDate() - 1] += toIdr(t);
    const prevDaily = Array.from({ length: prevDays }, () => 0);
    for (const t of prvExp) prevDaily[new Date(t.date).getDate() - 1] += toIdr(t);

    let a = 0;
    let b = 0;
    const trend = Array.from({ length: days }, (_, i) => {
      a += daily[i];
      b += i < prevDays ? prevDaily[i] : 0;
      return { day: i + 1, ini: i < elapsed ? a : null, lalu: b };
    });

    const total = daily.reduce((s, v) => s + v, 0);
    const prevTotal = prevDaily.reduce((s, v) => s + v, 0);
    const prevSameDay = prevDaily.slice(0, Math.min(elapsed, prevDays)).reduce((s, v) => s + v, 0);
    const income = cur.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);

    const byCat = new Map<string, { name: string; total: number; prev: number }>();
    for (const t of curExp) {
      const k = (t.category || 'Lainnya').toLowerCase();
      const e = byCat.get(k) ?? { name: t.category || 'Lainnya', total: 0, prev: 0 };
      e.total += toIdr(t);
      byCat.set(k, e);
    }
    for (const t of prvExp) {
      const k = (t.category || 'Lainnya').toLowerCase();
      const e = byCat.get(k);
      if (e) e.prev += toIdr(t);
    }
    const categories = [...byCat.values()].sort((x, y) => y.total - x.total);

    const byPlace = new Map<string, { name: string; total: number; count: number }>();
    for (const t of curExp) {
      const label = (t.note || t.subCategory || t.category || '').trim();
      if (!label) continue;
      const k = label.toLowerCase();
      const e = byPlace.get(k) ?? { name: label, total: 0, count: 0 };
      e.total += toIdr(t);
      e.count++;
      byPlace.set(k, e);
    }
    const places = [...byPlace.values()].sort((x, y) => y.count - x.count || y.total - x.total).slice(0, 5);
    const biggest = [...curExp].sort((x, y) => toIdr(y) - toIdr(x)).slice(0, 5);

    const budgetCap = budgets
      .filter((bb) => bb.type === 'pengeluaran')
      .reduce((s, bb) => s + (bb.period === 'yearly' ? bb.amount / 12 : bb.amount), 0);

    return { cur, curExp, days, elapsed, isCurrent, daily, trend, total, prevTotal, prevSameDay, income, categories, places, biggest, budgetCap };
    // `now` hanya dipakai untuk tanggal hari ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, budgets, month, year]);

  const loading = all === null;
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const max = Math.max(1, ...r.daily);
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const diff = r.total - r.prevSameDay;
  const dayTx = selectedDay ? r.cur.filter((t) => t.type !== 'debt' && new Date(t.date).getDate() === selectedDay) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
          <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm">Bulanan</span>
          <Link href="/membership/annual" className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <CalendarRange size={14} /> Tahunan
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <span className="min-w-[140px] text-center text-sm font-bold capitalize text-slate-900">{label}</span>
          <button type="button" onClick={() => shiftMonth(1)} disabled={r.isCurrent} aria-label="Bulan berikutnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Total + heatmap */}
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-3">
          <p className="text-sm font-semibold text-slate-500">Pengeluaran</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-52" />
          ) : (
            <p className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900 tabular-nums">{formatIDR(r.total)}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>rata-rata {formatIDR(r.total / Math.max(1, r.elapsed))}/hari</span>
            {r.prevSameDay > 0 && (
              <span className={cn('flex items-center gap-0.5 font-semibold', diff > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                {diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(Math.round((diff / r.prevSameDay) * 100))}% vs bulan lalu di tanggal yang sama
              </span>
            )}
          </p>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => <span key={w} className="text-center text-xs font-semibold text-slate-400">{w}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
            {r.daily.map((v, i) => {
              const future = r.isCurrent && i + 1 > r.elapsed;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={future}
                  onClick={() => setSelectedDay(selectedDay === i + 1 ? null : i + 1)}
                  title={`${i + 1} ${label}: ${formatIDR(v)}`}
                  className={cn(
                    'flex aspect-[1.25] flex-col justify-between rounded-xl p-1.5 text-left transition-transform hover:scale-[1.04] disabled:cursor-default disabled:hover:scale-100',
                    future ? 'bg-white text-slate-300 ring-1 ring-slate-100' : HEAT[level(v)],
                    selectedDay === i + 1 && 'ring-2 ring-slate-900',
                    r.isCurrent && i + 1 === r.elapsed && selectedDay !== i + 1 && 'ring-2 ring-indigo-400'
                  )}
                >
                  <span className="text-[11px] font-bold">{i + 1}</span>
                  {v > 0 && <span className="hidden truncate text-[10px] font-semibold sm:block">{short(v)}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            sedikit {HEAT.map((h, i) => <span key={i} className={cn('h-3 w-5 rounded', h.split(' ')[0])} />)} banyak
          </div>

          {selectedDay && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-slate-900">{selectedDay} {label}</p>
              {dayTx.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada transaksi.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayTx.map((t, i) => (
                    <li key={t.id || i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700">{categoryEmoji(t.category)} {t.note || t.category} <span className="text-slate-400">· {t.category}</span></span>
                      <span className={cn('shrink-0 font-bold tabular-nums', t.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-500')}>
                        {t.type === 'pemasukan' ? '+' : '−'}{formatIDR(toIdr(t))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Kategori */}
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-2">
          <p className="font-bold text-slate-900">Kategori</p>
          <p className="mb-4 text-xs text-slate-400">Pemasukan {formatIDR(r.income)} · sisa {formatIDR(r.income - r.total)}</p>
          {loading ? (
            <Skeleton className="h-40" />
          ) : r.categories.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <ul className="space-y-3.5">
              {r.categories.slice(0, 7).map((c) => {
                const pct = r.total > 0 ? (c.total / r.total) * 100 : 0;
                const delta = c.prev > 0 ? Math.round(((c.total - c.prev) / c.prev) * 100) : null;
                return (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-bold text-slate-800">{categoryEmoji(c.name)} {c.name}</span>
                      <span className="shrink-0 font-extrabold text-slate-900 tabular-nums">{formatIDR(c.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {Math.round(pct)}% dari total
                      {delta !== null && <span className={delta > 0 ? 'text-rose-500' : 'text-emerald-600'}> · {delta > 0 ? '+' : ''}{delta}% vs bulan lalu</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Tren */}
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-bold text-slate-900">Tren pengeluaran</p>
            <p className="text-xs text-slate-400">Kumulatif harian, dibandingkan bulan lalu{r.budgetCap > 0 ? ' dan anggaran' : ''}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-violet-600" /> Bulan ini</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-slate-300" /> Bulan lalu ({formatIDR(r.prevTotal)})</span>
          </div>
        </div>
        <div className="mt-4 h-64">
          {loading ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={r.trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                <YAxis domain={[0, (dataMax: number) => Math.max(dataMax, r.budgetCap) * 1.08]} tickFormatter={(v) => short(Number(v))} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v, n) => [formatIDR(Number(v)), n === 'ini' ? 'Bulan ini' : 'Bulan lalu']} labelFormatter={(d) => `Tanggal ${d}`} />
                {r.budgetCap > 0 && (
                  <ReferenceLine y={r.budgetCap} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `Anggaran ${short(r.budgetCap)}`, position: 'insideTopRight', fontSize: 11, fill: '#b45309' }} />
                )}
                <Line type="monotone" dataKey="lalu" stroke="#cbd5e1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ini" stroke="#7c3aed" strokeWidth={3} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="font-bold text-slate-900">Paling sering</p>
          <p className="mb-3 text-xs text-slate-400">Dikelompokkan dari catatan transaksi</p>
          {r.places.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {r.places.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.count}× transaksi</span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-slate-900 tabular-nums">{formatIDR(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <p className="font-bold text-slate-900">Pengeluaran terbesar</p>
          <p className="mb-3 text-xs text-slate-400">Pembayaran tunggal terbesar bulan ini</p>
          {r.biggest.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {r.biggest.map((t, i) => (
                <li key={t.id || i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{categoryEmoji(t.category)} {t.note || t.category}</span>
                    <span className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date))} · {t.category}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-rose-500 tabular-nums">−{formatIDR(toIdr(t))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

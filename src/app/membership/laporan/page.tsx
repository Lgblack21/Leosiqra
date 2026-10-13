"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { DayReviewModal } from '@/components/reports/DayReviewModal';

// Laporan gaya baru (pola Oyenza): Bulanan/Tahunan, pengeluaran vs pemasukan,
// heatmap harian (klik → ringkasan hari + "Lihat harinya"), tren kumulatif vs
// periode lalu, donat "Komposisi pengeluaran" + daftar kategori (klik → Transaksi
// tersaring), tempat teratas, pengeluaran terbesar. Baca saja.

type Mode = 'bulan' | 'tahun';
const COLORS = ['#6366f1', '#0ea5e9', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const HEAT = ['bg-slate-100', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-500'];

const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const isExpense = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category);
const short = (n: number) =>
  n >= 1e9 ? `Rp${(n / 1e9).toFixed(2).replace('.', ',')} M` : n >= 1e6 ? `Rp${(n / 1e6).toFixed(2).replace('.', ',')} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : `Rp${Math.round(n)}`;

export default function LaporanPage() {
  const reduce = useReducedMotion();
  const now = new Date();
  const [mode, setMode] = useState<Mode>('bulan');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [day, setDay] = useState<{ d: number; x: number; y: number } | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [review, setReview] = useState<Date | null>(null);
  const [selM, setSelM] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setAll).catch(() => setAll([]));
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    return subscribeToCollectionChanges('transactions', load);
  }, []);

  const isCurrent = mode === 'bulan' ? year === now.getFullYear() && month === now.getMonth() : year === now.getFullYear();
  const shift = (d: number) => {
    setDay(null);
    if (mode === 'tahun') return setYear((y) => y + d);
    const x = new Date(year, month + d, 1);
    setMonth(x.getMonth());
    setYear(x.getFullYear());
  };
  const periodLabel = mode === 'bulan' ? `${MONTHS[month]} '${String(year).slice(2)}` : String(year);
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '';

  const r = useMemo(() => {
    const txs = all ?? [];
    const inRange = (t: Transaction, y: number, m: number | null) => {
      const d = new Date(t.date);
      return d.getFullYear() === y && (m === null || d.getMonth() === m);
    };
    const prevY = mode === 'bulan' ? new Date(year, month - 1, 1).getFullYear() : year - 1;
    const prevM = mode === 'bulan' ? new Date(year, month - 1, 1).getMonth() : null;
    const cur = txs.filter((t) => inRange(t, year, mode === 'bulan' ? month : null));
    const prv = txs.filter((t) => inRange(t, prevY, prevM));
    const exp = cur.filter(isExpense);
    const total = exp.reduce((s, t) => s + toIdr(t), 0);
    const income = cur.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);

    // satuan waktu: hari (bulanan) / bulan (tahunan)
    const units = mode === 'bulan' ? new Date(year, month + 1, 0).getDate() : 12;
    const prevUnits = mode === 'bulan' ? new Date(prevY, (prevM ?? 0) + 1, 0).getDate() : 12;
    const elapsed = !isCurrent ? units : mode === 'bulan' ? now.getDate() : now.getMonth() + 1;
    const unitOf = (t: Transaction) => (mode === 'bulan' ? new Date(t.date).getDate() - 1 : new Date(t.date).getMonth());
    const series = Array.from({ length: units }, () => 0);
    for (const t of exp) series[unitOf(t)] += toIdr(t);
    const prevSeries = Array.from({ length: prevUnits }, () => 0);
    for (const t of prv.filter(isExpense)) prevSeries[unitOf(t)] += toIdr(t);
    const prevTotal = prevSeries.reduce((s, v) => s + v, 0);

    let a = 0;
    let b = 0;
    const trend = Array.from({ length: Math.max(units, prevUnits) }, (_, i) => {
      a += series[i] ?? 0;
      b += prevSeries[i] ?? 0;
      return { i: i + 1, ini: i < elapsed && i < units ? a : null, lalu: i < prevUnits ? b : null };
    });
    const prevSame = prevSeries.slice(0, Math.min(elapsed, prevUnits)).reduce((s, v) => s + v, 0);

    const byCat = new Map<string, number>();
    for (const t of exp) byCat.set(t.category || 'Lainnya', (byCat.get(t.category || 'Lainnya') ?? 0) + toIdr(t));
    const cats = [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    // Tahunan: batang bulanan bertumpuk 4 kategori teratas + lainnya
    const top = cats.slice(0, 4).map((c) => c.name);
    const stacked = MONTHS.map((m, mi) => {
      const row: Record<string, number | string> = { m };
      for (const c of [...top, 'Lainnya']) row[c] = 0;
      for (const t of exp) {
        if (new Date(t.date).getMonth() !== mi) continue;
        const key = top.includes(t.category) ? t.category : 'Lainnya';
        row[key] = (row[key] as number) + toIdr(t);
      }
      return row;
    });

    const byPlace = new Map<string, { name: string; total: number; count: number }>();
    for (const t of exp) {
      const label = (t.note || t.subCategory || t.category || '').trim();
      if (!label) continue;
      const e = byPlace.get(label.toLowerCase()) ?? { name: label, total: 0, count: 0 };
      e.total += toIdr(t);
      e.count++;
      byPlace.set(label.toLowerCase(), e);
    }
    // Kategori × bulan (tahunan): 8 kategori teratas.
    const catMonths = cats.slice(0, 8).map((c) => {
      const vals = Array.from({ length: 12 }, () => 0);
      for (const t of exp) if ((t.category || 'Lainnya') === c.name) vals[new Date(t.date).getMonth()] += toIdr(t);
      return { name: c.name, total: c.value, vals };
    });

    const places = [...byPlace.values()].sort((x, y) => y.total - x.total).slice(0, 8);
    const biggest = [...exp].sort((x, y) => toIdr(y) - toIdr(x)).slice(0, 5);

    return { cur, exp, total, income, units, elapsed, series, trend, prevTotal, prevSame, cats, top, stacked, catMonths, places, biggest };
    // now hanya tanggal hari ini
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, mode, month, year, isCurrent]);

  const loading = all === null;
  const prevName = mode === 'bulan' ? new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(year, month - 1, 1)) : String(year - 1);
  const diff = r.total - r.prevSame;
  const maxDay = Math.max(1, ...r.series);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / maxDay) * 4)));
  const perUnit = (v: number) => v / Math.max(1, r.elapsed);
  const dayTx = day ? r.cur.filter((t) => t.type !== 'debt' && new Date(t.date).getDate() === day.d) : [];
  const dayOut = dayTx.filter(isExpense);
  const dayTop = [...dayOut.reduce((m, t) => m.set(t.category, (m.get(t.category) ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1])[0]?.[0];
  const key = `${mode}-${year}-${month}`;
  const catHref = (name: string, m?: number) =>
    `/membership/transactions/daily?category=${encodeURIComponent(name)}${
      m !== undefined ? `&month=${year}-${String(m + 1).padStart(2, '0')}` : mode === 'tahun' ? `&year=${year}` : !isCurrent ? `&month=${year}-${String(month + 1).padStart(2, '0')}` : ''
    }`;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12" onClick={() => setDay(null)}>
      <h1 className="sr-only">Laporan</h1>

      <motion.div key={key} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        {/* Kiri */}
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">Pengeluaran{mode === 'tahun' ? ` Jan–${MONTHS[r.elapsed - 1]}` : ''}</p>
            {loading ? <Skeleton className="mt-2 h-11 w-56" /> : (
              <p className="mt-1 flex items-start gap-1 leading-none text-slate-900">
                <span className="mt-1.5 text-lg font-bold text-slate-400">Rp</span>
                <span className="text-[52px] font-extrabold tracking-tight tabular-nums"><AnimatedNumber value={r.total} format={(n) => Math.round(n).toLocaleString('id-ID')} /></span>
              </p>
            )}
            <p className="mt-0.5 text-sm text-slate-500">
              dari pemasukan <b className="text-emerald-600">{short(r.income)}</b> · sisa <b className={r.income - r.total < 0 ? 'text-rose-500' : 'text-slate-800'}>{short(r.income - r.total)}</b>
            </p>

            {mode === 'bulan' ? (
              <div className="mt-6">
                <p className="text-xl font-extrabold tracking-tight text-slate-900">Trend harian</p>
                <p className="text-sm text-slate-500">rata-rata {short(perUnit(r.total))}/hari</p>
                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((w) => <span key={w} className="text-center text-[11px] font-semibold text-slate-400">{w}</span>)}
                  {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                  {r.series.map((v, i) => {
                    const future = isCurrent && i + 1 > r.elapsed;
                    const today = isCurrent && i + 1 === r.elapsed;
                    return (
                      <motion.button
                        key={i}
                        type="button"
                        disabled={future}
                        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(i * 0.012, 0.35), duration: 0.2 }}
                        whileHover={future ? undefined : { scale: 1.06 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setDay(day?.d === i + 1 ? null : { d: i + 1, x: b.left + b.width / 2, y: b.top });
                        }}
                        className={cn(
                          'flex h-14 flex-col justify-between rounded-xl p-2 text-left text-xs font-bold md:h-[60px]',
                          future ? 'border border-dashed border-slate-200 bg-transparent text-slate-300' : HEAT[level(v)],
                          level(v) >= 4 ? 'text-white' : 'text-slate-600',
                          today && 'ring-2 ring-slate-900',
                          day?.d === i + 1 && 'bg-slate-900 text-white ring-0'
                        )}
                      >
                        {i + 1}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">sedikit {HEAT.map((h) => <span key={h} className={cn('h-2.5 w-4 rounded', h)} />)} banyak</div>
              </div>
            ) : (
              <YearBars r={r} sel={selM} onSel={setSelM} elapsed={isCurrent ? r.elapsed : 12} />
            )}

            <div className="mt-6">
              <p className="text-xl font-extrabold tracking-tight text-slate-900">Trend pengeluaran</p>
              <p className="text-sm text-slate-500">{mode === 'bulan' ? 'Harian' : 'Bulanan'}, dibandingkan {mode === 'bulan' ? 'bulan' : 'tahun'} lalu</p>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.trend} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="i" hide />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.length ? (
                      <div className="space-y-1">
                        {payload.filter((p) => p.value != null).map((p) => (
                          <div key={String(p.dataKey)} className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-md', p.dataKey === 'ini' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
                            <span className={cn('h-2 w-2 rounded-full', p.dataKey === 'ini' ? 'bg-indigo-400' : 'bg-slate-300')} />
                            {p.dataKey === 'ini' ? periodLabel.split(' ')[0] : mode === 'bulan' ? MONTHS[new Date(year, month - 1, 1).getMonth()] : String(year - 1)} <b>{short(Number(p.value))}</b>
                          </div>
                        ))}
                      </div>
                    ) : null} />
                    <Area type="monotone" dataKey="lalu" stroke="#cbd5e1" strokeWidth={2} fill="none" dot={false} isAnimationActive={!reduce} />
                    <Area type="monotone" dataKey="ini" stroke="#6366f1" strokeWidth={2.5} fill="url(#lpg)" dot={false} connectNulls={false} isAnimationActive={!reduce} animationDuration={900} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>{mode === 'bulan' ? 1 : 'Jan'}</span>
                <span>{mode === 'bulan' ? r.units : 'Des'}</span>
              </div>
              {r.prevSame > 0 && (
                <p className={cn('mt-2 flex items-center gap-1 text-sm font-semibold', diff > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                  {diff > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {short(Math.abs(diff))} {diff > 0 ? 'lebih banyak' : 'lebih sedikit'} dari {prevName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Kanan: periode + ke mana uangnya */}
        <div className="order-first space-y-5 lg:order-2">
      <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-between">
            <LayoutGroup id="lp-mode">
              <div className="flex rounded-full bg-slate-100 p-1">
                {(['bulan', 'tahun'] as Mode[]).map((m) => (
                  <button key={m} type="button" onClick={(e) => { e.stopPropagation(); setMode(m); setDay(null); }} className={cn('relative rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors', mode === m ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                    {mode === m && <motion.span layoutId="lp-mode-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className="relative">{m === 'bulan' ? 'Bulanan' : 'Tahunan'}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
            <div className="flex items-center rounded-full bg-slate-100 p-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); shift(-1); }} aria-label="Sebelumnya" className="rounded-full p-1.5 text-slate-500 hover:bg-white hover:text-slate-900"><ChevronLeft size={16} /></button>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={periodLabel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="min-w-[72px] text-center text-[13px] font-bold text-slate-900">{periodLabel}</motion.span>
              </AnimatePresence>
              <button type="button" onClick={(e) => { e.stopPropagation(); shift(1); }} disabled={isCurrent} aria-label="Berikutnya" className="rounded-full p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        <div>
          <p className="text-xl font-extrabold tracking-tight text-slate-900">Komposisi pengeluaran</p>
          <p className="text-sm text-slate-500">Klik potongan grafik atau kategori untuk detail</p>
          {loading ? <Skeleton className="mt-4 h-64" /> : r.cats.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Belum ada pengeluaran di periode ini.</p>
          ) : (
            <>
              <div className="relative mx-auto mt-3 h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={r.cats} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={1.5} stroke="none" isAnimationActive={!reduce} animationDuration={800} className="cursor-pointer"
                      onClick={(_, i) => { const c = r.cats[i]; if (c) router.push(catHref(c.name)); }}
                      onMouseEnter={(_, i) => setActiveCat(r.cats[i]?.name ?? null)} onMouseLeave={() => setActiveCat(null)}>
                      {r.cats.map((c) => <Cell key={c.name} fill={c.color} opacity={activeCat && activeCat !== c.name ? 0.35 : 1} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-400">{activeCat ?? 'Pengeluaran'}</span>
                  <span className="text-lg font-extrabold text-slate-900">{short(activeCat ? r.cats.find((c) => c.name === activeCat)?.value ?? 0 : r.total)}</span>
                  <span className="text-[11px] text-slate-400">{activeCat ? `${Math.round(((r.cats.find((c) => c.name === activeCat)?.value ?? 0) / Math.max(1, r.total)) * 100)}%` : `${r.cats.length} kategori`}</span>
                </div>
              </div>
              <ul className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-100">
                {r.cats.map((c, i) => (
                  <motion.li key={c.name} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <Link
                      href={catHref(c.name)}
                      onMouseEnter={() => setActiveCat(c.name)}
                      onMouseLeave={() => setActiveCat(null)}
                      className={cn('flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors', activeCat === c.name ? 'bg-slate-50' : 'hover:bg-slate-50')}
                    >
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-base">
                        {categoryEmoji(c.name)}
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: c.color }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{c.name}</span>
                        <span className="text-xs text-slate-400">{Math.round((c.value / Math.max(1, r.total)) * 100)}% · {short(perUnit(c.value))}/{mode === 'bulan' ? 'hari' : 'bln'}</span>
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{formatIDR(c.value)}</span>
                      <ChevronRight size={15} className="text-slate-300" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </>
          )}
        </div>
        </div>
      </motion.div>

      {mode === 'tahun' && r.catMonths.length > 0 && (
        <motion.section key={`${key}-cm`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <p className="text-xl font-extrabold tracking-tight text-slate-900">Pola kategori sepanjang tahun</p>
          <p className="text-sm text-slate-500">Warna lebih pekat = pengeluaran kategori itu lebih besar di bulan tersebut</p>
          <div className="mt-3 overflow-x-auto rounded-3xl bg-slate-100/70 p-2">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th />
                  {MONTHS.map((m) => <th key={m} className="font-medium">{m}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.catMonths.map((c, ci) => {
                  const max = Math.max(1, ...c.vals);
                  return (
                    <motion.tr key={c.name} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ci * 0.04 }} className="group">
                      <td className="rounded-l-2xl py-1.5 pl-3 pr-2 group-hover:bg-white">
                        <span className="flex items-center gap-2 whitespace-nowrap font-medium text-slate-800">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm">{categoryEmoji(c.name)}</span>{c.name}
                        </span>
                      </td>
                      {c.vals.map((v, mi) => {
                        const f = v / max;
                        const future = isCurrent && mi > now.getMonth();
                        return (
                          <td key={mi} className="px-1 py-1.5 text-center group-hover:bg-white">
                            {v > 0 ? (
                              <Link href={catHref(c.name, mi)} title={`${c.name} · ${MONTHS[mi]} · ${formatIDR(v)}`} className="block">
                                <motion.span
                                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: ci * 0.04 + mi * 0.015 }}
                                  whileHover={{ scale: 1.12 }}
                                  className="mx-auto block h-7 w-10 rounded-lg"
                                  style={{ background: `rgba(99,102,241,${0.18 + f * 0.82})` }}
                                />
                              </Link>
                            ) : (
                              <span className={cn('mx-auto block h-7 w-10 rounded-lg', future ? 'bg-transparent' : 'bg-slate-200/70')} />
                            )}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap rounded-r-2xl py-1.5 pl-2 pr-3 text-right font-bold text-slate-900 tabular-nums group-hover:bg-white">{formatIDR(c.total)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}

      <motion.div key={`${key}-b`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="text-xl font-extrabold tracking-tight text-slate-900">Tempat teratas</p>
          <p className="mb-3 text-sm text-slate-500">Total per tempat, menurut catatan transaksi</p>
          {r.places.length === 0 ? <p className="py-3 text-sm text-slate-500">Belum ada data.</p> : (
            <ul className="divide-y divide-slate-200/70 rounded-3xl bg-slate-100/70 px-4">
              {r.places.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-400">{p.count}×</span>
                  <span className="w-28 text-right text-sm font-bold text-slate-900 tabular-nums">{formatIDR(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xl font-extrabold tracking-tight text-slate-900">Pengeluaran terbesar</p>
          <p className="mb-3 text-sm text-slate-500">Pembayaran tunggal terbesar</p>
          {r.biggest.length === 0 ? <p className="py-3 text-sm text-slate-500">Belum ada data.</p> : (
            <ul className="divide-y divide-slate-200/70 rounded-3xl bg-slate-100/70 px-4">
              {r.biggest.map((t, i) => (
                <li key={t.id || i} className="flex items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">{categoryEmoji(t.category)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{t.note || t.category}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date))}, {new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {t.category}{accountName(t.accountId) ? ` · ${accountName(t.accountId)}` : ''}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">−{formatIDR(toIdr(t))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {review && (
          <DayReviewModal
            key="review"
            date={review}
            transactions={all ?? []}
            accounts={accounts}
            onShift={(d) => setReview((cur) => (cur ? new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + d) : cur))}
            onClose={() => setReview(null)}
          />
        )}
      </AnimatePresence>

      {/* Ringkasan hari (heatmap) */}
      <AnimatePresence>
        {day && (
          <motion.div
            key={day.d}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{ position: 'fixed', left: Math.min(Math.max(day.x - 120, 8), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 248), top: Math.max(day.y - 158, 8), width: 240 }}
            className="z-50 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-100"
          >
            <button type="button" onClick={() => setDay(null)} aria-label="Tutup" className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
            <p className="text-xs text-slate-400">{new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(year, month, day.d))}</p>
            <p className="text-xl font-extrabold text-slate-900 tabular-nums">{formatIDR(dayOut.reduce((s, t) => s + toIdr(t), 0))}</p>
            <p className="text-xs text-slate-500">{dayOut.length} pembayaran{dayTop ? <> · paling banyak {categoryEmoji(dayTop)} {dayTop}</> : null}</p>
            <button type="button" onClick={() => { setReview(new Date(year, month, day.d)); setDay(null); }} className="mt-3 flex w-full items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-slate-800 hover:text-indigo-600">
              Lihat harinya <ChevronRight size={15} />
            </button>
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white ring-1 ring-slate-100 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Report = { stacked: Record<string, number | string>[]; top: string[]; cats: { name: string; value: number; color: string }[]; total: number };

// Trend bulanan (tahunan): batang bertumpuk per bulan — 4 kategori teratas +
// Lainnya, garis rata-rata, bulan terpilih disorot (ketuk batang untuk memilih).
function YearBars({ r, sel, onSel, elapsed }: { r: Report; sel: number | null; onSel: (m: number) => void; elapsed: number }) {
  const reduce = useReducedMotion();
  const keys = [...r.top, 'Lainnya'];
  const colorOf = (k: string, i: number) => (k === 'Lainnya' ? '#a1a1aa' : r.cats[i]?.color ?? '#94a3b8');
  const totals = r.stacked.map((row) => keys.reduce((s, k) => s + (Number(row[k]) || 0), 0));
  // Rata-rata bulan yang ada pengeluarannya (bulan kosong sebelum mulai mencatat tidak dihitung).
  const used = totals.slice(0, elapsed).filter((v) => v > 0);
  const avg = used.reduce((s, v) => s + v, 0) / Math.max(1, used.length);
  const rawMax = Math.max(1, ...totals);
  const step = 10 ** Math.floor(Math.log10(rawMax));
  const max = Math.ceil(rawMax / step) * step;
  const active = sel ?? Math.max(0, elapsed - 1);
  const fullMonth = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2000, active, 1));
  const tick = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10} jt`.replace('.', ',') : v >= 1e3 ? `${Math.round(v / 1e3)} rb` : String(v));

  return (
    <div className="mt-6">
      <p className="text-xl font-extrabold tracking-tight text-slate-900">Trend bulanan</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={active} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="text-sm text-slate-500">
          {fullMonth} · {formatIDR(totals[active] ?? 0)}
        </motion.p>
      </AnimatePresence>

      <div className="relative mt-4 flex h-60 gap-2">
        <div className="flex w-9 shrink-0 flex-col justify-between pb-6 text-[10px] text-slate-400">
          <span>{tick(max)}</span>
          <span>{tick(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 items-stretch gap-1">
          {avg > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-400" style={{ bottom: `calc(24px + (100% - 32px) * ${avg / max})` }}>
              <span className="absolute -top-5 right-0 rounded-full bg-white/90 px-1.5 text-[10px] font-semibold text-slate-500">rata-rata {formatIDR(avg).replace(/\s/g, '')}</span>
            </div>
          )}
          {r.stacked.map((row, mi) => {
            const future = mi >= elapsed;
            const isSel = mi === active;
            return (
              <button
                key={mi}
                type="button"
                disabled={future}
                aria-label={`${MONTHS[mi]} ${formatIDR(totals[mi])}`}
                aria-pressed={isSel}
                onClick={() => onSel(mi)}
                className={cn('group flex flex-1 flex-col items-center rounded-2xl pt-2 transition-colors', isSel ? 'bg-slate-100' : 'hover:bg-slate-50')}
              >
                <div className="flex w-full flex-1 flex-col-reverse items-center gap-[2px] px-1.5 md:px-3">
                  {future ? (
                    <span className="h-1 w-full rounded-full bg-slate-100" />
                  ) : (
                    keys.map((k, ki) => {
                      const v = Number(row[k]) || 0;
                      if (!v) return null;
                      return (
                        <motion.span
                          key={k}
                          title={`${k} · ${formatIDR(v)}`}
                          initial={reduce ? false : { height: 0 }}
                          animate={{ height: `${(v / max) * 100}%` }}
                          transition={{ duration: 0.5, delay: mi * 0.03, ease: 'easeOut' }}
                          className="w-full rounded-md"
                          style={{ background: colorOf(k, ki), minHeight: 3 }}
                        />
                      );
                    })
                  )}
                </div>
                <span className={cn('mt-1.5 h-[18px] text-[11px]', isSel ? 'font-bold text-slate-900' : future ? 'text-slate-300' : 'text-slate-500')}>{MONTHS[mi]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full" style={{ background: colorOf(k, i) }} />{k}
          </span>
        ))}
      </div>
    </div>
  );
}

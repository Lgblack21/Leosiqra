"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gauge, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryVisual, useCategoryStyles } from '@/lib/categoryEmoji';
import { cn, formatIDR, isInvestmentFlow } from '@/lib/utils';
import { HeaderSlot } from '@/components/Header';
import { BubbleCalendar, TopExpenses, WeekdayPattern, YearMonths } from '@/components/laporan/ReportExtras';

// Laporan pengeluaran Bulanan / Tahunan: total vs pemasukan, tren per
// bulan (atau per hari), perbandingan kumulatif dengan periode sebelumnya,
// porsi per kategori, kategori dari waktu ke waktu, dan tempat teratas.
// Hanya pemasukan/pengeluaran (amountIDR) — transfer, tabungan, beli/jual
// investasi (isInvestmentFlow, sama dengan Worker) dan catatan hutang bukan
// pengeluaran.

type Mode = 'bulanan' | 'tahunan';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const COLORS = ['#4f46e5', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#f97316', '#14b8a6'];
const STACK = 4; // kategori terbesar yang punya warna sendiri di grafik batang

const inPeriod = (t: Transaction, y: number, m: number | null) => {
  const d = new Date(t.date);
  return d.getFullYear() === y && (m === null || d.getMonth() === m);
};
const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) =>
  n >= 1e9 ? `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  : n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
  : n >= 1e3 ? `Rp${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
  : formatIDR(n);
// Batas atas sumbu yang "bulat" (1/2/5 × 10^n).
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
};

export default function LaporanPage() {
  // Ikon/warna kategori pilihan user (Pengaturan → Kategori & Anggaran).
  useCategoryStyles();
  const [all, setAll] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('tahunan');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [focus, setFocus] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "hari ini" mengikuti jam perangkat
    setNow(new Date());
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((list) => active && setAll(list.filter((t) => (t.type === 'pengeluaran' || t.type === 'pemasukan') && !isInvestmentFlow(t))))
        .catch(console.error)
        .finally(() => active && setLoading(false));
    load();
    const unsub = subscribeToCollectionChanges('transactions', load);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const prev = mode === 'tahunan' ? { y: year - 1, m: null as number | null } : { y: month === 0 ? year - 1 : year, m: month === 0 ? 11 : month - 1 };
  const cur = { y: year, m: mode === 'tahunan' ? null : month };

  const spend = useMemo(() => all.filter((t) => t.type === 'pengeluaran' && inPeriod(t, cur.y, cur.m)), [all, cur.y, cur.m]);
  const prevSpend = useMemo(() => all.filter((t) => t.type === 'pengeluaran' && inPeriod(t, prev.y, prev.m)), [all, prev.y, prev.m]);
  const income = useMemo(() => all.filter((t) => t.type === 'pemasukan' && inPeriod(t, cur.y, cur.m)).reduce((s, t) => s + idr(t), 0), [all, cur.y, cur.m]);
  const total = spend.reduce((s, t) => s + idr(t), 0);

  // Kategori diurutkan dari yang terbesar.
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of spend) m.set(t.category || 'Lainnya', (m.get(t.category || 'Lainnya') ?? 0) + idr(t));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [spend]);
  const stackCats = cats.slice(0, STACK).map((c) => c.name);

  // Batang: per bulan (tahunan) atau per hari (bulanan), ditumpuk per kategori teratas.
  const isCurYear = now ? year === now.getFullYear() : false;
  const isCurMonth = now ? isCurYear && month === now.getMonth() : false;
  const slots = mode === 'tahunan' ? 12 : new Date(year, month + 1, 0).getDate();
  const bars = useMemo(() => {
    const rows = Array.from({ length: slots }, () => ({ total: 0, parts: new Map<string, number>() }));
    for (const t of spend) {
      const d = new Date(t.date);
      const i = mode === 'tahunan' ? d.getMonth() : d.getDate() - 1;
      const key = stackCats.includes(t.category) ? t.category : 'Lainnya';
      rows[i].total += idr(t);
      rows[i].parts.set(key, (rows[i].parts.get(key) ?? 0) + idr(t));
    }
    return rows;
  }, [spend, slots, mode, stackCats]);
  // Rata-rata hanya dari slot yang sudah lewat (bulan/hari berjalan ikut dihitung).
  const elapsed = mode === 'tahunan'
    ? (isCurYear && now ? now.getMonth() + 1 : 12)
    : (isCurMonth && now ? now.getDate() : slots);
  // Tahunan: bulan tanpa catatan (mis. sebelum mulai pakai Leosiqra) tidak ikut dirata-rata.
  const passed = bars.slice(0, elapsed).filter((b) => mode === 'bulanan' || b.total > 0);

  // Kumulatif periode ini vs periode sebelumnya.
  const cumulative = (list: Transaction[], n: number, byMonth: boolean) => {
    const per = Array(n).fill(0) as number[];
    for (const t of list) {
      const d = new Date(t.date);
      const i = byMonth ? d.getMonth() : d.getDate() - 1;
      if (i < n) per[i] += idr(t);
    }
    let run = 0;
    return per.map((v) => (run += v));
  };
  const curLine = cumulative(spend, slots, mode === 'tahunan').slice(0, elapsed);
  const prevLine = cumulative(prevSpend, slots, mode === 'tahunan');
  const lineMax = niceMax(Math.max(1, ...curLine, ...prevLine));
  const prevTotal = prevSpend.reduce((s, t) => s + idr(t), 0);

  // Heatmap kategori × bulan (tahunan).
  const heat = useMemo(() => {
    if (mode !== 'tahunan') return [];
    return cats.slice(0, 8).map((c) => {
      const per = Array(12).fill(0) as number[];
      for (const t of spend) if ((t.category || 'Lainnya') === c.name) per[new Date(t.date).getMonth()] += idr(t);
      const max = Math.max(...per);
      return { ...c, per, max };
    });
  }, [cats, spend, mode]);

  // Di HP heatmap cuma menampilkan 6 bulan terakhir (sampai bulan berjalan).
  const heatEnd = Math.max(6, elapsed);
  const heatCell = (i: number) => (i < heatEnd - 6 || i >= heatEnd ? 'hidden md:block' : '');

  // Tempat/judul teratas.
  const places = useMemo(() => {
    const m = new Map<string, { total: number; n: number; category: string }>();
    for (const t of spend) {
      const key = (t.note || '').trim();
      if (!key) continue;
      const p = m.get(key) ?? { total: 0, n: 0, category: t.category };
      m.set(key, { total: p.total + idr(t), n: p.n + 1, category: p.category });
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [spend]);

  const periodLabel = mode === 'tahunan'
    ? (elapsed === 12 ? `${year}` : `Jan–${MONTHS[Math.max(0, elapsed - 1)]} ${year}`)
    : `${MONTHS_LONG[month]} ${year}`;
  const step = (dir: -1 | 1) => {
    if (mode === 'tahunan') return setYear((y) => y + dir);
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const atLatest = now ? (mode === 'tahunan' ? year >= now.getFullYear() : year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) : false;
  const perUnit = mode === 'tahunan' ? '/bln' : '/hari';
  const txLink = (category: string) => `/membership/transactions/daily?kategori=${encodeURIComponent(category)}&periode=${mode === 'tahunan' && isCurYear ? 'tahun' : mode === 'bulanan' && isCurMonth ? 'bulan' : 'semua'}`;

  // Donat
  const R = 70;
  const C = 2 * Math.PI * R;
  const offsets = cats.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (cats[i - 1].value / total) * C], []);
  const focused = cats.find((c) => c.name === focus);

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-12">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Laporan</h1>
            <p className="text-[13px] text-slate-500">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/membership/annual" className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              <Printer size={15} /> <span className="hidden sm:inline">Laporan tahunan lengkap</span><span className="sm:hidden">Tahunan</span>
            </Link>
            <HeaderSlot />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-slate-200/60 p-0.5">
            {(['bulanan', 'tahunan'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setFocus(null); }}
                className={cn('rounded-full px-4 py-1 text-[13px] font-semibold capitalize transition-colors', mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-full bg-white ring-1 ring-slate-200">
            <button type="button" onClick={() => step(-1)} aria-label="Periode sebelumnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
            <span className="min-w-[90px] text-center text-[13px] font-bold text-slate-900">{mode === 'tahunan' ? year : `${MONTHS[month]} ${year}`}</span>
            <button type="button" onClick={() => step(1)} disabled={atLatest} aria-label="Periode berikutnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
          <Link href="/membership/budget" aria-label="Anggaran" className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <Gauge size={15} /> <span className="hidden sm:inline">Anggaran</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-72" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Total: satu kartu tipis — keluar, masuk, sisa (ringkas di HP, lengkap di desktop) */}
          <section>
            <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-[20px] bg-white py-3 ring-1 ring-slate-100">
              {[
                { label: 'Keluar', v: total, cls: 'text-slate-900' },
                { label: 'Masuk', v: income, cls: 'text-emerald-600' },
                { label: income - total >= 0 ? 'Sisa' : 'Minus', v: Math.abs(income - total), cls: income - total >= 0 ? 'text-slate-900' : 'text-rose-600' },
              ].map((x) => (
                <div key={x.label} className="min-w-0 px-3 md:px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{x.label}</p>
                  <p className={cn('truncate text-[15px] font-bold tabular-nums md:text-[19px]', x.cls)} title={formatIDR(x.v)}>
                    <span className="md:hidden">{short(x.v)}</span>
                    <span className="hidden md:inline">{formatIDR(x.v)}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 px-1 text-[12px] text-slate-500">
              {prevTotal > 0 && (
                <span className={cn('font-semibold', total > prevTotal ? 'text-rose-600' : 'text-emerald-600')}>
                  {total > prevTotal ? '▲' : '▼'} {short(Math.abs(total - prevTotal))} vs {mode === 'tahunan' ? year - 1 : MONTHS_LONG[prev.m ?? 0]}
                </span>
              )}
              {income > 0 && <span>{Math.round((Math.max(0, income - total) / income) * 100)}% pemasukan tersisa</span>}
            </p>
          </section>

          {/* Bulanan: kalender gelembung; Tahunan: 12 kartu bulan */}
          {mode === 'bulanan' ? (
            <BubbleCalendar key={`${year}-${month}`} spend={spend} year={year} month={month} now={now} />
          ) : (
            <YearMonths
              all={all}
              year={year}
              now={now}
              onPick={(m) => {
                setMode('bulanan');
                setMonth(m);
               
                setFocus(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* Kumulatif vs periode sebelumnya */}
          <section>
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Tren pengeluaran</h2>
            <p className="text-[12px] text-slate-500">
              Kumulatif, dibandingkan {mode === 'tahunan' ? `tahun ${year - 1}` : `${MONTHS_LONG[prev.m ?? 0]}`}
              {prevTotal > 0 && ` (total ${short(prevTotal)})`}
            </p>
            <div className="mt-4 rounded-[20px] bg-white p-4 ring-1 ring-slate-100 md:p-6">
              <svg viewBox="0 0 600 200" className="h-40 w-full md:h-44" preserveAspectRatio="none" role="img" aria-label="Grafik pengeluaran kumulatif">
                {[0.5, 1].map((f) => <line key={f} x1="0" x2="600" y1={190 - f * 175} y2={190 - f * 175} stroke="#f1f5f9" />)}
                <line x1="0" x2="600" y1="190" y2="190" stroke="#e2e8f0" />
                {(() => {
                  const x = (i: number) => (slots === 1 ? 0 : (i / (slots - 1)) * 600);
                  const y = (v: number) => 190 - (v / lineMax) * 175;
                  const path = (pts: number[]) => pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
                  const last = curLine.length - 1;
                  return (
                    <>
                      {prevLine.some((v) => v > 0) && <path d={path(prevLine)} fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />}
                      {last >= 0 && (
                        <>
                          <path d={`${path(curLine)} L${x(last)},190 L0,190 Z`} fill="url(#lapGrad)" />
                          <path d={path(curLine)} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </>
                      )}
                      <defs>
                        <linearGradient id="lapGrad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </>
                  );
                })()}
              </svg>
              <div className="mt-2 flex items-center justify-between text-[12px] text-slate-400">
                <span>{mode === 'tahunan' ? 'Jan' : '1'}</span>
                <span className="flex gap-4">
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-600" /> {mode === 'tahunan' ? year : MONTHS[month]} · {short(total)}</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-300" /> {mode === 'tahunan' ? year - 1 : MONTHS[prev.m ?? 0]}</span>
                </span>
                <span>{mode === 'tahunan' ? 'Des' : slots}</span>
              </div>
            </div>
          </section>

          {/* Donat + daftar kategori */}
          <section>
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Ke mana uangnya</h2>
            <p className="text-[12px] text-slate-500">Ketuk kategori untuk lihat transaksinya</p>
            {cats.length === 0 ? (
              <p className="mt-4 rounded-[20px] bg-white p-8 text-center text-[14px] text-slate-500 ring-1 ring-slate-100">Belum ada pengeluaran di periode ini.</p>
            ) : (
              <div className="mt-3 grid items-start gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="flex justify-center md:sticky md:top-6">
                  <div className="relative h-44 w-44">
                    <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
                      {cats.map((c, i) => {
                        const len = (c.value / total) * C;
                        return (
                          <circle
                            key={c.name}
                            cx="90" cy="90" r={R} fill="none"
                            stroke={c.color}
                            strokeWidth={focus === c.name ? 24 : 18}
                            strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`}
                            strokeDashoffset={-offsets[i]}
                            className="cursor-pointer transition-[stroke-width]"
                            onMouseEnter={() => setFocus(c.name)}
                            onMouseLeave={() => setFocus(null)}
                            onClick={() => setFocus(focus === c.name ? null : c.name)}
                          />
                        );
                      })}
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[13px] text-slate-500">{focused ? focused.name : 'Pengeluaran'}</span>
                      <span className="text-[17px] font-extrabold tracking-tight text-slate-900">{short(focused ? focused.value : total)}</span>
                      <span className="text-[13px] text-slate-500">{focused ? `${Math.round((focused.value / total) * 100)}%` : `${cats.length} kategori`}</span>
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
                  {cats.map((c) => {
                    const v = categoryVisual(c.name, 'pengeluaran');
                    return (
                      <li key={c.name}>
                        <Link
                          href={txLink(c.name)}
                          onMouseEnter={() => setFocus(c.name)}
                          onMouseLeave={() => setFocus(null)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 md:px-5"
                        >
                          <span className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]', v.tile)} aria-hidden>
                            {v.emoji}
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white" style={{ background: c.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-slate-900">{c.name}</p>
                            <p className="text-[12px] text-slate-500">{Math.round((c.value / total) * 100)}% · {short(c.value / Math.max(1, mode === 'tahunan' ? passed.length : elapsed))}{perUnit}</p>
                          </div>
                          <p className="text-[14px] font-bold tabular-nums text-slate-900">{formatIDR(c.value)}</p>
                          <ChevronRight size={17} className="text-slate-300" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Heatmap kategori × bulan */}
          {mode === 'tahunan' && heat.length > 0 && (
            <section>
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Kategori dari waktu ke waktu</h2>
              <p className="text-[12px] text-slate-500">Makin besar gelembung, makin besar belanja kategori itu di bulan tersebut</p>
              <div className="mt-4 rounded-[20px] bg-white p-4 ring-1 ring-slate-100 md:p-6">
                <div>
                  <div className="grid grid-cols-[104px_repeat(6,minmax(0,1fr))_64px] md:grid-cols-[170px_repeat(12,minmax(0,1fr))_120px] gap-1.5 pb-2 text-center text-[12px] text-slate-400">
                    <span />
                    {MONTHS.map((m, i) => <span key={m} className={heatCell(i)}>{m}</span>)}
                    <span />
                  </div>
                  {heat.map((row) => {
                    const v = categoryVisual(row.name, 'pengeluaran');
                    return (
                      <div key={row.name} className="grid grid-cols-[104px_repeat(6,minmax(0,1fr))_64px] md:grid-cols-[170px_repeat(12,minmax(0,1fr))_120px] items-center gap-1.5 py-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]', v.tile)} aria-hidden>{v.emoji}</span>
                          <span className="truncate text-[13px] font-medium text-slate-700">{row.name}</span>
                        </span>
                        {row.per.map((val, i) => (
                          <span key={i} title={`${MONTHS_LONG[i]}: ${formatIDR(val)}`} className={heatCell(i)}>
                            <span className="flex h-10 items-center justify-center">
                            <span
                              className="rounded-full transition-transform hover:scale-110"
                              style={
                                val > 0
                                  ? { width: 12 + 24 * Math.sqrt(val / row.max), height: 12 + 24 * Math.sqrt(val / row.max), background: row.color, opacity: 0.45 + 0.55 * (val / row.max) }
                                  : { width: 6, height: 6, background: '#e2e8f0' }
                              }
                            />
                            </span>
                          </span>
                        ))}
                        <span className="whitespace-nowrap text-right text-[12px] font-bold tabular-nums text-slate-900 md:text-[14px]">{short(row.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <WeekdayPattern spend={spend} />

          {/* Tempat teratas */}
          {places.length > 0 && (
            <section>
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Tempat teratas</h2>
              <p className="text-[12px] text-slate-500">Total per tempat, menurut judul transaksi</p>
              <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
                {places.map(([name, p], i) => {
                  const v = categoryVisual(p.category, 'pengeluaran');
                  return (
                    <li key={name} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                      <span className="w-5 text-center text-[13px] font-bold text-slate-400">{i + 1}</span>
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]', v.tile)} aria-hidden>{v.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-slate-900">{name}</p>
                        <p className="text-[12px] text-slate-500">{p.n}× · {p.category}</p>
                      </div>
                      <p className="text-[14px] font-bold tabular-nums text-slate-900">{formatIDR(p.total)}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <TopExpenses spend={spend} />
        </>
      )}
    </div>
  );
}

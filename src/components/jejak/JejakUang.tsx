"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Footprints, X } from 'lucide-react';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { HeaderSlot } from '@/components/Header';
import { cn, formatIDR, isInvestmentFlow } from '@/lib/utils';

// Jejak Uang: dari mana uang datang & ke mana perginya, sebagai diagram aliran
// (Sankey) sumber pemasukan → total → kategori → tempat. Data = pemasukan &
// pengeluaran tercatat, aturan sama dengan Laporan (beli/jual investasi bukan
// pengeluaran). "Tempat" = judul/catatan transaksi. Kalau pengeluaran > pemasukan,
// selisihnya digambar sebagai "Dari simpanan" (bukan data — hanya penyeimbang).

type Mode = 'bulanan' | 'tahunan';
type NodeKind = 'in' | 'deficit' | 'mid' | 'sisa' | 'cat' | 'place';
type N = { id: string; label: string; value: number; color: string; col: number; kind: NodeKind; cat?: string; y: number; h: number };
type L = { from: string; to: string; value: number; color: string; toColor: string; cat?: string; sy: number; ty: number; h0: number; h1: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const IN_COLORS = ['#22c55e', '#14b8a6', '#06b6d4', '#84cc16', '#10b981'];
const OUT_COLORS = ['#6366f1', '#3b82f6', '#0ea5e9', '#ec4899', '#f97316', '#a855f7', '#eab308'];
const GREY = '#94a3b8';
const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (a >= 1e6) return `Rp${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  if (a >= 1e3) return `Rp${Math.round(a / 1e3)} rb`;
  return formatIDR(a);
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const group = (list: Transaction[], key: (t: Transaction) => string) => {
  const m = new Map<string, { value: number; n: number }>();
  for (const t of list) {
    const k = key(t);
    const p = m.get(k) ?? { value: 0, n: 0 };
    m.set(k, { value: p.value + idr(t), n: p.n + 1 });
  }
  return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
};
// Pita boleh beda tebal di kedua ujung (node punya tinggi minimum supaya yang
// kecil tetap terbaca — lihat MINH).
const ribbon = (x0: number, y0: number, x1: number, y1: number, h0: number, h1: number) => {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0} Z`;
};
const centerLine = (x0: number, y0: number, x1: number, y1: number) => {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1}`;
};

export function JejakUang() {
  const reduce = useReducedMotion();
  const [all, setAll] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('bulanan');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      transactionService.getUserTransactions('session')
        .then((list) => active && setAll(list.filter((t) => (t.type === 'pengeluaran' || t.type === 'pemasukan') && !isInvestmentFlow(t))))
        .catch(console.error)
        .finally(() => active && setLoading(false));
    load();
    const unsub = subscribeToCollectionChanges('transactions', load);
    const mq = window.matchMedia('(max-width: 767px)');
    const onMq = () => setNarrow(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => { active = false; unsub(); mq.removeEventListener('change', onMq); };
  }, []);

  const now = new Date();
  const atLatest = mode === 'tahunan' ? year >= now.getFullYear() : year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  const step = (d: number) => {
    setFocus(null);
    if (mode === 'tahunan') { setYear((y) => y + d); return; }
    const m = month + d;
    setYear((y) => y + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12);
  };
  const periodLabel = mode === 'tahunan' ? String(year) : `${MONTHS[month]} '${String(year).slice(2)}`;

  const period = useMemo(
    () => all.filter((t) => { const d = new Date(t.date); return d.getFullYear() === year && (mode === 'tahunan' || d.getMonth() === month); }),
    [all, year, month, mode]
  );
  const incomeList = period.filter((t) => t.type === 'pemasukan');
  const spendList = period.filter((t) => t.type === 'pengeluaran');
  const totalIn = incomeList.reduce((s, t) => s + idr(t), 0);
  const totalOut = spendList.reduce((s, t) => s + idr(t), 0);
  const net = totalIn - totalOut;

  // Kategori pengeluaran (top 6 + Lainnya) & tempat per kategori.
  const spendCats = useMemo(() => {
    const g = group(spendList, (t) => t.category || 'Lainnya');
    const top = g.slice(0, 6);
    const rest = g.slice(6);
    const cats = top.map((c, i) => ({ ...c, color: OUT_COLORS[i % OUT_COLORS.length], members: [c.name] }));
    if (rest.length) cats.push({ name: 'Lainnya', value: rest.reduce((s, r) => s + r.value, 0), n: rest.reduce((s, r) => s + r.n, 0), color: GREY, members: rest.map((r) => r.name) });
    return cats.map((c) => {
      const list = spendList.filter((t) => c.members.includes(t.category || 'Lainnya'));
      const places = group(list, (t) => (t.note || '').trim() || '—');
      return { ...c, places };
    });
  }, [spendList]);
  const incomeCats = useMemo(() => {
    const g = group(incomeList, (t) => t.category || 'Pemasukan lain');
    const top = g.slice(0, 4).map((c, i) => ({ ...c, color: IN_COLORS[i % IN_COLORS.length] }));
    const rest = g.slice(4);
    if (rest.length) top.push({ name: 'Lainnya', value: rest.reduce((s, r) => s + r.value, 0), n: 0, color: GREY });
    return top;
  }, [incomeList]);

  // Tata letak diagram.
  const cols = narrow ? 3 : 4;
  const W = narrow ? 420 : 1000;
  const XS = narrow ? [96, 196, 300] : [170, 400, 630, 850];
  const NW = narrow ? 9 : 12;
  const GAP = narrow ? 8 : 12;
  const MINH = narrow ? 20 : 22;
  const PAD = 44; // ruang label node tengah
  const layout = useMemo(() => {
    if (totalIn <= 0 && totalOut <= 0) return null;
    const big = Math.max(totalIn, totalOut);
    const c0: Omit<N, 'y' | 'h'>[] = incomeCats.map((c) => ({ id: `in:${c.name}`, label: c.name, value: c.value, color: c.color, col: 0, kind: 'in' }));
    if (totalOut > totalIn) c0.push({ id: 'deficit', label: 'Dari simpanan', value: totalOut - totalIn, color: '#f43f5e', col: 0, kind: 'deficit' });
    const c1: Omit<N, 'y' | 'h'>[] = [{ id: 'mid', label: totalOut > totalIn ? 'Pengeluaran' : 'Pemasukan', value: big, color: '#0f172a', col: 1, kind: 'mid' }];
    const c2: Omit<N, 'y' | 'h'>[] = [];
    if (totalIn > totalOut) c2.push({ id: 'sisa', label: 'Sisa', value: totalIn - totalOut, color: '#22c55e', col: 2, kind: 'sisa' });
    for (const c of spendCats) c2.push({ id: `cat:${c.name}`, label: c.name, value: c.value, color: c.color, col: 2, kind: 'cat', cat: c.name });
    const c3: Omit<N, 'y' | 'h'>[] = [];
    if (cols === 4) {
      for (const c of spendCats) {
        const top = c.places.filter((p) => p.name !== '—').slice(0, 3);
        const restVal = c.value - top.reduce((s, p) => s + p.value, 0);
        const restCount = c.places.length - top.length;
        for (const p of top) c3.push({ id: `pl:${c.name}:${p.name}`, label: p.name, value: p.value, color: c.color, col: 3, kind: 'place', cat: c.name });
        if (restVal > 0.5) {
          const onlyBlank = restCount === 1 && c.places.some((p) => p.name === '—');
          c3.push({ id: `pl:${c.name}:__rest`, label: onlyBlank ? 'Tanpa keterangan' : `${restCount} tempat lain`, value: restVal, color: c.color, col: 3, kind: 'place', cat: c.name });
        }
      }
    }
    const columns = [c0, c1, c2, ...(cols === 4 ? [c3] : [])];
    const maxNodes = Math.max(...columns.map((c) => c.length));
    const H = Math.max(narrow ? 340 : 420, maxNodes * (MINH + GAP) + 160);
    // Tinggi node = MINH + nilai × k: urutan & proporsi tetap, yang kecil tetap kelihatan.
    const k = Math.min(...columns.map((c) => (H - GAP * (c.length - 1) - MINH * c.length) / Math.max(1, c.reduce((s, n) => s + n.value, 0))));
    const nodes = new Map<string, N>();
    columns.forEach((col) => {
      const stack = col.reduce((s, n) => s + MINH + n.value * k, 0) + GAP * (col.length - 1);
      let y = PAD + (H - stack) / 2;
      for (const n of col) {
        const h = MINH + n.value * k;
        nodes.set(n.id, { ...n, y, h });
        y += h + GAP;
      }
    });
    // Tautan dengan offset bertumpuk di sisi asal & tujuan.
    const outOff = new Map<string, number>();
    const inOff = new Map<string, number>();
    const links: L[] = [];
    const link = (from: string, to: string, value: number, cat?: string) => {
      const a = nodes.get(from)!;
      const b = nodes.get(to)!;
      const h0 = a.value > 0 ? (value / a.value) * a.h : 0;
      const h1 = b.value > 0 ? (value / b.value) * b.h : 0;
      const sy = a.y + (outOff.get(from) ?? 0);
      const ty = b.y + (inOff.get(to) ?? 0);
      outOff.set(from, (outOff.get(from) ?? 0) + h0);
      inOff.set(to, (inOff.get(to) ?? 0) + h1);
      links.push({ from, to, value, color: a.kind === 'mid' ? b.color : a.color, toColor: b.kind === 'mid' ? a.color : b.color, cat, sy, ty, h0, h1 });
    };
    for (const n of c0) link(n.id, 'mid', n.value);
    for (const n of c2) link('mid', n.id, n.value, n.cat);
    for (const n of c3) link(`cat:${n.cat}`, n.id, n.value, n.cat);
    return { nodes: [...nodes.values()], links, H: H + PAD + 8, k };
  }, [incomeCats, spendCats, totalIn, totalOut, cols, narrow, GAP, MINH]);

  const active = hover ?? focus;
  const focused = spendCats.find((c) => c.name === focus);
  const dim = (cat?: string) => (active ? cat !== active : false);
  const animKey = `${mode}-${year}-${month}-${cols}`;

  return (
    <div className="mx-auto mb-12 max-w-6xl space-y-5">
      <style>{`@keyframes jejak-flow { to { stroke-dashoffset: -22; } } .jejak-flow { animation: jejak-flow 1.1s linear infinite; }`}</style>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Jejak Uang <Footprints size={24} className="text-emerald-500" /></h1>
            <p className="text-[14px] text-slate-500">Dari mana uangmu datang, dan ke mana saja perginya.</p>
          </div>
          <HeaderSlot className="md:hidden" />
        </div>
        <div className="flex items-center gap-2">
          <LayoutGroup id="jejak-mode">
            <div className="flex gap-1 rounded-full bg-slate-100 p-1">
              {(['bulanan', 'tahunan'] as Mode[]).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setFocus(null); }} aria-pressed={mode === m} className={cn('relative rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize', mode === m ? 'text-slate-900' : 'text-slate-500')}>
                  {mode === m && <motion.span layoutId={reduce ? undefined : 'jejak-mode-pill'} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative">{m}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="flex items-center rounded-full bg-white ring-1 ring-slate-200">
            <button type="button" onClick={() => step(-1)} aria-label="Periode sebelumnya" className="rounded-full p-2 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
            <span className="min-w-[72px] text-center text-[13px] font-bold text-slate-900">{periodLabel}</span>
            <button type="button" onClick={() => step(1)} disabled={atLatest} aria-label="Periode berikutnya" className="rounded-full p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
          <HeaderSlot className="hidden md:flex" />
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: 'Masuk', value: totalIn, tone: 'text-emerald-600', bar: 'bg-emerald-400' },
          { label: 'Keluar', value: totalOut, tone: 'text-slate-900', bar: 'bg-indigo-400' },
          { label: net >= 0 ? 'Sisa' : 'Tekor', value: Math.abs(net), tone: net >= 0 ? 'text-emerald-600' : 'text-rose-600', bar: net >= 0 ? 'bg-emerald-400' : 'bg-rose-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="relative overflow-hidden rounded-[22px] bg-white p-3.5 ring-1 ring-slate-100 md:p-5">
            <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', s.bar)} />
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={cn('mt-0.5 whitespace-nowrap text-[15px] font-extrabold tabular-nums sm:text-[17px] md:text-[26px]', s.tone)}>{short(s.value)}</p>
          </motion.div>
        ))}
      </div>

      {/* Diagram */}
      <section className="relative overflow-hidden rounded-[28px] bg-white p-3 ring-1 ring-slate-100 md:p-6">
        {loading ? (
          <div className="h-[380px] animate-pulse rounded-2xl bg-slate-50" />
        ) : !layout ? (
          <div className="py-16 text-center">
            <Footprints className="mx-auto text-slate-300" size={32} />
            <p className="mt-2 text-[15px] font-semibold text-slate-800">Belum ada jejak di {periodLabel}</p>
            <p className="text-[13px] text-slate-500">Catat pemasukan & pengeluaran, nanti alirannya muncul di sini.</p>
          </div>
        ) : (
          <>
            <svg key={animKey} viewBox={`0 0 ${W} ${layout.H}`} className="h-auto w-full" role="img" aria-label={`Aliran uang ${periodLabel}: masuk ${short(totalIn)}, keluar ${short(totalOut)}`}>
              <defs>
                <clipPath id="jejak-reveal">
                  <motion.rect x="0" y="0" height={layout.H} initial={{ width: reduce ? W : 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }} />
                </clipPath>
                {layout.links.map((l, i) => (
                  <linearGradient key={i} id={`jg-${i}`} gradientUnits="userSpaceOnUse" x1={XS[nodeCol(layout.nodes, l.from)] + NW} x2={XS[nodeCol(layout.nodes, l.to)]} y1="0" y2="0">
                    <stop offset="0%" stopColor={l.color} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={l.toColor} stopOpacity="0.32" />
                  </linearGradient>
                ))}
              </defs>
              <g clipPath="url(#jejak-reveal)">
                {layout.links.map((l, i) => {
                  const x0 = XS[nodeCol(layout.nodes, l.from)] + NW;
                  const x1 = XS[nodeCol(layout.nodes, l.to)];
                  const isDim = dim(l.cat) && l.cat !== undefined ? true : Boolean(active) && l.cat === undefined;
                  return (
                    <g key={i} style={{ opacity: isDim ? 0.12 : 1, transition: 'opacity 250ms' }} onMouseEnter={() => l.cat && setHover(l.cat)} onMouseLeave={() => setHover(null)} onClick={() => l.cat && setFocus((f) => (f === l.cat ? null : l.cat!))} className={l.cat ? 'cursor-pointer' : undefined}>
                      <path d={ribbon(x0, l.sy, x1, l.ty, l.h0, l.h1)} fill={`url(#jg-${i})`} />
                      {!reduce && Math.min(l.h0, l.h1) >= 3 && (
                        <path d={centerLine(x0, l.sy + l.h0 / 2, x1, l.ty + l.h1 / 2)} fill="none" stroke="white" strokeOpacity={0.75} strokeWidth={Math.min(3, Math.min(l.h0, l.h1) * 0.22)} strokeLinecap="round" strokeDasharray="0.5 21.5" className="jejak-flow" style={{ animationDelay: `${(i % 7) * -0.16}s` }} />
                      )}
                    </g>
                  );
                })}
              </g>
              {layout.nodes.map((n, i) => {
                const x = XS[n.col];
                const isDim = active ? (n.cat ? n.cat !== active : n.kind !== 'mid') : false;
                const clickable = n.kind === 'cat' || n.kind === 'place';
                const labelLeft = n.col === 0;
                const tx = labelLeft ? x - 8 : n.kind === 'mid' ? x + NW / 2 : x + NW + 8;
                const ty = n.kind === 'mid' ? n.y - 22 : n.y + n.h / 2 - 6;
                const anchor = labelLeft ? 'end' : n.kind === 'mid' ? 'middle' : 'start';
                const maxChars = narrow ? 13 : n.col === 3 ? 22 : 18;
                return (
                  <g key={n.id} style={{ opacity: isDim ? 0.25 : 1, transition: 'opacity 250ms' }} className={clickable ? 'cursor-pointer' : undefined}
                    onMouseEnter={() => n.cat && setHover(n.cat)} onMouseLeave={() => setHover(null)} onClick={() => n.cat && setFocus((f) => (f === n.cat ? null : n.cat!))}>
                    <motion.rect x={x} y={n.y} width={NW} height={n.h} rx={Math.min(4, NW / 2)} fill={n.color}
                      initial={reduce ? false : { scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: 0.15 + n.col * 0.25 + (i % 8) * 0.02, duration: 0.45 }}
                      style={{ transformOrigin: `${x + NW / 2}px ${n.y + n.h / 2}px`, transformBox: 'view-box' }} />
                    <motion.text initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + n.col * 0.25 }} x={tx} y={ty} textAnchor={anchor}
                      className="fill-slate-900 font-semibold" style={{ fontSize: narrow ? 11 : 13, paintOrder: 'stroke', stroke: 'white', strokeWidth: 4, strokeLinejoin: 'round' }}>
                      {n.kind === 'mid' && <tspan x={tx} dy="-14" className="fill-slate-400" style={{ fontSize: narrow ? 9 : 11, letterSpacing: 1 }}>{n.label.toUpperCase()}</tspan>}
                      <tspan x={tx} dy={n.kind === 'mid' ? 15 : 0}>{n.kind === 'mid' ? short(n.value) : clip(n.label, maxChars)}</tspan>
                      {n.kind !== 'mid' && <tspan x={tx} dy={narrow ? 13 : 15} className={n.kind === 'deficit' ? 'fill-rose-500' : 'fill-slate-400'} style={{ fontSize: narrow ? 10 : 12, fontWeight: 500 }}>{short(n.value)}</tspan>}
                    </motion.text>
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 text-center text-[12px] text-slate-400">{focus ? 'Ketuk lagi untuk kembali' : 'Ketuk kategori untuk mengikuti uangnya lebih jauh'}{totalOut > totalIn ? ' · "Dari simpanan" = kekurangan yang ditutup dari saldo/tabungan' : ''}</p>
          </>
        )}
      </section>

      {/* Ikuti satu kategori */}
      <AnimatePresence>
        {focused && (
          <motion.section key={focused.name} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 md:p-5">
            <div className="flex items-center gap-3">
              <span className="h-10 w-1.5 rounded-full" style={{ background: focused.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-slate-900">{focused.name}</p>
                <p className="text-[12px] text-slate-500">{short(focused.value)} · {totalOut > 0 ? Math.round((focused.value / totalOut) * 100) : 0}% pengeluaran · {focused.n} transaksi</p>
              </div>
              <button type="button" onClick={() => setFocus(null)} aria-label="Tutup" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {focused.places.map((p, i) => (
                <motion.li key={p.name} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="relative overflow-hidden rounded-2xl bg-slate-50 px-3.5 py-2.5">
                  <motion.span aria-hidden className="absolute inset-y-0 left-0" style={{ background: `${focused.color}22` }} initial={{ width: 0 }} animate={{ width: `${(p.value / focused.value) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + Math.min(i, 10) * 0.03 }} />
                  <span className="relative flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate font-semibold text-slate-800">{p.name === '—' ? 'Tanpa keterangan' : p.name} <span className="font-normal text-slate-400">· {p.n}×</span></span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900">{short(p.value)}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Kategori (HP: pengganti kolom tempat) */}
      {layout && !focused && spendCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {spendCats.map((c) => (
            <button key={c.name} type="button" onClick={() => setFocus(c.name)} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name} <span className="text-slate-400">{totalOut > 0 ? Math.round((c.value / totalOut) * 100) : 0}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function nodeCol(nodes: N[], id: string) {
  return nodes.find((n) => n.id === id)?.col ?? 0;
}

"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { Skeleton } from '@/components/ui/Skeleton';

// Ikuti uangmu (pola Oyenza): diagram aliran dari pemasukan → total →
// sisa & kategori pengeluaran → tempat (3 teratas + "N tempat lain").
// Klik salah satu kategori untuk melihat rinciannya: kategori → tempat →
// tiap pembayaran (ketuk pembayaran = buka harinya di Transaksi). Baca saja.

type Mode = 'bulan' | 'tahun';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const PALETTE = ['#3b82f6', '#6366f1', '#0ea5e9', '#a78bfa', '#14b8a6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e'];
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) => (n >= 1e9 ? `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M` : n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : n >= 1e3 ? `Rp${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb` : `Rp${Math.round(n)}`);
const placeOf = (t: Transaction) => (t.note || t.subCategory || t.category || 'Tanpa catatan').trim();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- model diagram ----------
type SNode = { id: string; col: number; label: string; value: number; color: string; muted?: boolean; onClick?: () => void; header?: string };
type SLink = { from: string; to: string; value: number; color: string };
type Laid = SNode & { x: number; y: number; h: number };

// Ambil n teratas, sisanya jadi satu node "N <label> lain".
const topN = <T,>(items: T[], n: number, value: (t: T) => number) => {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  return { top: sorted.slice(0, n), rest: sorted.slice(n) };
};

function layout(nodes: SNode[], links: SLink[], width: number, opts: { colX: number[]; unit: number; gap: number }) {
  const { colX, unit, gap } = opts;
  const SLOT = 32; // ruang minimal per node supaya label (nama + nominal) tidak bertumpuk
  const SIB = 6; // jarak antar-saudara (anak dari induk yang sama)
  const laid = new Map<string, Laid>();
  const cols = [...new Set(nodes.map((n) => n.col))].sort((a, b) => a - b);
  const hOf = (n: SNode) => Math.max(3, n.value * unit);
  const slotOf = (n: SNode) => (n.header ? hOf(n) : Math.max(hOf(n), SLOT));
  const parentOf = (n: SNode) => links.find((l) => l.to === n.id)?.from;
  const put = (n: SNode, top: number) => {
    const h = hOf(n);
    laid.set(n.id, { ...n, x: colX[n.col] * width, y: top + (slotOf(n) - h) / 2, h });
  };

  // 1) Dua kolom terakhir: kelompok anak disusun berurutan, induk diletakkan
  //    di tengah kelompoknya (kategori sejajar dengan tempat-tempatnya).
  const L = cols[cols.length - 1];
  const P = cols[cols.length - 2];
  let y = 0;
  let lastParentBottom = -Infinity;
  for (const parent of nodes.filter((n) => n.col === P)) {
    const kids = nodes.filter((n) => n.col === L && parentOf(n) === parent.id);
    if (!kids.length) {
      const top = Math.max(y, lastParentBottom + 8);
      put(parent, top);
      y = top + slotOf(parent) + gap;
      lastParentBottom = top + slotOf(parent);
      continue;
    }
    const groupH = kids.reduce((s, k) => s + slotOf(k), 0) + SIB * (kids.length - 1);
    let top = y;
    let pTop = top + groupH / 2 - slotOf(parent) / 2;
    if (pTop < lastParentBottom + 8) {
      top += lastParentBottom + 8 - pTop;
      pTop = lastParentBottom + 8;
    }
    put(parent, pTop);
    lastParentBottom = pTop + slotOf(parent);
    let ky = top;
    for (const k of kids) {
      put(k, ky);
      ky += slotOf(k) + SIB;
    }
    y = Math.max(top + groupH, lastParentBottom) + gap;
  }
  const spanTop = Math.min(...[...laid.values()].map((n) => n.y));
  const spanBottom = Math.max(...[...laid.values()].map((n) => n.y + n.h));
  const mid = (spanTop + spanBottom) / 2;

  // 2) Kolom sebelumnya (pemasukan & total): rata tengah terhadap tinggi kolom kanan.
  for (const c of cols.filter((c) => c < P)) {
    const ns = nodes.filter((n) => n.col === c);
    const total = ns.reduce((s, n) => s + slotOf(n), 0) + gap * (ns.length - 1);
    let cy = Math.max(0, mid - total / 2);
    for (const n of ns) {
      put(n, cy);
      cy += slotOf(n) + gap;
    }
  }
  // Posisi pita di sisi sumber & tujuan (berurutan dari atas).
  const outOff = new Map<string, number>();
  const inOff = new Map<string, number>();
  const bands = links.map((l) => {
    const a = laid.get(l.from)!;
    const b = laid.get(l.to)!;
    const ha = (l.value / Math.max(1, a.value)) * a.h;
    const hb = (l.value / Math.max(1, b.value)) * b.h;
    const ya = a.y + (outOff.get(a.id) ?? 0);
    const yb = b.y + (inOff.get(b.id) ?? 0);
    outOff.set(a.id, (outOff.get(a.id) ?? 0) + ha);
    inOff.set(b.id, (inOff.get(b.id) ?? 0) + hb);
    const x0 = a.x + 6;
    const x1 = b.x;
    const mx = (x0 + x1) / 2;
    const d = `M${x0},${ya} C${mx},${ya} ${mx},${yb} ${x1},${yb} L${x1},${yb + hb} C${mx},${yb + hb} ${mx},${ya + ha} ${x0},${ya + ha} Z`;
    return { ...l, d };
  });
  const bottom = Math.max(...[...laid.values()].map((n) => n.y + n.h));
  return { nodes: [...laid.values()], bands, height: bottom + 20 };
}

function Sankey({ nodes, links, colX, unit, gap, flowKey, hubCol }: { nodes: SNode[]; links: SLink[]; colX: number[]; unit: number; gap: number; flowKey: string; hubCol?: number }) {
  const reduce = useReducedMotion();
  const W = 1000;
  const [hover, setHover] = useState<string | null>(null);
  const { nodes: ln, bands, height } = useMemo(() => layout(nodes, links, W, { colX, unit, gap }), [nodes, links, colX, unit, gap]);
  const related = (id: string) => (hover ? hover === id || links.some((l) => (l.from === hover && l.to === id) || (l.to === hover && l.from === id)) : true);
  const clipId = `flow-${flowKey.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 -30 ${W} ${height + 40}`} className="h-auto w-full overflow-visible" role="img" aria-label="Diagram aliran uang">
      <defs>
        <clipPath id={clipId}>
          <motion.rect x={0} y={-40} height={height + 80} initial={reduce ? false : { width: 0 }} animate={{ width: W + 400 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {bands.map((b, i) => (
          <path key={i} d={b.d} fill={b.color} opacity={hover ? (b.from === hover || b.to === hover ? 0.45 : 0.08) : 0.22} className="transition-opacity duration-200" />
        ))}
        {ln.map((n) => (
          <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={n.onClick} className={cn(n.onClick && 'cursor-pointer')} opacity={related(n.id) ? 1 : 0.35}>
            {n.col === hubCol ? (
              <rect x={n.x} y={n.y} width={6} height={n.h} rx={2} fill="#0f172a" />
            ) : (
              <rect x={n.x} y={n.y} width={6} height={n.h} rx={2} fill={n.color} opacity={n.muted ? 0.45 : 1} />
            )}
            {n.header && (
              <>
                <text x={n.x + 3} y={n.y - 22} textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold uppercase tracking-wide">{n.header}</text>
                <text x={n.x + 3} y={n.y - 7} textAnchor="middle" className="fill-slate-900 text-[13px] font-bold">{short(n.value)}</text>
              </>
            )}
            {!n.header && (
              <g transform={`translate(${n.col === 0 ? n.x - 8 : n.x + 12}, ${n.y + n.h / 2})`}>
                <text textAnchor={n.col === 0 ? 'end' : 'start'} y={-2} className={cn('text-[12.5px] font-bold', n.muted ? 'fill-slate-500' : 'fill-slate-900')}>{n.label}</text>
                <text textAnchor={n.col === 0 ? 'end' : 'start'} y={12} className="fill-slate-500 text-[11px]">{short(n.value)}</text>
              </g>
            )}
            {/* area klik lebih besar */}
            {n.onClick && <rect x={n.x - 4} y={n.y - 4} width={180} height={Math.max(28, n.h + 8)} fill="transparent" />}
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function ArusPage() {
  const router = useRouter();
  const now = new Date();
  const [mode, setMode] = useState<Mode>('bulan');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setAll).catch(() => setAll([]));
    load();
    return subscribeToCollectionChanges('transactions', load);
  }, []);

  const isCurrent = mode === 'bulan' ? year === now.getFullYear() && month === now.getMonth() : year === now.getFullYear();
  const shift = (d: number) => {
    setFocus(null);
    if (mode === 'tahun') return setYear((y) => y + d);
    const x = new Date(year, month + d, 1);
    setMonth(x.getMonth());
    setYear(x.getFullYear());
  };
  const periodLabel = mode === 'bulan' ? `${MONTHS[month]} '${String(year).slice(2)}` : String(year);

  const period = useMemo(() => (all ?? []).filter((t) => {
    const d = new Date(t.date);
    return t.type !== 'debt' && d.getFullYear() === year && (mode === 'tahun' || d.getMonth() === month);
  }), [all, mode, month, year]);
  const income = period.filter((t) => t.type === 'pemasukan');
  const spend = period.filter((t) => t.type === 'pengeluaran');
  const masuk = income.reduce((s, t) => s + toIdr(t), 0);
  const keluar = spend.reduce((s, t) => s + toIdr(t), 0);
  const sisa = masuk - keluar;

  // Kategori pengeluaran terurut + warna tetap.
  const cats = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    spend.forEach((t) => m.set(t.category || 'Lainnya', [...(m.get(t.category || 'Lainnya') ?? []), t]));
    return [...m.entries()].map(([name, txs]) => ({ name, txs, value: txs.reduce((s, t) => s + toIdr(t), 0) })).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  const colorOf = (cat: string) => PALETTE[Math.max(0, cats.findIndex((c) => c.name === cat)) % PALETTE.length];

  const groupPlaces = (txs: Transaction[]) => {
    const m = new Map<string, { label: string; txs: Transaction[]; value: number }>();
    txs.forEach((t) => {
      const k = placeOf(t).toLowerCase();
      const e = m.get(k) ?? { label: placeOf(t), txs: [], value: 0 };
      e.txs.push(t);
      e.value += toIdr(t);
      m.set(k, e);
    });
    return [...m.values()];
  };

  // ----- Diagram utama -----
  const overview = useMemo(() => {
    const nodes: SNode[] = [];
    const links: SLink[] = [];
    const inc = new Map<string, number>();
    income.forEach((t) => inc.set(t.category || 'Pemasukan', (inc.get(t.category || 'Pemasukan') ?? 0) + toIdr(t)));
    const incList = [...inc.entries()].sort((a, b) => b[1] - a[1]);
    if (keluar > masuk) incList.push(['Dari saldo', keluar - masuk]);
    const hubVal = Math.max(masuk, keluar);
    incList.forEach(([name, v], i) => {
      nodes.push({ id: `in:${name}`, col: 0, label: name, value: v, color: name === 'Dari saldo' ? '#94a3b8' : i === 0 ? '#22c55e' : '#14b8a6' });
      links.push({ from: `in:${name}`, to: 'hub', value: v, color: name === 'Dari saldo' ? '#94a3b8' : i === 0 ? '#22c55e' : '#14b8a6' });
    });
    nodes.push({ id: 'hub', col: 1, label: 'Pemasukan', value: hubVal, color: '#0f172a', header: masuk >= keluar ? 'Pemasukan' : 'Uangmu' });
    if (sisa > 0) {
      nodes.push({ id: 'sisa', col: 2, label: 'Sisa', value: sisa, color: '#16a34a' });
      links.push({ from: 'hub', to: 'sisa', value: sisa, color: '#16a34a' });
    }
    const { top, rest } = topN(cats, 7, (c) => c.value);
    const shown = rest.length ? [...top, { name: 'Lainnya', txs: rest.flatMap((r) => r.txs), value: rest.reduce((s, r) => s + r.value, 0) }] : top;
    shown.forEach((c) => {
      const color = c.name === 'Lainnya' && rest.length ? '#94a3b8' : colorOf(c.name);
      nodes.push({ id: `cat:${c.name}`, col: 2, label: c.name, value: c.value, color, onClick: () => setFocus(c.name === 'Lainnya' && rest.length ? '__lainnya' : c.name) });
      links.push({ from: 'hub', to: `cat:${c.name}`, value: c.value, color });
      const places = topN(groupPlaces(c.txs), 3, (p) => p.value);
      places.top.forEach((p) => {
        nodes.push({ id: `pl:${c.name}:${p.label}`, col: 3, label: p.label, value: p.value, color, onClick: () => setFocus(c.name === 'Lainnya' && rest.length ? '__lainnya' : c.name) });
        links.push({ from: `cat:${c.name}`, to: `pl:${c.name}:${p.label}`, value: p.value, color });
      });
      if (places.rest.length) {
        const v = places.rest.reduce((s, p) => s + p.value, 0);
        nodes.push({ id: `pl:${c.name}:__rest`, col: 3, label: `${places.rest.length} tempat lain`, value: v, color, muted: true });
        links.push({ from: `cat:${c.name}`, to: `pl:${c.name}:__rest`, value: v, color });
      }
    });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, cats]);

  // ----- Fokus satu kategori: kategori → tempat → pembayaran -----
  const focused = useMemo(() => {
    if (!focus) return null;
    const restCats = topN(cats, 7, (c) => c.value).rest;
    const txs = focus === '__lainnya' ? restCats.flatMap((c) => c.txs) : cats.find((c) => c.name === focus)?.txs ?? [];
    if (!txs.length) return null;
    const label = focus === '__lainnya' ? 'Lainnya' : focus;
    const color = focus === '__lainnya' ? '#94a3b8' : colorOf(focus);
    const total = txs.reduce((s, t) => s + toIdr(t), 0);
    const nodes: SNode[] = [{ id: 'cat', col: 0, label, value: total, color }];
    const links: SLink[] = [];
    const places = topN(groupPlaces(txs), 3, (p) => p.value);
    const openDay = (t: Transaction) => () => router.push(`/membership/transactions/daily?date=${ymd(new Date(t.date))}`);
    places.top.forEach((p, pi) => {
      nodes.push({ id: `p${pi}`, col: 1, label: p.label, value: p.value, color });
      links.push({ from: 'cat', to: `p${pi}`, value: p.value, color });
      const pays = topN(p.txs, 3, (t) => toIdr(t));
      pays.top.forEach((t, ti) => {
        nodes.push({ id: `p${pi}t${ti}`, col: 2, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(t.date)), value: toIdr(t), color, onClick: openDay(t) });
        links.push({ from: `p${pi}`, to: `p${pi}t${ti}`, value: toIdr(t), color });
      });
      if (pays.rest.length) {
        const v = pays.rest.reduce((s, t) => s + toIdr(t), 0);
        nodes.push({ id: `p${pi}r`, col: 2, label: `${pays.rest.length} pembayaran lain`, value: v, color, muted: true });
        links.push({ from: `p${pi}`, to: `p${pi}r`, value: v, color });
      }
    });
    if (places.rest.length) {
      const v = places.rest.reduce((s, p) => s + p.value, 0);
      nodes.push({ id: 'pr', col: 1, label: `${places.rest.length} tempat lain`, value: v, color, muted: true });
      links.push({ from: 'cat', to: 'pr', value: v, color });
      const more = topN(places.rest, 2, (p) => p.value);
      more.top.forEach((p, i) => {
        nodes.push({ id: `pr${i}`, col: 2, label: p.label, value: p.value, color, onClick: p.txs.length === 1 ? openDay(p.txs[0]) : undefined });
        links.push({ from: 'pr', to: `pr${i}`, value: p.value, color });
      });
      if (more.rest.length) {
        const mv = more.rest.reduce((s, p) => s + p.value, 0);
        nodes.push({ id: 'prr', col: 2, label: `${more.rest.length} tempat lain`, value: mv, color, muted: true });
        links.push({ from: 'pr', to: 'prr', value: mv, color });
      }
    }
    return { nodes, links, label, count: txs.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, cats]);

  const loading = all === null;
  const unitFor = (total: number, target: number) => (total > 0 ? target / total : 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <h1 className="sr-only">Ikuti uangmu</h1>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-500">Lihat jalur uangmu: masuk dari mana, habis untuk apa</p>
        <div className="flex flex-wrap items-center gap-2">
          <LayoutGroup id="arus-mode">
            <div className="flex rounded-full bg-slate-100 p-1">
              {(['bulan', 'tahun'] as Mode[]).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setFocus(null); }} className={cn('relative rounded-full px-5 py-2 text-sm font-semibold', mode === m ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                  {mode === m && <motion.span layoutId="arus-mode-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className="relative">{m === 'bulan' ? 'Bulanan' : 'Tahunan'}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="flex items-center rounded-full bg-slate-100 p-1">
            <button type="button" onClick={() => shift(-1)} aria-label="Sebelumnya" className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900"><ChevronLeft size={16} /></button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={periodLabel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="min-w-[80px] text-center text-sm font-bold text-slate-900">{periodLabel}</motion.span>
            </AnimatePresence>
            <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label="Berikutnya" className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="flex gap-12">
        {[['Masuk', masuk, 'text-slate-900'], ['Keluar', keluar, 'text-slate-900'], ['Sisa', sisa, sisa >= 0 ? 'text-emerald-600' : 'text-rose-600']].map(([l, v, c]) => (
          <div key={l as string}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{l}</p>
            {loading ? <Skeleton className="mt-1 h-7 w-24" /> : <p className={cn('text-xl font-bold tabular-nums', c as string)}>{(v as number) < 0 ? '−' : ''}{short(Math.abs(v as number))}</p>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {focused && (
          <motion.div key="crumb" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
            <button type="button" onClick={() => setFocus(null)} className="flex items-center gap-1 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200"><ChevronLeft size={15} /> Kembali</button>
            <span className="text-sm text-slate-600">{categoryEmoji(focused.label)} {focused.label} · {focused.count} pembayaran</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <Skeleton className="h-[560px] rounded-3xl" />
      ) : spend.length === 0 && income.length === 0 ? (
        <p className="rounded-3xl bg-slate-100/70 p-10 text-center text-sm text-slate-500">Belum ada transaksi di periode ini.</p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${periodLabel}-${focus ?? 'all'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-x-auto">
            <div className="min-w-[760px]">
              {focused ? (
                <Sankey flowKey={`f-${focus}-${periodLabel}`} nodes={focused.nodes} links={focused.links} colX={[0.15, 0.45, 0.82]} unit={unitFor(focused.nodes[0].value, 360)} gap={22} />
              ) : (
                <Sankey flowKey={`o-${periodLabel}`} nodes={overview.nodes} links={overview.links} colX={[0.15, 0.3, 0.5, 0.82]} unit={unitFor(Math.max(masuk, keluar), 420)} gap={22} hubCol={1} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
      <p className="text-sm text-slate-500">{focused ? 'Klik tanggal untuk membuka transaksinya' : 'Klik salah satu kategori untuk melihat rinciannya'}</p>
    </div>
  );
}

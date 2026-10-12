"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, Wand2 } from 'lucide-react';
import { formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Kanvas: semua uangmu dalam satu papan — dari mana uang masuk, rekening mana
// yang menampungnya, dan ke mana uang dari tiap rekening pergi (pengeluaran,
// tabungan, investasi, transfer ke rekening lain). Dibangun dari catatanmu
// sendiri (baca saja). Kotak bisa diseret; posisinya diingat di perangkat ini.

type NodeKind = 'in' | 'acc' | 'out';
type CNode = { id: string; kind: NodeKind; label: string; emoji: string; amount: number; out?: number };
type CEdge = { from: string; to: string; value: number };
type Pos = { x: number; y: number };

const W = 176;
const H = 56;
const POS_KEY = 'leo-kanvas-pos:v1';
const toIdr = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(Math.round(n)));
const ACC_EMOJI: Record<string, string> = { 'Bank Account': '🏦', 'E-Wallet': '📱', Cash: '💵', 'Investment Account': '📈', 'Credit Card': '💳' };
const TONE: Record<NodeKind, { fill: string; stroke: string }> = {
  in: { fill: '#ecfdf5', stroke: '#6ee7b7' },
  acc: { fill: '#eef2ff', stroke: '#a5b4fc' },
  out: { fill: '#fff1f2', stroke: '#fda4af' },
};

const readPos = (): Record<string, Pos> => {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || '{}') as Record<string, Pos>;
  } catch {
    return {};
  }
};

export default function KanvasPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saved, setSaved] = useState<Record<string, Pos>>(() => (typeof window === 'undefined' ? {} : readPos()));
  const [view, setView] = useState({ x: 20, y: 20, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ type: 'node' | 'pan'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setTransactions).catch(() => setTransactions([]));
    const loadSav = () => savingsService.getUserSavings('session').then(setSavings).catch(() => {});
    const loadAcc = () => accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    load();
    loadSav();
    loadAcc();
    const subs = [subscribeToCollectionChanges('transactions', load), subscribeToCollectionChanges('savings', loadSav), subscribeToCollectionChanges('accounts', loadAcc)];
    return () => subs.forEach((u) => u());
  }, []);

  const graph = useMemo(() => {
    const inMonth = (d: Date | string) => {
      const x = new Date(d);
      return x.getFullYear() === year && x.getMonth() === month;
    };
    const accName = new Map(accounts.map((a) => [a.id, a]));
    const nodes = new Map<string, CNode>();
    const edges = new Map<string, CEdge>();
    const addNode = (n: CNode) => {
      const cur = nodes.get(n.id);
      if (cur) cur.amount += n.amount;
      else nodes.set(n.id, { ...n });
    };
    const addEdge = (from: string, to: string, value: number) => {
      const src = nodes.get(from);
      if (src?.kind === 'acc') src.out = (src.out ?? 0) + value;
      const k = `${from}>${to}`;
      const cur = edges.get(k);
      if (cur) cur.value += value;
      else edges.set(k, { from, to, value });
    };
    const accNode = (id?: string) => {
      const a = id ? accName.get(id) : undefined;
      const nid = `acc:${a?.id ?? 'lain'}`;
      if (!nodes.has(nid)) nodes.set(nid, { id: nid, kind: 'acc', label: a?.name ?? 'Lainnya', emoji: ACC_EMOJI[a?.type ?? ''] ?? '👛', amount: 0 });
      return nid;
    };

    for (const t of (transactions ?? []).filter((x) => inMonth(x.date) && x.type !== 'debt')) {
      const v = toIdr(t);
      if (!v) continue;
      if (t.type === 'pemasukan') {
        const nid = `in:${(t.category || 'Pemasukan').toLowerCase()}`;
        addNode({ id: nid, kind: 'in', label: t.category || 'Pemasukan', emoji: categoryEmoji(t.category), amount: v });
        const acc = accNode(t.accountId);
        nodes.get(acc)!.amount += v;
        addEdge(nid, acc, v);
      } else if (t.type === 'pengeluaran') {
        const inv = isInvestmentCategory(t.category);
        const label = inv ? 'Investasi' : t.category || 'Lainnya';
        const nid = `out:${label.toLowerCase()}`;
        addNode({ id: nid, kind: 'out', label, emoji: inv ? '📈' : categoryEmoji(label), amount: v });
        addEdge(accNode(t.accountId), nid, v);
      } else if (t.type === 'transfer' && t.targetAccountId && /keluar/i.test(t.subCategory || '')) {
        const from = accNode(t.accountId);
        const to = accNode(t.targetAccountId);
        if (from !== to) {
          addEdge(from, to, v);
          nodes.get(to)!.amount += v;
        }
      }
    }
    for (const s of savings.filter((x) => inMonth(x.date) && x.transactionType !== 'Penarikan')) {
      const v = toIdr(s);
      if (!v) continue;
      addNode({ id: 'out:tabungan', kind: 'out', label: 'Tabungan', emoji: '🐷', amount: v });
      addEdge(accNode(s.fromAccount), 'out:tabungan', v);
    }

    // Maks 8 kotak pengeluaran: sisanya digabung "Lainnya".
    const outs = [...nodes.values()].filter((n) => n.kind === 'out').sort((a, b) => b.amount - a.amount);
    if (outs.length > 8) {
      const merged = outs.slice(7);
      const keep = new Set(merged.map((n) => n.id));
      const other: CNode = { id: 'out:__lain', kind: 'out', label: 'Lainnya', emoji: '💸', amount: merged.reduce((s, n) => s + n.amount, 0) };
      for (const id of keep) nodes.delete(id);
      nodes.set(other.id, other);
      for (const [k, e] of [...edges]) {
        if (keep.has(e.to)) {
          edges.delete(k);
          // Tulis langsung (bukan addEdge) supaya "keluar" rekening tidak terhitung dua kali.
          const k2 = `${e.from}>${other.id}`;
          const cur = edges.get(k2);
          if (cur) cur.value += e.value;
          else edges.set(k2, { from: e.from, to: other.id, value: e.value });
        }
      }
    }
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  }, [transactions, savings, accounts, month, year]);

  // Tata letak otomatis tiga kolom; posisi hasil seret user menimpa.
  const autoPos = useMemo(() => {
    const cols: Record<NodeKind, CNode[]> = { in: [], acc: [], out: [] };
    for (const n of graph.nodes) cols[n.kind].push(n);
    const out: Record<string, Pos> = {};
    (['in', 'acc', 'out'] as NodeKind[]).forEach((k, ci) => {
      cols[k].sort((a, b) => b.amount - a.amount).forEach((n, i) => {
        out[n.id] = { x: 40 + ci * 330, y: 40 + i * (H + 26) };
      });
    });
    return out;
  }, [graph]);
  const pos = useCallback((id: string) => saved[id] ?? autoPos[id] ?? { x: 0, y: 0 }, [saved, autoPos]);

  const maxEdge = Math.max(1, ...graph.edges.map((e) => e.value));

  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: (cx - (r?.left ?? 0) - view.x) / view.k, y: (cy - (r?.top ?? 0) - view.y) / view.k };
  };
  const onPointerDown = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (id) {
      const p = pos(id);
      const w = toWorld(e.clientX, e.clientY);
      drag.current = { type: 'node', id, sx: w.x, sy: w.y, ox: p.x, oy: p.y, moved: false };
    } else {
      drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    if (d.type === 'node' && d.id) {
      const w = toWorld(e.clientX, e.clientY);
      const id = d.id;
      setSaved((cur) => ({ ...cur, [id]: { x: d.ox + (w.x - d.sx), y: d.oy + (w.y - d.sy) } }));
    } else {
      setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  // Posisi kotak hasil seret disimpan di perangkat ini.
  useEffect(() => {
    try {
      if (Object.keys(saved).length) localStorage.setItem(POS_KEY, JSON.stringify(saved));
      else localStorage.removeItem(POS_KEY);
    } catch {
      /* storage diblokir */
    }
  }, [saved]);
  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.4, v.k * factor)) }));
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 0.9);
  };
  const tidy = () => {
    setSaved({});
    setView({ x: 20, y: 20, k: 1 });
  };
  const shift = (d: number) => {
    const x = new Date(year, month + d, 1);
    setMonth(x.getMonth());
    setYear(x.getFullYear());
  };
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const accCount = graph.nodes.filter((n) => n.kind === 'acc').length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Kanvas</h1>
          <p className="text-sm text-slate-500">Dari uang masuk sampai tabungan: ke mana uangmu mengalir · {accCount} rekening · {graph.edges.length} jalur</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl bg-white px-1 py-1 shadow-sm ring-1 ring-slate-100">
            <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <span className="min-w-[120px] text-center text-sm font-bold capitalize text-slate-900">{label}</span>
            <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label="Bulan berikutnya" className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
          <button type="button" onClick={tidy} className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50">
            <Wand2 size={15} /> Rapikan
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[length:22px_22px] bg-slate-50 shadow-sm" style={{ height: 'min(72vh, 720px)' }}>
        {transactions !== null && graph.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <LeoMascot mood="idle" size={100} />
            <p className="mt-3 font-bold text-slate-900">Kanvasmu masih kosong</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Catat gaji dan pengeluaranmu bulan ini, nanti alirannya tergambar di sini.</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="h-full w-full touch-none select-none"
            onPointerDown={(e) => onPointerDown(e)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            style={{ cursor: 'grab' }}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {/* Judul kolom */}
              {(['Uang masuk', 'Rekening', 'Uang keluar'] as const).map((t, i) => (
                <text key={t} x={40 + i * 330} y={22} fontSize={12} fontWeight={700} fill="#94a3b8">{t}</text>
              ))}
              {graph.edges.map((e) => {
                const a = pos(e.from);
                const b = pos(e.to);
                const x1 = a.x + W;
                const y1 = a.y + H / 2;
                const x2 = b.x;
                const y2 = b.y + H / 2;
                const mx = (x1 + x2) / 2;
                const w = 2 + (e.value / maxEdge) * 16;
                const toOut = e.to.startsWith('out:');
                return (
                  <g key={`${e.from}>${e.to}`}>
                    <path d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={toOut ? '#fda4af' : e.from.startsWith('in:') ? '#6ee7b7' : '#a5b4fc'} strokeOpacity={0.55} strokeWidth={w} fill="none" strokeLinecap="round" />
                    <g transform={`translate(${mx} ${(y1 + y2) / 2})`}>
                      <rect x={-30} y={-10} width={60} height={20} rx={10} fill="white" stroke="#e2e8f0" />
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={10.5} fontWeight={700} fill="#475569">{short(e.value)}</text>
                    </g>
                  </g>
                );
              })}
              {graph.nodes.map((n) => {
                const p = pos(n.id);
                const tone = TONE[n.kind];
                return (
                  <g key={n.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={(e) => onPointerDown(e, n.id)} style={{ cursor: 'move' }}>
                    <rect width={W} height={H} rx={16} fill={tone.fill} stroke={tone.stroke} strokeWidth={1.5} />
                    <text x={14} y={H / 2 + 1} dominantBaseline="middle" fontSize={20}>{n.emoji}</text>
                    <text x={44} y={22} fontSize={12.5} fontWeight={700} fill="#1e293b">{n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}</text>
                    <text x={44} y={40} fontSize={11.5} fill="#64748b">{n.kind === 'acc' ? `+${short(n.amount)} · −${short(n.out ?? 0)}` : formatIDR(n.amount)}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-2xl bg-white p-1 shadow-md ring-1 ring-slate-100">
          <button type="button" onClick={() => zoom(1.15)} aria-label="Perbesar" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><Plus size={16} /></button>
          <button type="button" onClick={() => zoom(0.87)} aria-label="Perkecil" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><Minus size={16} /></button>
          <button type="button" onClick={() => setView({ x: 20, y: 20, k: 1 })} aria-label="Pas layar" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><Maximize2 size={16} /></button>
        </div>
        <p className="pointer-events-none absolute bottom-4 left-5 text-xs text-slate-400">Seret untuk geser · Ctrl + scroll untuk zoom · seret kotak untuk memindahkan</p>
      </div>
    </div>
  );
}

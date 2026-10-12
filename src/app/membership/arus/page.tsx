"use client";

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip, type SankeyNodeProps } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { useModal } from '@/context/ModalContext';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Skeleton } from '@/components/ui/Skeleton';

// Ikuti uangmu: dari mana uang bulan ini datang (pemasukan per kategori, atau
// "Dari saldo" kalau keluar lebih besar dari masuk) dan ke mana perginya
// (kategori pengeluaran, tabungan, investasi, sisa). Baca saja.

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#14b8a6'];
const toIdr = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;

type FlowNode = { name: string; color: string; side: 'in' | 'hub' | 'out' };

export default function ArusPage() {
  const { openModal } = useModal();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setAll).catch(() => setAll([]));
    const loadSav = () => savingsService.getUserSavings('session').then(setSavings).catch(() => {});
    load();
    loadSav();
    const a = subscribeToCollectionChanges('transactions', load);
    const b = subscribeToCollectionChanges('savings', loadSav);
    return () => {
      a();
      b();
    };
  }, []);

  const shift = (d: number) => {
    const x = new Date(year, month + d, 1);
    setMonth(x.getMonth());
    setYear(x.getFullYear());
  };
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));

  const flow = useMemo(() => {
    const inMonth = (d: Date | string) => {
      const x = new Date(d);
      return x.getFullYear() === year && x.getMonth() === month;
    };
    const cur = (all ?? []).filter((t) => inMonth(t.date));
    const group = (list: Transaction[]) => {
      const m = new Map<string, number>();
      for (const t of list) m.set(t.category || 'Lainnya', (m.get(t.category || 'Lainnya') ?? 0) + toIdr(t));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const incomes = group(cur.filter((t) => t.type === 'pemasukan'));
    let expenses = group(cur.filter((t) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category)));
    // Maks 7 kategori pengeluaran, sisanya digabung "Lainnya" supaya diagram terbaca.
    if (expenses.length > 7) {
      const rest = expenses.slice(6).reduce((s, [, v]) => s + v, 0);
      expenses = [...expenses.slice(0, 6), ['Lainnya', rest]];
    }
    const invest = cur.filter((t) => t.type === 'pengeluaran' && isInvestmentCategory(t.category)).reduce((s, t) => s + toIdr(t), 0);
    const saved = savings.filter((s) => inMonth(s.date)).reduce((s, x) => s + (x.transactionType === 'Penarikan' ? -1 : 1) * toIdr(x), 0);

    const totalIn = incomes.reduce((s, [, v]) => s + v, 0);
    const outs: [string, number][] = [...expenses];
    if (saved > 0) outs.push(['Tabungan', saved]);
    if (invest > 0) outs.push(['Investasi', invest]);
    const totalOut = outs.reduce((s, [, v]) => s + v, 0);
    const ins: [string, number][] = [...incomes];
    if (totalOut > totalIn) ins.push(['Dari saldo', totalOut - totalIn]);
    if (totalIn > totalOut) outs.push(['Sisa', totalIn - totalOut]);

    const nodes: FlowNode[] = [
      ...ins.map(([n], i) => ({ name: n, color: n === 'Dari saldo' ? '#94a3b8' : COLORS[(i + 5) % COLORS.length], side: 'in' as const })),
      { name: 'Uangmu', color: '#0f172a', side: 'hub' as const },
      ...outs.map(([n], i) => ({ name: n, color: n === 'Sisa' ? '#22c55e' : n === 'Tabungan' ? '#0ea5e9' : n === 'Investasi' ? '#10b981' : COLORS[i % COLORS.length], side: 'out' as const })),
    ];
    const hub = ins.length;
    const links = [
      ...ins.map(([, v], i) => ({ source: i, target: hub, value: Math.max(1, v) })),
      ...outs.map(([, v], i) => ({ source: hub, target: hub + 1 + i, value: Math.max(1, v) })),
    ];
    return { nodes, links, ins, outs, totalIn, totalOut, empty: ins.length === 0 && outs.length === 0 };
  }, [all, savings, month, year]);

  const total = Math.max(flow.totalIn, flow.totalOut, 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Ikuti uangmu</h1>
          <p className="mt-0.5 text-sm text-slate-500">Dari mana uangmu datang, dan ke mana saja perginya.</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <span className="min-w-[140px] text-center text-sm font-bold capitalize text-slate-900">{label}</span>
          <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label="Bulan berikutnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-100 bg-white p-4 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
        {all === null ? (
          <Skeleton className="h-[420px]" />
        ) : flow.empty ? (
          <div className="flex flex-col items-center py-12 text-center">
            <LeoMascot mood="idle" size={100} />
            <p className="mt-3 font-bold text-slate-900">Belum ada uang yang bergerak</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Catat uang masuk dan keluar, nanti di sini terlihat ke mana saja perginya.</p>
            <button type="button" onClick={() => openModal('harian')} className="mt-4 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Catat transaksi</button>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ height: Math.max(380, Math.max(flow.ins.length, flow.outs.length) * 44 + 40) }}>
            <div className="h-full min-w-[760px]">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={{ nodes: flow.nodes, links: flow.links }}
                  nodePadding={22}
                  nodeWidth={12}
                  margin={{ top: 24, right: 230, bottom: 10, left: 210 }}
                  link={{ stroke: '#c7d2fe', strokeOpacity: 0.45 }}
                  node={(props: SankeyNodeProps) => {
                    const { x, y, width, height } = props;
                    const payload = props.payload as unknown as FlowNode & { value: number };
                    const left = payload.side === 'in';
                    const hub = payload.side === 'hub';
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={Math.max(2, height)} rx={4} fill={payload.color} />
                        {!hub && (
                          <text x={left ? x - 10 : x + width + 10} y={y + height / 2} textAnchor={left ? 'end' : 'start'} dominantBaseline="middle" fontSize={12}>
                            <tspan fontWeight={700} fill="#1e293b">{categoryEmoji(payload.name)} {payload.name}</tspan>
                            <tspan fill="#64748b"> · {formatIDR(payload.value)}</tspan>
                          </text>
                        )}
                        {hub && (
                          <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={800} fill="#0f172a">Uangmu</text>
                        )}
                      </g>
                    );
                  }}
                >
                  <Tooltip formatter={(v) => formatIDR(Number(v))} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {!flow.empty && all !== null && (
        <div className="grid gap-5 md:grid-cols-2">
          {[
            { title: 'Masuk', total: flow.totalIn, rows: flow.ins, tone: 'text-emerald-600' },
            { title: 'Keluar', total: flow.totalOut, rows: flow.outs.filter(([n]) => n !== 'Sisa'), tone: 'text-rose-500' },
          ].map((col) => (
            <div key={col.title} className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="font-bold text-slate-900">{col.title}</p>
                <p className={`font-extrabold tabular-nums ${col.tone}`}>{formatIDR(col.total)}</p>
              </div>
              <ul className="space-y-2.5">
                {col.rows.map(([n, v]) => (
                  <li key={n}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-slate-700">{categoryEmoji(n)} {n}</span>
                      <span className="shrink-0 font-bold text-slate-900 tabular-nums">{formatIDR(v)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(v / total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

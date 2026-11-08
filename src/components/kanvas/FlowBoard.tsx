'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { computeFlow, rp, short, type FlowPeriod } from '@/lib/kanvas/data';
import { Board, type BoardEdge, type BoardHandle, type BoardNode } from '@/components/kanvas/Board';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { cn } from '@/lib/utils';

// "Dari catatanmu": uang masuk → rekening → kategori pengeluaran, tebal garis = besar uang.
const FLOW_W = 230;
const NARROW_W = 166;
const FLOW_H = 70;
const FLOW_GAP = 16;
const FLOW_COLX = [0, 360, 720];
const PERIODS: { id: FlowPeriod; label: string }[] = [
  { id: 'bulan', label: 'Bulan ini' },
  { id: 'bulan-lalu', label: 'Bulan lalu' },
  { id: '3-bulan', label: '3 bulan' },
];

export function FlowBoard({ tx, accounts }: { tx: Transaction[] | null; accounts: Account[] }) {
  const [period, setPeriod] = useState<FlowPeriod>('bulan');
  const [moved, setMoved] = useState<Record<string, [number, number]>>({});
  const [narrow, setNarrow] = useState(false);
  const board = useRef<BoardHandle>(null);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 640);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const flow = useMemo(() => (tx ? computeFlow(tx, accounts, period) : null), [tx, accounts, period]);
  useEffect(() => {
    // Periode berganti → susunan baru, pas di layar.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset posisi seret saat data periode berganti
    setMoved({});
    const t = setTimeout(() => board.current?.fit(), 60);
    return () => clearTimeout(t);
  }, [flow, narrow]);

  const nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];
  if (flow) {
    const cols = [0, 1, 2].map((c) => flow.nodes.filter((n) => n.col === c));
    const tallest = Math.max(1, ...cols.map((c) => c.length));
    const maxLink = Math.max(1, ...flow.links.map((l) => l.value));
    const tones = [
      'from-emerald-50 to-white ring-emerald-200 dark:from-emerald-500/10',
      'from-indigo-50 to-white ring-indigo-200 dark:from-indigo-500/10',
      'from-rose-50 to-white ring-rose-200 dark:from-rose-500/10',
    ];
    const totals = [flow.income, 0, flow.expense];
    // Layar lebar: 3 kolom kiri→kanan. HP: 3 pita atas→bawah, 2 kartu per baris (tetap terbaca tanpa zoom kecil).
    const W = narrow ? NARROW_W : FLOW_W;
    const layout: Record<string, [number, number]> = {};
    const heads = ['h-in', 'h-acc', 'h-out'];
    if (narrow) {
      let top = 0;
      cols.forEach((list, c) => {
        layout[heads[c]] = [0, top];
        list.forEach((n, i) => (layout[n.id] = [(i % 2) * (W + 12), top + 64 + Math.floor(i / 2) * (FLOW_H + 12)]));
        top += 64 + Math.ceil(list.length / 2) * (FLOW_H + 12) + 70;
      });
      layout.sisa = [0, top];
    } else {
      cols.forEach((list, c) => {
        layout[heads[c]] = [FLOW_COLX[c], 0];
        const offset = ((tallest - list.length) * (FLOW_H + FLOW_GAP)) / 2;
        list.forEach((n, i) => (layout[n.id] = [FLOW_COLX[c], offset + i * (FLOW_H + FLOW_GAP) + 70]));
      });
      layout.sisa = [FLOW_COLX[2] + FLOW_W + 90, 70];
    }
    // Lingkaran "Uang masuk" di depan kolom pemasukan.
    layout.mulai = narrow
      ? [W + 6 - 85, -190]
      : [
          -250,
          70 +
            (Math.max(1, cols[0].length) * (FLOW_H + FLOW_GAP)) / 2 -
            60 +
            ((tallest - cols[0].length) * (FLOW_H + FLOW_GAP)) / 2,
        ];
    const at = (id: string) => moved[id] ?? layout[id] ?? [0, 0];
    nodes.push({
      id: 'mulai',
      x: at('mulai')[0],
      y: at('mulai')[1],
      width: 170,
      content: (
        <div
          data-handle="mulai"
          className="cursor-grab rounded-[24px] bg-white p-3 text-center shadow-[0_14px_36px_-18px_rgba(15,23,42,.35)] ring-1 ring-slate-200/80 active:cursor-grabbing dark:bg-slate-900 dark:ring-slate-800"
        >
          <div className="flex justify-center">
            <LeoBadge topic="investasi" size={48} />
          </div>
          <p className="mt-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-slate-400">Mulai</p>
          <p className="text-[14px] font-black text-slate-900 dark:text-white">Uangmu datang</p>
        </div>
      ),
    });
    edges.push({ from: 'mulai', to: 'h-in', color: '#10b981', width: 2.5 });
    cols.forEach((list, c) => {
      list.forEach((n) => {
        const [x, y] = at(n.id);
        const pct = totals[c] ? Math.round((n.value / totals[c]) * 100) : null;
        nodes.push({
          id: n.id,
          x,
          y,
          width: W,
          content: (
            <div
              data-handle={n.id}
              className={cn(
                'flex h-[70px] cursor-grab flex-col justify-center rounded-2xl bg-gradient-to-br px-3.5 shadow-sm ring-1 active:cursor-grabbing dark:to-slate-900',
                tones[c],
              )}
            >
              <p className="truncate text-[13px] font-bold text-slate-600 dark:text-slate-300">{n.label}</p>
              <p className="text-[16px] font-black tabular-nums text-slate-900 dark:text-white">
                {rp(n.value)}{' '}
                {pct !== null ? <span className="text-[11.5px] font-bold text-slate-400">{pct}%</span> : null}
              </p>
              {n.sub ? <p className="truncate text-[10.5px] text-slate-400">{n.sub}</p> : null}
            </div>
          ),
        });
      });
    });
    const head = (id: string, label: string, value: number, cls: string) =>
      nodes.push({
        id,
        x: at(id)[0],
        y: at(id)[1],
        width: narrow ? W * 2 + 12 : W,
        content: (
          <div
            data-handle={id}
            className={cn('cursor-grab rounded-2xl px-3.5 py-2 text-white active:cursor-grabbing', cls)}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
            <p className="text-[17px] font-black tabular-nums">{rp(value)}</p>
          </div>
        ),
      });
    head('h-in', 'Uang masuk', flow.income, 'bg-emerald-600');
    head('h-acc', 'Lewat rekening', Math.max(flow.income, flow.expense), 'bg-indigo-600');
    head('h-out', 'Uang keluar', flow.expense, 'bg-rose-600');
    const left = flow.income - flow.expense;
    nodes.push({
      id: 'sisa',
      x: at('sisa')[0],
      y: at('sisa')[1],
      width: narrow ? W * 2 + 12 : 220,
      content: (
        <div
          data-handle="sisa"
          className="cursor-grab rounded-[22px] bg-slate-950 p-4 text-white shadow-xl active:cursor-grabbing"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Sisa {flow.label}</p>
          <p className={cn('text-[22px] font-black tabular-nums', left >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {rp(left)}
          </p>
          <p className="mt-1 text-[12px] text-white/60">
            {flow.income > 0
              ? `${Math.round((left / flow.income) * 100)}% dari uang masuk`
              : 'Belum ada pemasukan tercatat'}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-white/45">
            Transfer antar-rekening, beli investasi & utang-piutang tidak dihitung.
          </p>
        </div>
      ),
    });
    for (const l of flow.links)
      edges.push({
        from: l.from,
        to: l.to,
        width: 2 + (16 * l.value) / maxLink,
        color: l.from.startsWith('in:') ? '#10b981' : '#f43f5e',
      });
  }
  const onMove = (nid: string, x: number, y: number) => setMoved((m) => ({ ...m, [nid]: [x, y] }));

  return (
    <>
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="pointer-events-auto flex gap-1 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                'h-8 rounded-full px-3 text-[12.5px] font-bold',
                period === p.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {flow ? (
          <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/95 dark:ring-slate-700">
            {flow.label} · masuk {short(flow.income)} · keluar {short(flow.expense)}
          </span>
        ) : null}
      </div>
      <div className="absolute inset-0">
        {flow && !flow.links.length ? (
          <p className="absolute left-1/2 top-24 z-10 w-[min(90%,22rem)] -translate-x-1/2 rounded-2xl bg-white p-4 text-center text-[13.5px] font-semibold text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            Belum ada pemasukan/pengeluaran di periode ini. Coba periode lain, atau catat transaksi dulu.
          </p>
        ) : null}
        <Board ref={board} nodes={nodes} edges={edges} onMove={onMove} fitOnSizes padTop={72} />
      </div>
    </>
  );
}

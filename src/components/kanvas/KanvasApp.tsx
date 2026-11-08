'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, CloudOff, LayoutGrid, Plus, StickyNote, Trash2, Waypoints } from 'lucide-react';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { itemService } from '@/lib/services/itemService';
import { collectibleService } from '@/lib/services/collectibleService';
import { itemCurrentValue, type Item } from '@/lib/itemValue';
import { unitValueIdr, type Collectible } from '@/lib/collectibles';
import { computeNetWorth } from '@/lib/netWorth';
import { computeFlow, computeMetrics, rp, short, type FlowPeriod, type Metrics } from '@/lib/kanvas/data';
import { progressOf, templateById, TEMPLATES, type Ctx, type Template, type TemplateId } from '@/lib/kanvas/templates';
import {
  canvasMode,
  canvasService,
  type Canvas,
  type CanvasMeta,
  type CanvasState,
  type NoteColor,
} from '@/lib/kanvas/service';
import { newRequestId } from '@/lib/meals';
import { Board, type BoardEdge, type BoardHandle, type BoardNode, type Size } from '@/components/kanvas/Board';
import { ChapterNode, COLORS, FinalNode, NoteNode, type Edit } from '@/components/kanvas/cards';
import { cn } from '@/lib/utils';

type Route = { view: 'home' } | { view: 'arus' } | { view: 'board'; id: string };
const routeFromUrl = (): Route => {
  const q = new URLSearchParams(window.location.search);
  const id = q.get('id');
  if (id && /^[0-9a-f-]{36}$/i.test(id)) return { view: 'board', id };
  if (q.get('arus')) return { view: 'arus' };
  return { view: 'home' };
};

// Data keuangan untuk angka "Dari catatanmu" (sama dengan Kekayaan & Ringkasan).
function useFinance() {
  const [data, setData] = useState<{ tx: Transaction[]; accounts: Account[]; metrics: Metrics } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [accounts, tx, inv, sav, items, cols, fx] = await Promise.all([
        accountService.getUserAccounts('session').catch(() => [] as Account[]),
        transactionService.getUserTransactions('session').catch(() => [] as Transaction[]),
        investmentService.getUserInvestments('session').catch(() => [] as Investment[]),
        savingsService.getUserSavings('session').catch(() => [] as Saving[]),
        itemService.list().catch(() => [] as Item[]),
        collectibleService
          .list()
          .then((r) => r.items)
          .catch(() => [] as Collectible[]),
        exchangeRateService.getLatestRates().catch(() => ({}) as ExchangeRates),
      ]);
      const toIdr = (n: number, c?: string) => exchangeRateService.convert(n, c || 'IDR', 'IDR', fx);
      const nw = computeNetWorth({
        accounts,
        transactions: tx,
        investments: inv,
        savings: sav,
        toIdr,
        itemsValueIdr: items
          .filter((i) => i.status === 'aktif')
          .reduce((s, it) => s + toIdr(itemCurrentValue(it), it.currency), 0),
        collectiblesValueIdr: cols.reduce((s, c) => s + unitValueIdr(c, fx) * c.quantity, 0),
      });
      if (alive) setData({ tx, accounts, metrics: computeMetrics(tx, nw) });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

const EMPTY_METRICS = computeMetrics([], null);

export function KanvasApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const [route, setRoute] = useState<Route>({ view: 'home' });
  const fin = useFinance();
  useEffect(() => {
    const sync = () => setRoute(routeFromUrl());
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const go = useCallback((r: Route) => {
    const q = r.view === 'board' ? `?id=${r.id}` : r.view === 'arus' ? '?arus=1' : '';
    window.history.pushState(null, '', `${window.location.pathname}${q}`);
    setRoute(r);
  }, []);
  const backHref = variant === 'app' ? '/app/more' : '/membership/dashboard';
  const metrics = fin?.metrics ?? EMPTY_METRICS;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f6f5f1] text-slate-900 dark:bg-slate-950 dark:text-white">
      {route.view === 'home' ? (
        <Home backHref={backHref} metrics={metrics} ready={Boolean(fin)} go={go} />
      ) : route.view === 'arus' ? (
        <FlowBoard tx={fin?.tx ?? null} accounts={fin?.accounts ?? []} onBack={() => go({ view: 'home' })} />
      ) : (
        <TemplateBoard key={route.id} id={route.id} metrics={metrics} onBack={() => go({ view: 'home' })} />
      )}
    </div>
  );
}

function TopBar({
  onBack,
  backHref,
  title,
  sub,
  right,
}: {
  onBack?: () => void;
  backHref?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  const cls =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700';
  return (
    <div className="z-10 flex items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
      {backHref ? (
        <Link href={backHref} aria-label="Kembali" className={cls}>
          <ArrowLeft size={18} />
        </Link>
      ) : (
        <button type="button" aria-label="Kembali" onClick={onBack} className={cls}>
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-black tracking-tight">{title}</h1>
        {sub ? <p className="truncate text-[12px] font-semibold text-slate-500 dark:text-slate-400">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

// ── Beranda: Arus Uangku + kanvasku + template baru ───────────────────────
function Home({
  backHref,
  metrics,
  ready,
  go,
}: {
  backHref: string;
  metrics: Metrics;
  ready: boolean;
  go: (r: Route) => void;
}) {
  const [list, setList] = useState<CanvasMeta[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    canvasService
      .list()
      .then((l) => alive && setList(l))
      .catch((e) => alive && (setErr(e instanceof Error ? e.message : 'Gagal memuat kanvas.'), setList([])));
    return () => {
      alive = false;
    };
  }, []);
  const create = async (t: Template) => {
    setBusy(t.id);
    setErr('');
    try {
      const id = newRequestId();
      const n = (list ?? []).filter((x) => x.template === t.id).length;
      await canvasService.create(id, t.id, n ? `${t.title} ${n + 1}` : t.title);
      go({ view: 'board', id });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat kanvas.');
      setBusy(null);
    }
  };
  return (
    <>
      <TopBar backHref={backHref} title="Kanvas" sub="Rencanakan keuangan di papan bebas" />
      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="mx-auto max-w-5xl space-y-6">
          {canvasMode() === 'local' && list ? (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <CloudOff size={16} className="mt-0.5 shrink-0" /> Kanvas sedang disiapkan di server. Untuk sementara
              isianmu disimpan di perangkat ini.
            </p>
          ) : null}
          {err ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{err}</p>
          ) : null}

          <button
            type="button"
            onClick={() => go({ view: 'arus' })}
            className="group relative block w-full overflow-hidden rounded-[28px] bg-slate-950 p-5 text-left text-white shadow-xl dark:ring-1 dark:ring-white/10"
          >
            <svg
              className="absolute -right-6 top-0 h-full w-2/3 opacity-60"
              viewBox="0 0 300 160"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0,40 C100,40 120,80 200,70 S260,20 300,30"
                stroke="#34d399"
                strokeWidth="14"
                fill="none"
                strokeOpacity=".5"
              />
              <path
                d="M0,90 C90,90 130,120 210,110 S270,140 300,130"
                stroke="#fb7185"
                strokeWidth="10"
                fill="none"
                strokeOpacity=".5"
              />
              <path
                d="M0,130 C110,130 140,50 220,60 S280,90 300,80"
                stroke="#fbbf24"
                strokeWidth="6"
                fill="none"
                strokeOpacity=".5"
              />
            </svg>
            <div className="relative">
              <p className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.2em] text-emerald-300">
                <Waypoints size={13} /> Dari catatanmu
              </p>
              <p className="mt-1 text-[22px] font-black leading-tight">Arus Uangku</p>
              <p className="mt-1 max-w-[16rem] text-[13px] text-white/70">
                Dari mana uangmu datang, lewat rekening mana, habis ke mana.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/10 px-3 py-1">
                  Masuk ±{ready ? short(metrics.incomeAvg) : '…'}/bln
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1">
                  Keluar ±{ready ? short(metrics.expenseAvg) : '…'}/bln
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1 text-slate-950">
                  Buka <ChevronRight size={14} />
                </span>
              </div>
            </div>
          </button>

          {list && list.length ? (
            <section>
              <h2 className="mb-2 text-[15px] font-black">Kanvasku</h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const t = templateById(c.template);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go({ view: 'board', id: c.id })}
                      className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800"
                    >
                      <span
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-[22px]',
                          COLORS[t.color].head,
                        )}
                      >
                        {t.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-black">{c.title}</span>
                        <span className="block text-[12px] text-slate-500">
                          diubah{' '}
                          {new Date(c.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                      <ChevronRight size={18} className="text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-black">
              <Plus size={17} /> Kanvas baru
            </h2>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!list || busy !== null}
                  onClick={() => void create(t)}
                  className="relative overflow-hidden rounded-[22px] bg-white p-3.5 text-left sm:p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <span className={cn('absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', COLORS[t.color].head)} />
                  <span className="text-[26px]">{t.emoji}</span>
                  <span className="mt-1 block text-[15px] font-black">{busy === t.id ? 'Membuat…' : t.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{t.tagline}</span>
                  <span className="mt-2 block text-[11px] font-bold text-slate-400">
                    {t.chapters.length > 1 ? `${t.chapters.length} bab` : 'bebas'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ── Papan template ─────────────────────────────────────────────────────────
const NODE_W = 312;
const GAP_X = 96;
const GAP_Y = 96;

function autoLayout(ids: string[], sizes: Record<string, Size>, cols: number) {
  const pos: Record<string, [number, number]> = {};
  let top = 0;
  for (let r = 0; r * cols < ids.length; r++) {
    const row = ids.slice(r * cols, r * cols + cols);
    row.forEach((id, i) => (pos[id] = [i * (NODE_W + GAP_X), top]));
    top += Math.max(...row.map((id) => sizes[id]?.h ?? 420)) + GAP_Y;
  }
  return pos;
}

function TemplateBoard({ id, metrics, onBack }: { id: string; metrics: Metrics; onBack: () => void }) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [error, setError] = useState('');
  const [save, setSave] = useState<'ok' | 'dirty' | 'saving' | 'err'>('ok');
  const [msg, setMsg] = useState('');
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [cols, setCols] = useState(4);
  const board = useRef<BoardHandle>(null);
  const latest = useRef<Canvas | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    latest.current = canvas;
  }, [canvas]);
  useEffect(() => {
    const f = () => setCols(window.innerWidth < 640 ? 1 : window.innerWidth < 1180 ? 2 : 4);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    let alive = true;
    canvasService
      .get(id)
      .then((c) => alive && (c ? setCanvas(c) : setError('Kanvas tidak ditemukan.')))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Gagal memuat kanvas.'));
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(async () => {
    const c = latest.current;
    if (!c || inflight.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    inflight.current = true;
    setSave('saving');
    const sent = c;
    try {
      const rev = await canvasService.save(c.id, c.rev, c.state, c.title);
      setCanvas((cur) => (cur ? { ...cur, rev } : cur));
      latest.current = latest.current ? { ...latest.current, rev } : latest.current;
      setSave(latest.current && latest.current.state !== sent.state ? 'dirty' : 'ok');
    } catch (e) {
      // Diubah di perangkat lain (rev beda) → pakai versi server; selain itu tandai gagal & coba lagi nanti.
      const server = await canvasService.get(c.id).catch(() => null);
      if (server && server.rev !== c.rev) {
        setCanvas(server);
        setMsg('Kanvas ini baru diubah di perangkat lain — versi terbaru dimuat.');
        setSave('ok');
      } else {
        setSave('err');
        setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
      }
    } finally {
      inflight.current = false;
    }
  }, []);
  useEffect(() => {
    if (save === 'dirty' && !inflight.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    }
  }, [save, canvas, flush]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && latest.current && timer.current && void flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) void flush();
    };
  }, [flush]);

  const update = useCallback((f: (s: CanvasState) => CanvasState) => {
    setCanvas((c) => (c ? { ...c, state: f(c.state) } : c));
    setSave('dirty');
  }, []);
  const edit: Edit = useMemo(
    () => ({
      answer: (k, v) =>
        update((s) => {
          const answers = { ...s.answers };
          if (v.trim()) answers[k] = v;
          else delete answers[k];
          return { ...s, answers };
        }),
      toggle: (k) =>
        update((s) => {
          const done = { ...s.done };
          if (done[k]) delete done[k];
          else done[k] = true;
          return { ...s, done };
        }),
      num: (k, v) =>
        update((s) => {
          const nums = { ...s.nums };
          if (v === null) delete nums[k];
          else nums[k] = v;
          return { ...s, nums };
        }),
    }),
    [update],
  );

  const t = canvas ? templateById(canvas.template) : null;
  const state = canvas?.state;
  const ctx: Ctx | null = state ? { m: metrics, n: state.nums, done: state.done } : null;
  const flowIds = useMemo(() => (t ? [...t.chapters.map((c) => c.id), ...(t.goal ? ['akhir'] : [])] : []), [t]);
  const auto = useMemo(() => autoLayout(flowIds, sizes, cols), [flowIds, sizes, cols]);
  const at = (nid: string): [number, number] => state?.pos[nid] ?? auto[nid] ?? [0, 0];

  if (error)
    return (
      <>
        <TopBar onBack={onBack} title="Kanvas" />
        <p className="m-4 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{error}</p>
      </>
    );
  if (!canvas || !t || !state || !ctx)
    return (
      <>
        <TopBar onBack={onBack} title="Kanvas" sub="Memuat…" />
      </>
    );

  const prog = progressOf(t, state);
  const nodes: BoardNode[] = [
    ...t.chapters.map((ch, i) => {
      const one = progressOf({ ...t, chapters: [ch] }, state);
      const [x, y] = at(ch.id);
      return {
        id: ch.id,
        x,
        y,
        width: NODE_W,
        content: <ChapterNode ch={ch} index={i} c={ctx} state={state} edit={edit} stat={one} />,
      };
    }),
    ...(t.goal
      ? [
          {
            id: 'akhir',
            x: at('akhir')[0],
            y: at('akhir')[1],
            width: NODE_W,
            content: <FinalNode t={t} c={ctx} pct={prog.pct} />,
          },
        ]
      : []),
    ...state.notes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: 220,
      content: (
        <NoteNode
          note={n}
          onText={(v) => update((s) => ({ ...s, notes: s.notes.map((x) => (x.id === n.id ? { ...x, text: v } : x)) }))}
          onColor={(c: NoteColor) =>
            update((s) => ({ ...s, notes: s.notes.map((x) => (x.id === n.id ? { ...x, color: c } : x)) }))
          }
          onDelete={() => update((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== n.id) }))}
        />
      ),
    })),
  ];
  const edges: BoardEdge[] = flowIds
    .slice(1)
    .map((to, i) => ({ from: flowIds[i], to, color: COLORS[t.chapters[i]?.color ?? 'indigo'].stroke, width: 2.5 }));

  const onMove = (nid: string, x: number, y: number) => {
    if (state.notes.some((n) => n.id === nid))
      update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === nid ? { ...n, x, y } : n)) }));
    else update((s) => ({ ...s, pos: { ...s.pos, [nid]: [x, y] } }));
  };
  const addNote = () => {
    const c = board.current?.center() ?? { x: 0, y: 0 };
    const nid = `n${Date.now().toString(36)}`;
    if (state.notes.length >= 40) return setMsg('Maksimal 40 catatan per kanvas.');
    update((s) => ({
      ...s,
      notes: [...s.notes, { id: nid, text: '', x: Math.round(c.x - 110), y: Math.round(c.y - 60), color: 'kuning' }],
    }));
  };
  const tidy = () => {
    update((s) => ({ ...s, pos: {} }));
    setTimeout(() => board.current?.fit(), 50);
  };
  const remove = async () => {
    if (!window.confirm(`Hapus kanvas "${canvas.title}"? Isian di dalamnya ikut terhapus.`)) return;
    try {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      await canvasService.remove(canvas.id);
      onBack();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  };
  const rename = () => {
    const v = window.prompt('Nama kanvas', canvas.title)?.trim();
    if (v) {
      setCanvas((c) => (c ? { ...c, title: v.slice(0, 80) } : c));
      setSave('dirty');
    }
  };

  const pill =
    'flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold shadow-lg ring-1 ring-slate-200 backdrop-blur hover:bg-white dark:bg-slate-900/95 dark:ring-slate-700';
  return (
    <>
      <TopBar
        onBack={onBack}
        title={canvas.title}
        sub={`${t.emoji} ${prog.pct}% selesai · ${save === 'saving' ? 'menyimpan…' : save === 'dirty' ? 'belum tersimpan' : save === 'err' ? 'gagal menyimpan' : canvasMode() === 'local' ? 'tersimpan di perangkat' : 'tersimpan'}`}
        right={
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={rename}
              className="hidden h-10 rounded-full bg-white px-3.5 text-[12.5px] font-bold shadow-sm ring-1 ring-slate-200 sm:block dark:bg-slate-900 dark:ring-slate-700"
            >
              Ganti nama
            </button>
            <button
              type="button"
              aria-label="Hapus kanvas"
              onClick={() => void remove()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <Trash2 size={17} />
            </button>
          </div>
        }
      />
      {msg ? (
        <button
          type="button"
          onClick={() => setMsg('')}
          className="mx-4 mb-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-left text-[12.5px] font-semibold text-white"
        >
          {msg} <span className="opacity-60">· tutup</span>
        </button>
      ) : null}
      {save === 'err' ? (
        <button
          type="button"
          onClick={() => void flush()}
          className="mx-4 mb-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-left text-[12.5px] font-bold text-rose-700"
        >
          Belum tersimpan. Ketuk untuk coba lagi.
        </button>
      ) : null}
      <div className="relative flex-1">
        <Board
          ref={board}
          nodes={nodes}
          edges={edges}
          onMove={onMove}
          onSizes={setSizes}
          fitOnSizes={cols > 1}
          toolbar={
            <div className="flex gap-1.5">
              <button type="button" aria-label="Catatan" onClick={addNote} className={pill}>
                <StickyNote size={16} /> <span className="hidden sm:inline">Catatan</span>
              </button>
              <button type="button" aria-label="Rapikan" onClick={tidy} className={pill}>
                <LayoutGrid size={16} /> <span className="hidden sm:inline">Rapikan</span>
              </button>
            </div>
          }
        />
      </div>
    </>
  );
}

// ── Arus Uangku ────────────────────────────────────────────────────────────
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

function FlowBoard({ tx, accounts, onBack }: { tx: Transaction[] | null; accounts: Account[]; onBack: () => void }) {
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
    const at = (id: string) => moved[id] ?? layout[id] ?? [0, 0];
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
      <TopBar
        onBack={onBack}
        title="Arus Uangku"
        sub={flow ? `${flow.label} · masuk ${short(flow.income)} · keluar ${short(flow.expense)}` : 'Memuat catatanmu…'}
      />
      <div className="px-4 pb-2">
        <div className="mx-auto flex max-w-md gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                'h-9 flex-1 rounded-full text-[13px] font-bold',
                period === p.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex-1">
        {flow && !flow.links.length ? (
          <p className="absolute left-1/2 top-24 z-10 w-[min(90%,22rem)] -translate-x-1/2 rounded-2xl bg-white p-4 text-center text-[13.5px] font-semibold text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            Belum ada pemasukan/pengeluaran di periode ini. Coba periode lain, atau catat transaksi dulu.
          </p>
        ) : null}
        <Board ref={board} nodes={nodes} edges={edges} onMove={onMove} fitOnSizes />
      </div>
    </>
  );
}

export type { TemplateId };

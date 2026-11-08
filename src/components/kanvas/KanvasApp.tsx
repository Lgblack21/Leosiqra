'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CloudOff, LayoutGrid, MoreHorizontal, Plus, StickyNote, X } from 'lucide-react';
import { computeMetrics, type Metrics } from '@/lib/kanvas/data';
import { useFinance } from '@/components/kanvas/useFinance';
import {
  TEMPLATES,
  cardState,
  chapterProgress,
  counts,
  isDone,
  progressOf,
  skipKey,
  templateById,
  type Card,
  type Ctx,
  type Saran,
  type Template,
  type TemplateId,
} from '@/lib/kanvas/templates';
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
import { babColor, ChapterNode, COLORS, FinalNode, NoteNode, StartNode, TableNode } from '@/components/kanvas/cards';
import { Panel, type PanelActions } from '@/components/kanvas/Panel';
import { FlowBoard } from '@/components/kanvas/FlowBoard';
import { cn } from '@/lib/utils';

// Rute halaman web → halaman app HP (Capacitor). Yang tidak ada di app tetap memakai halaman web.
const APP_ROUTES: Record<string, string> = {
  '/membership/kekayaan': '/app/wallet',
  '/membership/cek-keuangan': '/app/cek-keuangan',
  '/membership/sehat': '/app/sehat',
  '/membership/recurring': '/app/recurring',
  '/membership/dompet-bersama': '/app/dompet-bersama',
  '/membership/transactions': '/app/transactions',
  '/membership/ladang': '/app/ladang',
};

const EMPTY_METRICS = computeMetrics([], null);

export function KanvasApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const fin = useFinance();
  const metrics = fin?.metrics ?? EMPTY_METRICS;
  const [list, setList] = useState<CanvasMeta[] | null>(null);
  const [tab, setTab] = useState<string>('arus');
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState('');
  const boardApi = useRef<{ tidy: () => void } | null>(null);
  const router = useRouter();
  const href = useCallback((h: string) => (variant === 'app' ? (APP_ROUTES[h.split('?')[0]] ?? h) : h), [variant]);

  const go = useCallback((t: string) => {
    const q = t === 'arus' ? '' : `?id=${t}`;
    window.history.replaceState(null, '', `${window.location.pathname}${q}`);
    setTab(t);
    setMenu(false);
  }, []);

  const create = useCallback(
    async (t: Template, current: CanvasMeta[]) => {
      setBusy(t.id);
      setErr('');
      try {
        const id = newRequestId();
        const n = current.filter((x) => x.template === t.id).length;
        const title = n ? `${t.title} ${n + 1}` : t.title;
        await canvasService.create(id, t.id, title);
        setList((l) => [{ id, template: t.id, title, rev: 0, updated_at: new Date().toISOString() }, ...(l ?? [])]);
        setPicker(false);
        go(id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Gagal membuat kanvas.');
      } finally {
        setBusy(null);
      }
    },
    [go],
  );

  useEffect(() => {
    let alive = true;
    canvasService
      .list()
      .then((l) => {
        if (!alive) return;
        setList(l);
        const q = new URLSearchParams(window.location.search);
        const id = q.get('id');
        const baru = q.get('baru');
        if (id && l.some((x) => x.id === id)) setTab(id);
        else if (baru && TEMPLATES.some((t) => t.id === baru)) void create(templateById(baru), l);
      })
      .catch((e) => alive && (setErr(e instanceof Error ? e.message : 'Gagal memuat kanvas.'), setList([])));
    return () => {
      alive = false;
    };
  }, [create]);

  const active = list?.find((x) => x.id === tab) ?? null;
  const t = active ? templateById(active.template) : null;

  const rename = async () => {
    if (!active) return;
    const v = window.prompt('Nama kanvas', active.title)?.trim().slice(0, 80);
    if (!v) return;
    setList((l) => (l ?? []).map((x) => (x.id === active.id ? { ...x, title: v } : x)));
    window.dispatchEvent(new CustomEvent('kanvas:rename', { detail: { id: active.id, title: v } }));
    setMenu(false);
  };
  const remove = async () => {
    if (!active || !window.confirm(`Hapus kanvas "${active.title}"? Isian di dalamnya ikut terhapus.`)) return;
    try {
      await canvasService.remove(active.id);
      setList((l) => (l ?? []).filter((x) => x.id !== active.id));
      go('arus');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  };

  const pill =
    'flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-bold shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800';
  return (
    <div
      className={cn(
        'flex flex-col text-slate-900 dark:text-white',
        variant === 'app'
          ? 'fixed inset-0 z-40 bg-[#f6f5f1] pt-[max(10px,env(safe-area-inset-top))] dark:bg-slate-950'
          : 'h-[calc(100dvh-11rem)] min-h-[560px] md:h-[calc(100dvh-8.5rem)]',
      )}
    >
      <div className={cn('flex items-start gap-3', variant === 'app' && 'px-4')}>
        {variant === 'app' ? (
          <Link
            href="/app/more"
            aria-label="Kembali"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            <ArrowLeft size={18} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-black tracking-tight">Kanvas</h1>
          <p className="line-clamp-1 text-[13px] text-slate-500 dark:text-slate-400">
            {tab === 'arus' ? 'Dari uang masuk sampai habis: ke mana uangmu mengalir' : (t?.tagline ?? subtitle)}
          </p>
        </div>
        {tab !== 'arus' && active ? (
          <button type="button" onClick={() => boardApi.current?.tidy()} className={pill}>
            <LayoutGrid size={16} /> <span className="hidden sm:inline">Rapikan</span>
          </button>
        ) : null}
      </div>

      <div className={cn('relative mt-3 flex items-center gap-2 overflow-x-auto pb-1', variant === 'app' && 'px-4')}>
        <button
          type="button"
          onClick={() => go('arus')}
          className={cn(
            'h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold ring-1 transition',
            tab === 'arus'
              ? 'bg-white ring-slate-900 dark:bg-slate-900 dark:ring-white'
              : 'text-slate-500 ring-slate-200 hover:text-slate-700 dark:ring-slate-700',
          )}
        >
          Dari catatanmu
        </button>
        {(list ?? []).map((c) => {
          const on = c.id === tab;
          return (
            <span key={c.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => (on ? setMenu((m) => !m) : go(c.id))}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold ring-1 transition',
                  on
                    ? 'bg-white ring-slate-900 dark:bg-slate-900 dark:ring-white'
                    : 'text-slate-500 ring-slate-200 hover:text-slate-700 dark:ring-slate-700',
                )}
              >
                <span>{templateById(c.template).emoji}</span>
                <span className="max-w-[11rem] truncate">{c.title}</span>
                {on ? <MoreHorizontal size={16} className="text-slate-400" /> : null}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          disabled={!list}
          onClick={() => setPicker(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-slate-600 ring-1 ring-dashed ring-slate-300 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-900"
        >
          <Plus size={16} /> Kanvas baru
        </button>
      </div>
      {menu && active ? (
        <div className={cn('mt-1 flex gap-2', variant === 'app' && 'px-4')}>
          <button
            type="button"
            onClick={() => void rename()}
            className="rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            Ganti nama
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold text-rose-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            Hapus kanvas
          </button>
        </div>
      ) : null}
      <p className={cn('mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-400', variant === 'app' && 'px-4')}>
        {canvasMode() === 'local' && list ? (
          <>
            <CloudOff size={13} /> Kanvas sedang disiapkan di server — sementara isianmu tersimpan di perangkat ini.
          </>
        ) : tab === 'arus' ? (
          'Diagram dari catatanmu sendiri. Transfer, beli investasi & utang-piutang tidak dihitung.'
        ) : (
          'Jawabanmu tersimpan di akun dan tidak mengubah catatan keuanganmu.'
        )}
      </p>
      {err ? (
        <p
          className={cn(
            'mt-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-[13px] font-semibold text-rose-700',
            variant === 'app' && 'mx-4',
          )}
        >
          {err}
        </p>
      ) : null}

      <div
        className={cn(
          'relative mt-3 flex-1 overflow-hidden',
          variant === 'app' ? '' : 'rounded-[28px] ring-1 ring-slate-200 dark:ring-slate-800',
        )}
      >
        {tab === 'arus' ? (
          <FlowBoard tx={fin?.tx ?? null} accounts={fin?.accounts ?? []} />
        ) : active ? (
          <TemplateBoard
            key={active.id}
            id={active.id}
            metrics={metrics}
            href={href}
            api={boardApi}
            onTitle={setSubtitle}
            onSaranHref={(h) => {
              const baru = /[?&]baru=([a-z-]+)/.exec(h)?.[1];
              if (baru && TEMPLATES.some((x) => x.id === baru)) void create(templateById(baru), list ?? []);
              else router.push(href(h));
            }}
          />
        ) : null}
      </div>

      {picker ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center"
          onClick={() => setPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-3xl sm:rounded-[28px] dark:bg-slate-950"
          >
            <div className="mb-3 flex items-center">
              <h2 className="flex-1 text-[18px] font-black">Kanvas baru</h2>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setPicker(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {TEMPLATES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void create(x, list ?? [])}
                  className="relative overflow-hidden rounded-[20px] bg-slate-50 p-3.5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <span className={cn('absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', COLORS[x.color].head)} />
                  <span className="text-[24px]">{x.emoji}</span>
                  <span className="mt-1 block text-[14.5px] font-black">{busy === x.id ? 'Membuat…' : x.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{x.tagline}</span>
                  <span className="mt-2 block text-[11px] font-bold text-slate-400">
                    {x.chapters.length > 1 ? `${x.chapters.length} bab` : 'bebas'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Papan template ─────────────────────────────────────────────────────────
const NODE_W = 300;
const COLORS_HEAD = (i: number) => babColor(i).head;
const GAP_X = 72;
const GAP_Y = 90;
const START = 220; // lebar kartu "Mulai di sini"
const START_H = 190;

type Layout = { pos: Record<string, [number, number]>; rows: string[][] };

function computeLayout(t: Template, sizes: Record<string, Size>, narrow: boolean): Layout {
  const ids = t.chapters.map((c) => c.id);
  const tablesAfter = (id: string) => (t.tables ?? []).filter((x) => x.after === id).map((x) => x.id);
  const h = (id: string, d = 480) => sizes[id]?.h ?? d;
  const pos: Record<string, [number, number]> = {};
  if (narrow) {
    let y = 0;
    pos.mulai = [(NODE_W - START) / 2, y];
    y += START_H + 60;
    for (const id of ids) {
      pos[id] = [0, y];
      y += h(id) + 70;
      for (const tb of tablesAfter(id)) {
        pos[tb] = [0, y];
        y += h(tb, 300) + 70;
      }
    }
    pos.akhir = [0, y];
    return { pos, rows: [ids] };
  }
  const split = ids.length >= 5 ? Math.ceil(ids.length / 2) : ids.length;
  const rows = [ids.slice(0, split), ids.slice(split)].filter((r) => r.length);
  const x0 = START + 80;
  let y = 0;
  let maxX = 0;
  const rowMid: number[] = [];
  rows.forEach((row) => {
    const rowH = Math.max(...row.map((id) => h(id)));
    row.forEach((id, i) => (pos[id] = [x0 + i * (NODE_W + GAP_X), y]));
    let x = x0 + row.length * (NODE_W + GAP_X);
    for (const id of row)
      for (const tb of tablesAfter(id)) {
        pos[tb] = [x, y + Math.max(0, (Math.min(rowH, 520) - h(tb, 300)) / 2)];
        x += NODE_W + 20 + GAP_X;
      }
    maxX = Math.max(maxX, x);
    rowMid.push(y + 60);
    y += rowH + GAP_Y;
  });
  pos.mulai = [0, rows.length > 1 ? y / 2 - GAP_Y / 2 - START_H / 2 : rowMid[0]];
  pos.akhir = [maxX, rows.length > 1 ? Math.max(0, y / 2 - GAP_Y / 2 - 200) : 0];
  return { pos, rows };
}

function TemplateBoard({
  id,
  metrics,
  href,
  api,
  onTitle,
  onSaranHref,
}: {
  id: string;
  metrics: Metrics;
  href: (h: string) => string;
  api: React.MutableRefObject<{ tidy: () => void } | null>;
  onTitle: (t: string) => void;
  onSaranHref: (h: string) => void;
}) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [error, setError] = useState('');
  const [save, setSave] = useState<'ok' | 'dirty' | 'saving' | 'err'>('ok');
  const [msg, setMsg] = useState('');
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [narrow, setNarrow] = useState(false);
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const board = useRef<BoardHandle>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const latest = useRef<Canvas | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    latest.current = canvas;
  }, [canvas]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const f = () => {
      setNarrow(el.clientWidth < 640);
      setWide(el.clientWidth >= 900);
    };
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    canvasService
      .get(id)
      .then((c) => alive && (c ? (setCanvas(c), onTitle(c.title)) : setError('Kanvas tidak ditemukan.')))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Gagal memuat kanvas.'));
    return () => {
      alive = false;
    };
  }, [id, onTitle]);
  useEffect(() => {
    const onRename = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; title: string }>).detail;
      if (d.id !== id) return;
      setCanvas((c) => (c ? { ...c, title: d.title } : c));
      setSave('dirty');
    };
    window.addEventListener('kanvas:rename', onRename);
    return () => window.removeEventListener('kanvas:rename', onRename);
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
      // Diubah di perangkat lain (rev beda) → pakai versi server; selain itu tandai gagal.
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
      timer.current = setTimeout(() => void flush(), 800);
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

  const t = canvas ? templateById(canvas.template) : null;
  const state = canvas?.state;
  const layout = useMemo(() => (t ? computeLayout(t, sizes, narrow) : null), [t, sizes, narrow]);
  const flat = useMemo(
    () => (t ? t.chapters.flatMap((ch, ci) => ch.cards.map((card) => ({ card, ch, ci }))) : []),
    [t],
  );

  useEffect(() => {
    api.current = {
      tidy: () => {
        update((s) => ({ ...s, pos: {} }));
        setTimeout(() => board.current?.fit(), 60);
      },
    };
  }, [api, update]);

  if (error)
    return <p className="m-4 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{error}</p>;
  if (!canvas || !t || !state || !layout)
    return (
      <div ref={wrap} className="flex h-full items-center justify-center text-[13px] text-slate-400">
        Memuat kanvas…
      </div>
    );

  const ctx: Ctx = { m: metrics, n: state.nums, a: state.answers, done: state.done };
  const prog = progressOf(t, state, metrics);
  const at = (nid: string): [number, number] => state.pos[nid] ?? layout.pos[nid] ?? [0, 0];
  const babDone = (cid: string) => chapterProgress(t.chapters.find((c) => c.id === cid)!, state, metrics).done;

  const act: PanelActions = {
    answer: (k, v) =>
      update((s) => {
        const answers = { ...s.answers };
        if (v) answers[k] = v;
        else delete answers[k];
        return { ...s, answers };
      }),
    toggle: (k, on) =>
      update((s) => {
        const done = { ...s.done };
        if (on) done[k] = true;
        else delete done[k];
        return { ...s, done };
      }),
    num: (k, v) =>
      update((s) => {
        const nums = { ...s.nums };
        if (v === null) delete nums[k];
        else nums[k] = v;
        return { ...s, nums };
      }),
    skip: (k, on) =>
      update((s) => {
        const done = { ...s.done };
        if (on) done[skipKey(k)] = true;
        else delete done[skipKey(k)];
        return { ...s, done };
      }),
    prev: () => {
      const i = flat.findIndex((x) => x.card.id === open);
      if (i > 0) setOpen(flat[i - 1].card.id);
    },
    next: () => {
      const i = flat.findIndex((x) => x.card.id === open);
      const rest = [...flat.slice(i + 1), ...flat.slice(0, i)];
      const nxt = rest.find((x) => counts(x.card) && !isDone(cardState(x.card, state, metrics))) ?? flat[i + 1];
      setOpen(nxt ? nxt.card.id : null);
    },
    close: () => setOpen(null),
    href,
  };

  const saran: Saran[] = [
    ...(t.saran?.(ctx) ?? []),
    ...t.chapters
      .map((ch, i) => ({ ch, i, p: chapterProgress(ch, state, metrics) }))
      .filter((x) => !x.p.done)
      .slice(0, 2)
      .map((x) => {
        const first = x.ch.cards.find((c) => counts(c) && !isDone(cardState(c, state, metrics)));
        return { text: `Jawab Bab ${x.i + 1}: ${x.ch.title}`, card: first?.id };
      }),
  ];
  const onSaran = (s: Saran) => {
    if (s.card) {
      setOpen(s.card);
      const it = flat.find((x) => x.card.id === s.card);
      if (it && narrow) goTo(it.ch.id);
    } else if (s.href) onSaranHref(s.href);
  };

  const nodes: BoardNode[] = [
    {
      id: 'mulai',
      x: at('mulai')[0],
      y: at('mulai')[1],
      width: START,
      content: <StartNode t={t} prog={prog} />,
    },
    ...t.chapters.map((ch, i) => ({
      id: ch.id,
      x: at(ch.id)[0],
      y: at(ch.id)[1],
      width: NODE_W,
      content: <ChapterNode ch={ch} index={i} s={state} c={ctx} selected={open} onOpen={setOpen} />,
    })),
    ...(t.tables ?? []).map((tb) => ({
      id: tb.id,
      x: at(tb.id)[0],
      y: at(tb.id)[1],
      width: NODE_W + 20,
      content: <TableNode kind={tb.kind} m={metrics} a={state.answers} />,
    })),
    {
      id: 'akhir',
      x: at('akhir')[0],
      y: at('akhir')[1],
      width: 340,
      content: <FinalNode t={t} c={ctx} prog={prog} saran={saran} onSaran={onSaran} />,
    },
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

  const dash = '#94a3b8';
  const edges: BoardEdge[] = [];
  const rowEnds: string[] = [];
  layout.rows.forEach((row) => {
    if (row.length)
      edges.push({
        from: 'mulai',
        to: row[0],
        color: babColor(t.chapters.findIndex((c) => c.id === row[0])).stroke,
        width: 3,
      });
    row.forEach((cid, i) => {
      const col = babColor(t.chapters.findIndex((c) => c.id === cid)).stroke;
      const tabs = (t.tables ?? []).filter((x) => x.after === cid).map((x) => x.id);
      const nextId = row[i + 1];
      if (nextId)
        edges.push({
          from: cid,
          to: nextId,
          color: babDone(cid) ? col : dash,
          dashed: !babDone(cid),
          width: babDone(cid) ? 3 : 2,
        });
      tabs.forEach((tb) =>
        edges.push({
          from: cid,
          to: tb,
          color: babDone(cid) ? col : dash,
          dashed: !babDone(cid),
          width: babDone(cid) ? 3 : 2,
        }),
      );
    });
    const last = row[row.length - 1];
    const lastTable = (t.tables ?? [])
      .filter((x) => row.includes(x.after))
      .map((x) => x.id)
      .pop();
    rowEnds.push(lastTable ?? last);
  });
  const allDone = prog.babDone === prog.babTotal;
  rowEnds.forEach((e) =>
    edges.push({ from: e, to: 'akhir', color: allDone ? '#10b981' : dash, dashed: !allDone, width: allDone ? 3 : 2 }),
  );

  const onMove = (nid: string, x: number, y: number) => {
    if (state.notes.some((n) => n.id === nid))
      update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === nid ? { ...n, x, y } : n)) }));
    else update((s) => ({ ...s, pos: { ...s.pos, [nid]: [x, y] } }));
  };
  const addNote = () => {
    if (state.notes.length >= 40) return setMsg('Maksimal 40 catatan per kanvas.');
    const c = board.current?.center() ?? { x: 0, y: 0 };
    const nid = `n${Date.now().toString(36)}`;
    update((s) => ({
      ...s,
      notes: [...s.notes, { id: nid, text: '', x: Math.round(c.x - 110), y: Math.round(c.y - 60), color: 'kuning' }],
    }));
  };

  const goTo = (nid: string) => {
    const [x, y] = at(nid);
    board.current?.focus(x - 8, y - 56, narrow ? 1 : 0.9);
  };
  const openItem = open ? flat.find((x) => x.card.id === open) : null;
  const panel = openItem ? (
    <Panel
      key={openItem.card.id}
      ch={openItem.ch}
      index={openItem.ci}
      card={openItem.card as Card}
      s={state}
      c={ctx}
      act={act}
      hasNext={flat.length > 1}
      step={{ i: openItem.ch.cards.findIndex((x) => x.id === openItem.card.id) + 1, n: openItem.ch.cards.length }}
    />
  ) : null;
  const pill =
    'flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold shadow-lg ring-1 ring-slate-200 backdrop-blur hover:bg-white dark:bg-slate-900/95 dark:ring-slate-700';

  return (
    <div ref={wrap} className="relative flex h-full">
      <div className="relative min-w-0 flex-1">
        {msg ? (
          <button
            type="button"
            onClick={() => setMsg('')}
            className="absolute left-3 right-3 top-3 z-20 rounded-2xl bg-slate-900 px-4 py-2.5 text-left text-[12.5px] font-semibold text-white"
          >
            {msg} <span className="opacity-60">· tutup</span>
          </button>
        ) : null}
        <div className="absolute left-3 right-28 top-3 z-10 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {t.chapters.map((ch, i) => {
            const p = chapterProgress(ch, state, metrics);
            return (
              <button
                key={ch.id}
                type="button"
                title={`Bab ${i + 1}: ${ch.title}`}
                onClick={() => goTo(ch.id)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold shadow-sm ring-1 backdrop-blur transition',
                  p.done
                    ? 'bg-emerald-500 text-white ring-emerald-500'
                    : 'bg-white/95 text-slate-700 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    p.done ? 'bg-white' : 'bg-gradient-to-br',
                    !p.done && COLORS_HEAD(i),
                  )}
                />
                {i + 1}
                <span className="hidden lg:inline">· {ch.title}</span>
                {p.done ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <span className="text-slate-400">
                    {p.got}/{p.total}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => goTo('akhir')}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-[12.5px] font-bold text-white shadow-sm dark:bg-white dark:text-slate-900"
          >
            🎯 {t.finalTitle}
          </button>
        </div>
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:ring-slate-700">
          {save === 'saving'
            ? 'Menyimpan…'
            : save === 'dirty'
              ? 'Belum tersimpan'
              : save === 'err'
                ? 'Gagal menyimpan'
                : canvasMode() === 'local'
                  ? 'Tersimpan di perangkat'
                  : 'Tersimpan'}
        </span>
        <Board
          ref={board}
          nodes={nodes}
          edges={edges}
          onMove={onMove}
          onSizes={setSizes}
          onReady={() => {
            const [x, y] = at('mulai');
            board.current?.focus(
              x - 8,
              (narrow ? y : Math.min(y, at(t.chapters[0].id)[1])) - 64,
              narrow ? 1 : 0.85,
              false,
            );
          }}
          toolbar={
            <button type="button" aria-label="Catatan" onClick={addNote} className={pill}>
              <StickyNote size={16} /> <span className="hidden sm:inline">Catatan</span>
            </button>
          }
        />
      </div>
      {panel && wide ? (
        <aside className="w-[400px] shrink-0 border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {panel}
        </aside>
      ) : null}
      {panel && !wide ? (
        <div className="fixed inset-0 z-[55] flex items-end bg-slate-950/30" onClick={() => setOpen(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-slate-950"
          >
            <div className="flex max-h-[85dvh] flex-col">{panel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { TemplateId };

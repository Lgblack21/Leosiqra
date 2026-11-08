'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Minus, Plus, Scan } from 'lucide-react';

export type BoardNode = { id: string; x: number; y: number; width: number; content: ReactNode; draggable?: boolean };
export type BoardEdge = { from: string; to: string; width?: number; color?: string; dashed?: boolean; label?: string };
export type BoardHandle = {
  fit: () => void;
  center: () => { x: number; y: number };
  // Geser kamera supaya titik dunia (x, y) ada di kiri-atas layar (dengan jarak), pada zoom k.
  focus: (x: number, y: number, k?: number, animate?: boolean) => void;
};
export type Size = { w: number; h: number };

const MIN_K = 0.2;
const MAX_K = 1.6;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

// Permukaan tak terbatas: geser latar untuk pan, cubit / Ctrl+scroll untuk zoom, seret kepala
// kartu (elemen [data-handle]) untuk memindahkan. Ukuran kartu diukur supaya garis & "Rapikan" pas.
export function Board({
  nodes,
  edges,
  onMove,
  onSizes,
  ref,
  toolbar,
  fitOnSizes,
  onReady,
}: {
  nodes: BoardNode[];
  edges: BoardEdge[];
  onMove?: (id: string, x: number, y: number, final: boolean) => void;
  onSizes?: (s: Record<string, Size>) => void;
  ref?: Ref<BoardHandle>;
  toolbar?: ReactNode;
  fitOnSizes?: boolean;
  // Dipanggil sekali saat semua kartu sudah terukur (mis. untuk posisi awal sendiri).
  onReady?: () => void;
}) {
  const view = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 40, y: 40, k: 1 });
  const camRef = useRef(cam);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const sizesRef = useRef(sizes);
  const nodesRef = useRef(nodes);
  useLayoutEffect(() => {
    camRef.current = cam;
    sizesRef.current = sizes;
    nodesRef.current = nodes;
  });
  const [grabbing, setGrabbing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
    | { kind: 'pinch'; d0: number; k0: number; mx: number; my: number; cx: number; cy: number }
    | { kind: 'node'; id: string; sx: number; sy: number; nx: number; ny: number; moved: boolean; pid: number }
    | null
  >(null);
  const fitted = useRef(false);

  const fit = useCallback(() => {
    const el = view.current;
    const list = nodesRef.current;
    if (!el || !list.length) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of list) {
      const s = sizesRef.current[n.id] ?? { w: n.width, h: 160 };
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + s.w);
      y1 = Math.max(y1, n.y + s.h);
    }
    const pad = 24;
    const bottom = 84; // ruang untuk toolbar zoom di bawah
    const k = clampK(Math.min((el.clientWidth - pad * 2) / (x1 - x0), (el.clientHeight - pad - bottom) / (y1 - y0), 1));
    setCam({
      k,
      x: (el.clientWidth - (x1 - x0) * k) / 2 - x0 * k,
      y: Math.max(pad, (el.clientHeight - bottom + pad - (y1 - y0) * k) / 2) - y0 * k,
    });
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      fit,
      focus: (x, y, k, animate = true) => {
        const el = view.current;
        if (!el) return;
        const nk = clampK(k ?? camRef.current.k);
        const pad = el.clientWidth < 640 ? 16 : 40;
        const target = { k: nk, x: pad - x * nk, y: 24 - y * nk };
        if (!animate) return setCam(target);
        // Animasi singkat (easeOutCubic) supaya pindah bab terasa meluncur, bukan melompat.
        const from = camRef.current;
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / 380);
          const e = 1 - (1 - p) ** 3;
          setCam({
            k: from.k + (target.k - from.k) * e,
            x: from.x + (target.x - from.x) * e,
            y: from.y + (target.y - from.y) * e,
          });
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      center: () => {
        const el = view.current;
        const c = camRef.current;
        return el ? { x: (el.clientWidth / 2 - c.x) / c.k, y: (el.clientHeight / 2 - c.y) / c.k } : { x: 0, y: 0 };
      },
    }),
    [fit],
  );

  // Ukur kartu (offsetWidth/Height = ukuran tata letak, tidak terpengaruh zoom).
  const observers = useRef(new Map<string, HTMLDivElement>());
  const ro = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    ro.current = new ResizeObserver((entries) => {
      setSizes((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const e of entries) {
          const el = e.target as HTMLDivElement;
          const id = el.dataset.node!;
          const s = { w: el.offsetWidth, h: el.offsetHeight };
          if (!prev[id] || prev[id].w !== s.w || prev[id].h !== s.h) {
            next[id] = s;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    observers.current.forEach((el) => ro.current!.observe(el));
    return () => ro.current?.disconnect();
  }, []);
  const nodeRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      const prev = observers.current.get(id);
      if (prev && prev !== el) ro.current?.unobserve(prev);
      if (el) {
        observers.current.set(id, el);
        ro.current?.observe(el);
      } else observers.current.delete(id);
    },
    [],
  );
  useEffect(() => {
    onSizes?.(sizes);
    if (!fitted.current && nodes.length && nodes.every((n) => sizes[n.id])) {
      fitted.current = true;
      if (onReady) onReady();
      else if (fitOnSizes) fit();
    }
  }, [sizes, onSizes, fitOnSizes, onReady, nodes, fit]);

  const zoomAt = useCallback((k: number, mx: number, my: number) => {
    setCam((c) => {
      const nk = clampK(k);
      return { k: nk, x: mx - ((mx - c.x) / c.k) * nk, y: my - ((my - c.y) / c.k) * nk };
    });
  }, []);
  const zoomBy = (f: number) => {
    const el = view.current;
    if (el) zoomAt(camRef.current.k * f, el.clientWidth / 2, el.clientHeight / 2);
  };

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Biarkan isian teks yang bisa digulir tetap menggulir.
      if ((e.target as HTMLElement).closest('textarea')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey)
        zoomAt(camRef.current.k * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setCam((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = view.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input,textarea,button,select,a,label')) return;
    const handle = target.closest<HTMLElement>('[data-handle]');
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    try {
      view.current?.setPointerCapture(e.pointerId);
    } catch {
      /* pointer sintetis */
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        k0: camRef.current.k,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        cx: camRef.current.x,
        cy: camRef.current.y,
      };
      return;
    }
    if (handle) {
      const id = handle.dataset.handle!;
      const n = nodesRef.current.find((x) => x.id === id);
      if (n && n.draggable !== false) {
        gesture.current = { kind: 'node', id, sx: p.x, sy: p.y, nx: n.x, ny: n.y, moved: false, pid: e.pointerId };
        return;
      }
    }
    if (target.closest('[data-node]') && !handle) return; // isi kartu: biarkan (pilih teks, gulir)
    gesture.current = { kind: 'pan', sx: p.x, sy: p.y, cx: camRef.current.x, cy: camRef.current.y };
    setGrabbing(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan') setCam((c) => ({ ...c, x: g.cx + p.x - g.sx, y: g.cy + p.y - g.sy }));
    else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const k = clampK((g.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, g.d0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      setCam({ k, x: mx - ((g.mx - g.cx) / g.k0) * k, y: my - ((g.my - g.cy) / g.k0) * k });
    } else if (g.kind === 'node' && e.pointerId === g.pid) {
      const k = camRef.current.k;
      const dx = (p.x - g.sx) / k;
      const dy = (p.y - g.sy) / k;
      if (!g.moved && Math.hypot(dx, dy) < 3) return;
      g.moved = true;
      onMove?.(g.id, Math.round(g.nx + dx), Math.round(g.ny + dy), false);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === 'node' && g.moved && e.pointerId === g.pid) {
      const n = nodesRef.current.find((x) => x.id === g.id);
      if (n) onMove?.(g.id, n.x, n.y, true);
    }
    gesture.current = null;
    setGrabbing(false);
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const anchor = (from: BoardNode, to: BoardNode) => {
    const fs = sizes[from.id] ?? { w: from.width, h: 120 };
    const ts = sizes[to.id] ?? { w: to.width, h: 120 };
    if (to.x >= from.x + fs.w - 10) {
      const x1 = from.x + fs.w;
      const y1 = from.y + Math.min(fs.h / 2, 80);
      const x2 = to.x;
      const y2 = to.y + Math.min(ts.h / 2, 80);
      const dx = Math.max(40, (x2 - x1) / 2);
      return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, ex: x2, ey: y2 };
    }
    const down = to.y >= from.y + fs.h;
    const x1 = from.x + fs.w / 2;
    const y1 = down ? from.y + fs.h : from.y;
    const x2 = to.x + ts.w / 2;
    const y2 = down ? to.y : to.y + ts.h;
    const dy = Math.max(40, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
    return { d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`, ex: x2, ey: y2 };
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f5f1] dark:bg-slate-950">
      <div
        ref={view}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(100,116,139,.28) 1px, transparent 1.2px)',
          backgroundSize: `${22 * cam.k}px ${22 * cam.k}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
          cursor: grabbing ? 'grabbing' : 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Fokus ke isian bisa membuat browser menggulir wadah ini; ubah jadi geser kamera supaya tetap konsisten.
        onScroll={(e) => {
          const el = e.currentTarget;
          if (!el.scrollTop && !el.scrollLeft) return;
          const dx = el.scrollLeft;
          const dy = el.scrollTop;
          el.scrollTop = 0;
          el.scrollLeft = 0;
          setCam((c) => ({ ...c, x: c.x - dx, y: c.y - dy }));
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.k})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            {edges.map((e, i) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const { d, ex, ey } = anchor(a, b);
              return (
                <g key={i}>
                  <path
                    d={d}
                    fill="none"
                    stroke={e.color ?? '#94a3b8'}
                    strokeWidth={e.width ?? 2}
                    strokeOpacity={e.width && e.width > 3 ? 0.35 : 0.9}
                    strokeDasharray={e.dashed ? '6 6' : undefined}
                    strokeLinecap="round"
                  />
                  <circle cx={ex} cy={ey} r={4} fill={e.color ?? '#94a3b8'} />
                </g>
              );
            })}
          </svg>
          {nodes.map((n) => (
            <div
              key={n.id}
              ref={nodeRef(n.id)}
              data-node={n.id}
              className="absolute select-text"
              style={{ left: n.x, top: n.y, width: n.width }}
            >
              {n.content}
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/95 p-1 shadow-lg ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700">
          <button
            type="button"
            aria-label="Perkecil"
            onClick={() => zoomBy(1 / 1.25)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Minus size={17} />
          </button>
          <span className="w-11 text-center text-[12px] font-bold tabular-nums text-slate-500">
            {Math.round(cam.k * 100)}%
          </span>
          <button
            type="button"
            aria-label="Perbesar"
            onClick={() => zoomBy(1.25)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            aria-label="Pas layar"
            onClick={fit}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Scan size={17} />
          </button>
        </div>
        {toolbar ? <div className="pointer-events-auto">{toolbar}</div> : null}
      </div>
    </div>
  );
}

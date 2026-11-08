'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  ArrowLeft,
  Camera,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Layers,
  Loader2,
  RotateCw,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { toBlob } from 'html-to-image';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { computeStoryStats, type StoryRange } from '@/lib/storyStats';
import { cn } from '@/lib/utils';
import { STICKERS, STICKER_GROUPS, stickerById, type StickerGroup } from './stickers';

// Stikerku — foto + stiker angka keuangan → gambar Story (9:16) / Post (4:5).
// Satu layar: halaman tidak menggulir; yang bisa digulir hanya daftar stiker.
// Gambar dibuat di perangkat (html-to-image); foto TIDAK diunggah ke server.

type Placed = { uid: string; id: string; x: number; y: number; scale: number; rot: number };
type Size = 'story' | 'post';
const BASE_W = 360; // kanvas logis; tampilan diskalakan, ekspor tanpa skala → 1080 px
const SIZES: Record<Size, { ratio: number; label: string; outW: number }> = {
  story: { ratio: 16 / 9, label: '9:16', outW: 1080 },
  post: { ratio: 5 / 4, label: '4:5', outW: 1080 },
};
const BACKGROUNDS = [
  { id: 'senja', name: 'Senja', css: 'linear-gradient(160deg,#FDBA74 0%,#F472B6 55%,#7C3AED 100%)' },
  { id: 'malam', name: 'Malam', css: 'radial-gradient(circle at 30% 20%,#4338CA 0%,#0F172A 60%,#020617 100%)' },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(160deg,#A7F3D0 0%,#5EEAD4 50%,#0EA5E9 100%)' },
  { id: 'krem', name: 'Krem', css: 'linear-gradient(180deg,#FFF7ED 0%,#FDE68A 100%)' },
  { id: 'leo', name: 'Leo', css: 'repeating-linear-gradient(45deg,#F59E0B 0 22px,#FBBF24 22px 44px)' },
  { id: 'hitam', name: 'Hitam', css: '#0B0B0F' },
];
type RangeId = StoryRange | 'bulan-lalu';
const RANGES: { id: RangeId; label: string }[] = [
  { id: 'hari', label: 'Hari' },
  { id: 'minggu', label: 'Minggu' },
  { id: 'bulan', label: 'Bulan' },
  { id: 'bulan-lalu', label: 'Bln lalu' },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const DEFAULT: Omit<Placed, 'uid'>[] = [
  { id: 'chip-tanggal', x: 0.5, y: 0.08, scale: 1, rot: 0 },
  { id: 'struk', x: 0.5, y: 0.55, scale: 0.95, rot: 0 },
  { id: 'leo-cap', x: 0.82, y: 0.2, scale: 0.8, rot: -8 },
];

export function StikerApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [range, setRange] = useState<RangeId>('hari');
  const [size, setSize] = useState<Size>('story');
  const [bg, setBg] = useState(BACKGROUNDS[0].id);
  const [photo, setPhoto] = useState<string | null>(null);
  const [hide, setHide] = useState(false);
  const [placed, setPlaced] = useState<Placed[]>(() => DEFAULT.map((p) => ({ ...p, uid: uid() })));
  const [sel, setSel] = useState<string | null>(null);
  const [group, setGroup] = useState<StickerGroup | 'Semua'>('Semua');
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Layar lebar (desktop / tablet mendatar): kanvas kiri, panel kanan. Selain itu: kanvas atas, panel bawah.
  const [wide, setWide] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const galIn = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    uid: string;
    mode: 'move' | 'turn';
    sx: number;
    sy: number;
    px: number;
    py: number;
    scale: number;
    rot: number;
    cx: number;
    cy: number;
    d0: number;
    a0: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    transactionService
      .getUserTransactions('session')
      .then((t) => alive && setTxs(t))
      .catch(() => alive && setLoadErr(true));
    return () => {
      alive = false;
    };
  }, []);
  // Dari notifikasi rekap bulanan (tgl 1): ?periode=bulan-lalu langsung memilih bulan lalu.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('periode');
    if (p && RANGES.some((r) => r.id === p)) setRange(p as RangeId);
  }, []);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);
  // Area kanvas mengikuti sisa layar; kanvas diskalakan agar muat penuh (lebar & tinggi).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const check = () =>
      setWide(window.innerWidth >= 1024 || (window.innerWidth >= 768 && window.innerWidth > window.innerHeight));
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const stats = useMemo(
    () =>
      range === 'bulan-lalu'
        ? computeStoryStats(txs ?? [], 'bulan', new Date(), true)
        : computeStoryStats(txs ?? [], range),
    [txs, range],
  );
  const W = BASE_W;
  const H = Math.round(BASE_W * SIZES[size].ratio);
  const k = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;
  const selected = placed.find((p) => p.uid === sel) ?? null;

  const pickFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setPhoto(URL.createObjectURL(f));
  };
  const add = (id: string) => {
    const p: Placed = { uid: uid(), id, x: 0.5, y: 0.5, scale: 0.8, rot: 0 };
    setPlaced((l) => [...l, p]);
    setSel(p.uid);
  };
  const update = (u: string, patch: Partial<Placed>) =>
    setPlaced((l) => l.map((p) => (p.uid === u ? { ...p, ...patch } : p)));
  const remove = (u: string) => {
    setPlaced((l) => l.filter((p) => p.uid !== u));
    setSel(null);
  };
  const toFront = (u: string) => setPlaced((l) => [...l.filter((p) => p.uid !== u), ...l.filter((p) => p.uid === u)]);

  // Geser (badan stiker) & putar+ubah ukuran (pegangan sudut) — jari maupun mouse.
  const start = (e: RPointerEvent, p: Placed, mode: 'move' | 'turn') => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvas.current!.getBoundingClientRect();
    const kk = rect.width / W;
    const cx = rect.left + p.x * rect.width;
    const cy = rect.top + p.y * rect.height;
    drag.current = {
      uid: p.uid,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      px: p.x,
      py: p.y,
      scale: p.scale,
      rot: p.rot,
      cx,
      cy,
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) / kk || 1,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    setSel(p.uid);
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer sintetis / sudah dilepas — geser tetap jalan lewat pointermove kanvas */
    }
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    if (d.mode === 'move') {
      const x = Math.min(1, Math.max(0, d.px + (e.clientX - d.sx) / rect.width));
      const y = Math.min(1, Math.max(0, d.py + (e.clientY - d.sy) / rect.height));
      update(d.uid, { x, y });
    } else {
      const kk = rect.width / W;
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / kk;
      const ang = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
      update(d.uid, {
        scale: Math.min(3, Math.max(0.3, d.scale * (dist / d.d0))),
        rot: Math.round(d.rot + ((ang - d.a0) * 180) / Math.PI),
      });
    }
  };
  const end = () => {
    drag.current = null;
  };

  const fileName = `leosiqra-${range}-${stats.now.toISOString().slice(0, 10)}.png`;
  const render = async () => {
    if (!canvas.current) return null;
    setSel(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return toBlob(canvas.current, {
      width: W,
      height: H,
      pixelRatio: SIZES[size].outW / W,
      style: { transform: 'none' },
      cacheBust: true,
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport !== undefined),
    });
  };
  const save = (blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const doExport = async (mode: 'share' | 'save') => {
    setBusy(mode);
    setMsg(null);
    try {
      const blob = await render();
      if (!blob) throw new Error('kosong');
      const file = new File([blob], fileName, { type: 'image/png' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cerita keuanganku' }).catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
        });
      } else {
        save(blob);
        setMsg(
          mode === 'share' ? 'Belum bisa berbagi langsung di perangkat ini — gambar disimpan.' : 'Gambar disimpan.',
        );
      }
    } catch {
      setMsg('Gagal membuat gambar. Coba lagi, atau ganti foto.');
    } finally {
      setBusy(null);
    }
  };

  const list = STICKERS.filter((s) => group === 'Semua' || s.group === group);
  const chip = (on: boolean) =>
    cn(
      'h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-bold transition',
      on
        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    );

  // ── Kanvas ──────────────────────────────────────────────────────────────
  const canvasEl = (
    <div ref={stage} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {k > 0 && (
        <div
          className="relative overflow-hidden rounded-[22px] shadow-[0_24px_50px_-22px_rgba(15,23,42,0.6)]"
          style={{ width: W * k, height: H * k }}
        >
          <div
            ref={canvas}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerDown={() => setSel(null)}
            className="absolute left-0 top-0 touch-none select-none overflow-hidden"
            style={{
              width: W,
              height: H,
              transform: `scale(${k})`,
              transformOrigin: 'top left',
              background: BACKGROUNDS.find((b) => b.id === bg)?.css,
            }}
          >
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- foto lokal (blob:), dirender ke gambar di perangkat
              <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            )}
            {placed.map((p) => {
              const def = stickerById(p.id);
              if (!def) return null;
              const active = p.uid === sel;
              const handle = 1 / (p.scale * k);
              return (
                <div
                  key={p.uid}
                  className="absolute"
                  style={{
                    left: p.x * W,
                    top: p.y * H,
                    width: def.w,
                    transform: `translate(-50%,-50%) rotate(${p.rot}deg) scale(${p.scale})`,
                    zIndex: active ? 50 : undefined,
                  }}
                >
                  <div
                    onPointerDown={(e) => start(e, p, 'move')}
                    className={cn(
                      'cursor-grab active:cursor-grabbing',
                      active && 'outline-2 outline-offset-4 outline-dashed outline-white/90',
                    )}
                  >
                    {def.render({ s: stats, hide })}
                  </div>
                  {active && (
                    <>
                      <button
                        data-noexport
                        type="button"
                        aria-label="Hapus stiker"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => remove(p.uid)}
                        className="absolute -left-3.5 -top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg"
                        style={{ transform: `scale(${handle})` }}
                      >
                        <X size={15} />
                      </button>
                      <button
                        data-noexport
                        type="button"
                        aria-label="Putar & ubah ukuran"
                        onPointerDown={(e) => start(e, p, 'turn')}
                        className="absolute -bottom-4 -right-4 flex h-8 w-8 touch-none items-center justify-center rounded-full bg-white text-slate-900 shadow-lg"
                        style={{ transform: `scale(${handle})` }}
                      >
                        <RotateCw size={15} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {selected && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              <button
                type="button"
                onClick={() => toFront(selected.uid)}
                className="flex h-8 items-center gap-1 rounded-full bg-black/60 px-3 text-[11.5px] font-bold text-white backdrop-blur"
              >
                <Layers size={13} /> Depan
              </button>
              <button
                type="button"
                onClick={() => update(selected.uid, { rot: 0, scale: 1 })}
                className="h-8 rounded-full bg-black/60 px-3 text-[11.5px] font-bold text-white backdrop-blur"
              >
                Luruskan
              </button>
              <button
                type="button"
                onClick={() => remove(selected.uid)}
                className="flex h-8 items-center gap-1 rounded-full bg-rose-500/90 px-3 text-[11.5px] font-bold text-white"
              >
                <Trash2 size={13} /> Hapus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Pengaturan ringkas (tanpa gulir) ────────────────────────────────────
  const settings = (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                'h-8 rounded-full text-[12.5px] font-bold transition',
                range === r.id ? 'bg-white text-slate-950 shadow dark:bg-slate-950 dark:text-white' : 'text-slate-500',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(Object.keys(SIZES) as Size[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={cn(
                'h-8 rounded-full px-2.5 text-[12px] font-bold',
                size === s ? 'bg-white text-slate-950 shadow dark:bg-slate-950 dark:text-white' : 'text-slate-500',
              )}
            >
              {SIZES[s].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setHide((h) => !h)}
          aria-pressed={hide}
          aria-label={hide ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
          title={hide ? 'Nominal disembunyikan' : 'Sembunyikan nominal'}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            hide ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {hide ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => camIn.current?.click()}
          aria-label="Foto dari kamera"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[12.5px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Camera size={15} /> <span className="hidden sm:inline">Kamera</span>
        </button>
        <button
          type="button"
          onClick={() => galIn.current?.click()}
          aria-label="Foto dari galeri"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[12.5px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ImagePlus size={15} /> <span className="hidden sm:inline">Galeri</span>
        </button>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
        <div className="flex min-w-0 gap-1.5 overflow-x-auto py-0.5">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Latar ${b.name}`}
              onClick={() => {
                setBg(b.id);
                setPhoto(null);
              }}
              className={cn(
                'h-8 w-8 shrink-0 rounded-full ring-2 ring-offset-1 dark:ring-offset-slate-950',
                bg === b.id && !photo ? 'ring-pink-400' : 'ring-transparent',
              )}
              style={{ background: b.css }}
            />
          ))}
        </div>
        <input
          ref={camIn}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <input
          ref={galIn}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );

  // ── Daftar stiker (satu-satunya bagian yang menggulir) ──────────────────
  const picker = (
    <div className={cn('flex flex-col', wide && 'min-h-0 flex-1')}>
      <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-2">
        {(['Semua', ...STICKER_GROUPS] as const).map((g) => (
          <button key={g} type="button" onClick={() => setGroup(g)} className={chip(group === g)}>
            {g}
          </button>
        ))}
      </div>
      {/* Lebar: grid digulir ke bawah. Tegak (HP): satu baris digeser ke samping. */}
      <div
        data-scroll
        className={cn(
          'overscroll-contain rounded-2xl pb-1',
          wide ? 'min-h-0 flex-1 overflow-y-auto' : 'shrink-0 overflow-x-auto',
        )}
      >
        <div className={cn('gap-2', wide ? 'grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5' : 'flex w-max')}>
          {list.map((s) => {
            const n = placed.filter((p) => p.id === s.id).length;
            const t = 92 / Math.max(s.w, 150);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s.id)}
                className={cn('group text-left', !wide && 'w-[96px] shrink-0')}
              >
                <div
                  className={cn(
                    'relative flex h-[84px] items-center justify-center overflow-hidden rounded-2xl ring-2 transition',
                    n ? 'ring-pink-400' : 'ring-transparent group-hover:ring-slate-300',
                  )}
                  style={{ background: 'linear-gradient(160deg,#334155,#0F172A)' }}
                >
                  <div className="pointer-events-none shrink-0" style={{ width: s.w, transform: `scale(${t})` }}>
                    {s.render({ s: stats, hide })}
                  </div>
                  {n > 0 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-pink-400 px-1.5 text-[10px] font-black text-slate-950">
                      ×{n}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                  {s.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const actions = (
    <div className="shrink-0">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!busy || !txs}
          onClick={() => doExport('share')}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 text-[14px] font-black text-slate-950 shadow-lg disabled:opacity-60"
        >
          {busy === 'share' ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />} Bagikan
        </button>
        <button
          type="button"
          disabled={!!busy || !txs}
          onClick={() => doExport('save')}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-slate-950 text-[14px] font-black text-white shadow-lg disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          {busy === 'save' ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Simpan
        </button>
      </div>
      <p
        className={cn(
          'mt-1.5 truncate text-center text-[11px] text-slate-500 dark:text-slate-400',
          !msg && '[@media(max-height:640px)]:hidden',
        )}
      >
        {msg ??
          (loadErr
            ? 'Data transaksi gagal dimuat — angka di stiker belum lengkap.'
            : `${stats.label} · ${txs ? `${stats.count} pengeluaran` : 'memuat…'} · foto tidak diunggah`)}
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#F8F7F4] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:bg-slate-950">
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 pb-2 pt-3 md:px-8 md:pt-5">
        <Link
          href={variant === 'app' ? '/app/more' : '/membership/dashboard'}
          aria-label={variant === 'app' ? 'Kembali' : 'Kembali ke Ringkasan'}
          className="group flex h-10 items-center gap-1.5 rounded-full bg-slate-950 pl-1.5 pr-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={16} />
          </span>
          <span className="hidden sm:inline">{variant === 'app' ? 'Kembali' : 'Ringkasan'}</span>
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[18px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[22px]">
            Stikerku
          </h1>
          <p className="truncate text-[11.5px] text-slate-500 [@media(max-height:640px)]:hidden dark:text-slate-400">
            Foto + angka keuanganmu, siap dibagikan
          </p>
        </div>
        <span className="flex h-10 items-center rounded-full bg-gradient-to-r from-amber-200 to-pink-200 px-3 text-[12px] font-black text-slate-900">
          {STICKERS.length} stiker
        </span>
      </header>

      {/* HP & tablet tegak: kanvas di atas, panel di bawah. Layar lebar: kanvas kiri, panel kanan. */}
      <main className={cn('flex min-h-0 flex-1 px-4 md:px-8', wide ? 'flex-row gap-8 pb-6' : 'flex-col gap-3 pb-3')}>
        <div className="flex min-h-0 min-w-0 flex-1">{canvasEl}</div>
        <section className={cn('flex flex-col gap-2.5', wide ? 'min-h-0 w-[min(560px,52%)] shrink-0' : 'shrink-0')}>
          {settings}
          {picker}
          {actions}
        </section>
      </main>
    </div>
  );
}

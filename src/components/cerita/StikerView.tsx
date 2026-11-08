'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Camera, Download, EyeOff, ImagePlus, Layers, Loader2, RotateCw, Share2, Trash2, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { computeStoryStats, type StoryRange } from '@/lib/storyStats';
import { cn } from '@/lib/utils';
import { STICKERS, STICKER_GROUPS, stickerById, type StickerGroup } from './stiker/stickers';

// Stiker Cerita: foto hari ini + stiker angka keuangan → gambar Story (9:16) / Post (4:5).
// Semua digambar di perangkat (html-to-image); foto TIDAK diunggah ke server.

type Placed = { uid: string; id: string; x: number; y: number; scale: number; rot: number };
type Size = 'story' | 'post';
const BASE_W = 360; // lebar kanvas logis; stiker diskalakan relatif terhadap ini
const SIZES: Record<Size, { ratio: number; label: string; hint: string; outW: number }> = {
  story: { ratio: 16 / 9, label: 'Story', hint: 'Story IG, WhatsApp, TikTok · 9:16', outW: 1080 },
  post: { ratio: 5 / 4, label: 'Post', hint: 'Feed Instagram · 4:5', outW: 1080 },
};
const BACKGROUNDS = [
  { id: 'senja', name: 'Senja', css: 'linear-gradient(160deg,#FDBA74 0%,#F472B6 55%,#7C3AED 100%)' },
  { id: 'malam', name: 'Malam', css: 'radial-gradient(circle at 30% 20%,#4338CA 0%,#0F172A 60%,#020617 100%)' },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(160deg,#A7F3D0 0%,#5EEAD4 50%,#0EA5E9 100%)' },
  { id: 'krem', name: 'Krem', css: 'linear-gradient(180deg,#FFF7ED 0%,#FDE68A 100%)' },
  { id: 'leo', name: 'Leo', css: 'repeating-linear-gradient(45deg,#F59E0B 0 22px,#FBBF24 22px 44px)' },
  { id: 'hitam', name: 'Hitam', css: '#0B0B0F' },
];
const RANGES: { id: StoryRange; label: string }[] = [
  { id: 'hari', label: 'Hari ini' },
  { id: 'minggu', label: 'Minggu ini' },
  { id: 'bulan', label: 'Bulan ini' },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const DEFAULT: Omit<Placed, 'uid'>[] = [
  { id: 'chip-tanggal', x: 0.5, y: 0.1, scale: 1, rot: 0 },
  { id: 'besar', x: 0.5, y: 0.72, scale: 1, rot: 0 },
  { id: 'leo-cap', x: 0.8, y: 0.25, scale: 0.85, rot: -8 },
];

export function StikerView() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [range, setRange] = useState<StoryRange>('hari');
  const [size, setSize] = useState<Size>('story');
  const [bg, setBg] = useState(BACKGROUNDS[0].id);
  const [photo, setPhoto] = useState<string | null>(null);
  const [hide, setHide] = useState(false);
  const [placed, setPlaced] = useState<Placed[]>(() => DEFAULT.map((p) => ({ ...p, uid: uid() })));
  const [sel, setSel] = useState<string | null>(null);
  const [group, setGroup] = useState<StickerGroup | 'Semua'>('Semua');
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
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
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);
  // Kanvas logis BASE_W px diskalakan agar pas lebar layar; ekspor memakai kanvas asli (tanpa skala).
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setK(el.clientWidth / BASE_W || 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stats = useMemo(() => computeStoryStats(txs ?? [], range), [txs, range]);
  const W = BASE_W;
  const H = Math.round(BASE_W * SIZES[size].ratio);
  const selected = placed.find((p) => p.uid === sel) ?? null;

  const pickFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setPhoto(URL.createObjectURL(f));
  };
  const add = (id: string) => {
    const p: Placed = { uid: uid(), id, x: 0.5, y: 0.5, scale: 0.8, rot: 0 };
    setPlaced((l) => [...l, p]);
    setSel(p.uid);
    // Layar kecil: kanvas ada di atas daftar stiker — gulir balik supaya stiker barunya terlihat.
    if (window.innerWidth < 1024) frame.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const update = (u: string, patch: Partial<Placed>) =>
    setPlaced((l) => l.map((p) => (p.uid === u ? { ...p, ...patch } : p)));
  const remove = (u: string) => {
    setPlaced((l) => l.filter((p) => p.uid !== u));
    setSel(null);
  };
  const toFront = (u: string) => setPlaced((l) => [...l.filter((p) => p.uid !== u), ...l.filter((p) => p.uid === u)]);

  // Geser (badan stiker) & putar+ubah ukuran (pegangan sudut) dengan pointer — jari maupun mouse.
  const start = (e: RPointerEvent, p: Placed, mode: 'move' | 'turn') => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvas.current!.getBoundingClientRect();
    const k = rect.width / W;
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
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) / k || 1,
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
      const k = rect.width / W;
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / k;
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
  const fileName = `leosiqra-${range}-${stats.now.toISOString().slice(0, 10)}.png`;
  const save = async (blob: Blob) => {
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
        await save(blob);
        setMsg(
          mode === 'share'
            ? 'Perangkat ini belum bisa berbagi langsung — gambar disimpan, unggah dari galeri.'
            : 'Gambar disimpan.',
        );
      }
    } catch {
      setMsg('Gagal membuat gambar. Coba lagi, atau ganti foto.');
    } finally {
      setBusy(null);
    }
  };

  const list = STICKERS.filter((s) => group === 'Semua' || s.group === group);

  return (
    <div className="grid gap-5 pb-28 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-8">
      {/* Kanvas */}
      <div className="lg:sticky lg:top-0 lg:self-start">
        <div className="mx-auto w-full max-w-[380px]">
          <div
            ref={frame}
            className="relative w-full overflow-hidden rounded-[28px] shadow-[0_30px_60px_-25px_rgba(15,23,42,0.55)]"
            style={{ aspectRatio: `${W} / ${H}` }}
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
              {!photo && (
                <div
                  data-noexport
                  className="pointer-events-none absolute inset-x-6 top-[38%] text-center text-[13px] font-semibold text-white/80"
                >
                  Tambah foto hari ini, atau pakai latar warna.
                </div>
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
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Geser stiker ke mana aja · tarik tombol <RotateCw size={11} className="inline" /> untuk putar & besarkan
          </p>
          {selected && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => toFront(selected.uid)}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Layers size={13} /> Ke depan
              </button>
              <button
                type="button"
                onClick={() => update(selected.uid, { rot: 0, scale: 1 })}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Luruskan
              </button>
              <button
                type="button"
                onClick={() => remove(selected.uid)}
                className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-bold text-rose-600 dark:bg-rose-500/15"
              >
                <Trash2 size={13} /> Hapus
              </button>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!!busy || !txs}
              onClick={() => doExport('share')}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 text-[14px] font-black text-slate-950 shadow-lg disabled:opacity-60"
            >
              {busy === 'share' ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />} Bagikan
            </button>
            <button
              type="button"
              disabled={!!busy || !txs}
              onClick={() => doExport('save')}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-slate-950 text-[14px] font-black text-white shadow-lg disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {busy === 'save' ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Simpan
            </button>
          </div>
          {msg && (
            <p className="mt-2 text-center text-[12px] font-semibold text-slate-600 dark:text-slate-300">{msg}</p>
          )}
          {loadErr && (
            <p className="mt-2 text-center text-[12px] font-semibold text-rose-600">
              Data transaksi gagal dimuat — angka di stiker belum lengkap.
            </p>
          )}
        </div>
      </div>

      {/* Pengaturan */}
      <div className="min-w-0 space-y-5">
        <section>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={cn(
                  'h-10 rounded-xl text-[13px] font-bold transition',
                  range === r.id
                    ? 'bg-white text-slate-950 shadow dark:bg-slate-950 dark:text-white'
                    : 'text-slate-500',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
            {stats.label} · {txs ? `${stats.count} pengeluaran` : 'memuat…'} · beli investasi & transfer tidak dihitung
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-extrabold text-slate-900 dark:text-white">
            Stiker <span className="text-[12px] font-semibold text-slate-400">{STICKERS.length} pilihan</span>
          </h3>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {(['Semua', ...STICKER_GROUPS] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={cn(
                  'h-9 shrink-0 rounded-full px-4 text-[13px] font-bold',
                  group === g
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {list.map((s) => {
              const n = placed.filter((p) => p.id === s.id).length;
              const k = 104 / Math.max(s.w, 150);
              return (
                <button key={s.id} type="button" onClick={() => add(s.id)} className="group text-left">
                  <div
                    className={cn(
                      'relative flex h-[104px] items-center justify-center overflow-hidden rounded-2xl ring-2 transition',
                      n ? 'ring-pink-400' : 'ring-transparent group-hover:ring-slate-300',
                    )}
                    style={{ background: 'linear-gradient(160deg,#334155,#0F172A)' }}
                  >
                    <div className="pointer-events-none shrink-0" style={{ width: s.w, transform: `scale(${k})` }}>
                      {s.render({ s: stats, hide })}
                    </div>
                    {n > 0 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-pink-400 px-1.5 text-[10px] font-black text-slate-950">
                        ×{n}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {s.name}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-extrabold text-slate-900 dark:text-white">Latar</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => camIn.current?.click()}
              className="flex h-10 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-[13px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Camera size={15} /> Kamera
            </button>
            <button
              type="button"
              onClick={() => galIn.current?.click()}
              className="flex h-10 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-[13px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ImagePlus size={15} /> Galeri
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="h-10 rounded-full bg-rose-50 px-4 text-[13px] font-bold text-rose-600 dark:bg-rose-500/15"
              >
                Hapus foto
              </button>
            )}
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
          <div className="mt-2 flex flex-wrap gap-2">
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
                  'h-10 w-10 rounded-full ring-2 ring-offset-2 dark:ring-offset-slate-900',
                  bg === b.id && !photo ? 'ring-pink-400' : 'ring-transparent',
                )}
                style={{ background: b.css }}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-extrabold text-slate-900 dark:text-white">
            Ukuran <span className="text-[12px] font-semibold text-slate-400">{SIZES[size].hint}</span>
          </h3>
          <div className="flex gap-2">
            {(Object.keys(SIZES) as Size[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSize(k)}
                className={cn(
                  'h-10 rounded-full px-5 text-[13px] font-bold',
                  size === k
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {SIZES[k].label}
              </button>
            ))}
          </div>
        </section>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
          <EyeOff size={18} className="text-slate-500" />
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-slate-900 dark:text-white">Sembunyikan nominal</span>
            <span className="block text-[12px] text-slate-500 dark:text-slate-400">
              Yang tampil hanya jumlah transaksi & persen
            </span>
          </span>
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
            className="h-5 w-5 accent-pink-500"
          />
        </label>

        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Gambarnya dibuat di perangkat ini, fotomu juga — tidak ada yang diunggah ke server sampai kamu sendiri yang
          membagikannya.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { shopService, type Shop } from '@/lib/services/shopService';
import { kindOf } from '@/lib/usaha/jenis';
import { cn } from '@/lib/utils';
import { CatalogImage } from '@/components/ladang/CatalogImage';

// Logo toko (style.logoUrl, dipakai kasir, struk, laporan, daftar toko). Dua cara: unggah gambar sendiri
// (Cloudinary, https) atau logo otomatis = SVG kecil (inisial/emoji di atas gradien), disimpan sebagai data URL
// (Worker membatasi ≤ 8.000 karakter, hanya data:image/*).
const PALETTES: [string, string][] = [
  ['#10b981', '#0f766e'],
  ['#8b5cf6', '#4c1d95'],
  ['#f97316', '#be123c'],
  ['#0ea5e9', '#1e3a8a'],
  ['#f59e0b', '#b45309'],
  ['#ec4899', '#7e22ce'],
  ['#111827', '#374151'],
  ['#22c55e', '#65a30d'],
];
const initialsOf = (name: string) =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'T';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const logoSvg = (text: string, [a, b]: [string, string], shape: 'kotak' | 'bulat', emoji: boolean) => {
  const bg =
    shape === 'bulat' ? `<circle cx='64' cy='64' r='64' fill='url(#g)'/>` : `<rect width='128' height='128' rx='30' fill='url(#g)'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>${bg}<circle cx='104' cy='24' r='30' fill='white' fill-opacity='.12'/><text x='64' y='${emoji ? 84 : 81}' font-family='Arial,Helvetica,sans-serif' font-size='${emoji ? 62 : text.length > 1 ? 50 : 62}' font-weight='800' fill='white' text-anchor='middle' letter-spacing='-1'>${esc(text)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export function LogoToko({ shop, onToast }: { shop: Shop; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState('');
  const [maker, setMaker] = useState(false);
  const [mode, setMode] = useState<'inisial' | 'emoji'>('inisial');
  const [shape, setShape] = useState<'kotak' | 'bulat'>('kotak');
  const [text, setText] = useState(() => initialsOf(shop.name));
  const fileRef = useRef<HTMLInputElement>(null);
  const emoji = shop.emoji || kindOf(shop.kind)?.emoji || '🏪';
  const logo = shop.style.logoUrl;
  const options = useMemo(
    () => PALETTES.map((p) => logoSvg(mode === 'emoji' ? emoji : text.slice(0, 3), p, shape, mode === 'emoji')),
    [mode, emoji, text, shape],
  );

  const save = async (logoUrl: string, msg: string) => {
    setBusy('save');
    try {
      await shopService.update(shop.id, { style: { ...shop.style, logoUrl } });
      onToast(msg);
      setMaker(false);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan logo.');
    }
    setBusy('');
  };
  const upload = async (file: File) => {
    setBusy('upload');
    try {
      const url = await uploadToCloudinary(file);
      await save(url, 'Logo toko diganti.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal mengunggah logo.');
      setBusy('');
    }
  };

  const btn =
    'flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 fs-13 font-bold transition-colors disabled:opacity-50';
  return (
    <section className="rounded-3xl p-4 ring-1 ring-slate-100 dark:ring-slate-800">
      <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Logo toko</p>
      <p className="mb-3 fs-12 text-slate-500 dark:text-slate-400">Tampil di daftar toko, kasir, struk, dan laporan.</p>
      <div className="flex items-center gap-4">
        <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[26px] bg-slate-50 fsh-40 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <CatalogImage src={logo} alt={`Logo ${shop.name}`} fallback={emoji} className="h-full w-full" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== ''}
            onClick={() => fileRef.current?.click()}
            className={cn(btn, 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900')}
          >
            {busy === 'upload' ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Unggah gambar
          </button>
          <button
            type="button"
            disabled={busy !== ''}
            onClick={() => setMaker((v) => !v)}
            className={cn(btn, 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300')}
          >
            <Sparkles size={15} /> Buat logo
          </button>
          {logo && (
            <button
              type="button"
              disabled={busy !== ''}
              onClick={() => {
                if (window.confirm('Hapus logo? Toko kembali memakai emoji.')) void save('', 'Logo dihapus.');
              }}
              className={cn(btn, 'px-3 text-slate-400 hover:bg-rose-50 hover:text-rose-600')}
              aria-label="Hapus logo"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
      </div>

      {maker && (
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center gap-2">
            {(['inisial', 'emoji'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'rounded-full px-3 py-1.5 fs-12 font-bold',
                  mode === m ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {m === 'inisial' ? 'Huruf' : `Emoji ${emoji}`}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            {(['kotak', 'bulat'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShape(s)}
                aria-pressed={shape === s}
                className={cn(
                  'rounded-full px-3 py-1.5 fs-12 font-bold capitalize',
                  shape === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {s}
              </button>
            ))}
            {mode === 'inisial' && (
              <input
                value={text}
                onChange={(e) => setText(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 3))}
                maxLength={3}
                aria-label="Huruf logo"
                className="h-9 w-20 rounded-full bg-white px-3 text-center fs-13 font-extrabold tracking-wider ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              />
            )}
          </div>
          <p className="fs-12 text-slate-500 dark:text-slate-400">Ketuk salah satu untuk dipakai:</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {options.map((src, i) => (
              <button
                key={i}
                type="button"
                disabled={busy !== ''}
                onClick={() => save(src, 'Logo baru dipasang.')}
                className="aspect-square overflow-hidden rounded-2xl ring-2 ring-transparent transition hover:scale-105 hover:ring-emerald-400 disabled:opacity-50"
                aria-label={`Pakai logo warna ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau SVG lokal */}
                <img src={src} alt="" className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

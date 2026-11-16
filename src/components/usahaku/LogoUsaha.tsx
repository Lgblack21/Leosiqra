'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Logo toko dengan bingkai yang MENGIKUTI gambarnya (permintaan Bos 2026-11-16):
// - logo berlatar penuh (mis. lingkaran emas di kotak hitam) → bingkai = warna tepi gambar, gambar memenuhi kotak;
// - logo transparan → bingkai terang + sedikit jarak (seperti stiker);
// - gagal dibaca (CORS) → gambar memenuhi kotak tanpa latar putih.
// Warna tepi dihitung sekali per gambar di perangkat (canvas kecil), disimpan di memori.
export type Tepi = { mode: 'penuh' | 'transparan' | 'tak-terbaca'; bg: string | null; gelap: boolean };
const cache = new Map<string, Tepi | Promise<Tepi>>();

export function bacaTepi(src: string): Promise<Tepi> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const p = new Promise<Tepi>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const n = 24;
        const c = document.createElement('canvas');
        c.width = n;
        c.height = n;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (!g) return resolve({ mode: 'tak-terbaca', bg: null, gelap: false });
        g.drawImage(img, 0, 0, n, n);
        const d = g.getImageData(0, 0, n, n).data;
        let r = 0;
        let gr = 0;
        let b = 0;
        let a = 0;
        let k = 0;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            if (x > 1 && x < n - 2 && y > 1 && y < n - 2) continue; // hanya 2 piksel tepi
            const i = (y * n + x) * 4;
            r += d[i];
            gr += d[i + 1];
            b += d[i + 2];
            a += d[i + 3];
            k++;
          }
        if (a / k < 160) return resolve({ mode: 'transparan', bg: null, gelap: false });
        const R = Math.round(r / k);
        const G = Math.round(gr / k);
        const B = Math.round(b / k);
        resolve({ mode: 'penuh', bg: `rgb(${R}, ${G}, ${B})`, gelap: 0.299 * R + 0.587 * G + 0.114 * B < 140 });
      } catch {
        resolve({ mode: 'tak-terbaca', bg: null, gelap: false });
      }
    };
    img.onerror = () => resolve({ mode: 'tak-terbaca', bg: null, gelap: false });
    img.src = src;
  });
  cache.set(src, p);
  void p.then((t) => cache.set(src, t));
  return p;
}

export function LogoUsaha({
  src,
  alt = '',
  fallback,
  className,
}: {
  src?: string | null;
  alt?: string;
  /** Emoji / inisial kalau belum ada logo atau gagal dimuat. */
  fallback: React.ReactNode;
  /** Ukuran & sudut bingkai, mis. "h-11 w-11 rounded-xl". */
  className?: string;
}) {
  const [tepi, setTepi] = useState<Tepi | null>(() => {
    const hit = src ? cache.get(src) : undefined;
    return hit && !(hit instanceof Promise) ? hit : null;
  });
  const [gagal, setGagal] = useState(false);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    void bacaTepi(src).then((t) => alive && setTepi(t));
    return () => {
      alive = false;
    };
  }, [src]);

  const base = 'flex shrink-0 items-center justify-center overflow-hidden';
  if (!src || gagal)
    return <span className={cn(base, 'bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700', className)}>{fallback}</span>;
  const penuh = tepi?.mode === 'penuh';
  const transparan = tepi?.mode === 'transparan';
  return (
    <span
      className={cn(
        base,
        penuh ? (tepi.gelap ? 'ring-1 ring-black/10 dark:ring-white/15' : 'ring-1 ring-black/5') : transparan ? 'bg-white ring-1 ring-slate-200 dark:ring-slate-700' : 'bg-slate-100 dark:bg-slate-800',
        className,
      )}
      style={penuh && tepi.bg ? { backgroundColor: tepi.bg } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logo dari tautan pengguna, static export tanpa optimizer */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setGagal(true)}
        className={cn('h-full w-full', transparan ? 'object-contain p-[12%]' : penuh ? 'object-contain' : 'object-cover')}
      />
    </span>
  );
}

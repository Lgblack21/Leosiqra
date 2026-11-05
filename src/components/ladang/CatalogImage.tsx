"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Gambar katalog (logo toko / gambar kategori) dari tautan https pengguna. Gagal
// dimuat → kembali ke isi cadangan (inisial/emoji). Referrer dimatikan.
export function CatalogImage({ src, alt, fallback, className }: { src?: string; alt: string; fallback: React.ReactNode; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- gambar dari situs pengguna, static export tanpa optimizer
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} className={cn('object-contain', className)} />;
}

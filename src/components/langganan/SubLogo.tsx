'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Logo layanan: ikon aplikasi resmi HD yang diunduh SAAT DEPLOY ke
// /logos/<domain>.png (scripts/fetch-logos.mjs) — file statis, cepat & tajam.
// Tidak lewat /api/logo: Worker gagal memanggil API App Store sehingga jatuh ke
// favicon kecil (pecah) dan lambat. Tanpa file → huruf pertama di warna merek.
const hashColor = (s: string) => `hsl(${[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 65% 48%)`;

export function SubLogo({
  name,
  domain,
  color,
  size = 44,
  className,
}: {
  name: string;
  domain?: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const src = domain ? `/logos/${domain}.png` : null;
  const [broken, setBroken] = useState<string | null>(null);
  const radius = Math.round(size * 0.28);
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5',
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {src && broken !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ikon statis kecil, tanpa optimasi (static export)
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-extrabold text-white"
          style={{ background: color || hashColor(name), fontSize: size * 0.42 }}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}

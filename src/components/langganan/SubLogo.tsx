"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { subLogoUrl } from '@/lib/subscriptions';

// Logo layanan: ikon resmi lewat Worker /api/logo (allowlist domain), cadangan
// huruf pertama di atas warna merek.
const hashColor = (s: string) => `hsl(${[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 65% 48%)`;

export function SubLogo({ name, domain, color, size = 44, className }: { name: string; domain?: string; color?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = subLogoUrl(domain);
  const radius = Math.round(size * 0.28);
  return (
    <span aria-hidden className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5', className)} style={{ width: size, height: size, borderRadius: radius }}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo dari API (butuh cookie sesi)
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-extrabold text-white" style={{ background: color || hashColor(name), fontSize: size * 0.42 }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}

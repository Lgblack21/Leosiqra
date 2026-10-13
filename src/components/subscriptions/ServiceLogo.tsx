"use client";

import { useState } from 'react';
import { serviceById, serviceLogoUrl } from '@/lib/subscriptionCatalog';

// Logo layanan langganan: logo dari domainnya, atau kotak warna merek + huruf
// pertama kalau logonya tidak ada / gagal dimuat. Favicon Google membalas
// bola dunia 16px untuk domain tanpa ikon — itu juga dianggap gagal.
export function ServiceLogo({ service, name, size = 40 }: { service?: string | null; name: string; size?: number }) {
  const s = serviceById(service);
  const src = serviceLogoUrl(s?.domain);
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.28);
  if (src && !failed) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-slate-100" style={{ width: size, height: size, borderRadius: radius }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="h-full w-full object-contain" loading="lazy" onError={() => setFailed(true)} onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setFailed(true)} />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center font-extrabold text-white"
      style={{ width: size, height: size, borderRadius: radius, background: s?.color ?? '#64748b', fontSize: size * 0.4 }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

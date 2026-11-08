'use client';

import { useEffect, useState } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

// Paket user dari /api/auth/me (GET di-cache bersama komponen lain). PRO dihitung aktif selama belum
// kedaluwarsa — sama dengan isProUser di Worker. null = belum termuat (jangan tampilkan label dulu).
export function usePlan() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    cloudflareApi<{ user?: { plan?: string | null; expiredAt?: string | null } | null }>('/api/auth/me')
      .then((r) => {
        const u = r.user;
        const pro = u?.plan === 'PRO' && (!u.expiredAt || new Date(u.expiredAt).getTime() > Date.now());
        if (alive) setIsPro(pro);
      })
      .catch(() => alive && setIsPro(null));
    return () => {
      alive = false;
    };
  }, []);
  return isPro;
}

"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

// Pintasan Kotak Masuk di samping lonceng (dulu menu Fitur). Angka = usulan
// transaksi yang menunggu ditinjau; diambil ulang saat pindah halaman (paling
// sering tiap 60 dtk) & saat tab aktif lagi. Gagal = tanpa angka.
let lastFetch = 0;
let lastCount = 0;

export function InboxButton() {
  const pathname = usePathname();
  const [count, setCount] = useState(lastCount);
  const active = pathname?.startsWith('/membership/kotak-masuk');

  useEffect(() => {
    let alive = true;
    const load = (force = false) => {
      if (!force && Date.now() - lastFetch < 60_000) return;
      lastFetch = Date.now();
      cloudflareApi<{ items?: unknown[] }>('/api/member/inbox')
        .then((r) => { lastCount = r.items?.length ?? 0; if (alive) setCount(lastCount); })
        .catch(() => undefined);
    };
    load(active);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, [pathname, active]);

  return (
    <Link
      href="/membership/kotak-masuk"
      aria-label={count ? `Kotak Masuk, ${count} usulan menunggu` : 'Kotak Masuk'}
      className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 shadow-sm', active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
    >
      <Inbox size={17} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

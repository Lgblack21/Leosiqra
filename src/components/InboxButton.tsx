"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

// Pintasan Kotak Masuk di samping lonceng. Angka = usulan
// transaksi yang menunggu ditinjau; diambil ulang saat pindah halaman (paling
// sering tiap 60 dtk) & saat tab aktif lagi. Gagal = tanpa angka.
let lastFetch = 0;
let lastCount = 0;
// Semua tombol yang sedang tampil ikut diperbarui saat angka datang — termasuk kalau effect
// sempat jalan ulang (hasil fetch pertama dulu terbuang & fetch kedua dilewati jeda 60 dtk).
const listeners = new Set<(n: number) => void>();

// variant "app" = ukuran & gaya tombol di header Beranda app HP (samping lonceng).
export function InboxButton({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const pathname = usePathname();
  const [count, setCount] = useState(lastCount);
  const href = variant === 'app' ? '/app/inbox' : '/membership/kotak-masuk';
  const active = pathname?.startsWith(href);

  useEffect(() => {
    listeners.add(setCount);
    const load = (force = false) => {
      if (!force && Date.now() - lastFetch < 60_000) return;
      lastFetch = Date.now();
      cloudflareApi<{ items?: unknown[] }>('/api/member/inbox')
        .then((r) => { lastCount = r.items?.length ?? 0; listeners.forEach((fn) => fn(lastCount)); })
        .catch(() => undefined);
    };
    load(active);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { listeners.delete(setCount); document.removeEventListener('visibilitychange', onVisible); };
  }, [pathname, active]);

  return (
    <Link
      href={href}
      aria-label={count ? `Kotak Masuk, ${count} usulan menunggu` : 'Kotak Masuk'}
      className={variant === 'app'
        ? 'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'
        : cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 shadow-sm', active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
    >
      <Inbox size={variant === 'app' ? 16 : 17} />
      {count > 0 && (
        <span className={cn('absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-indigo-500 px-1 font-bold text-white', variant === 'app' ? 'h-[16px] min-w-[16px] text-[9px] ring-2 ring-slate-50 dark:ring-slate-950' : 'h-[18px] min-w-[18px] text-[10px] ring-2 ring-white')}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

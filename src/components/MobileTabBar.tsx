"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { keuanganNav } from '@/lib/navigation';
import { usePrimaryAdd } from '@/lib/useRecordingPrefs';

// Tab bawah khusus HP (< md) di /membership: 4 halaman Keuangan + tombol
// tambah transaksi di tengah. Tablet & laptop memakai menu samping.
export function MobileTabBar() {
  const pathname = usePathname();
  const primaryAdd = usePrimaryAdd();
  const [left, right] = [keuanganNav.slice(0, 2), keuanganNav.slice(2, 4)];

  const tab = (item: (typeof keuanganNav)[number]) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold', active ? 'text-indigo-600' : 'text-slate-400')}
      >
        <item.icon size={22} strokeWidth={active ? 2.3 : 1.9} />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center px-2">
        {left.map(tab)}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={primaryAdd}
            aria-label="Tambah transaksi"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_12px_24px_-10px_rgba(79,70,229,0.8)] ring-4 ring-[#f6f7fb] active:scale-95"
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}

"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Flame, Mic, ScanLine, Plus } from 'lucide-react';
import { useModal } from '@/context/ModalContext';
import { cn } from '@/lib/utils';
import { findNavContext, tabsFor } from '@/lib/navigation';
import { useStreak } from '@/components/streak/CloseDay';
import { useFeatures } from '@/lib/features';

interface HeaderProps {
  onMenuClick?: () => void;
}

// Header gaya baru: judul halaman besar + aksi cepat (streak, struk, suara),
// lalu tab sub-halaman kalau halaman ini punya "keluarga" (mis. Investasi:
// Ringkasan · Saham · Deposito…). Tambah transaksi ada di sidebar; di HP
// lewat tombol + di kanan atas.
export const Header = ({ onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const { openModal } = useModal();
  const { title } = findNavContext(pathname);
  const tabs = tabsFor(pathname);
  // Streak, Struk, Suara cuma di Ringkasan — halaman lain tetap bersih.
  const isHome = pathname === '/membership/dashboard';
  const { isOn } = useFeatures();
  const { data: streak } = useStreak();

  return (
    <header className="sticky top-0 z-30 bg-slate-50/85 px-4 pb-3 pt-4 backdrop-blur-md md:px-8 md:pt-7 print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onMenuClick} aria-label="Buka menu" className="-ml-2 rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
            <Menu size={22} />
          </button>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-900 md:text-[30px]">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isHome && isOn('streak') && streak && (
            <Link
              href="/membership/streak"
              title={streak.todayKind ? 'Hari ini sudah ditutup' : 'Hari ini belum ditutup'}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-bold transition-colors',
                streak.todayKind ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100'
              )}
            >
              <Flame size={16} className={streak.todayKind ? 'fill-orange-400' : undefined} />
              <span className="tabular-nums">{streak.streak}</span>
            </Link>
          )}
          {isHome && (<>
          <button type="button" onClick={() => openModal('quick_scan')} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 md:px-4">
            <ScanLine size={16} /> <span className="hidden md:inline">Struk</span>
          </button>
          <button type="button" onClick={() => openModal('quick_voice')} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 md:px-4">
            <Mic size={16} /> <span className="hidden md:inline">Suara</span>
          </button>
          </>)}
          <button type="button" onClick={() => openModal('harian')} aria-label="Tambah transaksi" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white lg:hidden">
            <Plus size={18} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {tabs && (
        <nav aria-label="Sub-halaman" className="no-scrollbar mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={pathname === t.href ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                pathname === t.href ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};

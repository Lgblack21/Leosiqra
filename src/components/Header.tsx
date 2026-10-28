"use client";

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { findNavContext } from '@/lib/navigation';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
}

// Header atas: tombol menu (HP), judul halaman, dan lonceng notifikasi.
// Dropdown "Tambah Cepat" dihapus (2026-10-28, permintaan Bos) — mencatat
// lewat tombol "Tambah transaksi" di menu samping / tombol + (pintasan N).
export const Header = ({ onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const { title, group } = findNavContext(pathname);

  return (
    <header className="fixed top-0 right-0 left-0 md:left-[84px] lg:left-72 h-16 border-b border-slate-100 flex items-center justify-between gap-3 px-4 md:px-8 bg-[#f6f7fb]/95 z-30 print:hidden">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Buka menu"
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-control transition-all"
        >
          <Menu size={22} />
        </button>

        <nav aria-label="Lokasi halaman" className="flex items-center gap-1.5 min-w-0 text-[14px]">
          {group && (
            <>
              <span className="hidden sm:inline text-slate-400 truncate">{group}</span>
              <span className="hidden sm:inline text-slate-300">/</span>
            </>
          )}
          <span className="font-bold text-slate-900 truncate">{title}</span>
        </nav>
      </div>

      <NotificationBell />
    </header>
  );
};

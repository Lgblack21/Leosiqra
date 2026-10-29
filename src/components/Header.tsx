"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { InboxButton } from '@/components/InboxButton';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
}

// Tempat lonceng (dan tombol menu di HP) di baris judul halaman. Halaman yang
// punya baris judul besar memasang <HeaderSlot /> di ujung kanan baris itu.
// Boleh ada dua slot (mis. satu `sm:hidden`, satu `hidden sm:flex`) — yang
// dipakai yang sedang terlihat.
export const HeaderSlot = ({ className }: { className?: string }) => (
  <span data-header-slot className={`flex shrink-0 items-center gap-1.5 print:hidden ${className ?? ''}`} />
);

// Header tanpa judul kecil (judul cukup satu, di halaman — permintaan Bos
// 2026-10-28). Kalau halaman punya <HeaderSlot />, lonceng + tombol menu
// dipindah ke sana lewat portal supaya satu baris dengan judul; kalau tidak,
// tampil sebagai baris tipis di atas konten. Dropdown "Tambah Cepat" sudah
// dihapus — mencatat lewat "Tambah transaksi" di menu samping / tombol +.
export const Header = ({ onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // Slot baru ada setelah halaman dirender (bisa setelah data dimuat), jadi
  // dicari ulang tiap ada elemen yang ditambah/dihapus.
  useEffect(() => {
    const find = () =>
      setSlot([...document.querySelectorAll<HTMLElement>('[data-header-slot]')].find((el) => el.getClientRects().length > 0) ?? null);
    find();
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', find);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', find);
    };
  }, [pathname]);

  const menu = (
    <button
      type="button"
      onClick={onMenuClick}
      aria-label="Buka menu"
      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden"
    >
      <Menu size={22} />
    </button>
  );

  if (slot) return createPortal(<><InboxButton /><NotificationBell />{menu}</>, slot);

  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-3 md:justify-end md:px-8 md:pt-4 print:hidden">
      {menu}
      <span className="flex items-center gap-1.5">
        <InboxButton />
        <NotificationBell />
      </span>
    </header>
  );
};

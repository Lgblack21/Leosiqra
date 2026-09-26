"use client";

import { usePathname } from 'next/navigation';
import { Menu, Plus, ChevronDown, ArrowUpDown, Briefcase, PiggyBank, CreditCard, HandCoins, Target, RefreshCw, ArrowLeftRight, Globe, Landmark, Coins, Tags, Building2, type LucideIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useModal, ModalType } from '@/context/ModalContext';
import { cn } from '@/lib/utils';
import { findNavContext } from '@/lib/navigation';

interface HeaderProps {
  onMenuClick?: () => void;
}

interface QuickAction { id: ModalType; label: string; icon: LucideIcon; color: string }

// Dikelompokkan supaya 12 pintasan gak tampil sebagai satu daftar panjang.
const quickActionGroups: { label: string; items: QuickAction[] }[] = [
  {
    label: 'Transaksi',
    items: [
      { id: 'harian', label: 'Pemasukan / Pengeluaran', icon: ArrowUpDown, color: 'bg-emerald-50 text-emerald-600' },
      { id: 'topup_transfer', label: 'Transfer & Top Up', icon: ArrowLeftRight, color: 'bg-cyan-50 text-cyan-600' },
      { id: 'recurring', label: 'Transaksi Rutin', icon: RefreshCw, color: 'bg-slate-100 text-slate-600' },
    ],
  },
  {
    label: 'Aset & Investasi',
    items: [
      { id: 'rekening', label: 'Rekening Baru', icon: Building2, color: 'bg-blue-50 text-blue-600' },
      { id: 'tabungan', label: 'Tabungan', icon: PiggyBank, color: 'bg-rose-50 text-rose-600' },
      { id: 'saham', label: 'Saham', icon: Briefcase, color: 'bg-blue-50 text-blue-600' },
      { id: 'deposito', label: 'Deposito', icon: Landmark, color: 'bg-indigo-50 text-indigo-600' },
      { id: 'investasi_lain', label: 'Investasi Lainnya', icon: Coins, color: 'bg-purple-50 text-purple-600' },
      { id: 'kartu', label: 'Kartu Baru', icon: CreditCard, color: 'bg-rose-50 text-rose-600' },
    ],
  },
  {
    label: 'Perencanaan',
    items: [
      { id: 'hutang_piutang', label: 'Hutang & Piutang', icon: HandCoins, color: 'bg-orange-50 text-orange-600' },
      { id: 'budget_target', label: 'Budget & Target', icon: Target, color: 'bg-teal-50 text-teal-600' },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { id: 'ledger', label: 'Kategori', icon: Tags, color: 'bg-slate-100 text-slate-600' },
      { id: 'currency', label: 'Mata Uang', icon: Globe, color: 'bg-emerald-50 text-emerald-600' },
    ],
  },
];

export const Header = ({ onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const { openModal } = useModal();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { title, group } = findNavContext(pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-72 h-20 border-b border-slate-200 flex items-center justify-between gap-3 px-4 md:px-8 bg-white/80 backdrop-blur-md z-30 print:hidden">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Buka menu"
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-control transition-all"
        >
          <Menu size={22} />
        </button>

        <div className="flex flex-col min-w-0">
          {group && (
            <p className="text-label font-bold text-slate-400 uppercase leading-none mb-1 truncate">{group}</p>
          )}
          <h1 className="text-lg md:text-xl font-black text-slate-900 leading-tight truncate">{title}</h1>
        </div>
      </div>

      <div className="relative shrink-0" ref={dropdownRef} data-tour="tambah-cepat">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-expanded={isDropdownOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 bg-[#064e3b] text-white pl-3 pr-3 sm:pl-4 py-2.5 rounded-control text-sm font-bold shadow-lg shadow-emerald-900/10 hover:bg-[#054031] transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Tambah Cepat</span>
          <ChevronDown size={14} className={cn('transition-transform', isDropdownOpen && 'rotate-180')} />
        </button>

        {isDropdownOpen && (
          <div role="menu" className="absolute right-0 mt-2 w-72 bg-white border border-slate-100 rounded-card shadow-2xl z-50 animate-in overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {quickActionGroups.map((g) => (
                <div key={g.label} className="py-1">
                  <p className="px-3 pt-2 pb-1 text-label font-bold text-slate-400 uppercase">{g.label}</p>
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      role="menuitem"
                      onClick={() => {
                        openModal(item.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-control hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.color)}>
                        <item.icon size={16} />
                      </span>
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

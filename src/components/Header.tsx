"use client";

import { usePathname } from 'next/navigation';
import { Menu, PlusCircle, ChevronDown, TrendingUp, Briefcase, PiggyBank, CreditCard, Banknote, Target, RefreshCw, ArrowUpDown, Globe, type LucideIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useModal, ModalType } from '@/context/ModalContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const { openModal } = useModal();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems: { id: ModalType; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'harian', label: 'Transaksi Harian', icon: TrendingUp, color: 'text-emerald-600' },
    { id: 'saham', label: 'Investasi Saham', icon: Briefcase, color: 'text-blue-600' },
    { id: 'deposito', label: 'Deposito', icon: PiggyBank, color: 'text-indigo-600' },
    { id: 'investasi_lain', label: 'Investasi Lainnya', icon: Target, color: 'text-purple-600' },
    { id: 'tabungan', label: 'Tabungan', icon: PiggyBank, color: 'text-rose-600' },
    { id: 'hutang_piutang', label: 'Hutang & Piutang', icon: Banknote, color: 'text-orange-600' },
    { id: 'topup_transfer', label: 'Top Up & Transfer', icon: ArrowUpDown, color: 'text-cyan-600' },
    { id: 'budget_target', label: 'Budget dan Target', icon: Target, color: 'text-teal-600' },
    { id: 'recurring', label: 'Recurring', icon: RefreshCw, color: 'text-slate-600' },
    { id: 'ledger', label: 'Kategori Ledger', icon: Target, color: 'text-blue-900' },
    { id: 'currency', label: 'Mata Uang Dunia', icon: Globe, color: 'text-emerald-500' },
    { id: 'kartu', label: 'Kartu Baru', icon: CreditCard, color: 'text-rose-600' },
  ];

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-72 h-20 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-md z-30 print:hidden">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
        >
          <Menu size={22} />
        </button>

        <div className="flex flex-col">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">
            {pathname === '/membership/dashboard' ? 'Overview' : 'Reporting'}
          </h2>
          <h1 className="text-lg md:text-xl font-black text-slate-900 leading-none truncate max-w-[150px] xs:max-w-[200px] md:max-w-none">
            {{
              '/membership/dashboard': 'Monthly Dashboard',
              '/membership/annual': 'Annual Dashboard',
              '/membership/investment': 'Investment Dashboard',
              '/membership/cards': 'My Cards Dashboard',
              '/membership/transactions/input': 'Daily Transaction Input',
              '/membership/transactions/daily': 'Daily Transaction Log',
              '/membership/investasi/saham': 'Stock Investment Portfolio',
              '/membership/investasi/deposito': 'Time Deposits Portfolio',
              '/membership/investasi/lainnya': 'Other Investments',
              '/membership/tabungan': 'Savings Goals & Balance',
              '/membership/transactions/topup': 'Top Up & Transfer History',
              '/membership/transactions/debt': 'Debt & Receivables tracking',
              '/membership/rekening': 'Manage Accounts & Initial Balance',
              '/membership/nama-akun': 'Account Ledger Strategy',
              '/membership/budget': 'Fiscal Strategy & Budgeting',
              '/membership/recurring': 'Recurring Transactions Automation',
              '/membership/contact': 'Pro Activation & Payment Confirmation',
              '/membership/profile': 'User Identity & Preferences',
              '/membership/ai-leosiqra': 'Ethereal Portfolio Intelligence',
              '/membership/market-data': 'Global Market Intelligence Dashboard'
            }[pathname] || 'Dashboard'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Add Button & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 bg-[#064e3b] text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-100 hover:bg-[#054031] transition-all"
          >
            <PlusCircle size={16} />
            <span className="hidden sm:inline text-[#f0fdf4]">Tambah Cepat</span>
            <ChevronDown size={14} className={cn("transition-transform ml-1", isDropdownOpen && "rotate-180")} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-100 rounded-[24px] shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-5 py-2 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akses Cepat Transaksi</p>
              </div>
              <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        openModal(item.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group text-left"
                    >
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 group-hover:scale-110 transition-transform", item.color)}>
                        <Icon size={18} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
           System Status: Online
        </div>
      </div>
    </header>
  );
};

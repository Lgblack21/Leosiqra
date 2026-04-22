"use client";

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export const AdminHeader = ({ onMenuClick }: AdminHeaderProps) => {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-72 h-20 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-md z-30">
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
            Admin Consol
          </h2>
          <h1 className="text-lg md:text-xl font-black text-slate-900 leading-none truncate max-w-[150px] xs:max-w-[200px] md:max-w-none">
            {{
              '/admin/dashboard': 'Admin Dashboard Overview',
              '/admin/user': 'User Management',
              '/admin/pembayaran': 'Payment Confirmations',
              '/admin/laporan': 'Executive Reports',
              '/admin/pengaturan': 'System Configuration'
            }[pathname] || 'Admin Panel'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex px-4 py-2 rounded-full bg-slate-900 text-[10px] font-black text-white uppercase tracking-widest">
           Role: Master Admin
        </div>
      </div>
    </header>
  );
};

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Users,
  CreditCard,
  FileText,
  Settings,
  X,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const adminMenuGroups = [
  {
    label: 'Manajemen',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
      { icon: Users, label: 'User', href: '/admin/user' },
      { icon: CreditCard, label: 'Pembayaran', href: '/admin/pembayaran' },
      { icon: FileText, label: 'Laporan', href: '/admin/laporan' },
    ]
  },
  {
    label: 'Sistem',
    items: [
      { icon: Settings, label: 'Pengaturan', href: '/admin/pengaturan' },
    ]
  }
];

export const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<string[]>(['Manajemen']);
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
  } | null>(null);

  useEffect(() => {
    cloudflareApi<{ user?: {
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'user';
    } | null }>('/api/auth/me')
      .then((result) => setProfile(result.user ?? null))
      .catch(() => setProfile(null));
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  const isItemActive = (item: { label: string; href: string }) => {
    return pathname === item.href;
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  const handleLogout = async () => {
    try {
      await cloudflareApi('/api/auth/logout', { method: 'POST' });
      await router.push('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <>
      <aside className={cn(
        "fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header / Logo Section */}
        <div className="p-4 flex items-center justify-between shrink-0">
          <Link href="/admin/dashboard" className="block group flex-1" onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}>
            <div className="bg-slate-800 rounded-[20px] p-3 border border-slate-700 shadow-sm flex items-center gap-3 transition-all">
              <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden bg-white rounded-lg">
                <Image
                  src="/images/Logo-new.png"
                  alt="Leosiqra"
                  width={34}
                  height={34}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg text-white tracking-tight leading-none mb-1">Leosiqra</span>
                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.1em] leading-none">ADMIN PANEL</span>
              </div>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 custom-scrollbar mt-4">
          {adminMenuGroups.map((group) => {
            const isOpenGroup = openGroups.includes(group.label);
            return (
              <div key={group.label} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] hover:text-slate-300 transition-colors"
                >
                  {group.label}
                  {isOpenGroup ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {isOpenGroup && (
                  <div className="space-y-1 mt-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.label + item.href}
                        href={item.href}
                        onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                          isItemActive(item)
                            ? "text-indigo-400 font-bold bg-indigo-500/10"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        <item.icon size={18} className={cn(
                          "transition-colors",
                          isItemActive(item) ? "text-indigo-400" : "group-hover:text-white"
                        )} />
                        <span className="text-[13px]">{item.label}</span>
                        {isItemActive(item) && (
                          <div className="absolute left-0 w-1 h-4 bg-indigo-400 rounded-r-full" />
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 mt-auto border-t border-slate-800 bg-slate-900/50 shrink-0 space-y-4">
          {/* Profile Card */}
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-2xl shadow-sm group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-indigo-900/20 transform group-hover:scale-110 transition-transform">
                {profile ? getInitials(profile.name) : '??'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-black text-white truncate pr-2">
                  {profile?.name || 'Loading...'}
                </span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Administrator
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-bold text-[13px]"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
          .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        `}</style>
      </aside>
    </>
  );
};

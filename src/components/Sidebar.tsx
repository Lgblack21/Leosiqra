"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Bot,
  PlusCircle,
  PieChart,
  Banknote,
  Briefcase,
  Wallet,
  ArrowUpDown,
  UserCircle,
  User,
  Settings,
  Target,
  Repeat,
  Globe,
  Headphones,
  ChevronDown,
  X,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuGroups = [
  {
    label: 'Utama',
    items: [
      { icon: LayoutDashboard, label: 'Bulanan', href: '/membership/dashboard' },
      { icon: Calendar, label: 'Tahunan', href: '/membership/annual' },
      { icon: ShieldCheck, label: 'Pajak Center', href: '/membership/pajak-center' },
    ]
  },
  {
    label: 'Investasi',
    items: [
      { icon: TrendingUp, label: 'Dashboard Investasi', href: '/membership/investment' },
      { icon: Briefcase, label: 'Investasi Saham', href: '/membership/investasi/saham' },
      { icon: Banknote, label: 'Deposito', href: '/membership/investasi/deposito' },
      { icon: PieChart, label: 'Investasi Lainnya', href: '/membership/investasi/lainnya' },
      { icon: Globe, label: 'Data Pasar', href: '/membership/market-data' },
    ]
  },
  {
    label: 'Transaksi',
    items: [
      { icon: PlusCircle, label: 'Input Transaksi', href: '/membership/transactions/input' },
      { icon: ArrowUpDown, label: 'Transaksi Harian', href: '/membership/transactions/daily' },
      { icon: ArrowUpDown, label: 'Top Up & Transfer', href: '/membership/transactions/topup' },
      { icon: Repeat, label: 'Recurring', href: '/membership/recurring' },
    ]
  },
  {
    label: 'Perencanaan',
    items: [
      { icon: Wallet, label: 'Tabungan', href: '/membership/tabungan' },
      { icon: Target, label: 'Budget & Target', href: '/membership/budget' },
      { icon: Banknote, label: 'Hutang & Piutang', href: '/membership/transactions/debt' },
    ]
  },
  {
    label: 'Akun & Profil',
    items: [
      { icon: User, label: 'Profil', href: '/membership/profile' },
      { icon: Settings, label: 'Rekening', href: '/membership/rekening' },
      { icon: UserCircle, label: 'Nama Akun', href: '/membership/nama-akun' },
      { icon: CreditCard, label: 'Kartu Saya', href: '/membership/cards' },
    ]
  },
  {
    label: 'Lainnya',
    items: [
      { icon: Bot, label: 'AI Leosiqra', href: '/membership/ai-leosiqra' },
      { icon: Headphones, label: 'Hubungi Kami', href: '/membership/contact' },
    ]
  }
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<string[]>(['Utama']);
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    plan: 'FREE' | 'PRO';
    status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
    photoURL?: string;
    expiredAt?: string;
  } | null>(null);

  useEffect(() => {
    cloudflareApi<{ user?: {
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'user';
      plan: 'FREE' | 'PRO';
      status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
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

  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPro = async () => {
    if (!profile?.id) return;
    setIsRequesting(true);
    try {
      alert('Mode Cloudflare aktif: request akses Pro dari sidebar belum tersedia. Hubungi admin untuk aktivasi manual sementara.');
    } catch (error) {
      console.error('Error requesting pro:', error);
      alert('Gagal mengirim permintaan. Silakan coba lagi nanti.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await cloudflareApi('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getRemainingDays = () => {
    if (!profile?.expiredAt) return null;
    const now = new Date();
    const exp = new Date(profile.expiredAt);
    const diffTime = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const remainingDays = getRemainingDays();

  return (
    <>
      <aside className={cn(
        "fixed top-0 left-0 h-full w-72 bg-slate-50 border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto print:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header / Logo Section */}
        <div className="p-4 flex items-center justify-between shrink-0">
          <Link href="/" className="block group flex-1" onClick={() => { if (window.innerWidth < 1024) onClose?.(); }}>
            <div className="bg-white rounded-[20px] p-3 border border-slate-100 shadow-sm flex items-center gap-3 transition-all">
              <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/images/Logo-new.png"
                  alt="Leosiqra"
                  width={34}
                  height={34}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg text-slate-900 tracking-tight leading-none mb-1">Leosiqra</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none">MEMBER WORKSPACE</span>
              </div>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 custom-scrollbar">
          {profile?.status === 'GUEST' || profile?.status === 'PENDING' ? (
            <div className="py-10 px-2 space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="w-16 h-16 rounded-[24px] bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100 shadow-sm relative">
                <ShieldCheck size={32} />
                {profile?.status === 'PENDING' && (
                  <div className="absolute inset-0 rounded-[24px] border-2 border-indigo-600 border-t-transparent animate-spin" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  {profile?.status === 'PENDING' ? 'Sedang Diverifikasi' : 'Akses Terbatas'}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                  {profile?.status === 'PENDING' 
                    ? 'Permintaan akses Anda sudah terkirim. Admin akan memverifikasi data Anda segera.' 
                    : 'Akun Anda sedang dalam status tamu. Silakan ajukan akses member untuk melihat dashboard.'}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {profile?.status === 'GUEST' ? (
                  <button 
                    onClick={handleRequestPro}
                    disabled={isRequesting}
                    className={cn(
                      "w-full py-4 bg-indigo-600 text-white text-[11px] font-black rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group",
                      isRequesting && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {isRequesting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        🚀 Request Akses
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-4 bg-slate-100 text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 uppercase tracking-widest">
                    Menunggu Konfirmasi...
                  </div>
                )}
              </div>
            </div>
          ) : (
            menuGroups.map((group) => {
              const isOpenGroup = openGroups.includes(group.label);
              return (
                <div key={group.label} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] hover:text-slate-600 transition-colors"
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
                              ? "text-indigo-600 font-bold bg-indigo-50/50"
                              : "text-slate-500 hover:text-indigo-600 hover:bg-slate-100/50"
                          )}
                        >
                          <item.icon size={18} className={cn(
                            "transition-colors",
                            isItemActive(item) ? "text-indigo-600" : "group-hover:text-indigo-600"
                          )} />
                          <span className="text-[13px]">{item.label}</span>
                          {isItemActive(item) && (
                            <div className="absolute left-0 w-1 h-4 bg-indigo-600 rounded-r-full" />
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 mt-auto border-t border-slate-200 bg-white/50 shrink-0 space-y-4">
          {/* Profile Card */}
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-indigo-100 transform group-hover:scale-110 transition-transform overflow-hidden relative">
                {profile?.photoURL ? (
                  <Image 
                    src={profile.photoURL} 
                    alt={profile.name} 
                    fill 
                    unoptimized
                    className="object-cover" 
                  />
                ) : (
                  profile ? getInitials(profile.name) : '??'
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-black text-slate-900 truncate pr-2">
                  {profile?.name || 'Loading...'}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                  {profile?.role || 'Member'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 hidden md:block">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                 <p className={cn(
                   "text-[9px] font-black uppercase tracking-wider leading-none",
                   profile?.plan === 'PRO' ? "text-emerald-600" : "text-slate-400"
                 )}>
                   {profile?.plan === 'PRO' ? 'Pro Member' : 'Free Plan Active'}
                 </p>
                 <div className={cn(
                   "w-1.5 h-1.5 rounded-full shrink-0",
                   profile?.plan === 'PRO' ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                 )} />
              </div>
              {remainingDays !== null && (
                 <p className="text-[10px] font-bold text-slate-400 italic">
                   Sisa {remainingDays} hari
                 </p>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold text-[13px]"
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

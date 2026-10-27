"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  ChevronRight,
  X,
  ShieldCheck,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { primaryNav, navGroups, type NavItem } from '@/lib/navigation';
import { useFeedback } from '@/components/ui/Feedback';
import { useModal } from '@/context/ModalContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useFeedback();
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

  const { openModal, activeModal } = useModal();

  // Pintasan keyboard "N" = tambah transaksi (selama tidak sedang mengetik
  // dan tidak ada modal lain yang terbuka).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || activeModal) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      e.preventDefault();
      openModal('harian');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal, openModal]);

  const closeOnMobile = () => { if (window.innerWidth < 1024) onClose?.(); };

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeOnMobile}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors',
          active ? 'font-bold text-indigo-700' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        {/* Latar item aktif meluncur halus dari item sebelumnya (shared layout). */}
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl bg-indigo-50"
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          />
        )}
        <item.icon size={18} strokeWidth={active ? 2.3 : 1.9} className={cn('relative shrink-0', active ? 'text-indigo-600' : 'text-slate-400')} />
        <span className="relative truncate">{item.label}</span>
      </Link>
    );
  };

  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPro = async () => {
    if (!profile?.id) return;
    setIsRequesting(true);
    try {
      await cloudflareApi('/api/member/request-access', { method: 'POST' });
      setProfile((prev) => (prev ? { ...prev, status: 'PENDING' } : prev));
    } catch (error) {
      console.error('Error requesting pro:', error);
      toast.error('Gagal mengirim permintaan. Silakan coba lagi nanti.');
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
        "fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-100 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 print:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <Link href="/membership/dashboard" onClick={closeOnMobile} className="flex items-center gap-2.5 select-none">
            <Image src="/images/Logo-new.png" alt="" width={32} height={32} className="object-contain" />
            <span className="font-extrabold text-[19px] text-slate-900 tracking-tight">Leosiqra</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/membership/profile"
              onClick={closeOnMobile}
              aria-label="Pengaturan"
              title="Pengaturan"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Settings size={18} />
            </Link>
            <button
              onClick={onClose}
              aria-label="Tutup menu"
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 shrink-0">
          <Link
            href="/membership/ai-leosiqra"
            onClick={closeOnMobile}
            className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-400 ring-1 ring-slate-100 hover:bg-indigo-50/60 hover:text-slate-500 transition-colors"
          >
            <Sparkles size={16} className="text-indigo-500" />
            Tanya Leo…
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
          {profile?.status === 'GUEST' || profile?.status === 'PENDING' ? (
            <div className="py-10 px-2 space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="w-16 h-16 rounded-card bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100 shadow-sm relative">
                <ShieldCheck size={32} />
                {profile?.status === 'PENDING' && (
                  <div className="absolute inset-0 rounded-card border-2 border-indigo-600 border-t-transparent animate-spin" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  {profile?.status === 'PENDING' ? 'Sedang Diverifikasi' : 'Akses Terbatas'}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                  {profile?.status === 'PENDING' 
                    ? 'Permintaan akses Anda sudah terkirim. Admin akan memverifikasi data Anda segera.' 
                    : 'Akun Anda sedang dalam status tamu. Ajukan akses gratis (menunggu verifikasi admin) atau bayar langsung untuk akses instan.'}
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
                        Request Akses
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-4 bg-slate-100 text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 uppercase tracking-widest">
                    Menunggu Konfirmasi...
                  </div>
                )}
                <Link
                  href="/membership/contact"
                  className="w-full py-4 bg-white text-indigo-600 text-[11px] font-black rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group"
                >
                  Bayar / Upgrade ke PRO
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-0.5" data-tour="sidebar-group-primary">
                {primaryNav.map((item) => renderItem(item))}
              </div>
              {navGroups.map((group) => (
                <div key={group.id} data-tour={`sidebar-group-${group.id}`}>
                  <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
                  <div className="space-y-0.5">{group.items.map((item) => renderItem(item))}</div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer: tombol tambah transaksi + profil */}
        <div className="p-3 shrink-0 space-y-2 border-t border-slate-100">
          {profile && profile.status !== 'GUEST' && profile.status !== 'PENDING' && (
            <button
              type="button"
              onClick={() => { openModal('harian'); closeOnMobile(); }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(79,70,229,0.7)] hover:brightness-110 transition"
            >
              <Plus size={18} strokeWidth={2.6} />
              Tambah transaksi
              <kbd className="ml-1 hidden lg:inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/20 px-1.5 text-[11px] font-bold">N</kbd>
            </button>
          )}
          <div className="flex items-center gap-3 px-1.5 py-1">
            <Link
              href="/membership/profile"
              onClick={closeOnMobile}
              className="flex items-center gap-3 min-w-0 flex-1 group rounded-xl"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[12px] font-bold text-white overflow-hidden relative shrink-0">
                {profile?.photoURL ? (
                  <Image src={profile.photoURL} alt={profile.name} fill unoptimized className="object-cover" />
                ) : (
                  profile ? getInitials(profile.name) : '··'
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                  {profile?.name || 'Memuat...'}
                </span>
                <span className={cn(
                  'text-[12px] font-medium truncate',
                  profile?.plan === 'PRO' ? 'text-emerald-600' : 'text-slate-400'
                )}>
                  {profile?.plan === 'PRO' ? 'PRO' : 'Free'}
                  {remainingDays !== null && ` · sisa ${remainingDays} hari`}
                </span>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Keluar"
              title="Keluar"
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

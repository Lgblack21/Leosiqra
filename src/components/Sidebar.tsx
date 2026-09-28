"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  ChevronRight,
  ChevronDown,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { primaryNav, navGroups, type NavItem } from '@/lib/navigation';
import { useFeedback } from '@/components/ui/Feedback';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useFeedback();
  // Grup yang berisi halaman aktif otomatis terbuka; sisanya bisa dibuka
  // manual. Disimpan sebagai set id yang di-toggle user.
  const activeGroupId = navGroups.find((g) => g.items.some((i) => i.href === pathname))?.id;
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroupId ? [activeGroupId] : []);
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

  // Pindah halaman lewat link di luar sidebar (Header, tombol di halaman,
  // tur) juga harus membuka grup tujuannya.
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => (prev.includes(activeGroupId) ? prev : [...prev, activeGroupId]));
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : [...prev, id]
    );
  };

  const closeOnMobile = () => { if (window.innerWidth < 1024) onClose?.(); };

  const renderItem = (item: NavItem, nested = false) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeOnMobile}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-control text-sm transition-colors',
          nested ? 'pl-10 pr-3 py-2' : 'px-3 py-2.5 font-bold',
          active
            ? 'text-indigo-600 font-bold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        )}
      >
        {/* Latar item aktif meluncur halus dari item sebelumnya (shared layout). */}
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-control bg-white shadow-sm ring-1 ring-slate-200/70"
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          />
        )}
        {!nested && <item.icon size={18} className={cn('relative', active ? 'text-indigo-600' : 'text-slate-400')} />}
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
        "fixed top-0 left-0 h-full w-72 bg-slate-50 border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 print:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-5 h-20 flex items-center justify-between shrink-0 border-b border-slate-200/70">
          <div className="flex items-center gap-3 select-none" aria-hidden>
            <Image src="/images/Logo-new.png" alt="" width={34} height={34} className="object-contain" />
            <div className="flex flex-col">
              <span className="font-black text-lg text-slate-900 tracking-tight leading-none">Leosiqra</span>
              <span className="text-label font-bold text-slate-400 uppercase mt-1">Member Workspace</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup menu"
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-control transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
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
            <div className="space-y-1">
              <div className="space-y-1" data-tour="sidebar-group-primary">
                {primaryNav.map((item) => renderItem(item))}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1">
                {navGroups.map((group) => {
                  const isOpenGroup = openGroups.includes(group.id);
                  const hasActive = group.id === activeGroupId;
                  return (
                    <div key={group.id} data-tour={`sidebar-group-${group.id}`}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpenGroup}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm font-bold transition-colors',
                          hasActive && !isOpenGroup ? 'text-indigo-600' : 'text-slate-600',
                          'hover:text-slate-900 hover:bg-slate-100'
                        )}
                      >
                        <group.icon size={18} className={hasActive ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="flex-1 text-left truncate">{group.label}</span>
                        <ChevronDown size={14} className={cn('text-slate-400 transition-transform', !isOpenGroup && '-rotate-90')} />
                      </button>
                      {isOpenGroup && (
                        <div className="mt-0.5 mb-1 space-y-0.5">
                          {group.items.map((item) => renderItem(item, true))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer: profil + paket + logout jadi satu kartu */}
        <div className="p-3 border-t border-slate-200/70 shrink-0">
          <div className="p-3 bg-white border border-slate-100 rounded-card shadow-sm">
            <div className="flex items-center gap-3">
              <Link
                href="/membership/profile"
                onClick={closeOnMobile}
                className="flex items-center gap-3 min-w-0 flex-1 group"
              >
                <div className="w-10 h-10 rounded-control bg-indigo-600 flex items-center justify-center text-xs font-black text-white overflow-hidden relative shrink-0">
                  {profile?.photoURL ? (
                    <Image src={profile.photoURL} alt={profile.name} fill unoptimized className="object-cover" />
                  ) : (
                    profile ? getInitials(profile.name) : '··'
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {profile?.name || 'Memuat...'}
                  </span>
                  <span className={cn(
                    'text-caption font-bold truncate',
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
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-control transition-colors shrink-0"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

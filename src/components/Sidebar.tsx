'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Wordmark } from '@/components/brand/Wordmark';
import { usePathname } from 'next/navigation';
import { ChevronRight, X, ShieldCheck, Plus, Settings, Sparkles, LayoutGrid, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { keuanganNav, type NavItem } from '@/lib/navigation';
import { featuresFromIds, SIDEBAR_LIMIT } from '@/lib/features';
import { proHint } from '@/lib/fiturCatalog';
import { OPEN_PALETTE_EVENT } from '@/components/fitur/CommandPalette';
import { useFeatures } from '@/lib/useFeatures';
import { useFeedback } from '@/components/ui/Feedback';
import { useModal } from '@/context/ModalContext';
import { usePrimaryAdd } from '@/lib/useRecordingPrefs';
import { UserAvatar, type AvatarConfig } from '@/components/profile/LeoAvatar';
import { PROFILE_UPDATED_EVENT } from '@/components/settings/ProfileEditView';

// Menu samping /membership. Tiga ukuran:
// - HP (< md): laci yang dibuka dari tombol menu di Header.
// - Tablet (md–lg): rel ikon ramping (label disembunyikan, title jadi tooltip).
// - Laptop (≥ lg): menu penuh.
// Isi: grup "Keuangan" (4 halaman inti) + "Fitur" (pintasan + Semua fitur).
// Pengaturan & profil dibuka sebagai panel (SettingsPanel) lewat onOpenSettings.

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
  /** Mode fokus (mis. menjawab di Kanvas): sidebar meluncur keluar di semua ukuran layar. */
  focusHidden?: boolean;
}

type Profile = {
  id: string;
  name: string;
  email: string;
  plan: 'FREE' | 'PRO';
  status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
  photoURL?: string | null;
  expiredAt?: string | null;
  avatar?: AvatarConfig | null;
};

// Teks yang hanya tampil di mode penuh (HP & laptop), disembunyikan di rel tablet.
const fullOnly = 'md:max-lg:hidden';

// Warna ubin ikon untuk 4 halaman inti (fitur memakai `tint` dari features.ts).
const KEUANGAN_TINT: Record<string, string> = {
  '/membership/dashboard': 'from-sky-50 to-indigo-100 text-indigo-600',
  '/membership/transactions/daily': 'from-orange-50 to-rose-100 text-orange-600',
  '/membership/laporan': 'from-violet-50 to-violet-100 text-violet-600',
  '/membership/rekening': 'from-emerald-50 to-teal-100 text-emerald-700',
};
const MORE_TINT = 'from-slate-100 to-slate-200 text-slate-600';

const GroupLabel = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div className={cn('flex items-center gap-2 px-3 pb-2', fullOnly)}>
    <span className="fs-10.5 font-extrabold uppercase tracking-[0.16em] text-slate-400">{children}</span>
    <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
    {extra}
  </div>
);

export const Sidebar = ({ isOpen, onClose, onOpenSettings, focusHidden = false }: SidebarProps) => {
  const pathname = usePathname();
  const { toast } = useFeedback();
  const { openModal, activeModal } = useModal();
  const primaryAdd = usePrimaryAdd();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const load = () =>
      cloudflareApi<{ user?: Profile | null }>('/api/auth/me')
        .then((result) => setProfile(result.user ?? null))
        .catch(() => setProfile(null));
    load();
    // Profil diubah di panel Pengaturan → muat ulang nama & avatar.
    window.addEventListener(PROFILE_UPDATED_EVENT, load);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, load);
  }, []);

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

  const closeOnMobile = () => {
    if (window.innerWidth < 768) onClose?.();
  };

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

  const remainingDays = (() => {
    if (!profile?.expiredAt) return null;
    const diff = Math.ceil((new Date(profile.expiredAt).getTime() - Date.now()) / 86400e3);
    return Number.isFinite(diff) ? Math.max(0, diff) : null;
  })();

  const features = useFeatures();
  const renderItem = (item: NavItem, tint: string, badge?: string) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeOnMobile}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-[14px] py-1.5 pl-2 pr-2.5 fs-14 transition-colors md:max-lg:justify-center md:max-lg:px-0',
          active ? 'font-bold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
        )}
      >
        {/* Kartu item aktif + garis aksen meluncur halus dari item sebelumnya (shared layout). */}
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-[14px] bg-white shadow-[0_6px_18px_-10px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80"
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500 md:max-lg:-left-2.5" />
          </motion.span>
        )}
        <span
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br transition-transform duration-200 group-hover:scale-105',
            tint,
            active && 'shadow-sm ring-1 ring-black/5',
          )}
        >
          <item.icon size={16} strokeWidth={active ? 2.4 : 2.1} />
        </span>
        <span className={cn('relative flex-1 truncate', fullOnly)}>{item.label}</span>
        {badge === 'PRO' ? (
          <span
            title={proHint(item.href)}
            className={cn(
              'relative rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2 py-0.5 fs-9.5 font-black tracking-wider text-white shadow-sm',
              fullOnly,
            )}
          >
            PRO
          </span>
        ) : badge ? (
          <span
            className={cn(
              'relative rounded-full bg-slate-100 px-2 py-0.5 fs-11 font-bold text-slate-500 ring-1 ring-slate-200/70',
              fullOnly,
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const restricted = profile?.status === 'GUEST' || profile?.status === 'PENDING';
  const allFeatures = featuresFromIds(features.active);
  // Member Gratis: label PRO pada fitur yang jatahnya lebih besar di paket PRO.
  const isProActive =
    profile?.plan === 'PRO' && (!profile.expiredAt || new Date(profile.expiredAt).getTime() > Date.now());
  const proBadge = (href: string) => (profile && !isProActive && proHint(href) ? 'PRO' : undefined);
  const sidebarFeatures = (() => {
    const shown = allFeatures.slice(0, SIDEBAR_LIMIT);
    const current = allFeatures.find(
      (f) => !shown.includes(f) && (pathname === f.href || pathname?.startsWith(`${f.href}/`)),
    );
    if (current) shown.push(current);
    return { shown, more: allFeatures.length - shown.length };
  })();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50 transition-transform duration-300 ease-in-out md:w-[84px] lg:w-72 print:hidden',
        focusHidden
          ? '-translate-x-full'
          : isOpen
            ? 'translate-x-0 md:translate-x-0'
            : '-translate-x-full md:translate-x-0',
        // Kembali setelah panel fokus selesai meluncur keluar.
        !focusHidden && 'md:delay-150',
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5 md:max-lg:justify-center md:max-lg:px-0">
        <Link
          href="/membership/dashboard"
          onClick={closeOnMobile}
          className="flex select-none items-center gap-2.5"
          title="Ringkasan"
        >
          <Image src="/images/Logo-new.png" alt="" width={34} height={34} className="wm-logo object-contain" />
          <Wordmark className={cn('fs-19 font-extrabold tracking-tight text-slate-900', fullOnly)} />
        </Link>
        <div className={cn('flex items-center gap-1', fullOnly)}>
          <button
            type="button"
            onClick={() => {
              onOpenSettings?.();
              closeOnMobile();
            }}
            aria-label="Pengaturan"
            title="Pengaturan"
            className="rounded-xl p-2 text-slate-400 transition-all hover:rotate-45 hover:bg-slate-100 hover:text-slate-700"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onClose}
            aria-label="Tutup menu"
            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 md:hidden"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-4 pb-1 md:max-lg:justify-center md:max-lg:px-3">
        <button
          type="button"
          onClick={() => {
            closeOnMobile();
            window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
          }}
          className={cn(
            'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 fs-13.5 text-slate-400 ring-1 ring-slate-200/80 transition hover:text-slate-600 hover:ring-slate-300',
            fullOnly,
          )}
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 truncate text-left">Cari fitur…</span>
          <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 fs-10.5 font-bold text-slate-500 lg:inline">Ctrl K</kbd>
        </button>
        <Link
          href="/membership/ai-leosiqra"
          onClick={closeOnMobile}
          title="Tanya Leo"
          aria-label="Tanya Leo"
          className="web-keep group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.7)] transition hover:-translate-y-0.5"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]"
          />
          <Sparkles size={17} className="relative transition-transform duration-300 group-hover:rotate-12" />
        </Link>
      </div>

      <nav aria-label="Menu utama" className="no-scrollbar flex-1 overflow-y-auto px-3 pb-3 pt-4">
        {restricted ? (
          <>
            <div className={cn('space-y-5 px-2 py-8 text-center', fullOnly)}>
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                <ShieldCheck size={30} />
                {profile?.status === 'PENDING' && (
                  <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-indigo-600 border-t-transparent" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="fs-15 font-bold text-slate-900">
                  {profile?.status === 'PENDING' ? 'Sedang diverifikasi' : 'Akses terbatas'}
                </h3>
                <p className="fs-13 leading-relaxed text-slate-500">
                  {profile?.status === 'PENDING'
                    ? 'Permintaan aksesmu sudah terkirim. Admin akan memverifikasi segera.'
                    : 'Akunmu masih berstatus tamu. Ajukan akses gratis (diverifikasi admin) atau bayar untuk akses instan.'}
                </p>
              </div>
              <div className="space-y-2.5">
                {profile?.status === 'GUEST' ? (
                  <button
                    onClick={handleRequestPro}
                    disabled={isRequesting}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 py-3 fs-14 font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {isRequesting ? (
                      'Mengirim…'
                    ) : (
                      <>
                        Ajukan akses <ChevronRight size={15} />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full rounded-full bg-slate-100 py-3 fs-13 font-semibold text-slate-500">
                    Menunggu konfirmasi…
                  </div>
                )}
                <Link
                  href="/membership/contact"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white py-3 fs-14 font-bold text-indigo-600 hover:bg-indigo-50"
                >
                  Bayar / upgrade ke PRO <ChevronRight size={15} />
                </Link>
              </div>
            </div>
            <div className="hidden justify-center pt-4 text-indigo-600 md:max-lg:flex" title="Akses terbatas">
              <ShieldCheck size={22} />
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <div data-tour="sidebar-group-keuangan">
              <GroupLabel>Keuangan</GroupLabel>
              <div className="space-y-1">
                {keuanganNav.map((item) => renderItem(item, KEUANGAN_TINT[item.href] ?? MORE_TINT))}
              </div>
            </div>
            <div
              data-tour="sidebar-group-fitur"
              className="md:max-lg:border-t md:max-lg:border-slate-200/70 md:max-lg:pt-4"
            >
              <GroupLabel>Fitur</GroupLabel>
              <div className="space-y-1">
                {/* Ringkas: maksimal SIDEBAR_LIMIT fitur (+ fitur yang sedang dibuka); sisanya lewat Fitur lainnya. */}
                {sidebarFeatures.shown.map((f) =>
                  renderItem({ label: f.label, href: f.href, icon: f.icon }, f.tint, proBadge(f.href)),
                )}
                {renderItem(
                  { label: 'Fitur lainnya', href: '/membership/fitur', icon: LayoutGrid },
                  MORE_TINT,
                  sidebarFeatures.more ? `+${sidebarFeatures.more}` : undefined,
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="shrink-0 space-y-2.5 border-t border-slate-200/70 p-3">
        {profile && !restricted && (
          <button
            type="button"
            onClick={() => {
              primaryAdd();
              closeOnMobile();
            }}
            title="Catat transaksi (N)"
            className="web-keep group relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] bg-slate-950 p-2 text-left text-white shadow-[0_14px_30px_-14px_rgba(2,6,23,0.75)] ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-14px_rgba(249,115,22,0.55)] active:translate-y-0 md:max-lg:justify-center lg:pr-3"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[320%]"
            />
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <Plus size={20} strokeWidth={2.8} className="transition-transform duration-300 group-hover:rotate-90" />
            </span>
            <span className={cn('relative min-w-0 flex-1 leading-tight', fullOnly)}>
              <span className="block fs-14 font-extrabold tracking-tight">Catat transaksi</span>
              <span className="block fs-11 font-medium text-white/55">Masuk / keluar, 10 detik</span>
            </span>
            <kbd className="relative hidden h-6 min-w-6 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-1.5 fs-11 font-bold text-white/80 lg:inline-flex">
              N
            </kbd>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onOpenSettings?.();
            closeOnMobile();
          }}
          title="Profil & pengaturan"
          className="group flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left ring-1 ring-slate-200/80 transition hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.4)] hover:ring-slate-300 md:max-lg:justify-center md:max-lg:bg-transparent md:max-lg:p-1 md:max-lg:ring-0"
        >
          <span className="relative shrink-0">
            {profile ? (
              <UserAvatar avatar={profile.avatar} photoURL={profile.photoURL} name={profile.name} size={38} />
            ) : (
              <span className="block h-[38px] w-[38px] rounded-full bg-slate-100" />
            )}
            {profile && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </span>
          <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', fullOnly)}>
            <span className="truncate fs-14 font-bold text-slate-900">{profile?.name || 'Memuat…'}</span>
            <span className="flex items-center gap-1.5">
              {isProActive ? (
                <span className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2 py-px fs-10 font-black tracking-wider text-white">
                  PRO
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-px fs-10.5 font-bold text-slate-500">Gratis</span>
              )}
              {isProActive && remainingDays !== null && (
                <span className="truncate fs-11.5 font-medium text-slate-400">sisa {remainingDays} hari</span>
              )}
            </span>
          </span>
          <ChevronRight
            size={16}
            className={cn('shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5', fullOnly)}
          />
        </button>
      </div>
    </aside>
  );
};

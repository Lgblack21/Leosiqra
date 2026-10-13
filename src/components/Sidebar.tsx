"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  ChevronRight,
  ChevronUp,
  X,
  ShieldCheck,
  Settings,
  Sparkles,
  Plus,
  Crown,
  ArrowUpDown,
  ArrowLeftRight,
  Repeat,
  Building2,
  PiggyBank,
  CreditCard,
  Briefcase,
  Landmark,
  Coins,
  HandCoins,
  Target,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { coreNav, captureNav, accountNav, tabsFor, type NavItem } from '@/lib/navigation';
import { useFeedback } from '@/components/ui/Feedback';
import { useFeatures } from '@/lib/features';
import { useModal, type ModalType } from '@/context/ModalContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Form lain di balik tombol "Tambah transaksi" (panah ▾).
const MORE_ADDS: { id: ModalType; label: string; icon: LucideIcon }[] = [
  { id: 'topup_transfer', label: 'Transfer & top up', icon: ArrowLeftRight },
  { id: 'langganan', label: 'Langganan', icon: Repeat },
  { id: 'pemasukan_rutin', label: 'Pemasukan rutin', icon: Repeat },
  { id: 'tabungan', label: 'Setor tabungan', icon: PiggyBank },
  { id: 'hutang_piutang', label: 'Hutang & piutang', icon: HandCoins },
  { id: 'rekening', label: 'Rekening baru', icon: Building2 },
  { id: 'kartu', label: 'Kartu baru', icon: CreditCard },
  { id: 'saham', label: 'Saham', icon: Briefcase },
  { id: 'deposito', label: 'Deposito', icon: Landmark },
  { id: 'investasi_lain', label: 'Investasi lainnya', icon: Coins },
  { id: 'budget_target', label: 'Anggaran', icon: Target },
  { id: 'ledger', label: 'Kategori', icon: SlidersHorizontal },
];

type Profile = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  plan: 'FREE' | 'PRO';
  status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
  photoURL?: string;
  expiredAt?: string;
};

// Sidebar datar: Keuangan (5 halaman inti) · Fitur (yang dinyalakan) ·
// Pencatatan. Pengaturan & bantuan ada di menu akun (kartu user di bawah).
export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useFeedback();
  const { openModal } = useModal();
  const { enabled } = useFeatures();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    cloudflareApi<{ user?: Profile | null }>('/api/auth/me')
      .then((result) => setProfile(result.user ?? null))
      .catch(() => setProfile(null));
  }, []);

  // Tutup menu kecil saat klik di luar / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) onClose?.();
  };

  // Aktif: cocok persis, atau halaman ini satu keluarga tab dengan item menu.
  const isActive = (href: string) => {
    if (pathname === href) return true;
    const family = tabsFor(pathname);
    return Boolean(family && family[0].href === href);
  };

  const renderItem = (item: NavItem, onClick?: () => void) => {
    const active = isActive(item.href);
    const cls = cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors',
      active ? 'bg-slate-200/70 font-bold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    );
    const inner = (
      <>
        <item.icon size={17} className={active ? 'text-slate-900' : 'text-slate-400'} />
        <span className="truncate">{item.label}</span>
      </>
    );
    return onClick ? (
      <button key={item.href} type="button" onClick={onClick} className={cls}>{inner}</button>
    ) : (
      <Link key={item.href} href={item.href} onClick={closeOnMobile} aria-current={active ? 'page' : undefined} className={cls}>{inner}</Link>
    );
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

  const handleLogout = async () => {
    try {
      await cloudflareApi('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const remainingDays = (() => {
    if (!profile?.expiredAt) return null;
    const diff = Math.ceil((new Date(profile.expiredAt).getTime() - Date.now()) / 86400000);
    return diff > 0 ? diff : 0;
  })();
  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  const limited = profile?.status === 'GUEST' || profile?.status === 'PENDING';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-200/70 bg-slate-50 transition-transform duration-300 ease-in-out lg:translate-x-0 print:hidden',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo + pengaturan */}
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <Link href="/membership/dashboard" onClick={closeOnMobile} className="flex items-center gap-2.5">
          <Image src="/images/Logo-new.png" alt="" width={30} height={30} className="object-contain" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900">Leosiqra</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/membership/profile" onClick={closeOnMobile} aria-label="Pengaturan" title="Pengaturan" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <Settings size={18} />
          </Link>
          <button onClick={onClose} aria-label="Tutup menu" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tanya Leo — popup chat, tetap di halaman yang sama */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => {
            openModal('ai_chat');
            closeOnMobile();
          }}
          className="flex w-full items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 text-left text-sm text-slate-500 ring-1 ring-slate-200/80 transition-colors hover:text-slate-800"
        >
          <Sparkles size={16} className="text-violet-500" />
          Tanya Leo…
        </button>
      </div>

      <nav aria-label="Menu utama" className="no-scrollbar flex-1 overflow-y-auto px-3 pb-3">
        {limited ? (
          <div className="space-y-5 px-2 py-8 text-center">
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <ShieldCheck size={28} />
              {profile?.status === 'PENDING' && <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-indigo-600 border-t-transparent" />}
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900">{profile?.status === 'PENDING' ? 'Sedang diverifikasi' : 'Akses terbatas'}</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                {profile?.status === 'PENDING'
                  ? 'Permintaan aksesmu sudah terkirim. Admin akan memverifikasi segera.'
                  : 'Akunmu masih berstatus tamu. Ajukan akses gratis (menunggu verifikasi admin) atau upgrade untuk akses instan.'}
              </p>
            </div>
            {profile?.status === 'GUEST' ? (
              <button
                onClick={handleRequestPro}
                disabled={isRequesting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {isRequesting ? 'Mengirim…' : <>Minta akses <ChevronRight size={14} /></>}
              </button>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-bold text-slate-400">Menunggu konfirmasi…</div>
            )}
            <Link href="/membership/contact" className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50">
              Bayar / upgrade ke PRO <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            <p className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">Keuangan</p>
            <div className="space-y-0.5" data-tour="sidebar-group-keuangan">{coreNav.map((i) => renderItem(i))}</div>

            <p className="px-3 pb-1 pt-5 text-xs font-semibold text-slate-400">Fitur</p>
            <div className="space-y-0.5" data-tour="sidebar-group-fitur">
              {/* Fitur yang sebenarnya bagian halaman inti (mis. Kartu kredit → Dompet) tidak diulang di sini. */}
              {enabled.filter((f) => !f.href.startsWith('/membership/rekening')).map((f) => renderItem({ label: f.short ?? f.label, href: f.href, icon: f.icon }))}
              {renderItem({ label: 'Kelola fitur', href: '/membership/fitur', icon: SlidersHorizontal })}
            </div>

            <p className="px-3 pb-1 pt-5 text-xs font-semibold text-slate-400">Pencatatan</p>
            <div className="space-y-0.5" data-tour="sidebar-group-pencatatan">
              {captureNav.map((i) =>
                i.modal
                  ? renderItem(i, () => {
                      openModal(i.modal!);
                      closeOnMobile();
                    })
                  : renderItem(i)
              )}
            </div>
          </>
        )}
      </nav>

      {/* Bawah: PRO, Tambah transaksi, akun */}
      <div className="space-y-2.5 border-t border-slate-200/70 p-3">
        {profile && profile.plan !== 'PRO' && !limited && (
          <Link href="/membership/contact" onClick={closeOnMobile} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200/80 transition-colors hover:bg-amber-50/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Crown size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">Leosiqra PRO</span>
              <span className="block text-xs text-slate-500">{remainingDays !== null ? `Sisa ${remainingDays} hari · upgrade` : 'Buka semua fitur'}</span>
            </span>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
        )}

        {!limited && (
          <div className="relative flex" ref={moreRef} data-tour="tambah-cepat">
            <button
              type="button"
              onClick={() => {
                openModal('harian');
                closeOnMobile();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-l-2xl bg-slate-900 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              <Plus size={17} strokeWidth={2.6} /> Tambah transaksi
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="Tambah lainnya"
              aria-expanded={moreOpen}
              className="flex items-center rounded-r-2xl border-l border-white/15 bg-slate-900 px-3 text-white transition-colors hover:bg-slate-800"
            >
              <ChevronUp size={16} className={cn('transition-transform', !moreOpen && 'rotate-180')} />
            </button>
            {moreOpen && (
              <div role="menu" className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openModal('harian');
                    setMoreOpen(false);
                    closeOnMobile();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowUpDown size={15} className="text-slate-400" /> Pemasukan / pengeluaran
                </button>
                {MORE_ADDS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openModal(m.id);
                      setMoreOpen(false);
                      closeOnMobile();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <m.icon size={15} className="text-slate-400" /> {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={accountRef}>
          <button type="button" onClick={() => setAccountOpen((v) => !v)} aria-expanded={accountOpen} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-slate-100">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
              {profile?.photoURL ? <Image src={profile.photoURL} alt={profile.name} fill unoptimized className="object-cover" /> : profile ? initials(profile.name) : '··'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-900">{profile?.name || 'Memuat…'}</span>
              <span className="block truncate text-xs text-slate-500">{profile?.plan === 'PRO' ? 'PRO' : 'Free'}{profile?.email ? ` · ${profile.email}` : ''}</span>
            </span>
            <ChevronUp size={15} className={cn('text-slate-400 transition-transform', !accountOpen && 'rotate-180')} />
          </button>
          {accountOpen && (
            <div role="menu" className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl">
              {accountNav.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    closeOnMobile();
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <i.icon size={15} className="text-slate-400" /> {i.label}
                </Link>
              ))}
              <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">
                <LogOut size={15} /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

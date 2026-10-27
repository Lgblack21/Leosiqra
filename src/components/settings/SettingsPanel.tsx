"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Tags,
  Users,
  LifeBuoy,
  Settings,
  ShieldCheck,
  FileText,
  Bot,
  LogOut,
  Check,
  Minus,
  PenLine,
  MessageCircle,
  Target,
  Repeat,
  Coins,
  Bell,
  Zap,
  Lightbulb,
  Mail,
  BookOpen,
  KeyRound,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn, formatIDR } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { navGroups } from '@/lib/navigation';
import { getMemberPaymentInfo, type ProPackage } from '@/lib/services/adminService';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useModal } from '@/context/ModalContext';
import { KategoriSection, MataUangView } from '@/components/settings/CategoryBudgetViews';
import { ProfileEditView } from '@/components/settings/ProfileEditView';
import { UserAvatar, type AvatarConfig } from '@/components/profile/LeoAvatar';

// Panel Pengaturan (dibuka dari ikon roda gigi / profil di menu samping,
// atau avatar di header HP). Tiga tampilan: menu utama, Profil, dan Paket
// (Gratis vs PRO). Isinya hanya fitur yang benar-benar ada — pengaturan
// detail tetap di halaman /membership/profile (tab akun/keamanan/notifikasi/ai).

export interface PanelUser {
  id: string;
  name: string;
  email: string;
  plan: 'FREE' | 'PRO';
  status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
  photoURL?: string | null;
  expiredAt?: string | null;
  memberSince?: string | null;
  avatar?: AvatarConfig | null;
}

export type View = 'menu' | 'profil' | 'paket' | 'bantuan' | 'umum' | 'privasi' | 'legal' | 'kategori' | 'kategori-detail' | 'kategori-baru' | 'mata-uang' | 'ubah-profil';
const PARENT: Partial<Record<View, View>> = { 'ubah-profil': 'profil', 'kategori-detail': 'kategori', 'kategori-baru': 'kategori', 'mata-uang': 'umum' };

const FEATURE_COUNT = navGroups.reduce((s, g) => s + g.items.length, 0);
const STATUS_LABEL: Record<PanelUser['status'], string> = {
  AKTIF: 'Aktif',
  PENDING: 'Menunggu verifikasi',
  GUEST: 'Tamu (akses terbatas)',
  NONAKTIF: 'Nonaktif',
};

const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(t) ? Math.max(1, Math.floor((Date.now() - t) / 86400e3) + 1) : null;
};
const monthYear = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
};
const dateLong = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

const Avatar = ({ user, size = 56 }: { user: PanelUser | null; size?: number }) => (
  <UserAvatar avatar={user?.avatar} photoURL={user?.photoURL} name={user?.name} size={size} />
);

const Row = ({ icon: Icon, title, desc, href, onClick, value }: { icon?: React.ElementType; title: string; desc?: string; href?: string; onClick?: () => void; value?: string }) => {
  const inner = (
    <>
      {Icon && <Icon size={21} className="shrink-0 text-slate-600" strokeWidth={1.8} />}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium text-slate-900">{title}</span>
        {desc && <span className="block truncate text-[13px] text-slate-500">{desc}</span>}
      </span>
      {value && <span className="shrink-0 text-[14px] text-slate-500">{value}</span>}
      {(href || onClick) && <ChevronRight size={18} className="shrink-0 text-slate-400" />}
    </>
  );
  const cls = 'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-100/70';
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
};

const Group = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('divide-y divide-slate-200/60 overflow-hidden rounded-[22px] bg-slate-50', className)}>{children}</div>
);

const Tile = ({ icon: Icon, title, desc, href, onClick }: { icon: React.ElementType; title: string; desc?: string; href?: string; onClick?: () => void }) => {
  const inner = (
    <>
      <Icon size={22} className="shrink-0 text-slate-600" strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block truncate text-[16px] font-medium text-slate-900">{title}</span>
        {desc && <span className="block truncate text-[13px] text-slate-500">{desc}</span>}
      </span>
    </>
  );
  const cls = 'flex items-center gap-3.5 rounded-[22px] bg-slate-50 px-5 py-4 text-left transition-colors hover:bg-slate-100';
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
};

// Perbandingan paket — hanya pembeda yang memang diterapkan di server
// (batas Dompet Bersama & izin mencatat lewat AI luar/MCP).
const PLAN_TABLE: { section: string; rows: { label: string; free: string | boolean; pro: string | boolean }[] }[] = [
  {
    section: 'Sehari-hari',
    rows: [
      { label: 'Catat, budget & laporan', free: true, pro: true },
      { label: 'Tanya AI Leosiqra', free: true, pro: true },
      { label: 'Scan struk & input suara', free: true, pro: true },
      { label: 'Kartu kredit, investasi & pajak', free: true, pro: true },
    ],
  },
  {
    section: 'Dompet Bersama',
    rows: [
      { label: 'Jumlah dompet', free: '1', pro: '5' },
      { label: 'Anggota per dompet', free: 'Hingga 3 orang', pro: 'Hingga 10 orang' },
    ],
  },
  {
    section: 'Hubungkan ke AI (Claude, ChatGPT)',
    rows: [
      { label: 'Baca data keuangan', free: true, pro: true },
      { label: 'Mencatat lewat AI', free: false, pro: true },
    ],
  },
];

function PaketView({ user, onClose }: { user: PanelUser | null; onClose: () => void }) {
  const isPro = user?.plan === 'PRO';
  const [tab, setTab] = useState<'FREE' | 'PRO'>(isPro ? 'PRO' : 'PRO');
  const [packages, setPackages] = useState<ProPackage[] | null>(null);

  useEffect(() => {
    getMemberPaymentInfo().then((s) => setPackages(s?.proPackages ?? [])).catch(() => setPackages([]));
  }, []);

  const cheapestMonthly = useMemo(() => {
    const list = (packages ?? []).filter((p) => p.price > 0 && p.durationMonths > 0);
    if (!list.length) return null;
    return Math.min(...list.map((p) => p.price / p.durationMonths));
  }, [packages]);
  const pro = tab === 'PRO';
  const current = (tab === 'PRO') === isPro;
  const expiry = dateLong(user?.expiredAt);

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 flex justify-center bg-white/90 pb-3 pt-1 backdrop-blur">
        <div className="flex rounded-full bg-slate-100 p-1">
          {(['FREE', 'PRO'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('rounded-full px-6 py-2 text-[15px] font-semibold transition-colors', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {t === 'FREE' ? 'Gratis' : 'PRO'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative -mx-6 flex flex-col items-center px-6 pb-2 pt-2 text-center">
        <span aria-hidden className={cn('absolute inset-x-10 top-0 h-56 rounded-full blur-3xl', pro ? 'bg-violet-200/60' : 'bg-indigo-100/70')} />
        <div className="relative">
          <LeoMascot mood={pro ? 'happy' : 'idle'} size={170} />
        </div>
        <p className="relative mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-slate-500">
          {pro ? <Sparkles size={15} className="text-violet-500" /> : null}
          {pro ? 'PRO' : 'Gratis'}
        </p>
        <h3 className="relative mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">
          {pro ? <>Dompet bersama lebih lega,<br />AI bisa ikut mencatat</> : <>Semua inti Leosiqra,<br />gratis</>}
        </h3>
        <p className="relative mt-1 text-[15px] text-slate-500">
          {current
            ? isPro && expiry ? `Paketmu sekarang · aktif sampai ${expiry}` : 'Paketmu sekarang'
            : pro
              ? cheapestMonthly ? `Mulai ${formatIDR(Math.round(cheapestMonthly))} per bulan` : 'Lihat pilihan paket di bawah'
              : 'Tanpa biaya'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-[20px] bg-slate-50 py-4 text-center">
        <div className="px-2"><p className="text-[18px] font-bold text-slate-900">{pro ? '5' : '1'}</p><p className="text-[12px] text-slate-500">Dompet bersama</p></div>
        <div className="px-2"><p className="text-[18px] font-bold text-slate-900">{pro ? '10' : '3'}</p><p className="text-[12px] text-slate-500">Anggota/dompet</p></div>
        <div className="px-2"><p className="text-[18px] font-bold text-slate-900">{pro ? 'Baca + catat' : 'Baca'}</p><p className="text-[12px] text-slate-500">Lewat AI luar</p></div>
      </div>

      <div className="mt-4 divide-y divide-slate-100 rounded-[22px] bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-100">
        {(pro
          ? [
              { icon: Users, t: 'Dompet Bersama lebih banyak', d: 'Sampai 5 dompet, masing-masing 10 orang' },
              { icon: Bot, t: 'AI luar bisa mencatat', d: 'Claude/ChatGPT boleh menambah transaksi lewat MCP' },
              { icon: Sparkles, t: 'Dukung pengembangan Leosiqra', d: 'Semua fitur Gratis tetap termasuk' },
            ]
          : [
              { icon: PenLine, t: 'Catat dengan cara apa pun', d: 'Ketik, bicara, atau foto struk' },
              { icon: MessageCircle, t: 'Tanya AI Leosiqra', d: 'Tanya apa saja soal uangmu' },
              { icon: Users, t: 'Satu Dompet Bersama', d: 'Bareng sampai 3 orang' },
            ]
        ).map((r) => (
          <div key={r.t} className="flex items-center gap-4 px-5 py-4 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium text-slate-900">{r.t}</span>
              <span className="block text-[13px] text-slate-500">{r.d}</span>
            </span>
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', pro ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white' : 'bg-slate-100 text-slate-600')}>
              <r.icon size={19} />
            </span>
          </div>
        ))}
      </div>

      {PLAN_TABLE.map((g) => (
        <div key={g.section} className="mt-4 rounded-[22px] bg-slate-50 px-5 py-2 text-left">
          <p className="border-b border-slate-200/70 py-2.5 text-[14px] text-slate-500">{g.section}</p>
          {g.rows.map((r) => {
            const v = pro ? r.pro : r.free;
            return (
              <div key={r.label} className="flex items-center justify-between gap-3 py-3">
                <span className={cn('text-[15px]', v === false ? 'text-slate-400' : 'text-slate-900')}>{r.label}</span>
                {v === true ? (
                  <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] text-slate-600"><Check size={14} className="text-emerald-600" /> Termasuk</span>
                ) : v === false ? (
                  <span className="flex items-center gap-1 text-[13px] text-slate-400"><Minus size={14} /> Tidak termasuk</span>
                ) : (
                  <span className="rounded-full bg-white px-3 py-1 text-[13px] text-slate-600">{v}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {pro && (
        <div className="mt-4 rounded-[22px] bg-slate-50 px-5 py-2 text-left">
          <p className="border-b border-slate-200/70 py-2.5 text-[14px] text-slate-500">Harga</p>
          {packages === null ? (
            <p className="py-3 text-[14px] text-slate-400">Memuat…</p>
          ) : packages.length === 0 ? (
            <p className="py-3 text-[14px] text-slate-500">Hubungi admin untuk harga terbaru.</p>
          ) : (
            packages.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-[15px] text-slate-900">{p.name}{p.isPopular && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Populer</span>}</span>
                <span className="rounded-full bg-white px-3 py-1 text-[13px] text-slate-600">{formatIDR(p.price)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <p className="mt-4 px-2 text-center text-[13px] leading-relaxed text-slate-500">
        Pembayaran lewat transfer, lalu diaktifkan admin (maks. 1×24 jam). Kalau masa PRO berakhir, akun kembali ke Gratis — datamu tetap aman.
      </p>

      <div className="sticky bottom-0 -mx-6 mt-4 flex justify-center bg-gradient-to-t from-white via-white to-white/0 px-6 pb-1 pt-6">
        {pro && !isPro ? (
          <Link href="/membership/contact" onClick={onClose} className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-[16px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(79,70,229,0.8)]">
            Pilih paket & bayar
          </Link>
        ) : pro && isPro ? (
          <Link href="/membership/contact" onClick={onClose} className="rounded-full bg-slate-900 px-8 py-3.5 text-[16px] font-bold text-white">
            Perpanjang PRO
          </Link>
        ) : (
          <button type="button" onClick={onClose} className="rounded-full bg-slate-900 px-8 py-3.5 text-[16px] font-bold text-white">
            {isPro ? 'Tutup' : 'Lanjut dengan Gratis'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel({ open, onClose, initialView = 'menu' }: { open: boolean; onClose: () => void; initialView?: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<View>(initialView);
  const [user, setUser] = useState<PanelUser | null>(null);

  useEffect(() => {
    if (!open) return;
    setView(initialView);
    cloudflareApi<{ user?: PanelUser | null }>('/api/auth/me').then((r) => setUser(r.user ?? null)).catch(() => undefined);
  }, [open, initialView]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const logout = async () => {
    try {
      await cloudflareApi('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/auth/login');
    }
  };

  const days = daysSince(user?.memberSince);
  const isPro = user?.plan === 'PRO';
  // Halaman Profil membaca ?tab= sekali saat dibuka — kalau sudah di sana,
  // muat ulang supaya tab yang diminta benar-benar terbuka.
  const go = (href: string) => () => {
    onClose();
    if (href.startsWith('/membership/profile?') && pathname === '/membership/profile') window.location.assign(href);
    else router.push(href);
  };
  const TITLES: Record<View, string> = {
    menu: 'Profil',
    profil: 'Profil',
    paket: 'Paket',
    bantuan: 'Bantuan',
    umum: 'Pengaturan',
    privasi: 'Privasi & keamanan',
    legal: 'Ketentuan & kebijakan',
    kategori: 'Kategori & Anggaran',
    'kategori-detail': 'Kategori',
    'kategori-baru': 'Tambah kategori',
    'mata-uang': 'Mata uang',
    'ubah-profil': 'Ubah profil',
  };
  const { openModal } = useModal();
  const title = TITLES[view];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-6 print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[28px]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 pb-2 pt-5">
              {view !== 'menu' && (
                <button type="button" onClick={() => setView(PARENT[view] ?? 'menu')} aria-label="Kembali" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                  <ChevronLeft size={20} />
                </button>
              )}
              <h2 className="flex-1 text-[20px] font-bold text-slate-900">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                <X size={19} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 pb-6 pt-2">
              {view === 'menu' && (
                <div className="space-y-4">
                  <Group>
                    <button type="button" onClick={() => setView('profil')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-100/70">
                      <Avatar user={user} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[18px] font-semibold text-slate-900">{user?.name ?? 'Memuat…'}</span>
                        <span className="block truncate text-[14px] text-slate-500">
                          {days ? `Memakai Leosiqra selama ${days} hari` : user?.email ?? ''}
                        </span>
                      </span>
                      <span className={cn('shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold', isPro ? 'bg-violet-100 text-violet-700' : 'bg-slate-200/70 text-slate-600')}>
                        {isPro ? 'PRO' : 'Gratis'}
                      </span>
                    </button>
                  </Group>
                  <Group>
                    <Row icon={Bot} title="Aplikasi terhubung" desc="Claude, ChatGPT & aplikasi lain lewat MCP" onClick={go('/membership/profile?tab=ai')} />
                    <Row icon={Zap} title="Input Cepat" desc="Catat dari layar utama HP, suara & foto struk" onClick={go('/membership/profile?tab=lainnya')} />
                  </Group>

                  <Group>
                    <Row icon={Sparkles} title="Paket" desc={isPro ? `PRO${dateLong(user?.expiredAt) ? ` · sampai ${dateLong(user?.expiredAt)}` : ''}` : 'Gratis'} onClick={() => setView('paket')} />
                  </Group>

                  <div className="grid grid-cols-2 gap-3">
                    <Tile icon={LayoutGrid} title="Fitur" desc={`${FEATURE_COUNT} tersedia`} onClick={go('/membership/fitur')} />
                    <Tile icon={Tags} title="Kategori & Anggaran" onClick={() => setView('kategori')} />
                    <Tile icon={Users} title="Dompet Bersama" onClick={go('/membership/dompet-bersama')} />
                    <Tile icon={LifeBuoy} title="Bantuan" onClick={() => setView('bantuan')} />
                  </div>

                  <Group>
                    <Row icon={Settings} title="Pengaturan" desc="Uang, cara mencatat, pengingat" onClick={() => setView('umum')} />
                    <Row icon={ShieldCheck} title="Privasi & keamanan" desc="Kata sandi, verifikasi 2 langkah, perangkat" onClick={() => setView('privasi')} />
                    <Row icon={FileText} title="Ketentuan & kebijakan" onClick={() => setView('legal')} />
                  </Group>

                  <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-rose-50 py-3.5 text-[15px] font-semibold text-rose-600 hover:bg-rose-100">
                    <LogOut size={17} /> Keluar
                  </button>

                  <div className="flex justify-center gap-2 pt-1">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-500">Leosiqra web</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">Tersimpan di akunmu</span>
                  </div>
                </div>
              )}

              {view === 'profil' && (
                <div className="space-y-4">
                  <p className="px-1 text-[14px] text-slate-500">Profil kamu</p>
                  <Group>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <Avatar user={user} size={60} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[18px] font-semibold text-slate-900">{user?.name ?? '—'}</span>
                        <span className="block truncate text-[14px] text-slate-500">{user?.email ?? ''}</span>
                      </span>
                      <button type="button" onClick={() => setView('ubah-profil')} className="shrink-0 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100">
                        Ubah profil
                      </button>
                    </div>
                  </Group>
                  <Group>
                    <Row title="Status akun" value={user ? STATUS_LABEL[user.status] : '—'} />
                    <Row title="Status langganan" value={isPro ? 'PRO' : 'Gratis'} />
                    {isPro && dateLong(user?.expiredAt) && <Row title="Aktif sampai" value={dateLong(user?.expiredAt)!} />}
                    <Row title="Memakai Leosiqra sejak" value={monthYear(user?.memberSince)} />
                    <Row title="Kelola langganan" onClick={() => setView('paket')} />
                  </Group>
                  <p className="px-1 pt-2 text-[14px] text-slate-500">Akun</p>
                  <Group>
                    <Row title="Data diri & foto" onClick={go('/membership/profile?tab=akun')} />
                    <Row title="Kata sandi & 2 langkah" onClick={go('/membership/profile?tab=keamanan')} />
                    <Row title="Input Cepat & reset data" onClick={go('/membership/profile?tab=lainnya')} />
                  </Group>
                  <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-rose-50 py-3.5 text-[15px] font-semibold text-rose-600 hover:bg-rose-100">
                    <LogOut size={17} /> Keluar
                  </button>
                  {!isPro && (
                    <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-white via-white to-white/0 px-6 pt-4">
                      <button type="button" onClick={() => setView('paket')} className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[16px] font-bold text-white">
                        Upgrade ke PRO
                      </button>
                    </div>
                  )}
                </div>
              )}

              {view === 'bantuan' && (
                <Group>
                  <Row icon={BookOpen} title="Panduan & artikel" onClick={go('/membership/panduan')} />
                  <Row icon={Mail} title="Hubungi kami" onClick={go('/membership/hubungi-kami')} />
                  <Row icon={Lightbulb} title="Usulkan fitur" onClick={go('/membership/saran')} />
                </Group>
              )}

              {view === 'umum' && (
                <div className="space-y-4">
                  <p className="px-1 text-[14px] text-slate-500">Uang</p>
                  <Group>
                    <Row icon={Tags} title="Kategori & Anggaran" onClick={() => setView('kategori')} />
                    <Row icon={Target} title="Target tabungan" onClick={go('/membership/tabungan')} />
                    <Row icon={Repeat} title="Transaksi Rutin" onClick={go('/membership/recurring')} />
                    <Row icon={Coins} title="Mata uang" value="IDR" onClick={() => setView('mata-uang')} />
                  </Group>
                  <p className="px-1 pt-2 text-[14px] text-slate-500">Mencatat</p>
                  <Group>
                    <Row icon={Zap} title="Input Cepat" desc="Pasang di layar utama HP" onClick={go('/membership/profile?tab=lainnya')} />
                    <Row icon={Smartphone} title="Shortcut iPhone" desc="Catat lewat Siri, Back Tap & Action Button" onClick={go('/panduan/shortcut-ios')} />
                    <Row icon={Bot} title="Aplikasi terhubung" desc="Claude, ChatGPT lewat MCP" onClick={go('/membership/profile?tab=ai')} />
                  </Group>
                  <p className="px-1 pt-2 text-[14px] text-slate-500">Notifikasi</p>
                  <Group>
                    <Row icon={Bell} title="Notifikasi & pengingat" desc="Push, pengingat tutup hari, laporan email" onClick={go('/membership/profile?tab=notifikasi')} />
                  </Group>
                </div>
              )}

              {view === 'privasi' && (
                <div className="space-y-4">
                  <Group>
                    <Row icon={KeyRound} title="Kata sandi" onClick={go('/membership/profile?tab=keamanan')} />
                    <Row icon={ShieldCheck} title="Verifikasi 2 langkah" onClick={go('/membership/profile?tab=keamanan')} />
                    <Row icon={Smartphone} title="Perangkat yang masuk" onClick={go('/membership/profile?tab=keamanan')} />
                  </Group>
                  <button type="button" onClick={go('/membership/profile?tab=lainnya')} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[15px] font-medium text-rose-600 hover:text-rose-700">
                    <RotateCcw size={16} /> Atur ulang data
                  </button>
                </div>
              )}

              {view === 'legal' && (
                <Group>
                  <Row icon={ShieldCheck} title="Kebijakan Privasi" onClick={go('/privacy')} />
                  <Row icon={FileText} title="Ketentuan Penggunaan" onClick={go('/terms')} />
                </Group>
              )}

              {(view === 'kategori' || view === 'kategori-detail' || view === 'kategori-baru') && <KategoriSection view={view} go={setView} />}

              {view === 'ubah-profil' && user && (
                <ProfileEditView
                  initialName={user.name}
                  initialPhoto={user.photoURL ?? null}
                  initialAvatar={user.avatar ?? null}
                  onSaved={() => {
                    cloudflareApi<{ user?: PanelUser | null }>('/api/auth/me').then((r) => setUser(r.user ?? null)).catch(() => undefined);
                    setView('profil');
                  }}
                />
              )}

              {view === 'mata-uang' && <MataUangView onAdd={() => { onClose(); openModal('currency'); }} />}

              {view === 'paket' && <PaketView user={user} onClose={onClose} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

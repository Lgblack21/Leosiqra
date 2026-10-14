"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlarmClock, Bell, BookOpen, ChevronRight, Download, FileText, Flame, Grid3x3, Headphones, Inbox, LogOut, MessageSquareHeart, PiggyBank,
  Plug, Repeat, ShieldCheck, Smartphone, Tags, Target, Upload, User, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeatures } from '@/lib/features';
import { useModal } from '@/context/ModalContext';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Pengaturan dalam satu popup (dibuka dari ikon roda gigi di sidebar).
// Hanya pusat navigasi: tiap baris membuka halaman/form yang sudah ada.

type RowDef = { icon: React.ReactNode; label: string; hint?: string; href?: string; action?: () => void; danger?: boolean };

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { openModal } = useModal();
  const { enabled } = useFeatures();
  const [me, setMe] = useState<{ name?: string; email?: string; plan?: string; created_at?: string } | null>(null);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    cloudflareApi<{ user?: { name?: string; email?: string; plan?: string; created_at?: string } | null }>('/api/auth/me').then((r) => setMe(r.user ?? null)).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (href: string) => () => {
    onClose();
    router.push(href);
  };
  const days = me?.created_at ? Math.max(1, Math.floor((nowMs - Date.parse(me.created_at)) / 864e5)) : null;
  const logout = async () => {
    try {
      await cloudflareApi('/api/auth/logout', { method: 'POST' });
    } finally {
      onClose();
      router.push('/auth/login');
    }
  };

  const groups: { title: string; rows: RowDef[] }[] = [
    {
      title: 'Keuangan',
      rows: [
        { icon: <Target size={18} />, label: 'Anggaran', href: '/membership/budget' },
        { icon: <PiggyBank size={18} />, label: 'Target tabungan', href: '/membership/tabungan' },
        { icon: <Repeat size={18} />, label: 'Transaksi berulang', href: '/membership/langganan' },
        { icon: <Tags size={18} />, label: 'Kategori & mata uang', href: '/membership/nama-akun' },
        { icon: <Flame size={18} />, label: 'Streak & tutup hari', href: '/membership/streak' },
        { icon: <AlarmClock size={18} />, label: 'Pengingat', href: '/membership/pengingat' },
      ],
    },
    {
      title: 'Pencatatan & data',
      rows: [
        { icon: <Inbox size={18} />, label: 'Kotak masuk', hint: 'Draf dari notifikasi & email', href: '/membership/kotak-masuk' },
        { icon: <Upload size={18} />, label: 'Impor mutasi bank / e-wallet', action: () => { onClose(); openModal('import_mutasi'); } },
        { icon: <Download size={18} />, label: 'Ekspor transaksi (CSV)', href: '/membership/transactions/daily' },
        { icon: <Bell size={18} />, label: 'Notifikasi & keamanan', hint: 'Push, PIN, 2FA', href: '/membership/profile' },
      ],
    },
    {
      title: 'Bantuan',
      rows: [
        { icon: <Smartphone size={18} />, label: 'Pasang di HP', hint: 'Android · iPhone', href: '/install' },
        { icon: <BookOpen size={18} />, label: 'Panduan', href: '/membership/panduan' },
        { icon: <MessageSquareHeart size={18} />, label: 'Saran & kritik', href: '/membership/saran' },
        { icon: <Headphones size={18} />, label: 'Hubungi kami', href: '/membership/hubungi-kami' },
        { icon: <ShieldCheck size={18} />, label: 'Kebijakan privasi', href: '/privacy' },
        { icon: <FileText size={18} />, label: 'Syarat & ketentuan', href: '/terms' },
      ],
    },
  ];

  const Row = ({ r }: { r: RowDef }) => (
    <li className="border-b border-slate-200/60 last:border-0">
      <button type="button" onClick={r.action ?? (r.href ? go(r.href) : undefined)} className={cn('flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-200/50', r.danger ? 'text-rose-600' : 'text-slate-800')}>
        <span className={r.danger ? 'text-rose-500' : 'text-slate-500'}>{r.icon}</span>
        <span className="flex-1 text-[15px]">{r.label}</span>
        {r.hint && <span className="text-xs text-slate-400">{r.hint}</span>}
        {!r.danger && <ChevronRight size={16} className="text-slate-400" />}
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Pengaturan">
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-lg font-extrabold text-slate-900">Pengaturan</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6">
          <section className="space-y-2.5">
            <p className="px-1 text-sm font-semibold text-slate-500">Akun</p>
            <button type="button" onClick={go('/membership/profile')} className="flex w-full items-center gap-3 rounded-[20px] bg-slate-100/80 p-4 text-left hover:bg-slate-100">
              <LeoMascot mood="happy" size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-slate-900">{me?.name || 'Profil kamu'}</span>
                <span className="block truncate text-xs text-slate-500">{days ? `Bersama Leosiqra ${days} hari` : me?.email ?? 'Profil, foto, dan keamanan akun'}</span>
              </span>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', me?.plan === 'PRO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600')}>{me?.plan === 'PRO' ? 'PRO' : 'Gratis'}</span>
            </button>
            <ul className="overflow-hidden rounded-[20px] bg-slate-100/80">
              <Row r={{ icon: <Plug size={18} />, label: 'Aplikasi terhubung', hint: 'Gmail & lainnya', href: '/membership/aplikasi-terhubung' }} />
              <Row r={{ icon: <Grid3x3 size={18} />, label: 'Kelola fitur', hint: `${enabled.length} aktif`, href: '/membership/fitur' }} />
              <Row r={{ icon: <User size={18} />, label: 'Profil & keamanan', href: '/membership/profile' }} />
            </ul>
          </section>

          {groups.map((g) => (
            <section key={g.title} className="space-y-2.5">
              <p className="px-1 text-sm font-semibold text-slate-500">{g.title}</p>
              <ul className="overflow-hidden rounded-[20px] bg-slate-100/80">{g.rows.map((r) => <Row key={r.label} r={r} />)}</ul>
            </section>
          ))}

          <ul className="overflow-hidden rounded-[20px] bg-slate-100/80">
            <Row r={{ icon: <LogOut size={18} />, label: 'Keluar', action: logout, danger: true }} />
          </ul>
          <p className="text-center text-xs text-slate-400">Leosiqra</p>
        </div>
      </motion.div>
    </div>
  );
}

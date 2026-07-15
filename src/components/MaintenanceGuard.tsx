"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Wrench, MessageCircle } from 'lucide-react';
import type { UserProfile } from '@/lib/services/userService';
import type { AppSettings } from '@/lib/services/adminService';
import { cloudflareApi } from '@/lib/cloudflare-api';

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const pathname = usePathname();

  const isAdminPage = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/auth/login';

  useEffect(() => {
    cloudflareApi<{
      user?: UserProfile | null;
      maintenance?: {
        isActive: boolean;
        type?: 'code' | 'image' | null;
        code?: string | null;
        imageUrl?: string | null;
        whatsapp?: string | null;
      } | null;
    }>('/api/auth/me')
      .then((data) => {
        setProfile(data.user ?? null);
        setWhatsapp(data.maintenance?.whatsapp ?? null);
        setSettings(data.maintenance ? {
          maintenance: {
            isActive: data.maintenance.isActive,
            type: data.maintenance.type === 'code' || data.maintenance.type === 'image' ? data.maintenance.type : undefined,
            code: data.maintenance.code ?? undefined,
            imageUrl: data.maintenance.imageUrl ?? undefined,
          }
        } : null);
      })
      .catch(() => {
        setProfile(null);
        setSettings(null);
        setWhatsapp(null);
      })
      .finally(() => setIsChecking(false));

    return () => {
      setProfile(null);
      setSettings(null);
      setWhatsapp(null);
    };
  }, []);

  // Normalisasi nomor WhatsApp jadi format internasional tanpa "+"/spasi/strip
  // (dibutuhkan wa.me) — anggap nomor lokal Indonesia kalau diawali "0".
  const normalizedWhatsApp = useMemo(() => {
    if (!whatsapp) return null;
    let digits = whatsapp.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    else if (!digits.startsWith('62')) digits = '62' + digits;
    return digits;
  }, [whatsapp]);

  // LOGIKA BYPASS & BLOKIR

  // 1. Jika rute ADMIN, langsung berikan akses (AdminLayout akan handle selebihnya)
  // Ini untuk menghindari flicker atau double loading di level global.
  if (isAdminPage) return <>{children}</>;

  if (isChecking && settings?.maintenance?.isActive) return null;

  // 2. Admin (setelah terdeteksi) SELALU bisa melihat semua halaman
  if (profile?.role === 'admin') return <>{children}</>;

  // 2. Halaman Login SELALU terbuka agar Admin bisa masuk
  if (isLoginPage) return <>{children}</>;

  // 3. Jika maintenance aktif dan BUKAN Admin, blokir SEMUA halaman (termasuk landing & register).
  // Admin tetap bisa masuk lewat /auth/login secara langsung (dibebaskan di atas) —
  // sengaja tidak ada tombol/link menuju login di layar publik ini.
  if (settings?.maintenance?.isActive) {
    if (settings.maintenance.type === 'code' && settings.maintenance.code) {
      return (
        <div
          className="fixed inset-0 z-[9999] bg-white overflow-auto"
          dangerouslySetInnerHTML={{ __html: settings.maintenance.code }}
        />
      );
    } else if (settings.maintenance.type === 'image' && settings.maintenance.imageUrl) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black relative">
          <Image
            src={settings.maintenance.imageUrl}
            alt="Maintenance"
            fill
            className="object-contain"
          />
        </div>
      );
    } else {
      // Fallback — halaman maintenance default, dirancang tetap terasa premium
      // dan konsisten dengan identitas visual Leosiqra (serif display + indigo/slate).
      return (
        <div className="fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto overflow-x-hidden">
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 12% 15%, rgba(99,102,241,0.30), transparent 42%), radial-gradient(circle at 88% 85%, rgba(16,185,129,0.20), transparent 48%), radial-gradient(circle at 50% 100%, rgba(129,140,248,0.14), transparent 55%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />

          <div className="relative min-h-screen flex items-center justify-center px-5 py-16 sm:px-6">
            <div className="w-full max-w-md rounded-[36px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_70px_-20px_rgba(0,0,0,0.6)] px-7 py-10 sm:px-10 sm:py-12 text-center">
              <div className="relative mx-auto mb-8 w-16 h-16">
                <span className="absolute inset-0 rounded-2xl bg-indigo-500/25 animate-ping [animation-duration:2.4s]" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]">
                  <Wrench size={24} className="text-white" />
                </div>
              </div>

              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.2em] uppercase text-indigo-300 mb-5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                </span>
                Sedang Pemeliharaan
              </span>

              <h1 className="text-3xl sm:text-4xl font-serif font-black text-white leading-tight [text-wrap:balance] mb-3">
                Leosiqra Sedang Ditingkatkan
              </h1>
              <p className="text-slate-400 font-medium leading-relaxed text-[15px] [text-wrap:balance] mb-8">
                Kami sedang melakukan pemeliharaan sistem untuk pengalaman yang lebih baik.
                Mohon maaf atas ketidaknyamanannya — layanan akan segera aktif kembali.
              </p>

              {normalizedWhatsApp && (
                <a
                  href={`https://wa.me/${normalizedWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all hover:scale-[1.02] shadow-[0_10px_30px_-8px_rgba(16,185,129,0.55)]"
                >
                  <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors">
                    <MessageCircle size={14} />
                  </span>
                  Hubungi Kami: {whatsapp}
                </a>
              )}

              <p className="mt-10 text-[10px] font-bold text-white/25 uppercase tracking-[0.2em]">
                Leosiqra &middot; Platform Finansial Pribadi
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

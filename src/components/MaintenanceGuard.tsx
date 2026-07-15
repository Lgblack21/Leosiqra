"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Wrench, MessageCircle, ShieldCheck } from 'lucide-react';
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

  // 3. Jika maintenance aktif dan BUKAN Admin, blokir SEMUA halaman (termasuk landing & register)
  // Link kecil ke /auth/login selalu ditampilkan di atas layar maintenance apa pun
  // (code/image/fallback) agar Admin tetap bisa menemukan jalan masuk ke panel.
  const adminLoginLink = (
    <a
      href="/auth/login"
      className="fixed bottom-4 right-4 z-[10000] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-bold tracking-wide hover:bg-white/20 hover:text-white transition-all"
    >
      <ShieldCheck size={13} /> Admin Login
    </a>
  );

  if (settings?.maintenance?.isActive) {
    if (settings.maintenance.type === 'code' && settings.maintenance.code) {
      return (
        <>
          <div
            className="fixed inset-0 z-[9999] bg-white overflow-auto"
            dangerouslySetInnerHTML={{ __html: settings.maintenance.code }}
          />
          {adminLoginLink}
        </>
      );
    } else if (settings.maintenance.type === 'image' && settings.maintenance.imageUrl) {
      return (
        <>
          <div className="fixed inset-0 z-[9999] bg-black relative">
            <Image
              src={settings.maintenance.imageUrl}
              alt="Maintenance"
              fill
              className="object-contain"
            />
          </div>
          {adminLoginLink}
        </>
      );
    } else {
      // Fallback — halaman maintenance default, dirancang tetap terasa premium
      // dan konsisten dengan identitas visual Leosiqra (serif display + indigo/slate).
      return (
        <>
          <div className="fixed inset-0 z-[9999] bg-slate-950 overflow-auto">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 15% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(16,185,129,0.25), transparent 50%)',
              }}
            />
            <div className="relative min-h-screen flex items-center justify-center p-6 text-center">
              <div className="max-w-lg w-full space-y-8">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Wrench size={32} className="text-indigo-300 animate-[spin_6s_linear_infinite]" />
                </div>

                <div className="space-y-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.2em] uppercase text-indigo-300">
                    Sedang Pemeliharaan
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-serif font-black text-white leading-tight">
                    Leosiqra Sedang Ditingkatkan
                  </h1>
                  <p className="text-slate-400 font-medium leading-relaxed">
                    Kami sedang melakukan pemeliharaan sistem untuk pengalaman yang lebih baik.
                    Mohon maaf atas ketidaknyamanannya — layanan akan segera aktif kembali.
                  </p>
                </div>

                {normalizedWhatsApp && (
                  <a
                    href={`https://wa.me/${normalizedWhatsApp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors shadow-[0_8px_30px_rgba(16,185,129,0.35)]"
                  >
                    <MessageCircle size={18} />
                    Hubungi Kami: {whatsapp}
                  </a>
                )}
              </div>
            </div>
          </div>
          {adminLoginLink}
        </>
      );
    }
  }

  return <>{children}</>;
}

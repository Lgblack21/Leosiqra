"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, UserProfile } from '@/lib/services/userService';
import { subscribeAppSettings, AppSettings } from '@/lib/services/adminService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isCloudflareAuthEnabled } from '@/lib/runtime-mode';

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const pathname = usePathname();
  
  const isAdminPage = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/auth/login';

  useEffect(() => {
    if (isCloudflareAuthEnabled) {
      cloudflareApi<{
        user?: UserProfile | null;
        maintenance?: {
          isActive: boolean;
          type?: 'code' | 'image' | null;
          code?: string | null;
          imageUrl?: string | null;
        } | null;
      }>('/api/auth/me')
        .then((data) => {
          setProfile(data.user ?? null);
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
        })
        .finally(() => setIsChecking(false));

      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const prof = await getUserProfile(user.uid);
        setProfile(prof);
      } else {
        setProfile(null);
      }
      setIsChecking(false);
    });

    const unsubSettings = subscribeAppSettings((data) => {
      setSettings(data);
    });

    return () => {
      unsubAuth();
      unsubSettings();
    };
  }, []);

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
  if (settings?.maintenance?.isActive) {
    if (settings.maintenance.type === 'code') {
      return (
        <div 
          className="fixed inset-0 z-[9999] bg-white overflow-auto"
          dangerouslySetInnerHTML={{ __html: settings.maintenance.code || '<h1>Maintenance Mode</h1>' }}
        />
      );
    } else if (settings.maintenance.type === 'image' && settings.maintenance.imageUrl) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black">
          <img 
            src={settings.maintenance.imageUrl} 
            alt="Maintenance" 
            className="w-full h-full object-contain"
          />
        </div>
      );
    } else {
      // Fallback
      return (
        <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-black text-slate-900 font-serif">Pemeliharaan Sistem</h1>
            <p className="text-slate-500 font-medium">Kami akan segera kembali. Terima kasih atas kesabaran Anda.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

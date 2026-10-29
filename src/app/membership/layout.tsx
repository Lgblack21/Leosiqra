"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { MobileTabBar } from '@/components/MobileTabBar';
import { SettingsPanel, type View as SettingsView } from '@/components/settings/SettingsPanel';
import { OPEN_SETTINGS_EVENT, SETTINGS_VIEWS_FROM_URL } from '@/lib/settingsPanel';
import { ModalProvider } from '@/context/ModalContext';
import { GlobalModalWrapper } from '@/components/GlobalModalWrapper';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { readReferralCode, clearReferralCode } from '@/lib/signupSource';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { reportAppOpened } from '@/lib/appUsage';
import { useCategoryTemplateSync } from '@/lib/categoryTemplateSync';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { isWebDarkReady } from '@/lib/webTheme';

const ONBOARDING_PATH = '/membership/onboarding';
// Halaman layar penuh: tanpa sidebar, header, dan tab bar HP (punya navigasi sendiri).
const FULLSCREEN_PATHS = ['/membership/investment'];

// Tema (Sistem/Terang/Gelap) disimpan per perangkat, sama dengan aplikasi HP.
export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MembershipShell>{children}</MembershipShell>
    </ThemeProvider>
  );
}

function MembershipShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useCategoryTemplateSync();
  const { resolvedTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('menu');

  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // openSettings(view) dari halaman mana pun, atau ?pengaturan=<view> di URL
  // (dipakai pengalihan halaman lama Kategori/Budget & tautan dari luar layout).
  useEffect(() => {
    const open = (view: SettingsView) => { setSettingsView(view); setSettingsOpen(true); };
    const onEvent = (e: Event) => open((e as CustomEvent<SettingsView>).detail ?? 'menu');
    window.addEventListener(OPEN_SETTINGS_EVENT, onEvent);
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('pengaturan');
    if (fromUrl && (SETTINGS_VIEWS_FROM_URL as readonly string[]).includes(fromUrl)) {
      open(fromUrl as SettingsView);
      params.delete('pengaturan');
      const rest = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onEvent);
  }, [pathname]);

  useEffect(() => {
    cloudflareApi<{ user?: { onboarded?: boolean } | null }>('/api/auth/me')
      .then((result) => {
        if (!result.user) {
          setLoading(false);
          router.replace('/auth/login');
          return;
        }
        // Datang dari tautan "Ajak teman" (?ref=) → pakai kodenya sekali.
        // Ditolak server (kode sendiri/sudah pakai/akun >30 hari) = buang;
        // gagal jaringan = simpan untuk dicoba lagi.
        const refCode = readReferralCode();
        if (refCode) {
          cloudflareApi('/api/member/coins/apply-code', { method: 'POST', json: { code: refCode } })
            .then(clearReferralCode)
            .catch((e) => { if (!(e instanceof TypeError)) clearReferralCode(); });
        }
        // User baru yang belum menyelesaikan setup awal dipaksa ke wizard
        // onboarding dulu — kecuali memang sedang berada di halamannya, supaya
        // tidak terjadi redirect loop.
        if (!result.user.onboarded && pathname !== ONBOARDING_PATH) {
          router.replace(ONBOARDING_PATH);
          return;
        }
        // Dibuka dari aplikasi Leosiqra terpasang (scope-nya mencakup /membership).
        reportAppOpened('leosiqra');
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.replace('/auth/login');
      });
  }, [router, pathname]);

  // Hapus spinner agar transisi dari tombol login terasa instan.
  if (loading) return null;

  // Mode gelap bertahap: kerangka selalu ikut tema, isi halaman hanya untuk
  // rute di WEB_DARK_READY (lib/webTheme.ts). Lihat .web-dark di globals.css.
  const dark = resolvedTheme === 'dark';
  const pageDark = dark && isWebDarkReady(pathname);
  // Pembungkus selalu dirender (display: contents) — hanya kelasnya yang
  // berubah, supaya Sidebar/Header/Panel tidak di-mount ulang.
  const frameClass = `contents${dark && !pageDark ? ' web-dark' : ''}`;
  const fullscreen = FULLSCREEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (fullscreen) {
    return (
      <FeedbackProvider>
      <ModalProvider>
        <div className={`web-page min-h-screen bg-[#f6f7fb]${pageDark ? ' web-dark' : ''}`}>
          {children}
          <div className={frameClass}>
            <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialView={settingsView} />
          </div>
          <GlobalModalWrapper />
        </div>
      </ModalProvider>
      </FeedbackProvider>
    );
  }

  return (
    <FeedbackProvider>
    <ModalProvider>
      <div className={`web-page flex min-h-screen bg-[#f6f7fb] relative overflow-x-hidden print:block print:min-h-0 print:h-auto${pageDark ? ' web-dark' : ''}`}>
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className={frameClass}><Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onOpenSettings={() => { setSettingsView('menu'); setSettingsOpen(true); }} /></div>

        {/* Main Content */}
        {/* print:block+print:h-auto: tanpa ini, konten cetak yang bersarang di
            dalam ancestor flex/min-h-screen kepotong di batas tinggi layar
            (bug pagination flexbox saat print di Chrome) alih-alih mengalir
            ke halaman berikutnya. */}
        <main className="flex-1 md:ml-[84px] lg:ml-72 min-h-screen flex flex-col min-w-0 pb-24 md:pb-0 print:pb-0 print:block print:min-h-0 print:h-auto print:ml-0 print:pt-0">
          <div className={frameClass}><Header onMenuClick={() => setIsSidebarOpen(true)} /></div>

          {/* Page Content */}
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 print:p-0 print:m-0 print:max-w-none">
            {children}
          </div>
        </main>

        <div className={frameClass}>
          <MobileTabBar />
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialView={settingsView} />
        </div>
        <GlobalModalWrapper />
        <OnboardingTour />
      </div>
    </ModalProvider>
    </FeedbackProvider>
  );
}

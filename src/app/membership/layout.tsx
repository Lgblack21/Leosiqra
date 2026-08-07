"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ModalProvider } from '@/context/ModalContext';
import { GlobalModalWrapper } from '@/components/GlobalModalWrapper';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { cloudflareApi } from '@/lib/cloudflare-api';

const ONBOARDING_PATH = '/membership/onboarding';

export default function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    cloudflareApi<{ user?: { onboarded?: boolean } | null }>('/api/auth/me')
      .then((result) => {
        if (!result.user) {
          setLoading(false);
          router.replace('/auth/login');
          return;
        }
        // User baru yang belum menyelesaikan setup awal dipaksa ke wizard
        // onboarding dulu — kecuali memang sedang berada di halamannya, supaya
        // tidak terjadi redirect loop.
        if (!result.user.onboarded && pathname !== ONBOARDING_PATH) {
          router.replace(ONBOARDING_PATH);
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.replace('/auth/login');
      });
  }, [router, pathname]);

  // Hapus spinner agar transisi dari tombol login terasa instan.
  if (loading) return null;

  return (
    <ModalProvider>
      <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden print:block print:min-h-0 print:h-auto">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content */}
        {/* print:block+print:h-auto: tanpa ini, konten cetak yang bersarang di
            dalam ancestor flex/min-h-screen kepotong di batas tinggi layar
            (bug pagination flexbox saat print di Chrome) alih-alih mengalir
            ke halaman berikutnya. */}
        <main className="flex-1 lg:ml-72 min-h-screen flex flex-col min-w-0 pt-20 print:block print:min-h-0 print:h-auto print:ml-0 print:pt-0">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />

          {/* Page Content */}
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 print:p-0 print:m-0 print:max-w-none">
            {children}
          </div>
        </main>

        <GlobalModalWrapper />
        <OnboardingTour />
      </div>
    </ModalProvider>
  );
}

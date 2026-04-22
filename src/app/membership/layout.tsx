"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ModalProvider } from '@/context/ModalContext';
import { GlobalModalWrapper } from '@/components/GlobalModalWrapper';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isCloudflareAuthEnabled } from '@/lib/runtime-mode';

export default function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isCloudflareAuthEnabled) {
      cloudflareApi('/api/auth/me')
        .then(() => setLoading(false))
        .catch(() => router.push('/auth/login'));
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
      } else {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // Hapus spinner agar transisi dari tombol login terasa instan.
  if (loading) return null;

  return (
    <ModalProvider>
      <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen flex flex-col min-w-0 pt-20">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />

          {/* Page Content */}
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
            {children}
          </div>
        </main>

        <GlobalModalWrapper />
      </div>
    </ModalProvider>
  );
}

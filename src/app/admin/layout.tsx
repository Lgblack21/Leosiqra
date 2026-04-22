"use client";

import { useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminHeader } from '@/components/AdminHeader';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/services/userService';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isCloudflareAuthEnabled } from '@/lib/runtime-mode';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isCloudflareAuthEnabled) {
      cloudflareApi<{ user?: { role: 'admin' | 'user' } | null }>('/api/auth/me')
        .then((result) => {
          if (result.user?.role === 'admin') {
            setAuthorized(true);
          } else {
            router.push('/membership/dashboard');
          }
        })
        .catch(() => router.push('/auth/login'))
        .finally(() => setLoading(false));
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const prof = await getUserProfile(user.uid);
        if (prof?.role === 'admin') {
          setAuthorized(true);
        } else {
          router.push('/membership/dashboard');
        }
      } else {
        router.push('/auth/login');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Kita tidak lagi menampilkan spinner full-screen agar transisi terasa instan.
  // Jika belum authorized, kita kembalikan null agar tidak ada bocoran konten.
  if (loading || !authorized) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col min-w-0 pt-20">
        <AdminHeader onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

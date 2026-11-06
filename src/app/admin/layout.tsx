"use client";

import { useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminHeader } from '@/components/AdminHeader';
import { useRouter } from 'next/navigation';
import { cloudflareApi } from '@/lib/cloudflare-api';

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
    cloudflareApi<{ user?: { role: 'admin' | 'user' } | null }>('/api/auth/me')
      .then((result) => {
        if (result.user?.role === 'admin') {
          setAuthorized(true);
        } else if (result.user) {
          router.push('/membership/dashboard');
        } else {
          router.push('/auth/login');
        }
      })
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  }, [router]);

  // Jika belum authorized, kita kembalikan null agar tidak ada bocoran konten.
  if (loading || !authorized) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-x-hidden">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col min-w-0 pt-20">
        <AdminHeader onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

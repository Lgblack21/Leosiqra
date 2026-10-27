"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Halaman lama — Kategori, Mata uang & Anggaran kini ada di panel Pengaturan.
// Dipertahankan sebagai pengalihan supaya bookmark/tautan lama tetap jalan.
export default function RedirectToSettings() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/dashboard?pengaturan=kategori');
  }, [router]);
  return null;
}

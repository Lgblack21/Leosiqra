"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Halaman lama — Profil, kontak, keamanan, notifikasi, aplikasi terhubung &
// reset data kini ada di panel Pengaturan. Dipertahankan sebagai pengalihan
// supaya bookmark/tautan lama (?tab=…) tetap membuka bagian yang sama.
const TAB_TO_VIEW: Record<string, string> = {
  akun: 'kontak',
  keamanan: 'privasi',
  notifikasi: 'notifikasi',
  ai: 'ai',
  lainnya: 'lainnya',
};

export default function RedirectToSettings() {
  const router = useRouter();
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab') ?? '';
    router.replace(`/membership/dashboard?pengaturan=${TAB_TO_VIEW[tab] ?? 'profil'}`);
  }, [router]);
  return null;
}

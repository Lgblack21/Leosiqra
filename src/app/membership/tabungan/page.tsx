"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tabungan dilebur ke halaman Kekayaan (2026-10-30) — jadi tab #tabungan di sana.
export default function TabunganRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/kekayaan#tabungan');
  }, [router]);
  return null;
}

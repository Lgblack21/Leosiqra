"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Laporan Tahunan dihapus (2026-10-30) — dobel dengan Laporan → mode Tahunan.
export default function AnnualRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/laporan');
  }, [router]);
  return null;
}

"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Data Pasar dilebur ke Investasiku (2026-10-29) — harga pasar ada di kolom kanannya.
export default function MarketDataRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/investment#pasar');
  }, [router]);
  return null;
}

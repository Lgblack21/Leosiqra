"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Transfer & Top Up dilebur ke Riwayat Transaksi (2026-10-29): datanya memang
// transaksi biasa (type transfer/topup), tampil lewat filter "Transfer".
// Mencatat transfer tetap lewat Catat Transaksi → Transfer & Top Up.
export default function TopUpRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/transactions/daily?jenis=transfer');
  }, [router]);
  return null;
}

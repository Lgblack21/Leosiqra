'use client';

import { Suspense } from 'react';
import { UsahakuApp } from '@/components/usahaku/UsahakuApp';

// Usahaku — layar penuh (FULLSCREEN_PATHS di layout): daftar usaha, lalu Beranda · Kasir · Stok · Laporan.
export default function UsahakuPage() {
  return (
    <Suspense fallback={null}>
      <UsahakuApp variant="web" />
    </Suspense>
  );
}

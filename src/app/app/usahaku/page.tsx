'use client';

import { Suspense } from 'react';
import { UsahakuApp } from '@/components/usahaku/UsahakuApp';

// Usahaku versi app HP — layar penuh (di luar grup tab), komponen sama dengan web.
export default function AppUsahakuPage() {
  return (
    <Suspense fallback={null}>
      <UsahakuApp variant="app" />
    </Suspense>
  );
}

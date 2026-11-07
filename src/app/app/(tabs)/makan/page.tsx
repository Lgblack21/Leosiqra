'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Alamat lama (3.3.0) — Makan kini tab di Sehatku.
export default function AppMakanRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/app/sehat#makan'), [router]);
  return null;
}

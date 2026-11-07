'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Alamat lama (3.3.0) — Makan kini tab di Sehatku.
export default function MakanRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/membership/sehat#makan'), [router]);
  return null;
}

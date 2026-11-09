'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Alamat lama (3.3.0) — Makan kini tab di Olahragaku.
export default function MakanRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/membership/olahraga#makan'), [router]);
  return null;
}

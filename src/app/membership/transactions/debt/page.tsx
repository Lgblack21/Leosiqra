"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Hutang & Piutang dilebur ke halaman Kekayaan (2026-10-30) — jadi tab #hutang di sana.
export default function HutangRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/kekayaan#hutang');
  }, [router]);
  return null;
}

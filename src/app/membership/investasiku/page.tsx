"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Fitur "Simulasi Investasiku" sudah dihapus — simulasinya kini ada di
// Pasar & belajar (SBN vs deposito). URL lama diarahkan supaya tidak 404.
export default function InvestasikuRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/pasar');
  }, [router]);
  return null;
}

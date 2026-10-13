"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Kartu kredit sekarang bagian dari Dompet (panel Kartu kredit) — halaman
// terpisah dihapus supaya tidak ada dua tempat untuk hal yang sama. Tautan
// lama diarahkan ke Dompet dengan panel kartu terbuka.
export default function CardsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/rekening?panel=kartu');
  }, [router]);
  return null;
}

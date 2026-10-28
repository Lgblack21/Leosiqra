"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Halaman Kartu Saya dihapus (2026-10-28, permintaan Bos) — isinya dilebur ke
// Rekening (detail per rekening, tagihan kartu kredit, atur urutan). Rute ini
// tetap ada supaya tautan lama (notifikasi tagihan kartu yang sudah tersimpan,
// bookmark) tidak berakhir di 404.
export default function CardsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/membership/rekening');
  }, [router]);
  return null;
}

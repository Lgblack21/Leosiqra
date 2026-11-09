'use client';

import { cloudflareApi } from '@/lib/cloudflare-api';
import { pakaiDataApi, type HariLibur } from '@/lib/hariLibur';

// Muat tanggal merah dari API Indonesia (lewat Worker) untuk tahun ini & tahun depan, sekali per sesi.
// Gagal / belum aktif → diam-diam tetap memakai data bawaan.
let muat: Promise<void> | null = null;
export function muatHariLibur() {
  if (muat) return muat;
  const y = new Date().getFullYear();
  muat = Promise.all(
    [y, y + 1].map((tahun) =>
      cloudflareApi<{ items: HariLibur[] }>(`/api/member/libur?tahun=${tahun}`)
        .then((r) => pakaiDataApi(tahun, r.items))
        .catch(() => {}),
    ),
  ).then(() => {});
  return muat;
}

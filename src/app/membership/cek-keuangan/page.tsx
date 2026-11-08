'use client';

import { CekKeuanganApp } from '@/components/kanvas/CekKeuanganApp';

// Cek Keuangan — rasio sederhana (menabung, dana darurat, utang, cicilan, harta bersih) dari catatan user.
export default function CekKeuanganPage() {
  return <CekKeuanganApp variant="web" />;
}

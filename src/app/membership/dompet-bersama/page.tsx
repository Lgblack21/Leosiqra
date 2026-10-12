"use client";

import { SharedWalletPanel } from '@/components/shared-wallet/SharedWalletPanel';

export default function DompetBersamaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <h1 className="sr-only">Dompet bersama</h1>
      <p className="text-sm text-slate-500">
        Kelola uang keluarga, kas kos, atau patungan bareng. Buku kas terpisah dari keuangan pribadimu — anggota hanya melihat isi dompet
        bersama, tidak pernah rekening atau transaksi pribadimu.
      </p>
      <SharedWalletPanel platform="web" />
    </div>
  );
}

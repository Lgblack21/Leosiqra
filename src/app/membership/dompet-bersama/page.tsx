"use client";

import { Users } from 'lucide-react';
import { SharedWalletPanel } from '@/components/shared-wallet/SharedWalletPanel';

export default function DompetBersamaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-indigo-600/20 md:rounded-[32px] md:p-9">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Users size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">Dompet Bersama</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-indigo-100">
              Kelola uang keluarga, kas kos, atau patungan bareng. Buku kas terpisah dari keuangan pribadimu — anggota hanya
              melihat isi dompet bersama, tidak pernah rekening atau transaksi pribadimu.
            </p>
          </div>
        </div>
      </div>
      <SharedWalletPanel platform="web" />
    </div>
  );
}

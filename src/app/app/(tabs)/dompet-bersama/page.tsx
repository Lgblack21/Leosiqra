"use client";

import { FadeIn } from "@/components/app/FadeIn";
import { SharedWalletPanel } from "@/components/shared-wallet/SharedWalletPanel";

export default function AppDompetBersamaPage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10 space-y-5">
      <FadeIn>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Dompet Bersama</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Catat uang keluarga atau patungan bareng — terpisah dari keuangan pribadimu.</p>
      </FadeIn>
      <SharedWalletPanel platform="app" />
    </div>
  );
}

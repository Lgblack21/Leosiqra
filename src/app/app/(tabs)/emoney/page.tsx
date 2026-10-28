"use client";

import { FadeIn } from "@/components/app/FadeIn";
import { EmoneyScanner } from "@/components/emoney/EmoneyScanner";

export default function AppEmoneyPage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10 space-y-5">
      <FadeIn>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Kartu e-money</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Baca saldo Mandiri e-money & BNI TapCash lewat NFC, lalu samakan dengan rekeningmu.</p>
      </FadeIn>
      <EmoneyScanner />
    </div>
  );
}

"use client";

import Image from "next/image";
import { auth } from "@/lib/cf-client";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const name = auth.currentUser?.displayName?.split(" ")[0] || "";

  return (
    <div className="flex flex-col items-center text-center px-6 pt-16">
      <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 overflow-hidden">
        <Image src="/images/Logo-new.png" alt="Leosiqra" width={48} height={48} className="object-contain" />
      </div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-6">
        {name ? `Halo, ${name}!` : "Selamat Datang"}
      </h1>
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-2 max-w-xs">
        Yuk siapkan rekening pertama kamu supaya bisa langsung mulai catat transaksi.
      </p>

      <button
        type="button"
        onClick={onNext}
        className="mt-10 w-full max-w-xs py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
      >
        Mulai
      </button>
    </div>
  );
}

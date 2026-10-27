"use client";

import Image from "next/image";
import { FileCheck, Wallet, Zap } from "lucide-react";
import { auth } from "@/lib/cf-client";

interface WelcomeStepProps {
  onNext: () => void;
}

const TILES = [
  { title: "Catat dalam hitungan detik", desc: "Ketik “25rb kopi”, ucapkan, atau foto struk.", icon: Zap, tile: "bg-orange-500" },
  { title: "Semua rekening, satu layar", desc: "Bank, e-wallet, tunai, dan kartu kredit.", icon: Wallet, tile: "bg-indigo-600" },
  { title: "Siap lapor pajak", desc: "Ringkasan harta & penghasilan untuk SPT.", icon: FileCheck, tile: "bg-emerald-500" },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const name = auth.currentUser?.displayName?.split(" ")[0] || "";

  return (
    <div className="flex flex-col px-6 pt-12">
      <span className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
        <Image src="/images/Logo-new.png" alt="Leosiqra" width={34} height={34} className="object-contain" />
      </span>
      <p className="mt-8 text-[15px] font-semibold text-indigo-600 dark:text-indigo-400">
        {name ? `Halo, ${name}` : "Selamat datang"}
      </p>
      <h1 className="mt-1.5 text-[38px] leading-[1.03] font-black tracking-[-0.03em] text-slate-900 dark:text-white">
        Keuangan rapi,
        <br />
        mulai di sini.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
        Siapkan rekening pertama, lalu langsung catat transaksi.
      </p>

      <div className="mt-8 bg-white dark:bg-slate-900 rounded-[22px] divide-y divide-slate-100 dark:divide-slate-800">
        {TILES.map((t) => (
          <div key={t.title} className="flex items-center gap-3.5 px-4 py-3.5">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${t.tile}`}>
              <t.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-slate-900 dark:text-white">{t.title}</span>
              <span className="block text-[13px] text-slate-500 dark:text-slate-400">{t.desc}</span>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-10 w-full h-12 rounded-full bg-indigo-600 text-white font-bold text-[15px] active:scale-[0.98] transition-all"
      >
        Mulai
      </button>
    </div>
  );
}

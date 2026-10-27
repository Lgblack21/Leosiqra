"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeStep } from "@/components/app/onboarding/WelcomeStep";
import { FirstWalletStep } from "@/components/app/onboarding/FirstWalletStep";
import { GuestCarryOver } from "@/components/onboarding/GuestCarryOver";
import { loadGuest } from "@/lib/guestOnboarding";
import { useTheme } from "@/context/ThemeContext";

type Step = "welcome" | "wallet" | "carry";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const toApp = () => router.replace("/app");

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-slate-950 pb-10">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("wallet")} />}
      {step === "wallet" && <FirstWalletStep onDone={() => (loadGuest() ? setStep("carry") : toApp())} />}
      {step === "carry" && (
        // Datang dari /mulai: simpan pilihan + tawarkan catatan pertama & notifikasi.
        <div className="px-6 pt-12">
          <p className="text-[14px] font-semibold text-slate-500 dark:text-slate-400">Rekening siap</p>
          <h1 className="mt-1.5 text-[34px] leading-[1.05] font-black tracking-[-0.03em] text-slate-900 dark:text-white">Hampir selesai.</h1>
          <p className="mt-3 mb-6 text-[16px] leading-relaxed text-slate-500 dark:text-slate-400">
            Pilihanmu dari tadi sudah tersimpan di akun. Tinggal dua hal kecil ini.
          </p>
          <GuestCarryOver onDone={toApp} dark={resolvedTheme === "dark"} />
        </div>
      )}
    </div>
  );
}

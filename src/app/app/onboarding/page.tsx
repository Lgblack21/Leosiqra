"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeStep } from "@/components/app/onboarding/WelcomeStep";
import { FirstWalletStep } from "@/components/app/onboarding/FirstWalletStep";

type Step = "welcome" | "wallet";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("wallet")} />}
      {step === "wallet" && <FirstWalletStep onDone={() => router.replace("/app")} />}
    </div>
  );
}

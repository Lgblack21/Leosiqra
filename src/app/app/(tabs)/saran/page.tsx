"use client";

import { FadeIn } from "@/components/app/FadeIn";
import { FeedbackPanel } from "@/components/feedback/Feedback";

export default function AppSaranPage() {
  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10 space-y-5">
      <FadeIn>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Saran & Kritik</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bantu kami bikin Leosiqra lebih baik — setiap masukan dibaca langsung.</p>
      </FadeIn>
      <FeedbackPanel platform="app" />
    </div>
  );
}

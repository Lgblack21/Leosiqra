"use client";

import { MessageSquareHeart } from 'lucide-react';
import { FeedbackPanel } from '@/components/feedback/Feedback';

export default function SaranPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-indigo-600/20 md:rounded-[32px] md:p-9">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <MessageSquareHeart size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">Saran & Kritik</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-indigo-100">
              Bantu kami bikin Leosiqra lebih baik. Setiap masukan dibaca langsung oleh tim, dan balasannya muncul di
              riwayat di bawah.
            </p>
          </div>
        </div>
      </div>
      <FeedbackPanel platform="web" />
    </div>
  );
}

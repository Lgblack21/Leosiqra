"use client";

import { FeedbackPanel } from '@/components/feedback/Feedback';

export default function SaranPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <h1 className="sr-only">Saran & kritik</h1>
      <p className="text-sm text-slate-500">
        Bantu kami bikin Leosiqra lebih baik. Setiap masukan dibaca langsung oleh tim, dan balasannya muncul di riwayat di bawah.
      </p>
      <FeedbackPanel platform="web" />
    </div>
  );
}

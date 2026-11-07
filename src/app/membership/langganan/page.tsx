'use client';

import { HeaderSlot } from '@/components/Header';
import { LanggananView } from '@/components/langganan/LanggananView';
import { useFeedback } from '@/components/ui/Feedback';

// Langgananku — memantau langganan (Netflix, Spotify, internet, …) + Radar.
export default function LanggananPage() {
  const { toast } = useFeedback();
  return (
    <div className="mx-auto mb-12 max-w-[1100px] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Langgananku</h1>
          <p className="text-[14px] text-slate-500">
            Semua langganan di satu tempat — total per bulan, tagihan berikutnya, dan radar pemindai.
          </p>
        </div>
        <HeaderSlot />
      </div>
      <LanggananView variant="web" toast={(m) => toast.success(m)} />
    </div>
  );
}

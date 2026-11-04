"use client";

import { HeaderSlot } from '@/components/Header';
import { LadangView } from '@/components/ladang/LadangView';
import { useFeedback } from '@/components/ui/Feedback';

// Ladangku — cuan sampingan: Jual (taksir dari iklan asli), Tagih (WA + Patungan).
export default function LadangPage() {
  const { toast } = useFeedback();
  return (
    <div className="mx-auto mb-12 max-w-[900px] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Ladangku</h1>
          <p className="text-[14px] text-slate-500">Cuan sampingan: buka usaha, jual barang nganggur, dan tagih piutang.</p>
        </div>
        <HeaderSlot />
      </div>
      <LadangView variant="web" toast={(m) => toast.success(m)} />
    </div>
  );
}

"use client";

import { KasirView } from '@/components/ladang/KasirView';
import { useFeedback } from '@/components/ui/Feedback';

// Ladangku › Usahaku › Kasir (?id=<usaha>) — katalog toko + struk penjualan.
export default function KasirPage() {
  const { toast } = useFeedback();
  return (
    <div className="mx-auto mb-12 max-w-[1100px]">
      <KasirView variant="web" onToast={(m) => toast.success(m)} />
    </div>
  );
}

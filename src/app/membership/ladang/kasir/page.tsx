'use client';

import { KasirView } from '@/components/ladang/KasirView';
import { useFeedback } from '@/components/ui/Feedback';

// Ladangku › Usahaku › Kasir (?id=<usaha>) — katalog toko + struk penjualan.
export default function KasirPage() {
  const { toast } = useFeedback();
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pt-6">
      <KasirView variant="web" onToast={(m) => toast.success(m)} />
    </div>
  );
}

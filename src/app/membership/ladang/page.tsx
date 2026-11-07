'use client';

import { LadangView } from '@/components/ladang/LadangView';
import { useFeedback } from '@/components/ui/Feedback';

// Ladangku — layar penuh (seperti Investasiku): Ringkas · Usaha · Jual · Tagih.
export default function LadangPage() {
  const { toast } = useFeedback();
  return <LadangView variant="web" toast={(m) => toast.success(m)} />;
}

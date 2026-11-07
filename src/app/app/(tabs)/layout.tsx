'use client';

import { useEffect, useState } from 'react';
import { BottomTabBar } from '@/components/app/BottomTabBar';
import { Fab } from '@/components/app/Fab';
import { AddTransactionSheet } from '@/components/app/AddTransactionSheet';
import { useCategoryTemplateSync } from '@/lib/categoryTemplateSync';
import DevNoticeBanner from '@/components/DevNoticeBanner';
import { bindTxPrefillHost, takeTxPrefill, type TxPrefill } from '@/lib/txPrefill';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<TxPrefill | null>(null);
  useCategoryTemplateSync();

  // Ketuk notifikasi pengingat bernominal → buka sheet terisi (lihat lib/txPrefill).
  useEffect(() => {
    const open = () => {
      const p = takeTxPrefill();
      if (!p) return;
      setPrefill(p);
      setIsAddOpen(true);
    };
    open();
    return bindTxPrefillHost(open);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {children}
      <Fab onClick={() => setIsAddOpen(true)} isOpen={isAddOpen} />
      <DevNoticeBanner variant="app" saranHref="/app/saran" />
      <BottomTabBar />
      <AddTransactionSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} prefill={prefill} />
    </div>
  );
}

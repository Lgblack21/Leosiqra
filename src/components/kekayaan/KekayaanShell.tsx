"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { HandCoins, PieChart, PiggyBank } from 'lucide-react';
import { HeaderSlot } from '@/components/Header';
import { RingkasanKekayaan } from '@/components/kekayaan/RingkasanKekayaan';
import TabunganPanel from '@/components/kekayaan/TabunganPanel';
import HutangPanel from '@/components/kekayaan/HutangPanel';
import { cn } from '@/lib/utils';

// Halaman Kekayaan: Tabungan + Hutang & Piutang + ringkasan kekayaan bersih
// jadi satu (2026-10-30). Tab di hash URL (#tabungan, #hutang) supaya tautan
// lama (/membership/tabungan, /transactions/debt) bisa diarahkan ke sini.

export type KekayaanTab = 'ringkasan' | 'tabungan' | 'hutang';
const TABS: { id: KekayaanTab; label: string; icon: typeof PieChart }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: PieChart },
  { id: 'tabungan', label: 'Tabungan', icon: PiggyBank },
  { id: 'hutang', label: 'Hutang & Piutang', icon: HandCoins },
];
const fromHash = (): KekayaanTab => {
  const h = window.location.hash.slice(1) as KekayaanTab;
  return TABS.some((t) => t.id === h) ? h : 'ringkasan';
};

export function KekayaanShell() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<KekayaanTab>('ringkasan');

  useEffect(() => {
    const sync = () => setTab(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const go = (t: KekayaanTab) => {
    if (t === tab) return;
    window.history.pushState(null, '', t === 'ringkasan' ? window.location.pathname : `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="mx-auto mb-12 max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Kekayaan</h1>
            <p className="text-[14px] text-slate-500">Semua yang kamu punya dan yang masih harus dibayar, di satu tempat.</p>
          </div>
          <HeaderSlot className="md:hidden" />
        </div>
        <div className="flex items-center gap-2">
          <LayoutGroup id="kekayaan-tabs">
            <div role="tablist" aria-label="Bagian kekayaan" className="flex flex-1 gap-1 rounded-full bg-slate-100 p-1 md:flex-none">
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => go(t.id)} className={cn('relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold md:flex-none md:px-4', active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                    {active && <motion.span layoutId={reduce ? undefined : 'kekayaan-tab'} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <t.icon size={15} className="relative hidden sm:block" />
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
          <HeaderSlot className="hidden md:flex" />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === 'ringkasan' && <RingkasanKekayaan go={go} />}
          {tab === 'tabungan' && <TabunganPanel />}
          {tab === 'hutang' && <HutangPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

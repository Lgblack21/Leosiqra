"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BarChart3, GraduationCap, Newspaper, Sparkles } from 'lucide-react';
import { useMarketData } from '@/lib/hooks/useMarketData';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AiOrb } from '@/components/ai/AiChat';
import { TabInvestasiku } from '@/components/investasi/TabInvestasiku';
import { TabKabar, type KabarItem, type KabarState } from '@/components/investasi/TabKabar';
import { TabSbn } from '@/components/investasi/TabSbn';
import { TabBelajar } from '@/components/investasi/TabBelajar';
import { cn } from '@/lib/utils';

// Investasiku layar penuh (tanpa sidebar — lihat FULLSCREEN_PATHS di
// app/membership/layout.tsx): bar atas dengan tombol kembali ke Ringkasan,
// isi per tab, tab bar melayang di bawah. Tab disimpan di hash URL (#kabar)
// supaya tombol kembali browser & tautan langsung bekerja.

export type InvestTab = 'investasiku' | 'kabar' | 'sbn' | 'belajar';
const TABS: { id: InvestTab; label: string; title: string; icon: typeof Sparkles }[] = [
  { id: 'investasiku', label: 'Investasiku', title: 'Investasiku', icon: Sparkles },
  { id: 'kabar', label: 'Kabar', title: 'Kabar', icon: Newspaper },
  { id: 'sbn', label: 'SBN', title: 'SBN hari ini', icon: BarChart3 },
  { id: 'belajar', label: 'Belajar', title: 'Belajar', icon: GraduationCap },
];
const fromHash = (): InvestTab => {
  const h = (typeof window !== 'undefined' ? window.location.hash.slice(1) : '') as InvestTab;
  return TABS.some((t) => t.id === h) ? h : 'investasiku';
};

export function InvestShell() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<InvestTab>('investasiku');
  const market = useMarketData();
  const [kabar, setKabar] = useState<KabarState>({ items: null, error: false });

  useEffect(() => {
    const sync = () => setTab(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    let alive = true;
    cloudflareApi<{ items?: KabarItem[]; scanned?: number; relevant?: number }>('/api/member/kabar')
      .then((r) => alive && setKabar({ items: r.items ?? [], error: false, scanned: r.scanned, relevant: r.relevant }))
      .catch(() => alive && setKabar({ items: [], error: true }));
    return () => { alive = false; };
  }, []);

  const go = (t: InvestTab) => {
    if (t === tab) return;
    window.history.pushState(null, '', t === 'investasiku' ? window.location.pathname : `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-32 pt-4 md:px-8 md:pt-6">
      <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link href="/membership/dashboard" aria-label="Kembali ke Ringkasan" className="group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5"><ArrowLeft size={16} /></span> <span className="hidden sm:inline">Ringkasan</span>
        </Link>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="min-w-0 text-center">
            <h1 className="truncate text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[24px]">{current.title}</h1>
            {tab === 'investasiku' && <p className="text-[12px] text-slate-500">Portofolio, simulasi & harga pasar</p>}
          </motion.div>
        </AnimatePresence>
        <Link href="/membership/ai-leosiqra" aria-label="Tanya Leo" className="rounded-full ring-2 ring-white transition-transform hover:scale-105">
          <AiOrb size={44} />
        </Link>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={tab} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          {tab === 'investasiku' && <TabInvestasiku market={market} kabar={kabar} go={go} />}
          {tab === 'kabar' && <TabKabar kabar={kabar} market={market} go={go} />}
          {tab === 'sbn' && <TabSbn />}
          {tab === 'belajar' && <TabBelajar />}
        </motion.main>
      </AnimatePresence>

      {/* Dock melayang: gelap transparan, tab aktif melebar menampilkan label. */}
      <nav aria-label="Menu Investasiku" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4 print:hidden">
        <div className="flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <motion.button
                key={t.id}
                type="button"
                layout={!reduce}
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={cn('relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold', active ? 'px-4' : 'w-12 hover:bg-white/10')}
              >
                {active && <motion.span layoutId={reduce ? undefined : 'invest-tab'} className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <t.icon size={20} className={cn('relative shrink-0', active ? 'text-slate-950' : 'text-white/70')} strokeWidth={active ? 2.4 : 1.9} />
                {active && <motion.span initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="relative whitespace-nowrap text-slate-950">{t.label}</motion.span>}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { LayoutGroup, motion } from 'framer-motion';
import { ChevronLeft, Leaf, ListChecks, Settings2, Timer } from 'lucide-react';
import { FocusTimer } from './FocusTimer';
import { BreathView } from './BreathView';
import { RecapView } from './RecapView';
import { HeaderSlot } from '@/components/Header';
import { localSessions, subscribeSessions, syncSessions, type FocusSession } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

// Fokus bareng Leo — timer fokus (pomodoro), napas tenang & rekap. Dipakai web
// (/membership/fokus) dan app HP (/app/fokus). Tampil SATU LAYAR penuh: tinggi diukur
// dari ruang yang tersedia (di bawah header, di atas tab bawah & tombol +), halaman
// tidak bisa digulir; Rekap menggulir di dalam kartunya sendiri.
type Tab = 'fokus' | 'tenang' | 'rekap';
const TABS: { id: Tab; label: string; icon: typeof Timer }[] = [
  { id: 'fokus', label: 'Fokus', icon: Timer },
  { id: 'tenang', label: 'Tenang', icon: Leaf },
  { id: 'rekap', label: 'Rekap', icon: ListChecks },
];
const noop = () => () => {};
// Lebih pendek dari ini (HP landscape dsb.) → tidak dikunci; halaman boleh digulir.
const MIN_FIT = 420;

function useFitHeight(ref: React.RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bar = document.querySelector<HTMLElement>('[data-bottom-bar]');
      // (offsetParent selalu null untuk position:fixed → cek tampil dari ukuran & display)
      const r = bar?.getBoundingClientRect();
      const barTop = bar && r && r.height > 0 && getComputedStyle(bar).display !== 'none' ? r.top : window.innerHeight;
      // Tab bawah HP + tombol + yang menonjol di atasnya (±34px); desktop cukup jarak bawah.
      const reserve = barTop < window.innerHeight ? window.innerHeight - barTop + 34 : window.innerWidth >= 768 ? 24 : 16;
      const h = Math.floor(window.innerHeight - top - reserve);
      setHeight(h >= MIN_FIT ? h : null);
    };
    window.scrollTo(0, 0);
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(document.body);
    window.addEventListener('resize', calc);
    window.visualViewport?.addEventListener('resize', calc);
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); window.visualViewport?.removeEventListener('resize', calc); };
  }, [ref]);
  // Kunci gulir halaman selama tampilan muat satu layar.
  useEffect(() => {
    if (height === null) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { html.style.overflow = prev[0]; document.body.style.overflow = prev[1]; };
  }, [height]);
  return height;
}

export function FocusApp({ variant = 'web', backHref }: { variant?: 'web' | 'app'; backHref?: string }) {
  // Timer membaca localStorage → dirender setelah hydrate (HTML statis tetap sama).
  const client = useSyncExternalStore(noop, () => true, () => false);
  const [tab, setTab] = useState<Tab>('fokus');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const height = useFitHeight(root);

  useEffect(() => {
    const refresh = () => setSessions(localSessions());
    const off = subscribeSessions(refresh);
    void syncSessions().then(refresh);
    const onVis = () => { if (document.visibilityState === 'visible') void syncSessions(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const fit = height !== null;
  const tabs = (
    <LayoutGroup id="fokus-tabs">
      <div className="flex min-w-0 flex-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800 md:flex-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
            className={cn('relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold transition-colors md:flex-none md:px-4', tab === id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}>
            {tab === id && <motion.span layoutId="fokus-tab" className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-900" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative flex items-center gap-1.5"><Icon size={15} /> {label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
  const gear = (
    <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Pengaturan sesi"
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 transition-opacity hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800', tab !== 'fokus' && 'pointer-events-none opacity-0')}>
      <Settings2 size={17} />
    </button>
  );

  return (
    <div ref={root} className={cn('mx-auto flex w-full flex-col gap-3 md:gap-4', variant === 'web' && 'max-w-6xl', !fit && 'pb-8')} style={fit ? { height } : undefined}>
      {variant === 'web' ? (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[30px]">Fokus bareng Leo</h1>
              <p className="hidden text-[14px] text-slate-500 dark:text-slate-400 md:block">Timer fokus, musik bebas royalti & napas tenang — Leo yang nemenin.</p>
            </div>
            <HeaderSlot className="md:hidden" />
          </div>
          <div className="flex items-center gap-2">{tabs}{gear}<HeaderSlot className="hidden md:flex" /></div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {backHref && (
            <Link href={backHref} aria-label="Kembali" className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500"><ChevronLeft size={20} /></Link>
          )}
          {tabs}{gear}
        </div>
      )}

      <div className={cn('min-h-0 flex-1', !fit && 'min-h-[640px]')}>
        {/* Fokus tetap terpasang saat pindah tab supaya timer & musik tidak terputus. */}
        {client && <div className={cn('h-full', tab !== 'fokus' && 'hidden')}><FocusTimer settingsOpen={settingsOpen} onCloseSettings={() => setSettingsOpen(false)} /></div>}
        {client && tab === 'tenang' && <BreathView />}
        {client && tab === 'rekap' && <div className="h-full overflow-y-auto overscroll-contain rounded-[28px]"><RecapView sessions={sessions} onStart={() => setTab('fokus')} /></div>}
        {!client && <div className="h-full min-h-[420px] animate-pulse rounded-[28px] bg-slate-100 dark:bg-slate-800" />}
      </div>
    </div>
  );
}

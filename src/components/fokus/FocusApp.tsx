"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Leaf, ListChecks, Timer } from 'lucide-react';
import { FocusTimer } from './FocusTimer';
import { BreathView } from './BreathView';
import { RecapView } from './RecapView';
import { HeaderSlot } from '@/components/Header';
import { fmtMin, localSessions, subscribeSessions, summarize, syncSessions, type FocusSession } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

// Fokus bareng Leo — timer fokus (pomodoro), napas tenang & rekap. Dipakai web
// (/membership/fokus) dan app HP (/app/fokus).
type Tab = 'fokus' | 'tenang' | 'rekap';
const TABS: { id: Tab; label: string; icon: typeof Timer }[] = [
  { id: 'fokus', label: 'Fokus', icon: Timer },
  { id: 'tenang', label: 'Tenang', icon: Leaf },
  { id: 'rekap', label: 'Rekap', icon: ListChecks },
];
const noop = () => () => {};

export function FocusApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  // Timer membaca localStorage → dirender setelah hydrate (HTML statis tetap sama).
  const client = useSyncExternalStore(noop, () => true, () => false);
  const [tab, setTab] = useState<Tab>('fokus');
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    const refresh = () => setSessions(localSessions());
    const off = subscribeSessions(refresh);
    void syncSessions().then(refresh);
    const onVis = () => { if (document.visibilityState === 'visible') void syncSessions(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const sum = summarize(sessions);
  const todayLine = sum.todaySec
    ? <>Hari ini <b className="text-slate-900 dark:text-white">{fmtMin(sum.todaySec)}</b> · {sum.todayDone} sesi{sum.streak > 1 ? <> · 🔥 {sum.streak} hari beruntun</> : null}</>
    : 'Hari ini belum ada sesi — yuk mulai satu.';

  return (
    <div className={cn('mx-auto w-full space-y-4 md:space-y-5', variant === 'web' && 'max-w-6xl pb-10')}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        {variant === 'web' && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[30px]">Fokus bareng Leo</h1>
              <p className="text-[14px] text-slate-500 dark:text-slate-400">Timer fokus, musik bebas royalti & napas tenang — Leo yang nemenin.</p>
            </div>
            <HeaderSlot className="md:hidden" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <LayoutGroup id="fokus-tabs">
            <div className="flex flex-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800 md:flex-none">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
                  className={cn('relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors md:flex-none', tab === id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}>
                  {tab === id && <motion.span layoutId="fokus-tab" className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-900" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative flex items-center gap-1.5"><Icon size={15} /> {label}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          {variant === 'web' && <HeaderSlot className="hidden md:flex" />}
        </div>
      </div>

      {/* Fokus tetap terpasang saat pindah tab supaya timer & musik tidak terputus. */}
      {client && <div className={tab === 'fokus' ? undefined : 'hidden'}><FocusTimer onOpenRecap={() => setTab('rekap')} todayLine={todayLine} /></div>}
      {client && tab === 'tenang' && <BreathView />}
      {client && tab === 'rekap' && <RecapView sessions={sessions} onStart={() => setTab('fokus')} />}
      {!client && <div className="h-[420px] animate-pulse rounded-[28px] bg-slate-100 dark:bg-slate-800" />}
    </div>
  );
}

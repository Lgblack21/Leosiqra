'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFitHeight } from '@/lib/useFitHeight';
import Link from 'next/link';
import { ArrowLeft, Leaf, ListChecks, Settings2, Timer } from 'lucide-react';
import { LeoGuide } from '@/components/ai/LeoGuide';
import { FocusTimer } from './FocusTimer';
import { BreathView } from './BreathView';
import { RecapView } from './RecapView';
import { localSessions, subscribeSessions, syncSessions, type FocusSession } from '@/lib/focus/store';
import { cn } from '@/lib/utils';

type Tab = 'fokus' | 'tenang' | 'rekap';
const TABS: { id: Tab; label: string; icon: typeof Timer; title: string; sub: string }[] = [
  { id: 'fokus', label: 'Fokus', icon: Timer, title: 'Fokus bareng Leo', sub: 'Timer fokus & musik bebas royalti' },
  { id: 'tenang', label: 'Tenang', icon: Leaf, title: 'Napas tenang', sub: 'Latihan napas bareng Leo' },
  { id: 'rekap', label: 'Rekap', icon: ListChecks, title: 'Rekap fokus', sub: 'Waktu fokus & hari beruntun' },
];
const noop = () => () => {};

export function FocusApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  // Timer membaca localStorage → dirender setelah hydrate (HTML statis tetap sama).
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [tab, setTab] = useState<Tab>('fokus');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const height = useFitHeight(body);

  useEffect(() => {
    const refresh = () => setSessions(localSessions());
    const off = subscribeSessions(refresh);
    void syncSessions().then(refresh);
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncSessions();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const backHref = variant === 'app' ? '/app/more' : '/membership/dashboard';
  const fit = height !== null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] md:px-8 md:pt-6">
      <header className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:mb-4">
        <Link
          href={backHref}
          aria-label={variant === 'app' ? 'Kembali' : 'Kembali ke Ringkasan'}
          className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={16} />
          </span>
          <span className="hidden sm:inline">{variant === 'app' ? 'Kembali' : 'Ringkasan'}</span>
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[19px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[24px]">
            {current.title}
          </h1>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{current.sub}</p>
        </div>
        {tab === 'fokus' ? (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Musik & pengaturan"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
          >
            <Settings2 size={19} />
          </button>
        ) : (
          <LeoGuide topic="fokus" />
        )}
      </header>

      <div ref={body} className={cn('min-h-0', !fit && 'min-h-[640px] pb-28')} style={fit ? { height } : undefined}>
        {/* Fokus tetap terpasang saat pindah tab supaya timer & musik tidak terputus. */}
        {client && (
          <div className={cn('h-full', tab !== 'fokus' && 'hidden')}>
            <FocusTimer
              settingsOpen={settingsOpen}
              onOpenSettings={() => setSettingsOpen(true)}
              onCloseSettings={() => setSettingsOpen(false)}
            />
          </div>
        )}
        {client && tab === 'tenang' && <BreathView />}
        {client && tab === 'rekap' && (
          <div className="h-full overflow-y-auto overscroll-contain rounded-[28px] pb-2">
            <RecapView sessions={sessions} onStart={() => setTab('fokus')} />
          </div>
        )}
        {!client && (
          <div className="h-full min-h-[420px] animate-pulse rounded-[32px] bg-slate-100 dark:bg-slate-800" />
        )}
      </div>

      <nav
        data-focus-dock
        aria-label="Menu Fokus"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-40 flex justify-center px-4 print:hidden"
      >
        <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                className={cn(
                  'relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold transition-all',
                  active
                    ? 'bg-gradient-to-r from-indigo-400 to-violet-300 px-4 text-slate-950'
                    : 'w-12 text-white/70 hover:bg-white/10',
                )}
              >
                <t.icon size={20} className="shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                {active && <span className="whitespace-nowrap">{t.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

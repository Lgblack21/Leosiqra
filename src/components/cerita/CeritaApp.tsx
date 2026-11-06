"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CalendarDays, PenLine } from 'lucide-react';
import { AiOrb } from '@/components/ai/AiChat';
import { TulisView } from './TulisView';
import { KalenderView } from './KalenderView';
import { KumpulanView } from './KumpulanView';
import { storyService, wibToday, type StoryYear } from '@/lib/stories';
import { useFitHeight } from '@/lib/useFitHeight';
import { cn } from '@/lib/utils';

// Cerita Hari Ini — layar penuh seperti Fokus/Ladangku: bar atas (kembali · judul · Leo AI)
// + menu melayang (Tulis · Setahun · Kumpulan). Dipakai web (/membership/cerita) & app (/app/cerita).
type Tab = 'tulis' | 'kalender' | 'kumpulan';
const TABS: { id: Tab; label: string; icon: typeof PenLine; title: string; sub: string }[] = [
  { id: 'tulis', label: 'Tulis', icon: PenLine, title: 'Cerita Hari Ini', sub: 'Satu halaman untuk hari ini' },
  { id: 'kalender', label: 'Kalender', icon: CalendarDays, title: 'Kalender cerita', sub: 'Foto & mood di tiap tanggal' },
  { id: 'kumpulan', label: 'Kumpulan', icon: BookOpen, title: 'Kumpulan cerita', sub: 'Cari & baca lagi ceritamu' },
];
const noop = () => () => {};

export function CeritaApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  const [tab, setTab] = useState<Tab>('tulis');
  const [date, setDate] = useState(wibToday);
  const [year, setYear] = useState(() => Number(wibToday().slice(0, 4)));
  const [data, setData] = useState<StoryYear | null>(null);
  const [notReady, setNotReady] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const height = useFitHeight(body);

  const refresh = useCallback(async () => {
    try {
      const d = await storyService.year(String(year));
      setData(d);
      setNotReady(d.ready === false);
    } catch { /* biarkan data lama */ }
  }, [year]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ambil data setahun dari server saat tahun berganti
  useEffect(() => { void refresh(); }, [refresh]);

  // Halaman dikunci (satu layar) — pastikan tidak pernah tergulir (judul atas terpotong).
  const switchTab = (t: Tab) => { setTab(t); window.scrollTo(0, 0); };
  const open = (d: string) => { setDate(d); switchTab('tulis'); };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const fit = height !== null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] md:px-8 md:pt-6">
      <header className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:mb-4">
        <Link href={variant === 'app' ? '/app/more' : '/membership/dashboard'} aria-label={variant === 'app' ? 'Kembali' : 'Kembali ke Ringkasan'} className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5"><ArrowLeft size={16} /></span>
          <span className="hidden sm:inline">{variant === 'app' ? 'Kembali' : 'Ringkasan'}</span>
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[19px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[24px]">{current.title}</h1>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{current.sub}</p>
        </div>
        <Link href={variant === 'app' ? '/app/assistant/chat' : '/membership/ai-leosiqra'} aria-label="Tanya Leo" className="rounded-full ring-2 ring-white transition-transform hover:scale-105"><AiOrb size={44} /></Link>
      </header>

      {notReady && <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-800">Cerita Hari Ini sedang disiapkan di server — sebentar lagi bisa dipakai.</p>}

      <div ref={body} className={cn('min-h-0', !fit && 'pb-28')} style={fit ? { height } : undefined}>
        {client && tab === 'tulis' && <div data-scroll className="h-full overflow-y-auto overscroll-contain"><TulisView date={date} onDate={setDate} onChanged={refresh} /></div>}
        {client && tab === 'kalender' && <div data-scroll className="h-full overflow-y-auto overscroll-contain"><KalenderView year={year} data={data} onYear={setYear} onOpen={open} /></div>}
        {client && tab === 'kumpulan' && <div data-scroll className="h-full overflow-y-auto overscroll-contain"><KumpulanView data={data} onOpen={open} onWrite={() => open(wibToday())} /></div>}
        {!client && <div className="h-full min-h-[420px] animate-pulse rounded-[28px] bg-slate-100 dark:bg-slate-800" />}
      </div>

      <nav data-focus-dock aria-label="Menu Cerita" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-40 flex justify-center px-4 print:hidden">
        <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button key={t.id} type="button" onClick={() => switchTab(t.id)} aria-current={active ? 'page' : undefined} aria-label={t.label}
                className={cn('relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold transition-all', active ? 'bg-gradient-to-r from-amber-300 to-pink-300 px-4 text-slate-950' : 'w-12 text-white/70 hover:bg-white/10')}>
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

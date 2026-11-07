'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { LeoGuide, LeoBadge } from '@/components/ai/LeoGuide';
import { MakanApp } from '@/components/makan/MakanApp';
import { cn } from '@/lib/utils';

// Sehatku — layar penuh seperti Ladangku: bar atas (kembali · judul tab · Leo) + menu melayang.
// Tab di hash (#makan, #asuransi, #cek). Asuransi & Cek menyusul (tahap berikutnya).
const TABS = [
  {
    id: 'makan',
    label: 'Makan',
    icon: UtensilsCrossed,
    title: 'Sehatku · Makan',
    sub: 'Foto piringmu, Leo hitung gizi & belanjanya',
    ready: true,
  },
  {
    id: 'asuransi',
    label: 'Asuransi',
    icon: ShieldCheck,
    title: 'Sehatku · Asuransi',
    sub: 'Biaya kesehatan, polis & premi',
    ready: false,
  },
  {
    id: 'cek',
    label: 'Cek',
    icon: CalendarCheck,
    title: 'Sehatku · Cek',
    sub: 'Jadwal cek kesehatan rutin',
    ready: false,
  },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Segera({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-800">
      <LeoBadge topic="makan" size={76} />
      <p className="mt-4 text-[17px] font-black text-slate-800 dark:text-slate-100">{label} segera hadir</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        Leo lagi menyiapkan bagian ini. Sementara itu, catat makanmu di tab Makan — belanja makannya langsung masuk ke
        keuanganmu.
      </p>
    </div>
  );
}

export function SehatApp({ variant }: { variant: 'web' | 'app' }) {
  const [tab, setTab] = useState<TabId>('makan');
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    read(); // hash baru terbaca di klien (static export)
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const go = (t: TabId) => {
    setTab(t);
    window.scrollTo(0, 0);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}#${t}`);
    } catch {
      /* abaikan */
    }
  };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const app = variant === 'app';

  return (
    <div
      className={cn(
        'mx-auto min-h-screen max-w-6xl px-4 pb-32 md:px-8',
        app ? 'pt-[calc(env(safe-area-inset-top)+16px)]' : 'pt-4 md:pt-6',
      )}
    >
      <header className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:mb-5">
        <Link
          href={app ? '/app/more' : '/membership/dashboard'}
          aria-label={app ? 'Kembali' : 'Kembali ke Ringkasan'}
          className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={16} />
          </span>
          <span className="hidden sm:inline">{app ? 'Kembali' : 'Ringkasan'}</span>
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[24px] dark:text-white">
            {current.title}
          </h1>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{current.sub}</p>
        </div>
        <LeoGuide topic="makan" />
      </header>

      <main>{tab === 'makan' ? <MakanApp variant={variant} embedded /> : <Segera label={current.label} />}</main>

      <nav
        aria-label="Menu Sehatku"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4 print:hidden"
      >
        <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.ready ? t.label : `${t.label} (segera)`}
                className={cn(
                  'relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold transition-all',
                  active
                    ? 'bg-gradient-to-r from-orange-400 to-rose-400 px-4 text-slate-950'
                    : 'w-12 text-white/70 hover:bg-white/10',
                )}
              >
                <t.icon size={20} className="shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                {active && <span className="whitespace-nowrap">{t.label}</span>}
                {!t.ready && !active ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

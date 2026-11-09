'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarCheck, ShieldCheck } from 'lucide-react';
import { LeoGuide, LeoBadge } from '@/components/ai/LeoGuide';
import { AsuransiView } from '@/components/sehat/AsuransiView';
import { CekView } from '@/components/sehat/CekView';
import { cn } from '@/lib/utils';

// Sehatku — layar penuh seperti Ladangku: bar atas (kembali · judul tab · Leo) + menu melayang.
// Tab di hash (#asuransi, #cek). Makan pindah ke Olahragaku (3.26.0) — #makan lama diarahkan ke sana.
const TABS = [
  {
    id: 'asuransi',
    label: 'Asuransi',
    icon: ShieldCheck,
    title: 'Sehatku · Asuransi',
    sub: 'Biaya kesehatan, polis & premi',
    ready: true,
  },
  {
    id: 'cek',
    label: 'Cek',
    icon: CalendarCheck,
    title: 'Sehatku · Cek',
    sub: 'Jadwal cek kesehatan rutin',
    ready: true,
  },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Segera({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-800">
      <LeoBadge topic="kesehatan" size={76} />
      <p className="mt-4 fs-17 font-black text-slate-800 dark:text-slate-100">{label} segera hadir</p>
      <p className="mt-1 max-w-sm fs-13 leading-relaxed text-slate-500 dark:text-slate-400">
        Leo lagi menyiapkan bagian ini.
      </p>
    </div>
  );
}

export function SehatApp({ variant }: { variant: 'web' | 'app' }) {
  const [tab, setTab] = useState<TabId>('asuransi');
  const router = useRouter();
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (h === 'makan') {
        router.replace(variant === 'app' ? '/app/olahraga#makan' : '/membership/olahraga#makan');
        return;
      }
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    read(); // hash baru terbaca di klien (static export)
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [router, variant]);
  const go = (t: TabId) => {
    setTab(t);
    window.scrollTo(0, 0);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}#${t}`);
    } catch {
      /* abaikan */
    }
  };
  const [toast, setToast] = useState('');
  const say = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3500);
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
          className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 fs-13 font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={16} />
          </span>
          <span className="hidden sm:inline">{app ? 'Kembali' : 'Ringkasan'}</span>
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate fsh-20 font-extrabold tracking-tight text-slate-900 md:fsh-24 dark:text-white">
            {current.title}
          </h1>
          <p className="truncate fs-12 text-slate-500 dark:text-slate-400">{current.sub}</p>
        </div>
        <LeoGuide key={tab} topic={tab === 'asuransi' ? 'asuransi' : 'kesehatan'} />
      </header>

      <main>
        {tab === 'asuransi' ? (
          <AsuransiView onToast={say} />
        ) : tab === 'cek' ? (
          <CekView onToast={say} />
        ) : (
          <Segera label={current.label} />
        )}
      </main>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[90] flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2.5 fs-13 font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
            {toast}
          </div>
        </div>
      ) : null}
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
                  'relative flex h-12 items-center justify-center gap-2 rounded-full fs-13 font-bold transition-all',
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

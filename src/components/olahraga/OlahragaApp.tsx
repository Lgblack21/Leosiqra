'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BookOpen, Dumbbell, LineChart, UtensilsCrossed } from 'lucide-react';
import { LeoGuide } from '@/components/ai/LeoGuide';
import { MakanApp } from '@/components/makan/MakanApp';
import { LatihanView } from '@/components/olahraga/LatihanView';
import { MakanBanner } from '@/components/olahraga/MakanBanner';
import { MetodeView } from '@/components/olahraga/MetodeView';
import { ProfilForm } from '@/components/olahraga/ProfilForm';
import { ProgramView } from '@/components/olahraga/ProgramView';
import { ProgresView } from '@/components/olahraga/ProgresView';
import {
  deleteAllFit,
  deleteWeight,
  endProgram,
  loadFit,
  saveProfile,
  saveWeight,
  type FitData,
} from '@/lib/olahraga/api';
import { cn } from '@/lib/utils';

// Olahragaku — layar penuh (pola Sehatku): Program · Makan · Metode · Progres. Tab di hash.
// Rancangan: docs/rancangan/olahragaku.md. Rilis 1 tanpa AI baru; Makan = Makanku (pindahan dari Sehatku).
const TABS = [
  { id: 'program', label: 'Program', icon: Dumbbell, title: 'Olahragaku', sub: 'Angka tubuhmu & langkah berikutnya' },
  {
    id: 'makan',
    label: 'Makan',
    icon: UtensilsCrossed,
    title: 'Olahragaku · Makan',
    sub: 'Foto piringmu, Leo hitung gizi & belanjanya',
  },
  {
    id: 'latihan',
    label: 'Latihan',
    icon: Activity,
    title: 'Olahragaku · Latihan',
    sub: 'Latihan hari ini & perpustakaan gerakan',
  },
  {
    id: 'metode',
    label: 'Metode',
    icon: BookOpen,
    title: 'Olahragaku · Metode',
    sub: '20 metode diet — baca, jawab, cocokkan',
  },
  {
    id: 'progres',
    label: 'Progres',
    icon: LineChart,
    title: 'Olahragaku · Progres',
    sub: 'Timbangan & perjalanan beratmu',
  },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function OlahragaApp({ variant }: { variant: 'web' | 'app' }) {
  const app = variant === 'app';
  const [tab, setTab] = useState<TabId>('program');
  const [data, setData] = useState<FitData | null>(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const say = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3500);
  };

  const reload = useCallback(async () => setData(await loadFit()), []);
  useEffect(() => {
    let alive = true;
    void loadFit().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    read();
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

  const onSaveProfile = async (p: Parameters<typeof saveProfile>[0]) => {
    const where = await saveProfile(p);
    setEditing(false);
    say(where === 'akun' ? 'Profil tersimpan.' : 'Tersimpan di perangkat ini dulu (server sedang disiapkan).');
    await reload();
  };
  const hapusSemua = async () => {
    if (!window.confirm('Hapus semua data Olahragaku (profil tubuh & timbangan)? Catatan makan tidak ikut terhapus.'))
      return;
    await deleteAllFit();
    say('Data Olahragaku dihapus.');
    await reload();
  };

  const profileForm = data ? (
    <div className="mx-auto max-w-2xl rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 md:p-7 dark:bg-slate-900 dark:ring-slate-800">
      <p className="fsh-22 font-black tracking-tight text-slate-900 dark:text-white">
        {data.profile ? 'Ubah profil tubuh' : 'Kenalan dulu dengan tubuhmu'}
      </p>
      <p className="mb-5 mt-1 fs-14 leading-relaxed text-slate-500 dark:text-slate-400">
        Leo menghitung IMT, kebutuhan kalori, dan menyaring metode diet yang aman untukmu. Data ini hanya untukmu.
      </p>
      <ProfilForm
        initial={data.profile ?? data.prefill}
        fromCheck={data.profile ? undefined : data.prefill.fromCheck}
        onSave={onSaveProfile}
        onCancel={data.profile ? () => setEditing(false) : undefined}
      />
    </div>
  ) : null;

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
        <LeoGuide key={tab} topic={tab === 'makan' ? 'makan' : 'kesehatan'} />
      </header>

      <main>
        {tab === 'makan' ? (
          <>
            {data?.program?.plan ? <MakanBanner plan={data.program.plan} today={data.today} /> : null}
            <MakanApp variant={variant} embedded />
          </>
        ) : !data ? (
          <div className="flex justify-center py-20">
            <span
              className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500"
              aria-label="Memuat"
            />
          </div>
        ) : tab === 'program' ? (
          !data.profile || editing ? (
            profileForm
          ) : (
            <ProgramView
              profile={data.profile}
              pro={data.pro}
              program={data.program}
              today={data.today}
              onEdit={() => setEditing(true)}
              onPilihMetode={() => go('metode')}
              onLatihan={() => go('latihan')}
              onEnd={async () => {
                if (!data.program) return;
                await endProgram(data.program.id).catch(() => undefined);
                say('Program dihentikan.');
                await reload();
              }}
            />
          )
        ) : tab === 'metode' ? (
          <MetodeView
            profile={data.profile}
            pro={data.pro}
            app={app}
            coins={data.coins}
            aktif={data.program}
            onStarted={async () => {
              say('Programmu siap! Mulai dari hari ini.');
              await reload();
              go('program');
            }}
          />
        ) : tab === 'latihan' ? (
          <LatihanView data={data} onChanged={reload} onToast={say} onPilihMetode={() => go('metode')} />
        ) : (
          <ProgresView
            weights={data.weights}
            goal={data.profile?.goalKg ?? null}
            today={data.today}
            historyDays={data.historyDays}
            onSave={async (w) => {
              const where = await saveWeight(w);
              say(where === 'akun' ? 'Timbangan tersimpan.' : 'Tersimpan di perangkat ini dulu.');
              await reload();
            }}
            onDelete={async (d) => {
              await deleteWeight(d);
              await reload();
            }}
          />
        )}

        {data && tab !== 'makan' ? (
          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            {!data.ready ? (
              <p className="fs-12 text-amber-600 dark:text-amber-400">
                Olahragaku sedang disiapkan di server — datamu disimpan di perangkat ini dulu.
              </p>
            ) : null}
            {data.profile && tab === 'program' && !editing ? (
              <button
                type="button"
                onClick={hapusSemua}
                className="fs-12 font-semibold text-slate-400 underline hover:text-rose-600"
              >
                Hapus semua data Olahragaku
              </button>
            ) : null}
          </div>
        ) : null}
      </main>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[90] flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2.5 fs-13 font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
            {toast}
          </div>
        </div>
      ) : null}
      <nav
        aria-label="Menu Olahragaku"
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
                aria-label={t.label}
                className={cn(
                  'relative flex h-12 items-center justify-center gap-2 rounded-full fs-13 font-bold transition-all',
                  active
                    ? 'bg-gradient-to-r from-emerald-400 to-lime-300 px-4 text-slate-950'
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

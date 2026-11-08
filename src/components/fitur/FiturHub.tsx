'use client';

import Link from 'next/link';
import { HeaderSlot } from '@/components/Header';
import { FITUR, GOALS, TONE, isNew, type Fitur, type GoalId } from '@/lib/fiturCatalog';

const LAYOUT3: GoalId[][] = [
  ['catat', 'usaha'],
  ['harta', 'rencana', 'leo'],
  ['hidup', 'bantuan'],
];
const LAYOUT2: GoalId[][] = [
  ['catat', 'rencana', 'leo'],
  ['harta', 'hidup', 'usaha', 'bantuan'],
];
import { useFiturStatus, type Status } from '@/components/fitur/useFiturStatus';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

// Semua fitur: hanya tombol fitur, dikelompokkan per tujuan dalam kolom yang rapi.
// Baris kedua tiap tombol = status singkat dari data user (kalau ada), selain itu subjudul.
const toneText = (s?: Status) =>
  s?.tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : s?.tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : s?.tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-500 dark:text-slate-400';

function FiturButton({ f, s, to }: { f: Fitur; s?: Status; to: string }) {
  const t = TONE[GOALS.find((g) => g.id === f.goal)?.tone ?? 'slate'];
  const Icon = f.icon;
  return (
    <Link
      href={to}
      className="flex items-center gap-3.5 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br text-white',
          t.tile,
        )}
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{f.label}</span>
          {isNew(f, APP_VERSION) ? (
            <span className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-1.5 py-px text-[9.5px] font-black uppercase tracking-wider text-white">
              Baru
            </span>
          ) : null}
        </span>
        <span className={cn('block truncate text-[13px]', s ? toneText(s) : 'text-slate-500 dark:text-slate-400')}>
          {s?.text ?? f.sub}
        </span>
      </span>
    </Link>
  );
}

export function FiturHub({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const { status } = useFiturStatus();
  const href = (f: Fitur) => (variant === 'app' && f.appHref ? f.appHref : f.href);
  const group = (id: GoalId) => {
    const g = GOALS.find((x) => x.id === id)!;
    const items = FITUR.filter((f) => f.goal === id);
    if (!items.length) return null;
    const t = TONE[g.tone];
    return (
      <section
        key={id}
        className="rounded-[24px] bg-white p-3 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="px-2.5 pb-2 pt-1.5">
          <h2 className="flex items-center gap-2 text-[15px] font-black">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br', t.tile)} />
            {g.label}
          </h2>
          <p className="pl-[18px] text-[12.5px] text-slate-400">{g.sub}</p>
        </div>
        {items.map((f) => (
          <FiturButton key={f.key} f={f} s={status[f.key]} to={href(f)} />
        ))}
      </section>
    );
  };

  return (
    <div className={cn('mx-auto max-w-6xl pb-14 text-slate-900 dark:text-white', variant === 'app' && 'px-4 pt-2')}>
      <div className="mb-7 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-black tracking-tight md:text-[38px]">Semua fitur</h1>
          <p className="text-[14.5px] text-slate-500 dark:text-slate-400">
            Semua alat keuanganmu dalam satu tempat. Tekan Ctrl + K untuk mencari dari mana saja.
          </p>
        </div>
        {variant === 'web' ? <HeaderSlot /> : null}
      </div>

      {/* Kolom tetap (bukan CSS columns) supaya urutan kelompok selalu sama di semua layar. */}
      <div className="hidden grid-cols-3 items-start gap-5 xl:grid">
        {LAYOUT3.map((col, ci) => (
          <div key={ci} className="space-y-5">
            {col.map((id) => group(id))}
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-2 items-start gap-5 md:grid xl:hidden">
        {LAYOUT2.map((col, ci) => (
          <div key={ci} className="space-y-5">
            {col.map((id) => group(id))}
          </div>
        ))}
      </div>
      <div className="space-y-5 md:hidden">{GOALS.map((g) => group(g.id))}</div>
    </div>
  );
}

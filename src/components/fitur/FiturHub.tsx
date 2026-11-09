'use client';

import Link from 'next/link';
import { HeaderSlot } from '@/components/Header';
import { FITUR, GOALS, TONE, isNew, type Fitur, type GoalId } from '@/lib/fiturCatalog';

const SIDEBAR_KEUANGAN = [...keuanganNav.map((n) => n.href), '/membership/transactions/input'];

// Bagi kelompok ke n kolom: tiap kelompok (urutan GOALS) masuk ke kolom yang paling pendek, supaya kolom seimbang
// walau isi berkurang (fitur yang sudah di menu samping disembunyikan).
const balance = (groups: { id: GoalId; n: number }[], cols: number) => {
  const out: GoalId[][] = Array.from({ length: cols }, () => []);
  const h = Array(cols).fill(0);
  for (const g of groups) {
    const c = h.indexOf(Math.min(...h));
    out[c].push(g.id);
    h[c] += g.n + 1.5; // + judul kelompok
  }
  return out;
};
import { useFiturStatus, type Status } from '@/components/fitur/useFiturStatus';
import { useFeatures } from '@/lib/useFeatures';
import { usePlan } from '@/lib/usePlan';
import { sidebarFeatures } from '@/lib/features';
import { keuanganNav } from '@/lib/navigation';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

// Fitur lainnya: hanya tombol fitur yang belum ada di menu samping, dikelompokkan per tujuan dalam kolom tetap.
// Baris kedua tiap tombol = status singkat dari data user (kalau ada), selain itu subjudul.
const toneText = (s?: Status) =>
  s?.tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : s?.tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : s?.tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-500 dark:text-slate-400';

function FiturButton({ f, s, to, showPro }: { f: Fitur; s?: Status; to: string; showPro: boolean }) {
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
          <span className="truncate fs-15 font-bold text-slate-900 dark:text-white">{f.label}</span>
          {showPro && f.pro ? (
            <span
              title={f.pro}
              className="shrink-0 rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-px fs-9.5 font-black tracking-wider text-white"
            >
              PRO
            </span>
          ) : null}
          {isNew(f, APP_VERSION) ? (
            <span className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-1.5 py-px fs-9.5 font-black uppercase tracking-wider text-white">
              Baru
            </span>
          ) : null}
        </span>
        <span className={cn('block truncate fs-13', s ? toneText(s) : 'text-slate-500 dark:text-slate-400')}>
          {s?.text ?? f.sub}
        </span>
      </span>
    </Link>
  );
}

export function FiturHub({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const { status } = useFiturStatus();
  const { active } = useFeatures();
  const isPro = usePlan();
  // Yang sudah ada di menu samping tidak diulang: menu Keuangan, tombol Catat, dan fitur yang tampil di sana.
  const inSidebar = new Set<string>([...SIDEBAR_KEUANGAN, ...sidebarFeatures(active).map((f) => f.href)]);
  const visible = (f: Fitur) => !inSidebar.has(f.href);
  const sizes = GOALS.map((g) => ({ id: g.id, n: FITUR.filter((f) => f.goal === g.id && visible(f)).length })).filter(
    (g) => g.n > 0,
  );
  const href = (f: Fitur) => (variant === 'app' && f.appHref ? f.appHref : f.href);
  const group = (id: GoalId) => {
    const g = GOALS.find((x) => x.id === id)!;
    const items = FITUR.filter((f) => f.goal === id && visible(f));
    if (!items.length) return null;
    const t = TONE[g.tone];
    return (
      <section
        key={id}
        className="rounded-[24px] bg-white p-3 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="px-2.5 pb-2 pt-1.5">
          <h2 className="flex items-center gap-2 fs-15 font-black">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br', t.tile)} />
            {g.label}
          </h2>
          <p className="pl-[18px] fs-12.5 text-slate-400">{g.sub}</p>
        </div>
        {items.map((f) => (
          <FiturButton key={f.key} f={f} s={status[f.key]} to={href(f)} showPro={isPro === false} />
        ))}
      </section>
    );
  };

  return (
    <div className={cn('mx-auto max-w-6xl pb-14 text-slate-900 dark:text-white', variant === 'app' && 'px-4 pt-2')}>
      <div className="mb-7 flex items-start justify-between gap-3">
        <div>
          <h1 className="fsh-30 font-black tracking-tight md:fsh-38">Fitur lainnya</h1>
          <p className="fs-14.5 text-slate-500 dark:text-slate-400">
            Fitur yang belum ada di menu samping. Tekan Ctrl + K untuk mencari semua fitur dari mana saja.
          </p>
        </div>
        {variant === 'web' ? <HeaderSlot /> : null}
      </div>

      {/* Kolom tetap (bukan CSS columns) supaya urutan kelompok selalu sama di semua layar. */}
      <div className="hidden grid-cols-3 items-start gap-5 xl:grid">
        {balance(sizes, 3).map((col, ci) => (
          <div key={ci} className="space-y-5">
            {col.map((id) => group(id))}
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-2 items-start gap-5 md:grid xl:hidden">
        {balance(sizes, 2).map((col, ci) => (
          <div key={ci} className="space-y-5">
            {col.map((id) => group(id))}
          </div>
        ))}
      </div>
      <div className="space-y-5 md:hidden">{GOALS.map((g) => group(g.id))}</div>
    </div>
  );
}

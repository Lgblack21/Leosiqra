"use client";

import Link from 'next/link';
import { navGroups } from '@/lib/navigation';
import { featuresFromIds } from '@/lib/features';
import { useFeatures } from '@/lib/useFeatures';
import { openSettings } from '@/lib/settingsPanel';
import { cn } from '@/lib/utils';
import { HeaderSlot } from '@/components/Header';

// Semua fitur dalam bentuk ikon berwarna, dikelompokkan sesuai navGroups.
// "Fitur kamu" = fitur aktif (tampil di menu samping); diatur lewat pop-up
// Pengaturan → Fitur (tombol Atur).

const PALETTE = [
  'bg-indigo-50 text-indigo-600',
  'bg-orange-50 text-orange-500',
  'bg-sky-50 text-sky-600',
  'bg-emerald-50 text-emerald-600',
  'bg-pink-50 text-pink-500',
  'bg-violet-50 text-violet-600',
  'bg-amber-50 text-amber-600',
  'bg-teal-50 text-teal-600',
  'bg-rose-50 text-rose-500',
];

const Tile = ({ href, label, icon: Icon, i }: { href: string; label: string; icon: React.ElementType; i: number }) => (
  <Link href={href} className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center">
    <span className={cn('flex h-[72px] w-[72px] items-center justify-center rounded-[22px] transition-transform group-hover:-translate-y-0.5 md:h-20 md:w-20', PALETTE[i % PALETTE.length])}>
      <Icon size={32} strokeWidth={1.8} />
    </span>
    <span className="line-clamp-2 text-[13px] font-medium leading-tight text-slate-700 md:text-[14px]">{label}</span>
  </Link>
);

export default function SemuaFiturPage() {
  const { active } = useFeatures();
  const mine = featuresFromIds(active);
  const pinned = new Set(mine.map((f) => f.href));
  let n = 0;
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 md:text-[40px]">Semua fitur</h1>
          <p className="mt-1 text-[15px] text-slate-500">Semua yang bisa kamu pakai di Leosiqra, dalam satu tempat.</p>
        </div>
        <HeaderSlot />
      </div>

      <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100 md:p-6">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[16px] font-bold text-slate-900">Fitur kamu</h2>
          <button type="button" onClick={() => openSettings('fitur')} className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">Atur</button>
        </div>
        <div className="grid grid-cols-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-5">
          {mine.map((f) => <Tile key={f.href} href={f.href} label={f.label} icon={f.icon} i={n++} />)}
        </div>
      </section>

      {navGroups.map((g) => {
        const items = g.items.filter((i) => !pinned.has(i.href));
        if (!items.length) return null;
        return (
          <section key={g.id} className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100 md:p-6">
            <h2 className="mb-3 px-1 text-[16px] font-bold text-slate-900">{g.label}</h2>
            <div className="grid grid-cols-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((f) => <Tile key={f.href} href={f.href} label={f.label} icon={f.icon} i={n++} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

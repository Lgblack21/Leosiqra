'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { FITUR } from '@/lib/fiturCatalog';
import type { Saran } from '@/components/fitur/useFiturStatus';
import { cn } from '@/lib/utils';

const toApp = (h: string) => {
  const f = FITUR.find((x) => h.startsWith(x.href));
  return f?.appHref ? h.replace(f.href, f.appHref) : h;
};

// "Untukmu hari ini" versi aplikasi HP — kartu gelap, saran digeser ke samping.
export function AppSaranStrip({ saran }: { saran: Saran[] }) {
  if (!saran.length) return null;
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-slate-950 p-4 text-white">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-orange-400/30 blur-3xl" />
      <div className="relative flex items-center gap-2.5">
        <LeoBadge topic="investasi" size={38} />
        <p className="flex items-center gap-1.5 fs-11 font-black uppercase tracking-[0.18em] text-amber-300">
          <Sparkles size={12} /> Untukmu hari ini
        </p>
      </div>
      <div className="relative -mx-4 mt-3 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {saran.map((s) => (
          <Link
            key={s.key + s.title}
            href={toApp(s.href)}
            className="w-[78%] shrink-0 snap-start rounded-[18px] bg-white/[.08] p-3.5 ring-1 ring-white/10"
          >
            <span
              className={cn(
                'mb-1.5 block h-1.5 w-7 rounded-full',
                s.tone === 'warn' ? 'bg-amber-300' : s.tone === 'good' ? 'bg-emerald-300' : 'bg-sky-300',
              )}
            />
            <span className="block fs-14 font-black">{s.title}</span>
            <span className="mt-0.5 block fs-12 leading-snug text-white/65">{s.text}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

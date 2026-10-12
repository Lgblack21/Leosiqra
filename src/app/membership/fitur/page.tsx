"use client";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURES, useFeatures } from '@/lib/features';

// Kelola fitur: nyalakan yang dibutuhkan saja supaya menu tetap ringkas.
// Mematikan fitur cuma menyembunyikan menu & kotaknya — datanya tetap aman.
export default function KelolaFiturPage() {
  const { isOn, setFeature, enabled } = useFeatures();

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div>
        <h1 className="sr-only">Fitur</h1>
        <p className="text-sm text-slate-500">
          Nyalakan yang kamu butuhkan saja, Leosiqra tetap ringan. Mematikan fitur hanya menyembunyikan menunya — datamu tidak dihapus.
        </p>
        <p className="mt-2 text-xs font-semibold text-indigo-600">{enabled.length} dari {FEATURES.length} fitur aktif · tersimpan di perangkat ini</p>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
        {FEATURES.map((f) => {
          const on = isOn(f.id);
          return (
            <div key={f.id} className="flex items-center gap-4 p-4 md:p-5">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', f.tone)}><f.icon size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold text-slate-900">
                  {f.label}
                  {f.isNew && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-600">Baru</span>}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{f.description}</p>
                {on && (
                  <Link href={f.href} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
                    Buka <ArrowRight size={12} />
                  </Link>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${on ? 'Matikan' : 'Nyalakan'} ${f.label}`}
                onClick={() => setFeature(f.id, !on)}
                className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200')}
              >
                <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

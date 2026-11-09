'use client';

import { useEffect, useState } from 'react';
import { Clock, Drumstick, Flame } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { jendelaHari, type FitKerja, type Plan } from '@/lib/olahraga/program';
import { cn } from '@/lib/utils';

// Di atas tab Makan saat program aktif: status jendela makan sekarang + kalori & protein hari ini vs target.

type Meal = { time: string; kcal: number | null; protein: number | null };
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.replace('.', ':').split(':').map(Number);
  return h * 60 + (m || 0);
};
const fmtJam = (min: number) =>
  `${String(Math.floor((min % 1440) / 60)).padStart(2, '0')}.${String(min % 60).padStart(2, '0')}`;

export function jendelaStatus(j: NonNullable<Plan['jendela']>, now = new Date()) {
  const buka = toMin(j.mulai);
  const tutup = buka + j.makan * 60;
  const t = now.getHours() * 60 + now.getMinutes();
  const dalam = (x: number) => (tutup <= 1440 ? x >= buka && x < tutup : x >= buka || x < tutup - 1440);
  return { buka: fmtJam(buka), tutup: fmtJam(tutup), dalam: dalam(t), dalamWaktu: dalam };
}

export function MakanBanner({ plan, kerja, today }: { plan: Plan; kerja: FitKerja; today: string }) {
  const [meals, setMeals] = useState<Meal[] | null>(null);
  useEffect(() => {
    let alive = true;
    cloudflareApi<{ items?: Meal[] }>(`/api/member/meals?date=${today}`)
      .then((r) => alive && setMeals(r.items ?? []))
      .catch(() => alive && setMeals([]));
    return () => {
      alive = false;
    };
  }, [today]);
  const kcal = Math.round((meals ?? []).reduce((a, m) => a + (m.kcal ?? 0), 0));
  const protein = Math.round((meals ?? []).reduce((a, m) => a + (m.protein ?? 0), 0));
  const jHari = jendelaHari(plan, kerja, today);
  const js = jHari ? jendelaStatus(jHari) : null;
  const luar = js ? (meals ?? []).filter((m) => m.time && !js.dalamWaktu(toMin(m.time))).length : 0;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {js ? (
        <div
          className={cn(
            'flex items-start gap-3 rounded-[22px] p-4 ring-1',
            js.dalam
              ? 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30'
              : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
          )}
        >
          <Clock size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="fs-14 font-black">{js.dalam ? 'Jendela makan buka' : 'Jendela makan tutup'}</p>
            <p className="fs-12">
              {js.buka}–{js.tutup}
              {js.dalam ? '' : ' · sekarang cukup air putih, teh/kopi tanpa gula'}
            </p>
            {luar ? <p className="mt-1 fs-12 font-semibold">{luar} catatan makan hari ini di luar jendela.</p> : null}
          </div>
        </div>
      ) : null}
      <div className="flex items-start gap-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <Flame size={18} className="mt-0.5 shrink-0 text-orange-500" />
        <div>
          <p className="fs-14 font-black text-slate-900 dark:text-white">
            {meals === null ? '…' : kcal.toLocaleString('id-ID')} / {plan.targetKalori.toLocaleString('id-ID')} kkal
          </p>
          <p className="fs-12 text-slate-500 dark:text-slate-400">Kalori hari ini vs target programmu</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <Drumstick size={18} className="mt-0.5 shrink-0 text-rose-500" />
        <div>
          <p className="fs-14 font-black text-slate-900 dark:text-white">
            {meals === null ? '…' : protein} / {plan.proteinG.min}–{plan.proteinG.max} g protein
          </p>
          <p className="fs-12 text-slate-500 dark:text-slate-400">
            {meals !== null && protein < plan.proteinG.min
              ? `Kurang ±${plan.proteinG.min - protein} g — tambah telur, tempe, tahu, atau ikan.`
              : 'Protein bantu kenyang lebih lama.'}
          </p>
        </div>
      </div>
    </div>
  );
}

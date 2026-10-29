"use client";

import { useEffect, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURES, featuresFromIds, type Feature, type FeatureId } from '@/lib/features';
import { useFeatures } from '@/lib/useFeatures';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Fitur. "Fitur kamu" tampil di menu samping; "Fitur
// lainnya" disembunyikan. × mematikan (hanya dari menu — datanya tetap ada,
// halamannya tetap bisa dibuka), + menyalakan. Tersimpan di akun (semua perangkat).

function FeatureTile({ f, mode, onToggle, onOpen }: { f: Feature; mode: 'on' | 'off'; onToggle: () => void; onOpen: () => void }) {
  const Icon = f.icon;
  return (
    <div className="relative flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-gradient-to-br shadow-[inset_0_-3px_0_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 sm:h-[76px] sm:w-[76px]',
          f.tint,
          mode === 'off' && 'opacity-80'
        )}
        aria-label={`Buka ${f.label}`}
      >
        <Icon size={30} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={mode === 'on' ? `Matikan ${f.label}` : `Aktifkan ${f.label}`}
        className={cn(
          'absolute -top-1.5 right-1/2 flex h-7 w-7 translate-x-[42px] items-center justify-center rounded-full shadow-md ring-2 ring-white transition-colors sm:translate-x-[46px]',
          mode === 'on' ? 'bg-slate-900 text-white hover:bg-rose-600' : 'bg-white text-slate-700 hover:bg-indigo-600 hover:text-white'
        )}
      >
        {mode === 'on' ? <X size={14} strokeWidth={2.6} /> : <Plus size={15} strokeWidth={2.6} />}
      </button>
      <span className={cn('line-clamp-2 max-w-[92px] text-[13px] leading-tight', mode === 'on' ? 'font-semibold text-slate-800' : 'text-slate-500')}>{f.label}</span>
    </div>
  );
}

export function FeaturesView({ editing, open }: { editing: boolean; open: (href: string) => void }) {
  const { toast } = useFeedback();
  const { active, save, refresh } = useFeatures();
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  // Panel dibuka → ambil daftar terbaru dari server.
  useEffect(() => { void refresh(); }, [refresh]);
  // Tile terbang antara "Fitur kamu" ⇄ "Fitur lainnya" (layoutId sama).
  const fly = (id: string, children: React.ReactNode) => (
    <motion.div key={id} layoutId={reduce ? undefined : `feat-${id}`} layout={!reduce} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
      {children}
    </motion.div>
  );
  const mine = featuresFromIds(active);
  const others = FEATURES.filter((f) => !active.includes(f.id));

  const apply = async (next: FeatureId[], message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await save(next);
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan fitur.');
    } finally {
      setBusy(false);
    }
  };
  const turnOff = (f: Feature) => void apply(active.filter((id) => id !== f.id), `${f.label} dimatikan — datanya tetap aman.`);
  const turnOn = (f: Feature) => void apply([...active, f.id], `${f.label} aktif di menu.`);

  return (
    <LayoutGroup>
    <div className="space-y-5">
      <p className="px-1 text-[14px] leading-relaxed text-slate-500">
        {editing
          ? 'Ketuk × untuk mematikan, + untuk menyalakan. Mematikan hanya menyembunyikan dari menu — data tidak hilang.'
          : 'Nyalakan yang kamu pakai saja, menu tetap ringkas. Ketuk ikon untuk membuka fiturnya.'}
      </p>

      <section className="rounded-[24px] bg-slate-50 p-4">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h3 className="text-[15px] font-bold text-slate-900">Fitur kamu</h3>
          <span className="flex items-center gap-1 text-[13px] font-medium text-indigo-600"><Check size={13} /> {mine.length} aktif</span>
        </div>
        {mine.length ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-2 sm:grid-cols-4">
            {mine.map((f) => fly(f.id,
              editing ? (
                <FeatureTile f={f} mode="on" onToggle={() => turnOff(f)} onOpen={() => turnOff(f)} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <button type="button" onClick={() => open(f.href)} className={cn('flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-gradient-to-br shadow-[inset_0_-3px_0_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 sm:h-[76px] sm:w-[76px]', f.tint)} aria-label={`Buka ${f.label}`}>
                    <f.icon size={30} strokeWidth={1.8} />
                  </button>
                  <span className="line-clamp-2 max-w-[92px] text-[13px] font-semibold leading-tight text-slate-800">{f.label}</span>
                </div>
              )
            ))}
          </div>
        ) : (
          <p className="px-1 py-4 text-[14px] text-slate-500">Belum ada fitur aktif. Tambahkan dari daftar di bawah.</p>
        )}
      </section>

      <section className="px-1">
        <h3 className="mb-3 text-[15px] font-bold text-slate-900">Fitur lainnya</h3>
        {others.length ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-2 sm:grid-cols-4">
            {others.map((f) => fly(f.id, <FeatureTile f={f} mode="off" onToggle={() => turnOn(f)} onOpen={() => (editing ? turnOn(f) : open(f.href))} />))}
          </div>
        ) : (
          <p className="py-2 text-[14px] text-slate-500">Semua fitur sudah aktif.</p>
        )}
      </section>
    </div>
    </LayoutGroup>
  );
}

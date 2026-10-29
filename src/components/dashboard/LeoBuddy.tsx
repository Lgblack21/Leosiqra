"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeoMascot, type LeoActivity, type LeoMood } from '@/components/mascot/LeoMascot';
import type { Season } from '@/lib/season';

// Leo di Ringkasan: ngobrol soal keuanganmu hari ini. Setiap "kata" disusun
// halaman dari data asli (budget, hari ini, pengingat, kebiasaan). Ketuk Leo →
// kaget-ketawa lalu pindah ke kata berikutnya; ekspresinya ikut isi pesan.
export type LeoTip = {
  id: string;
  text: string;
  mood: LeoMood;
  action?: { label: string; href?: string; onClick?: () => void };
};

// Kesibukan Leo saat tidak sedang ngomong — ikut jam perangkat: malam tidur,
// jam makan makan, selebihnya gantian main bola, main koin, makan, santai.
const ACT_LABEL: Record<LeoActivity, string> = {
  eat: 'Leo lagi makan 🍗',
  play: 'Leo lagi main bola ⚽',
  coins: 'Leo lagi main koin 🪙',
  sleep: 'Leo lagi tidur 😴',
};
const pickActivity = (n: number): LeoActivity | null => {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return 'sleep';
  const meal = (h >= 11 && h < 14) || (h >= 18 && h < 20);
  const cycle: (LeoActivity | null)[] = meal ? ['eat', 'eat', 'play', 'coins'] : ['play', 'coins', 'eat', null];
  return cycle[n % cycle.length];
};
const ACT_EVERY = 12000;
const TALK_FOR = 6500;

export function LeoBuddy({ tips, season, size = 150, className }: { tips: LeoTip[]; season: Season | null; size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [pets, setPets] = useState(0);
  const tip = tips.length > 0 ? tips[i % tips.length] : null;

  // Daftar kata berubah (data dimuat ulang) → mulai dari yang pertama lagi.
  const key = tips.map((t) => t.id).join('|');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset urutan saat isi berubah
    setI(0);
  }, [key]);

  // Aktivitas berganti tiap ACT_EVERY; diketuk → berhenti sebentar untuk ngomong.
  const [activity, setActivity] = useState<LeoActivity | null>(null);
  const [talking, setTalking] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let n = 0;
    const first = setTimeout(() => setActivity(pickActivity(n)), 1800);
    const every = setInterval(() => {
      n += 1;
      setActivity(pickActivity(n));
    }, ACT_EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [reduce]);
  useEffect(() => {
    if (!talking) return;
    const t = setTimeout(() => setTalking(false), TALK_FOR);
    return () => clearTimeout(t);
  }, [talking, pets]);
  const busy = talking ? null : activity;

  const next = () => {
    setPets((p) => p + 1);
    setI((v) => v + 1);
    setTalking(true);
  };

  const action = tip?.action;
  const actionCls = 'mt-2.5 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-indigo-700';

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="relative min-w-0 flex-1 pb-6">
        <AnimatePresence mode="wait">
          {tip && (
            <motion.div
              key={`${tip.id}-${i}`}
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="relative rounded-[22px] rounded-br-md bg-white px-4 py-3 text-slate-800 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.55)]"
              aria-live="polite"
            >
              <p className="text-[14px] font-semibold leading-snug md:text-[15px]">{tip.text}</p>
              {action && (action.href ? (
                <Link href={action.href} className={actionCls}>{action.label} <ChevronRight size={14} /></Link>
              ) : (
                <button type="button" onClick={action.onClick} className={actionCls}>{action.label} <ChevronRight size={14} /></button>
              ))}
              <span aria-hidden className="absolute -right-1.5 bottom-2 h-4 w-4 rotate-45 rounded-sm bg-white" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute bottom-0 left-1 flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          {tips.length > 1 && (
            <span className="flex gap-1" aria-hidden>
              {tips.map((t, k) => (
                <span key={t.id} className={cn('h-1.5 rounded-full transition-all', k === i % tips.length ? 'w-4 bg-white' : 'w-1.5 bg-white/45')} />
              ))}
            </span>
          )}
          <motion.span key={busy ?? 'hint'} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1">
            {busy ? ACT_LABEL[busy] : <><Hand size={12} /> {pets === 0 ? 'Ketuk Leo' : pets < 5 ? 'Ketuk lagi' : `Dielus ${pets}×`}</>}
          </motion.span>
        </div>
      </div>
      <button
        type="button"
        onClick={next}
        aria-label="Ketuk Leo untuk pesan berikutnya"
        className="relative -mb-2 shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        <LeoMascot mood={busy ? 'idle' : tip?.mood ?? 'idle'} activity={busy} size={size} season={season} interactive />
      </button>
    </div>
  );
}

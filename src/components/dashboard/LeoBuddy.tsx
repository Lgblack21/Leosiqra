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

// "rata-rata", "Rp1,2 jt-an" dst. tidak dipotong di tanda hubung saat teks turun baris.
const keepHyphenated = (text: string) =>
  text.split(/(\S+-\S+)/).map((part, k) => (k % 2 ? <span key={k} className="whitespace-nowrap">{part}</span> : part));

// Satu instans untuk semua layar (dulu dua: HP & desktop, timer & listener ikut dobel);
// ukuran maskot diatur CSS lewat mascotClassName.
export function LeoBuddy({ tips, season, size = 150, className, mascotClassName }: { tips: LeoTip[]; season: Season | null; size?: number; className?: string; mascotClassName?: string }) {
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
  const actionCls = 'mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-indigo-700 md:text-[13px]';

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="relative min-w-0 max-w-[290px] flex-1 pb-6">
        <AnimatePresence mode="wait">
          {tip && (
            <motion.div
              key={`${tip.id}-${i}`}
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="relative rounded-[18px] rounded-br-md bg-white/95 px-3.5 py-2.5 text-slate-800 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.6)] backdrop-blur-sm"
              aria-live="polite"
            >
              <p className="text-[13px] font-semibold leading-snug md:text-[14px]">{keepHyphenated(tip.text)}</p>
              {action && (action.href ? (
                <Link href={action.href} className={actionCls}>{action.label} <ChevronRight size={14} /></Link>
              ) : (
                <button type="button" onClick={action.onClick} className={actionCls}>{action.label} <ChevronRight size={14} /></button>
              ))}
              <span aria-hidden className="absolute -right-1 bottom-2.5 h-3 w-3 rotate-45 rounded-[3px] bg-white/95" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute bottom-0 left-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/75 md:text-[12px]">
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
        <LeoMascot mood={busy ? 'idle' : tip?.mood ?? 'idle'} activity={busy} size={size} season={season} interactive ledge className={mascotClassName} />
      </button>
    </div>
  );
}

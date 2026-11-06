"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, RotateCcw, Square, Waves } from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { focusAudio } from '@/lib/focus/audio';
import { lightTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

// Tenang — latihan napas terpandu. Lingkaran membesar saat tarik napas, diam saat
// tahan, mengecil saat hembus; Leo di tengah ikut bernapas.
type Step = { name: 'tarik' | 'tahan' | 'hembus'; sec: number; text: string };
const PATTERNS: { id: string; label: string; hint: string; steps: Step[] }[] = [
  { id: 'lega', label: 'Napas lega', hint: 'Dua tarikan lewat hidung, satu hembusan panjang — cepat menurunkan tegang.', steps: [
    { name: 'tarik', sec: 2.5, text: 'Tarik lewat hidung' },
    { name: 'tarik', sec: 1.2, text: 'Tarik sedikit lagi' },
    { name: 'hembus', sec: 6, text: 'Hembuskan pelan lewat mulut' },
  ] },
  { id: 'kotak', label: 'Kotak 4×4', hint: 'Tarik, tahan, hembus, tahan — masing-masing 4 detik. Bikin fokus stabil.', steps: [
    { name: 'tarik', sec: 4, text: 'Tarik napas' },
    { name: 'tahan', sec: 4, text: 'Tahan' },
    { name: 'hembus', sec: 4, text: 'Hembuskan' },
    { name: 'tahan', sec: 4, text: 'Tahan' },
  ] },
  { id: '478', label: '4-7-8', hint: 'Tarik 4, tahan 7, hembus 8 detik — enak sebelum tidur.', steps: [
    { name: 'tarik', sec: 4, text: 'Tarik napas' },
    { name: 'tahan', sec: 7, text: 'Tahan' },
    { name: 'hembus', sec: 8, text: 'Hembuskan pelan' },
  ] },
];
const LENGTHS = [1, 3, 5];
const MIN_SCALE = 0.62;

export function BreathView() {
  const reduce = useReducedMotion();
  const [pattern, setPattern] = useState(PATTERNS[0].id);
  const [minutes, setMinutes] = useState(1);
  const [sound, setSound] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState(false);
  const lastStep = useRef(-1);
  // true = suara ombak dinyalakan oleh Tenang (bukan musik sesi Fokus) → boleh dimatikan di sini.
  const ownSound = useRef(false);
  const releaseSound = () => { if (ownSound.current) { ownSound.current = false; focusAudio.stop(); } };

  const p = PATTERNS.find((x) => x.id === pattern) ?? PATTERNS[0];
  const cycleSec = p.steps.reduce((a, s) => a + s.sec, 0);
  const totalSec = minutes * 60;
  const running = startedAt !== null;

  useEffect(() => {
    if (startedAt === null) return;
    let raf = 0;
    const loop = () => {
      const t = Date.now();
      setNow(t);
      if ((t - startedAt) / 1000 >= totalSec) {
        setStartedAt(null);
        setFinished(true);
        releaseSound();
        focusAudio.chime();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [startedAt, totalSec]);

  // Pindah tab saat masih berjalan → matikan suara yang dinyalakan Tenang.
  useEffect(() => () => releaseSound(), []);

  // Posisi dalam siklus → langkah & skala lingkaran.
  const elapsed = running ? (now - startedAt) / 1000 : 0;
  let inCycle = elapsed % cycleSec;
  let idx = 0;
  while (idx < p.steps.length - 1 && inCycle >= p.steps[idx].sec) { inCycle -= p.steps[idx].sec; idx += 1; }
  const step = p.steps[idx];
  const frac = Math.min(1, inCycle / step.sec);
  const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;
  // Skala sebelum langkah ini (tarik bertahap pada "Napas lega").
  const before = (() => {
    let sc = MIN_SCALE;
    for (let i = 0; i < idx; i++) {
      const s = p.steps[i];
      if (s.name === 'tarik') sc = i === 0 && p.steps[1]?.name === 'tarik' ? 0.88 : 1;
      if (s.name === 'hembus') sc = MIN_SCALE;
    }
    return sc;
  })();
  const target = step.name === 'tarik' ? (idx === 0 && p.steps[1]?.name === 'tarik' ? 0.88 : 1) : step.name === 'hembus' ? MIN_SCALE : before;
  const scale = running ? before + (target - before) * ease(frac) : 0.78;
  const left = running ? Math.max(0, totalSec - elapsed) : totalSec;

  // Getar halus tiap ganti langkah.
  const stepKey = running ? Math.floor(elapsed / cycleSec) * 10 + idx : -1;
  useEffect(() => {
    if (stepKey < 0 || stepKey === lastStep.current) return;
    lastStep.current = stepKey;
    try { navigator.vibrate?.(18); } catch { /* tidak didukung */ }
    lightTap();
  }, [stepKey]);

  const start = () => {
    lightTap();
    setFinished(false);
    lastStep.current = -1;
    if (sound) { focusAudio.play('ombak', 0.45); ownSound.current = true; }
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  };
  const stop = () => { setStartedAt(null); releaseSound(); lightTap(); };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:grid-rows-1 md:gap-4">
      <section className="relative flex min-h-0 flex-col items-center overflow-hidden rounded-[28px] bg-gradient-to-b from-[#F5F3FF] to-[#EEF2FF] px-4 py-4 ring-1 ring-slate-100 dark:from-[#1e1b4b] dark:to-[#0f172a] dark:ring-slate-800 md:py-6">
        {/* Lingkaran mengisi ruang yang ada (container query) → pas di semua tinggi layar. */}
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
        <div className="relative flex aspect-square items-center justify-center" style={{ width: 'min(100cqw, 100cqh, 340px)' }}>
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-200/70 dark:border-indigo-400/20" />
          <motion.div
            className="absolute inset-[6%] rounded-full bg-gradient-to-br from-indigo-200/80 via-violet-200/70 to-sky-200/70 shadow-[0_0_60px_rgba(129,140,248,0.45)] dark:from-indigo-500/40 dark:via-violet-500/30 dark:to-sky-500/30"
            style={{ scale: reduce ? 0.85 : scale }}
          />
          <div className="relative w-[46%]">
            {/* Leo ikut bernapas (dada mengembang, pipi menggembung saat tahan, embusan saat hembus) & tidak tertidur. */}
            <LeoMascot
              mood={finished ? 'happy' : 'idle'}
              size={140}
              stayAwake
              breathing={running ? step.name : null}
              breathAmt={running ? (scale - MIN_SCALE) / (1 - MIN_SCALE) : 0}
              className="h-auto w-full"
            />
          </div>
        </div>
        </div>
        <div className="mt-2 h-[56px] shrink-0 text-center md:mt-3">
          {running ? (
            <>
              <p className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[26px]">{step.text}</p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{Math.ceil(step.sec - inCycle)} · sisa {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, '0')}</p>
            </>
          ) : finished ? (
            <>
              <p className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">Selesai. Lebih enteng? 🌿</p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{minutes} menit napas bareng Leo.</p>
            </>
          ) : (
            <>
              <p className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">Napas bareng Leo</p>
              <p className="mx-auto max-w-xs text-[13px] text-slate-500 dark:text-slate-400">{p.hint}</p>
            </>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-3 md:gap-4">
        {/* HP: pilihan disembunyikan selama latihan (tidak bisa diubah) → lingkaran & Leo tampil besar. */}
        <div className={cn(running && 'hidden md:block', 'rounded-[28px] bg-white p-3.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-5')}>
          <p className="text-[12px] font-semibold text-slate-500 md:text-[13px]">Cara</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {PATTERNS.map((x) => (
              <button key={x.id} type="button" disabled={running} onClick={() => setPattern(x.id)}
                className={cn('rounded-2xl px-2 py-2.5 text-[12px] font-bold transition-colors disabled:opacity-50 md:text-[13px]', pattern === x.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300')}>{x.label}</button>
            ))}
          </div>
          <p className="mt-3 text-[12px] font-semibold text-slate-500 md:mt-4 md:text-[13px]">Lama</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {LENGTHS.map((m) => (
              <button key={m} type="button" disabled={running} onClick={() => setMinutes(m)}
                className={cn('rounded-2xl py-2.5 text-[13px] font-bold transition-colors disabled:opacity-50', minutes === m ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300')}>{m} menit</button>
            ))}
          </div>
          <button type="button" role="switch" aria-checked={sound} onClick={() => { const v = !sound; setSound(v); if (running) { if (v) { focusAudio.play('ombak', 0.45); ownSound.current = true; } else releaseSound(); } }}
            className="mt-3 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-2.5 text-left dark:bg-slate-800 md:mt-4 md:py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><Waves size={16} className="text-sky-500" /> Suara ombak pelan</span>
            <span className={cn('relative h-6 w-10 rounded-full transition-colors', sound ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]', sound ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </button>
        </div>
        {running ? (
          <button type="button" onClick={stop} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3.5 text-[15px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Square size={16} /> Berhenti</button>
        ) : (
          <button type="button" onClick={start} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-slate-900/15 active:scale-[0.98] dark:bg-white dark:text-slate-900">
            {finished ? <><RotateCcw size={17} /> Ulangi</> : <><Play size={18} fill="currentColor" /> Mulai · {minutes}:00</>}
          </button>
        )}
      </section>
    </div>
  );
}

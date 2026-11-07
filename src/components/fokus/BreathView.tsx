'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, RotateCcw, Square, Waves } from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { focusAudio } from '@/lib/focus/audio';
import { lightTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

type Step = { name: 'tarik' | 'tahan' | 'hembus'; sec: number; text: string };
const PATTERNS: { id: string; label: string; hint: string; steps: Step[] }[] = [
  {
    id: 'lega',
    label: 'Napas lega',
    hint: 'Dua tarikan lewat hidung, satu hembusan panjang — cepat menurunkan tegang.',
    steps: [
      { name: 'tarik', sec: 2.5, text: 'Tarik lewat hidung' },
      { name: 'tarik', sec: 1.2, text: 'Tarik sedikit lagi' },
      { name: 'hembus', sec: 6, text: 'Hembuskan pelan lewat mulut' },
    ],
  },
  {
    id: 'kotak',
    label: 'Kotak 4×4',
    hint: 'Tarik, tahan, hembus, tahan — masing-masing 4 detik. Bikin fokus stabil.',
    steps: [
      { name: 'tarik', sec: 4, text: 'Tarik napas' },
      { name: 'tahan', sec: 4, text: 'Tahan' },
      { name: 'hembus', sec: 4, text: 'Hembuskan' },
      { name: 'tahan', sec: 4, text: 'Tahan' },
    ],
  },
  {
    id: '478',
    label: '4-7-8',
    hint: 'Tarik 4, tahan 7, hembus 8 detik — enak sebelum tidur.',
    steps: [
      { name: 'tarik', sec: 4, text: 'Tarik napas' },
      { name: 'tahan', sec: 7, text: 'Tahan' },
      { name: 'hembus', sec: 8, text: 'Hembuskan pelan' },
    ],
  },
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
  const releaseSound = () => {
    if (ownSound.current) {
      ownSound.current = false;
      focusAudio.stop();
    }
  };

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

  const elapsed = running ? (now - startedAt) / 1000 : 0;
  let inCycle = elapsed % cycleSec;
  let idx = 0;
  while (idx < p.steps.length - 1 && inCycle >= p.steps[idx].sec) {
    inCycle -= p.steps[idx].sec;
    idx += 1;
  }
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
  const target =
    step.name === 'tarik'
      ? idx === 0 && p.steps[1]?.name === 'tarik'
        ? 0.88
        : 1
      : step.name === 'hembus'
        ? MIN_SCALE
        : before;
  const scale = running ? before + (target - before) * ease(frac) : 0.78;
  const left = running ? Math.max(0, totalSec - elapsed) : totalSec;

  const stepKey = running ? Math.floor(elapsed / cycleSec) * 10 + idx : -1;
  useEffect(() => {
    if (stepKey < 0 || stepKey === lastStep.current) return;
    lastStep.current = stepKey;
    try {
      navigator.vibrate?.(18);
    } catch {
      /* tidak didukung */
    }
    lightTap();
  }, [stepKey]);

  const start = () => {
    lightTap();
    setFinished(false);
    lastStep.current = -1;
    if (sound) {
      focusAudio.play('ombak', 0.45);
      ownSound.current = true;
    }
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  };
  const stop = () => {
    setStartedAt(null);
    releaseSound();
    lightTap();
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] bg-[radial-gradient(120%_80%_at_50%_0%,#3b2f86_0%,#1b1847_55%,#0c0b26_100%)] p-3 text-white shadow-[0_24px_60px_-34px_rgba(49,46,129,0.8)] md:p-5">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          [8, 12],
          [22, 30],
          [80, 10],
          [90, 34],
          [64, 22],
          [36, 8],
          [14, 52],
          [86, 60],
        ].map(([x, y], i) => (
          <span
            key={i}
            className="focus-twinkle absolute h-1 w-1 rounded-full bg-white/70"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </div>
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
        <div
          className="relative flex aspect-square items-center justify-center"
          style={{ width: 'min(92cqw, 92cqh, 380px)' }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              aria-hidden
              className="absolute inset-0 rounded-full border border-indigo-200/15"
              style={{ scale: reduce ? 1 : 0.7 + (scale - MIN_SCALE) * (0.55 + i * 0.22) }}
            />
          ))}
          <motion.div
            aria-hidden
            className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#c4b5fd_0%,#818cf8_45%,#4338ca_100%)] shadow-[0_0_80px_rgba(129,140,248,0.55)]"
            style={{ scale: reduce ? 0.85 : scale, opacity: 0.55 + (scale - MIN_SCALE) }}
          />
          <div className="relative w-[44%]">
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
      <div className="relative shrink-0 py-2 text-center md:py-3">
        {running ? (
          <>
            <p className="text-[22px] font-extrabold tracking-tight md:text-[28px]">{step.text}</p>
            <p className="text-[13px] font-semibold tabular-nums text-indigo-100/70">
              {Math.ceil(step.sec - inCycle)} · sisa {Math.floor(left / 60)}:
              {String(Math.floor(left % 60)).padStart(2, '0')}
            </p>
          </>
        ) : finished ? (
          <>
            <p className="text-[22px] font-extrabold tracking-tight">Selesai. Lebih enteng? 🌿</p>
            <p className="text-[13px] text-indigo-100/70">{minutes} menit napas bareng Leo.</p>
          </>
        ) : (
          <>
            <p className="text-[20px] font-extrabold tracking-tight md:text-[24px]">{p.label}</p>
            <p className="mx-auto max-w-sm text-[13px] text-indigo-100/70">{p.hint}</p>
          </>
        )}
      </div>

      <div className="relative shrink-0 rounded-[24px] bg-white/10 p-2.5 ring-1 ring-white/10 backdrop-blur-md md:mx-auto md:w-full md:max-w-2xl md:p-3">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-3.5 text-[15px] font-bold text-white hover:bg-white/20"
          >
            <Square size={16} /> Berhenti
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {PATTERNS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setPattern(x.id)}
                  aria-pressed={pattern === x.id}
                  className={cn(
                    'rounded-2xl py-2.5 text-[12px] font-bold transition-colors md:text-[13px]',
                    pattern === x.id ? 'bg-white text-indigo-900' : 'bg-white/10 text-white/80 hover:bg-white/15',
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {LENGTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  aria-pressed={minutes === m}
                  className={cn(
                    'flex-1 rounded-full py-2 text-[12px] font-bold transition-colors md:text-[13px]',
                    minutes === m ? 'bg-indigo-400 text-indigo-950' : 'bg-white/10 text-white/80 hover:bg-white/15',
                  )}
                >
                  {m} mnt
                </button>
              ))}
              <button
                type="button"
                role="switch"
                aria-checked={sound}
                aria-label="Suara ombak pelan"
                onClick={() => setSound((v) => !v)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition-colors',
                  sound ? 'bg-sky-300 text-sky-950' : 'bg-white/10 text-white/80 hover:bg-white/15',
                )}
              >
                <Waves size={14} /> Ombak
              </button>
            </div>
            <button
              type="button"
              onClick={start}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-bold text-indigo-950 shadow-lg active:scale-[0.98]"
            >
              {finished ? (
                <>
                  <RotateCcw size={17} /> Ulangi
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" /> Mulai · {minutes}:00
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

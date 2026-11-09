'use client';

// Bahan tampilan bersama Teduh (Al-Qur'an & Alkitab): kerangka layar penuh + dock, langit beranimasi
// sesuai waktu, angka & cincin beranimasi, latihan napas "Jeda sejenak", dan lembar (sheet) bertab.
// Semua animasi dimatikan otomatis bila perangkat memilih "kurangi gerakan".
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'framer-motion';
import { ArrowLeft, Wind, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Nada = 'islam' | 'kristen' | 'katolik';
export const WARNA: Record<Nada, { pill: string; soft: string; teks: string; solid: string; ring: string }> = {
  islam: {
    pill: 'from-emerald-300 to-teal-200',
    soft: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
    teks: 'text-emerald-700 dark:text-emerald-300',
    solid: 'bg-emerald-600 text-white',
    ring: 'ring-emerald-300',
  },
  kristen: {
    pill: 'from-indigo-300 to-sky-200',
    soft: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
    teks: 'text-indigo-700 dark:text-indigo-300',
    solid: 'bg-indigo-600 text-white',
    ring: 'ring-indigo-300',
  },
  katolik: {
    pill: 'from-amber-300 to-orange-200',
    soft: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
    teks: 'text-amber-700 dark:text-amber-300',
    solid: 'bg-amber-600 text-white',
    ring: 'ring-amber-300',
  },
};

// ── Kerangka layar penuh (seperti Ladangku): bar atas + isi + dock melayang ──
export type DockTab<T extends string> = {
  id: T;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};
export function TeduhShell<T extends string>({
  variant,
  nada,
  tabs,
  tab,
  onTab,
  judul,
  sub,
  kanan,
  polos,
  children,
}: {
  variant: 'web' | 'app';
  nada: Nada;
  tabs?: DockTab<T>[];
  tab?: T;
  onTab?: (t: T) => void;
  judul: string;
  sub?: string;
  kanan?: React.ReactNode;
  /** Tanpa bar atas & dock (mis. saat membaca surah/pasal — pembaca punya bar sendiri). */
  polos?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const back = variant === 'app' ? '/app/more' : '/membership/dashboard';
  return (
    <div className={cn(variant === 'app' && 'min-h-dvh bg-[#f6f7fb] dark:bg-slate-950')}>
      <div
        className={cn(
          'mx-auto min-h-dvh w-full max-w-5xl px-4 text-slate-900 md:px-8 dark:text-white',
          variant === 'app' ? 'pt-[max(12px,env(safe-area-inset-top))]' : 'pt-4 md:pt-6',
          polos ? 'pb-10' : 'pb-36',
        )}
      >
        {!polos ? (
          <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <Link
              href={back}
              aria-label={variant === 'app' ? 'Kembali' : 'Kembali ke Ringkasan'}
              className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 fs-13 font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
                <ArrowLeft size={16} />
              </span>
              <span className="hidden sm:inline">{variant === 'app' ? 'Lainnya' : 'Ringkasan'}</span>
            </Link>
            <div className="min-w-0 text-center">
              <h1 className="truncate fsh-20 font-extrabold tracking-tight md:fsh-24">{judul}</h1>
              {sub ? <p className="truncate fs-12 text-slate-500">{sub}</p> : null}
            </div>
            <div className="flex justify-end">{kanan}</div>
          </header>
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={polos ? 'pembaca' : (tab ?? 'x')}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {children}
          </motion.main>
        </AnimatePresence>
        {!polos && tabs && tab && onTab ? (
          <nav
            aria-label="Menu Teduh"
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4 print:hidden"
          >
            <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
              {tabs.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onTab(t.id);
                      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
                    }}
                    aria-current={active ? 'page' : undefined}
                    aria-label={t.label}
                    className={cn(
                      'relative flex h-12 items-center justify-center gap-2 rounded-full fs-13 font-bold transition-colors',
                      active ? 'px-4 text-slate-950' : 'w-12 text-white/70 hover:bg-white/10',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId={`teduh-dock-${nada}`}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className={cn('absolute inset-0 rounded-full bg-gradient-to-r', WARNA[nada].pill)}
                      />
                    ) : null}
                    <t.icon size={20} className="relative shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                    {active ? <span className="relative whitespace-nowrap">{t.label}</span> : null}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

// ── Muncul berurutan ──
const wadah: Variants = { tampil: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const butir: Variants = {
  awal: { opacity: 0, y: 16 },
  tampil: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
export function Berurutan({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={wadah} initial={reduce ? false : 'awal'} animate="tampil" className={className}>
      {children}
    </motion.div>
  );
}
export function Butir({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={butir} className={className}>
      {children}
    </motion.div>
  );
}

// ── Angka yang menghitung naik ──
export function AngkaNaik({ nilai, className }: { nilai: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? nilai : 0);
  const teks = useTransform(mv, (v) => Math.round(v).toLocaleString('id-ID'));
  useEffect(() => {
    if (reduce) {
      mv.set(nilai);
      return;
    }
    const c = animate(mv, nilai, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [mv, nilai, reduce]);
  return <motion.span className={cn('tabular-nums', className)}>{teks}</motion.span>;
}

// ── Cincin progres ──
export function CincinProgres({
  pct,
  warna = 'stroke-emerald-500',
  ukuran = 56,
}: {
  pct: number;
  warna?: string;
  ukuran?: number;
}) {
  const reduce = useReducedMotion();
  const r = ukuran / 2 - 5;
  const label = pct > 0 && pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: ukuran, height: ukuran }}>
      <svg width={ukuran} height={ukuran} viewBox={`0 0 ${ukuran} ${ukuran}`} className="-rotate-90">
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <motion.circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={warna}
          style={{ opacity: pct > 0 ? 1 : 0 }}
          initial={{ pathLength: reduce ? Math.max(pct, 0.005) : 0 }}
          animate={{ pathLength: pct > 0 ? Math.max(pct, 0.02) : 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center fs-11 font-black">{label}</span>
    </span>
  );
}

// ── Langit sesuai waktu ──
// ── Langit Teduh: warna, matahari, bulan & bintang mengikuti jam (berubah halus tiap menit) ──
// Titik kunci warna langit [jam, atas, tengah, cakrawala]; di antaranya diinterpolasi.
const LANGIT: [number, string, string, string][] = [
  [0, '#060b1f', '#0d1636', '#1b2550'],
  [4.3, '#070c22', '#151a45', '#2a2a5e'],
  [5.2, '#1b1f52', '#4b3a7a', '#c0708a'],
  [5.9, '#3b5a9c', '#c98aa0', '#ffc28a'],
  [7, '#3f7fd0', '#79b4ea', '#ffe2b0'],
  [10, '#2f78d6', '#5aa6ee', '#bfe4ff'],
  [14, '#2b6fcf', '#4f9ee9', '#b4dcff'],
  [16.4, '#3567be', '#7aa6dc', '#ffd59a'],
  [17.4, '#3a4f9a', '#c27a8a', '#ffa45c'],
  [18, '#2a2f6e', '#7a4a86', '#f08a5a'],
  [18.6, '#151b48', '#36306a', '#7a4f7e'],
  [19.4, '#0a1030', '#141c45', '#252c5c'],
  [24, '#060b1f', '#0d1636', '#1b2550'],
];
const TERBIT = 5.85;
const TERBENAM = 17.95;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const campur = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
export function warnaLangit(h: number) {
  const i = Math.max(0, LANGIT.findIndex((k) => k[0] > h) - 1);
  const [h0, ...a] = LANGIT[i];
  const [h1, ...b] = LANGIT[Math.min(i + 1, LANGIT.length - 1)];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  return a.map((c, k) => campur(c, b[k], t)) as [string, string, string];
}
/** Sapaan yang selaras dengan langit. */
export const sapaWaktu = (d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 4
    ? 'Selamat malam'
    : h < 10.5
      ? 'Selamat pagi'
      : h < 15
        ? 'Selamat siang'
        : h < 18.25
          ? 'Selamat sore'
          : 'Selamat malam';
};
const acak = (i: number) => {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const jamSekarang = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

export function LangitHero({
  nada,
  sapa,
  judul,
  tanggal,
  children,
}: {
  nada: Nada;
  sapa: string;
  judul: string;
  tanggal: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [h, setH] = useState(jamSekarang);
  useEffect(() => {
    const id = setInterval(() => setH(jamSekarang()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [atas, tengah, cakrawala] = warnaLangit(h);
  // Matahari: 0 saat terbit → 1 saat terbenam; tinggi = sinus (sedikit di bawah 0 = tenggelam di balik bukit).
  const tm = (h - TERBIT) / (TERBENAM - TERBIT);
  const siang = tm > -0.04 && tm < 1.04;
  // Bulan: dari terbenam sampai terbit esok.
  const malamPanjang = 24 - TERBENAM + TERBIT;
  const tb = (((h - TERBENAM + 24) % 24) + 0.0001) / malamPanjang;
  const gelap = Math.min(1, Math.max(0, siang ? (Math.abs(tm - 0.5) - 0.42) * 6 : 1));
  const busur = (v: number) => ({
    left: `${50 + v * 44}%`,
    top: `${92 - Math.sin(Math.PI * Math.min(1, Math.max(0, v))) * 70 + (v < 0 || v > 1 ? 10 : 0)}%`,
  });
  const dekatCakrawala = siang && (tm < 0.12 || tm > 0.88);
  const bintang = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        x: acak(i) * 100,
        y: acak(i + 50) * 62,
        s: 1 + acak(i + 99) * 1.8,
        d: acak(i + 7) * 3,
      })),
    [],
  );
  const awan = !siang || gelap > 0.6 ? 0 : 1;
  return (
    <section
      className="web-keep relative isolate overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.6)] transition-[background] duration-[2000ms] md:p-7"
      style={{ background: `linear-gradient(180deg, ${atas} 0%, ${tengah} 58%, ${cakrawala} 100%)` }}
    >
      {/* Bintang (makin terang saat gelap) */}
      {gelap > 0.05 &&
        bintang.map((b, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute -z-10 rounded-full bg-white"
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, opacity: 0.6 * gelap }}
            animate={reduce ? undefined : { opacity: [0.15 * gelap, 0.95 * gelap, 0.15 * gelap] }}
            transition={{ duration: 2.4 + b.d, repeat: Infinity, delay: b.d, ease: 'easeInOut' }}
          />
        ))}
      {/* Bintang jatuh sesekali di malam hari */}
      {gelap > 0.8 && !reduce && (
        <motion.span
          aria-hidden
          className="absolute -z-10 h-px w-24 bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: '18%', left: '30%', rotate: '-20deg' }}
          animate={{ x: [0, 260], y: [0, 90], opacity: [0, 1, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 9, ease: 'easeOut' }}
        />
      )}
      {/* Awan tipis melayang di siang hari */}
      {awan
        ? [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute -z-10 rounded-full bg-white/30 blur-2xl"
              style={{ top: `${14 + i * 22}%`, width: 180 - i * 30, height: 36 - i * 6 }}
              initial={{ x: `${-20 + i * 140}%` }}
              animate={reduce ? undefined : { x: ['-60%', '520%'] }}
              transition={{ duration: 70 + i * 25, repeat: Infinity, ease: 'linear', delay: -i * 25 }}
            />
          ))
        : null}
      {/* Matahari */}
      {siang && (
        <motion.span
          aria-hidden
          className="absolute -z-10 -translate-x-1/2 -translate-y-1/2"
          initial={reduce ? busur(tm) : busur(tm - 0.08)}
          animate={busur(tm)}
          transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${dekatCakrawala ? 'rgba(255,170,90,0.55)' : 'rgba(255,240,190,0.5)'} 0%, transparent 65%)`,
            }}
          />
          <motion.span
            className="relative block h-14 w-14 rounded-full"
            style={{
              background: dekatCakrawala
                ? 'radial-gradient(circle at 40% 40%, #fff3d6, #ffb36b 70%)'
                : 'radial-gradient(circle at 40% 40%, #fffdf0, #ffe28a 70%)',
            }}
            animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.span>
      )}
      {/* Bulan sabit */}
      {!siang && (
        <motion.span
          aria-hidden
          className="absolute -z-10 -translate-x-1/2 -translate-y-1/2"
          initial={reduce ? busur(tb) : busur(tb - 0.08)}
          animate={busur(tb)}
          transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,232,255,0.28),transparent_65%)]" />
          <svg viewBox="0 0 48 48" className="relative h-12 w-12 drop-shadow-[0_0_12px_rgba(255,248,220,0.6)]">
            <defs>
              <mask id="sabit">
                <rect width="48" height="48" fill="white" />
                <circle cx="32" cy="18" r="18" fill="black" />
              </mask>
            </defs>
            <circle cx="24" cy="24" r="20" fill="#fdf6dc" mask="url(#sabit)" />
          </svg>
        </motion.span>
      )}
      {/* Siluet bukit berlapis (warna mengikuti langit) */}
      <svg
        aria-hidden
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 -z-10 h-[34%] w-full"
      >
        <path
          d="M0 52 C 50 34, 90 40, 140 46 S 230 26, 290 38 S 370 30, 400 36 V80 H0Z"
          fill="#1e2350"
          opacity={0.18 + gelap * 0.12}
        />
        <path
          d="M0 64 C 60 50, 120 58, 180 54 S 280 44, 330 54 S 385 50, 400 52 V80 H0Z"
          fill="#0b1026"
          opacity={0.28 + gelap * 0.2}
        />
        <path d="M0 74 C 80 66, 160 72, 240 68 S 360 64, 400 70 V80 H0Z" fill="#070b1c" opacity={0.42 + gelap * 0.25} />
      </svg>
      {/* Motif: bintang segi delapan (Islam) atau berkas cahaya (Kristen/Katolik) */}
      {nada === 'islam' ? (
        <motion.svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-14 -top-16 -z-10 h-64 w-64 text-white/[0.07]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 160, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1, 2].map((k) => (
            <g key={k} transform={`translate(50 50) scale(${1 - k * 0.28})`}>
              <rect
                x="-34"
                y="-34"
                width="68"
                height="68"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2 / (1 - k * 0.28)}
              />
              <rect
                x="-34"
                y="-34"
                width="68"
                height="68"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2 / (1 - k * 0.28)}
                transform="rotate(45)"
              />
            </g>
          ))}
        </motion.svg>
      ) : (
        <motion.span
          aria-hidden
          className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full opacity-[0.16] [background:repeating-conic-gradient(from_0deg,rgba(255,255,255,0.55)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black_20%,transparent_70%)]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {/* Penjaga keterbacaan teks di kiri */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 w-2/3 bg-gradient-to-r from-black/25 to-transparent"
      />
      <div className="flex items-center justify-between gap-2">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-white/15 px-2.5 py-1 fs-11 font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur"
        >
          {sapa}
        </motion.p>
        <p className="truncate fs-11.5 font-semibold text-white/75">{tanggal}</p>
      </div>
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mt-3 max-w-[16ch] fsh-28 font-black leading-[1.1] md:fsh-34"
      >
        {judul}
      </motion.h2>
      {children}
    </section>
  );
}

/** Deret 7 hari dengan titik yang "menyala" berurutan. */
export function TitikMingguan({ days, todayKey }: { days: Record<string, number>; todayKey: (d: Date) => string }) {
  const reduce = useReducedMotion();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { d, on: Boolean(days[todayKey(d)]), hariIni: i === 6 };
  });
  return (
    <div className="flex gap-1.5">
      {week.map((w, i) => (
        <span key={w.d.toISOString()} className="flex flex-col items-center gap-1">
          <motion.span
            initial={reduce ? false : { scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.06, type: 'spring', stiffness: 380, damping: 20 }}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full fs-10 font-black',
              w.on ? 'bg-amber-300 text-amber-950 shadow-[0_0_14px_rgba(252,211,77,0.7)]' : 'bg-white/15 text-white/60 ring-1 ring-white/20',
              w.hariIni && !w.on && 'ring-1 ring-white/50',
            )}
          >
            {w.on ? '✓' : ''}
          </motion.span>
          <span className="fs-10 text-white/65">{w.d.toLocaleDateString('id-ID', { weekday: 'narrow' })}</span>
        </span>
      ))}
    </div>
  );
}

// ── Jeda sejenak: latihan napas 1 menit (tarik 4 · tahan 2 · hembus 6) ──
const FASE_NAPAS = [
  { id: 'tarik', label: 'Tarik napas', detik: 4, skala: 1 },
  { id: 'tahan', label: 'Tahan', detik: 2, skala: 1 },
  { id: 'hembus', label: 'Hembuskan perlahan', detik: 6, skala: 0.55 },
] as const;
const PUTARAN = 5;
export function JedaSejenak({ nada, kalimat, onClose }: { nada: Nada; kalimat: string[]; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [langkah, setLangkah] = useState(0); // 0..PUTARAN*3
  const selesai = langkah >= PUTARAN * FASE_NAPAS.length;
  const fase = FASE_NAPAS[langkah % FASE_NAPAS.length];
  const putaran = Math.floor(langkah / FASE_NAPAS.length);
  useEffect(() => {
    if (selesai) return;
    const t = setTimeout(() => setLangkah((v) => v + 1), fase.detik * 1000);
    return () => clearTimeout(t);
  }, [langkah, selesai, fase.detik]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const warna =
    nada === 'islam'
      ? 'from-emerald-300 to-teal-500'
      : nada === 'katolik'
        ? 'from-amber-200 to-orange-500'
        : 'from-sky-300 to-indigo-500';
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Jeda sejenak"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="web-keep fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-950/95 px-6 text-white backdrop-blur"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
      >
        <X size={20} />
      </button>
      <div className="relative flex h-72 w-72 items-center justify-center">
        <motion.span
          className={cn('absolute inset-0 rounded-full bg-gradient-to-br opacity-30 blur-2xl', warna)}
          animate={{ scale: selesai ? 0.8 : fase.skala }}
          transition={{ duration: reduce ? 0 : fase.detik, ease: 'easeInOut' }}
        />
        <motion.span
          className={cn('absolute inset-6 rounded-full bg-gradient-to-br shadow-2xl', warna)}
          initial={{ scale: 0.55 }}
          animate={{ scale: selesai ? 0.7 : fase.skala }}
          transition={{ duration: reduce ? 0 : fase.detik, ease: 'easeInOut' }}
        />
        <AnimatePresence mode="wait">
          <motion.p
            key={selesai ? 'selesai' : langkah}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative px-6 text-center fsh-22 font-black text-slate-950"
          >
            {selesai ? (nada === 'islam' ? 'Alhamdulillah, selesai' : 'Selesai') : fase.label}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="mt-8 min-h-[3em] max-w-sm text-center fs-15 leading-relaxed text-white/80">
        {selesai ? 'Semoga hatimu lebih tenang. Lanjutkan harimu perlahan.' : kalimat[putaran % kalimat.length]}
      </p>
      <div className="mt-6 flex gap-1.5">
        {Array.from({ length: PUTARAN }, (_, i) => (
          <span key={i} className={cn('h-1.5 w-8 rounded-full', i < putaran || selesai ? 'bg-white' : 'bg-white/20')} />
        ))}
      </div>
      {selesai ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-8 h-12 rounded-full bg-white px-6 fs-14 font-bold text-slate-950"
        >
          Kembali
        </button>
      ) : null}
    </motion.div>
  );
}
export function TombolJeda({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 fs-12.5 font-bold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25',
        className,
      )}
    >
      <Wind size={15} /> Jeda sejenak
    </button>
  );
}

// ── Lembar bertab (Pelajari) ──
export function LembarTab<T extends string>({
  judul,
  tabs,
  tab,
  onTab,
  onClose,
  nada,
  children,
}: {
  judul: string;
  tabs: { id: T; label: string }[];
  tab: T;
  onTab: (t: T) => void;
  onClose: () => void;
  nada: Nada;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [onClose]);
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [tab]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white text-slate-900 shadow-2xl sm:rounded-[28px] dark:bg-slate-900 dark:text-white"
      >
        <div className="flex items-center gap-2 px-5 pb-3 pt-4">
          <p className="min-w-0 flex-1 truncate fsh-20 font-black">{judul}</p>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-5 flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={cn(
                'relative h-10 flex-1 rounded-full fs-13 font-bold',
                tab === t.id ? 'text-slate-900 dark:text-white' : 'text-slate-500',
              )}
            >
              {tab === t.id ? (
                <motion.span
                  layoutId={`lembar-${nada}`}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-950"
                />
              ) : null}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <div ref={box} className="flex-1 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/** Nomor ayat dalam bingkai bintang segi delapan (gaya mushaf). */
export function NomorAyat({ n, aktif }: { n: number; aktif?: boolean }) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 40 40"
        className={cn('absolute inset-0', aktif ? 'text-emerald-500' : 'text-emerald-600/70 dark:text-emerald-400/70')}
      >
        <rect x="8" y="8" width="24" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect
          x="8"
          y="8"
          width="24"
          height="24"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(45 20 20)"
        />
      </svg>
      <span
        className={cn(
          'relative fs-11 font-black tabular-nums',
          aktif ? 'text-emerald-600' : 'text-emerald-800 dark:text-emerald-200',
        )}
      >
        {n}
      </span>
    </span>
  );
}

/** Catatan pribadi (textarea yang menyimpan otomatis setelah berhenti mengetik). */
export function CatatanPribadi({
  nilai,
  onSimpan,
  placeholder,
}: {
  nilai: string;
  onSimpan: (v: string) => void;
  placeholder: string;
}) {
  const [v, setV] = useState(nilai);
  const [tersimpan, setTersimpan] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ketikan yang belum tersimpan ikut disimpan saat lembar ditutup.
  const tunda = useRef<{ v: string; simpan: (v: string) => void } | null>(null);
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current);
      if (tunda.current) tunda.current.simpan(tunda.current.v);
    },
    [],
  );
  return (
    <div>
      <textarea
        value={v}
        onChange={(e) => {
          const x = e.target.value;
          setV(x);
          setTersimpan(false);
          tunda.current = { v: x, simpan: onSimpan };
          if (t.current) clearTimeout(t.current);
          t.current = setTimeout(() => {
            onSimpan(x);
            tunda.current = null;
            setTersimpan(true);
          }, 600);
        }}
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
        className="w-full resize-none rounded-2xl bg-slate-50 p-3.5 fs-14 leading-relaxed outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:ring-slate-700"
      />
      <p className="mt-1 fs-11.5 text-slate-400">
        {tersimpan ? 'Tersimpan di perangkat ini ✓' : 'Hanya disimpan di perangkat ini — tidak dikirim ke server.'}
      </p>
    </div>
  );
}

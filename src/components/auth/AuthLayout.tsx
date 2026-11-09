'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Mic, ShieldCheck, Sparkles } from 'lucide-react';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { BudgetChip, TxChip, VoiceChip } from './FinanceChips';

// Kerangka halaman masuk/daftar.
// - Laptop (≥ lg): dua kolom — kiri panel brand navy-emas (senada logo) berisi judul, 3 keunggulan, dan kartu
//   fitur yang melayang; kanan form di kartu putih dengan Leo mengintip di tepi atas.
// - HP/tablet: pita gelap di atas (logo, judul, chip keunggulan), kartu form menumpuk di atasnya.
const PERKS = [
  { icon: Mic, title: 'Catat 5 detik', sub: 'Ketik, ngomong, atau foto struk.' },
  { icon: Sparkles, title: 'Leo yang merangkum', sub: 'Saldo, budget, dan laporan tersusun sendiri.' },
  { icon: ShieldCheck, title: 'Datamu aman', sub: 'Login terlindungi, verifikasi 2 langkah tersedia.' },
];

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="auth-aurora absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-indigo-600/40 blur-[90px]" />
      <div
        className="auth-aurora absolute -right-20 top-1/3 h-[360px] w-[360px] rounded-full bg-amber-400/25 blur-[90px]"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="auth-aurora absolute -bottom-32 left-1/4 h-[380px] w-[380px] rounded-full bg-violet-600/30 blur-[100px]"
        style={{ animationDelay: '-11s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}

const Brand = ({ light = false }: { light?: boolean }) => (
  <Link href="/" className="flex items-center gap-2.5">
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]">
      <Image src="/images/Logo-new.png" alt="Leosiqra" width={40} height={40} className="scale-125" />
    </span>
    <span className={`fsh-21 font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
      Leo<span className="text-amber-300">siqra</span>
    </span>
  </Link>
);

export function AuthLayout({
  headline,
  sub,
  mood,
  lookX,
  children,
  footer,
  backHref = '/mulai',
}: {
  headline: string;
  sub: string;
  mood: LeoMood;
  lookX?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backHref?: string;
}) {
  // Jeda animasi masuk (CSS .auth-enter) per elemen.
  const d = (k: number) => ({ '--d': `${0.08 + k * 0.08}s` }) as React.CSSProperties;
  const back = (
    <Link
      href={backHref}
      aria-label="Kembali"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20"
    >
      <ChevronLeft size={20} />
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#f5f6fb] font-sans text-slate-900 selection:bg-indigo-100 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Panel brand (laptop) ── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br lg:sticky lg:top-0 lg:h-screen from-[#070d1f] via-[#0d1638] to-[#1b1150] text-white lg:flex lg:flex-col">
        <Aurora />
        <div className="relative flex items-center gap-4 px-12 pt-10 xl:px-16">
          {back}
          <Brand light />
        </div>
        <div className="relative flex flex-1 flex-col justify-center px-12 pb-6 xl:px-16">
          <span
            style={d(0)}
            className="auth-enter inline-flex w-fit items-center gap-2 rounded-full bg-amber-300/15 px-3.5 py-1.5 fs-13 font-bold text-amber-200 ring-1 ring-amber-300/30"
          >
            <Sparkles size={14} /> Gratis 14 hari · tanpa kartu kredit
          </span>
          <h1
            style={d(1)}
            className="auth-enter mt-5 max-w-lg fsh-44 font-extrabold leading-[1.05] tracking-[-0.03em] xl:fsh-52"
          >
            {headline}
          </h1>
          <p style={d(2)} className="auth-enter mt-4 max-w-md fs-16 leading-relaxed text-white/60">
            {sub}
          </p>
          <ul className="mt-9 max-w-md space-y-4">
            {PERKS.map((p, i) => (
              <li key={p.title} style={d(3 + i)} className="auth-enter flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 shadow-[0_10px_24px_-10px_rgba(251,191,36,0.8)]">
                  <p.icon size={19} strokeWidth={2.4} />
                </span>
                <span>
                  <span className="block fs-15.5 font-bold">{p.title}</span>
                  <span className="block fs-14 text-white/55">{p.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="relative h-[240px] shrink-0">
          <TxChip className="absolute left-12 top-0 xl:left-16" />
          <VoiceChip className="absolute right-10 top-10" />
          <BudgetChip className="absolute left-[30%] top-[118px] hidden xl:block" />
        </div>
      </aside>

      {/* ── Kolom form ── */}
      <main className="relative flex min-h-screen flex-col">
        {/* Pita atas (HP/tablet) */}
        <div className="relative overflow-hidden rounded-b-[36px] bg-gradient-to-br from-[#070d1f] via-[#0d1638] to-[#1b1150] px-5 pb-32 pt-5 text-white sm:px-8 lg:hidden">
          <Aurora />
          <div className="relative flex items-center gap-3">
            {back}
            <Brand light />
          </div>
          <h1
            style={d(0)}
            className="auth-enter relative mt-6 max-w-md fsh-30 font-extrabold leading-[1.1] tracking-tight"
          >
            {headline}
          </h1>
          <div style={d(1)} className="auth-enter relative mt-4 flex flex-wrap gap-2">
            {PERKS.map((p) => (
              <span
                key={p.title}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 fs-12 font-semibold text-white/85 ring-1 ring-white/10"
              >
                <p.icon size={13} className="text-amber-300" /> {p.title}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center px-4 pb-10 sm:px-8 lg:justify-center lg:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(rgba(79,70,229,0.08)_1px,transparent_1px)] [background-size:22px_22px] lg:block"
          />
          <div className="relative -mt-[120px] w-full max-w-[440px] lg:mt-0">
            {/* Leo mengintip di tepi atas kartu */}
            <div style={d(1)} className="auth-enter pointer-events-none relative z-20 -mb-[30px] flex justify-center">
              <LeoMascot mood={mood} lookX={lookX} size={124} interactive />
            </div>
            <div
              style={d(2)}
              className="auth-enter relative z-10 rounded-[32px] bg-white p-6 pt-9 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 sm:p-9 sm:pt-11"
            >
              <span
                aria-hidden
                className="absolute inset-x-10 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400"
              />
              {children}
            </div>
            {footer && <div className="mt-5 text-center text-xs text-slate-400">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

// Komponen kecil yang dipakai bersama halaman masuk & daftar.
export const authInputWrap =
  'group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10';
export const authInput =
  'w-full bg-transparent py-3.5 fs-15 font-medium text-slate-900 outline-none placeholder:text-slate-400';
export const authLabel = 'mb-1.5 block pl-1 fs-13 font-semibold text-slate-600';
export const authPrimaryBtn =
  'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-4 fs-15 font-bold text-white shadow-[0_14px_30px_-12px_rgba(79,70,229,0.7)] transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0';

export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

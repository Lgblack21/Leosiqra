"use client";

import Link from 'next/link';
import Image from 'next/image';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';

// Kerangka halaman auth sekunder (lupa/reset password): latar putih hangat yang
// sama dengan masuk/daftar, satu kartu di tengah, Leo mengintip di tepi atas
// kartu. Tanpa hiasan kertas supaya fokus ke satu aksi.
export function AuthCard({ badge, title, subtitle, mood = 'idle', children }: {
  badge: string;
  title: string;
  subtitle: React.ReactNode;
  mood?: LeoMood;
  children: React.ReactNode;
}) {
  const d = (k: number) => ({ "--d": `${k * 0.08}s` }) as React.CSSProperties;

  return (
    <div className="relative min-h-screen bg-white font-sans text-slate-900">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(251,191,36,0.13),transparent_58%)]" />
      <div className="relative flex min-h-screen flex-col items-center px-5 py-8 sm:justify-center">
        <div style={d(0)} className="auth-enter">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900">
            <Image src="/images/Logo-new.png" alt="Leosiqra" width={32} height={32} />
            <span className="text-xl font-extrabold tracking-tight">Leosiqra</span>
          </Link>
        </div>
        <div className="mt-6 w-full max-w-[440px]">
          <div style={d(1)} className="auth-enter pointer-events-none relative z-20 -mb-[27px] flex justify-center">
            <LeoMascot mood={mood} size={116} interactive />
          </div>
          <div style={d(1)} className="auth-enter relative z-10 space-y-6 rounded-[30px] border border-slate-100 bg-white p-6 pt-8 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.35)] sm:p-9 sm:pt-10">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">{badge}</span>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

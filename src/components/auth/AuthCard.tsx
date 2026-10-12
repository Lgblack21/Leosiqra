"use client";

import Link from 'next/link';
import Image from 'next/image';
import { AuthScene } from './AuthScene';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';

// Kerangka halaman auth sekunder (lupa/reset password): langit kota yang sama
// dengan masuk/daftar sebagai latar penuh, satu kartu di tengah, Leo mengintip
// di tepi atas kartu. Tanpa panel samping supaya fokus ke satu aksi.
export function AuthCard({ badge, title, subtitle, mood = 'idle', children }: {
  badge: string;
  title: string;
  subtitle: React.ReactNode;
  mood?: LeoMood;
  children: React.ReactNode;
}) {
  const d = (k: number) => ({ "--d": `${k * 0.08}s` }) as React.CSSProperties;

  return (
    <AuthScene className="min-h-screen font-sans text-slate-900">
      <div className="flex min-h-screen flex-col items-center px-5 py-8 sm:justify-center">
        <div style={d(0)} className="auth-enter">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 shadow-lg shadow-black/10">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={26} height={26} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">Leosiqra</span>
          </Link>
        </div>
        <div className="mt-6 w-full max-w-[440px]">
          <div style={d(1)} className="auth-enter pointer-events-none relative z-20 -mb-[27px] flex justify-center">
            <LeoMascot mood={mood} size={116} interactive />
          </div>
          <div style={d(1)} className="auth-enter relative z-10 space-y-6 rounded-[30px] border border-white/60 bg-white p-6 pt-8 shadow-[0_24px_70px_-24px_rgba(30,27,75,0.55)] sm:p-9 sm:pt-10">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">{badge}</span>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </AuthScene>
  );
}

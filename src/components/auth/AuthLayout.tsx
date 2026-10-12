"use client";

import Link from "next/link";
import Image from "next/image";
import { Mic, Sparkles, Users } from "lucide-react";
import { AuthScene, Greeting } from "./AuthScene";
import { LeoMascot, type LeoMood } from "@/components/mascot/LeoMascot";

// Kerangka halaman masuk/daftar: langit kota + Leo yang mengintip di atas
// kartu form. Desktop: langit di kiri, form di kanan. HP: langit jadi banner
// di atas, kartu form naik menimpanya, Leo duduk di tepi atas kartu.
const POINTS = [
  { icon: Mic, text: "Catat lewat ketik, suara, atau foto struk" },
  { icon: Sparkles, text: "AI Leosiqra yang paham keuanganmu" },
  { icon: Users, text: "Dompet bersama untuk keluarga" },
];

export function AuthLayout({
  headline,
  sub,
  mood,
  lookX,
  children,
  footer,
}: {
  headline: string;
  sub: string;
  mood: LeoMood;
  lookX?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Jeda animasi masuk (CSS .auth-enter) per elemen.
  const d = (k: number) => ({ "--d": `${0.08 + k * 0.08}s` }) as React.CSSProperties;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 lg:flex">
      {/* Langit kota — panel kiri (desktop) */}
      <AuthScene className="hidden lg:block lg:w-[52%] lg:min-h-screen">
        <div className="flex h-full min-h-screen flex-col px-14 py-12 text-white">
          <Link href="/" className="flex w-fit items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-lg shadow-black/10">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={30} height={30} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">Leosiqra</span>
          </Link>
          <div className="mt-[9vh] max-w-lg">
            <p className="auth-enter text-sm font-semibold text-white/80" style={d(0)}><Greeting /> 👋</p>
            <h1 style={d(1)} className="auth-enter mt-3 text-[44px] font-extrabold leading-[1.08] tracking-tight drop-shadow-sm">{headline}</h1>
            <p style={d(2)} className="auth-enter mt-4 text-base leading-relaxed text-white/85">{sub}</p>
            <div className="mt-8 flex flex-col gap-2.5">
              {POINTS.map(({ icon: Icon, text }, i) => (
                <div key={text} style={d(3 + i)} className="auth-enter flex w-fit items-center gap-3 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-md ring-1 ring-white/20">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/20"><Icon size={15} /></span>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuthScene>

      {/* Banner langit (HP) */}
      <AuthScene className="h-[250px] lg:hidden">
        <div className="flex h-full flex-col px-6 pt-7 text-white">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 shadow-md">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={24} height={24} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Leosiqra</span>
          </Link>
          <p className="mt-5 text-xs font-semibold text-white/85"><Greeting /> 👋</p>
          <h1 className="mt-1 max-w-[17rem] text-[22px] font-extrabold leading-tight drop-shadow-sm">{headline}</h1>
        </div>
      </AuthScene>

      {/* Form */}
      <div className="relative flex flex-1 justify-center px-5 pb-10 lg:items-center lg:bg-[#f7f7fb] lg:px-10">
        <div className="relative -mt-24 w-full max-w-[440px] lg:mt-0">
          {/* Leo mengintip di tepi atas kartu */}
          <div style={d(1)} className="auth-enter pointer-events-none relative z-20 -mb-[30px] flex justify-center">
            <LeoMascot mood={mood} lookX={lookX} size={128} interactive />
          </div>
          <div style={d(1)} className="auth-enter relative z-10 rounded-[30px] border border-slate-100 bg-white p-6 pt-8 shadow-[0_20px_60px_-24px_rgba(49,46,129,0.35)] sm:p-9 sm:pt-10">
            {children}
          </div>
          {footer && <div className="mt-5 text-center text-xs text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

// Komponen kecil yang dipakai bersama halaman masuk & daftar.
export const authInputWrap =
  "group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10";
export const authInput =
  "w-full bg-transparent py-3.5 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400";
export const authLabel = "mb-1.5 block pl-1 text-[13px] font-semibold text-slate-600";
export const authPrimaryBtn =
  "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0";

export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { LeoMascot, type LeoMood } from "@/components/mascot/LeoMascot";
import { BalanceChip, BrandBackdrop, BudgetChip, TxChip, VoiceChip } from "./FinanceChips";

// Kerangka halaman masuk/daftar: latar gradasi indigo khas Leosiqra dengan
// kartu fitur yang melayang (suara → transaksi, budget, saldo), satu kartu
// form di tengah, Leo mengintip di tepi atas kartu, tombol kembali ke /mulai.
export function AuthLayout({
  headline,
  sub,
  mood,
  lookX,
  children,
  footer,
  backHref = "/mulai",
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
  const d = (k: number) => ({ "--d": `${0.08 + k * 0.08}s` }) as React.CSSProperties;

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-slate-900 selection:bg-indigo-100">
      <BrandBackdrop />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
        <VoiceChip className="absolute left-[6%] top-[16%]" />
        <BudgetChip className="absolute bottom-[16%] left-[9%]" />
        <TxChip className="absolute right-[5%] top-[18%]" />
        <BalanceChip className="absolute bottom-[18%] right-[8%]" />
      </div>

      <Link
        href={backHref}
        aria-label="Kembali"
        className="absolute left-4 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100 backdrop-blur transition-colors hover:bg-white sm:left-8 sm:top-8"
      >
        <ChevronLeft size={20} />
      </Link>
      <div className="relative flex min-h-screen flex-col items-center px-5 pb-10 pt-8 sm:justify-center">
        <Link href="/" style={d(0)} className="auth-enter flex items-center gap-2.5">
          <Image src="/images/Logo-new.png" alt="Leosiqra" width={32} height={32} />
          <span className="text-[21px] font-extrabold tracking-tight">Leosiqra</span>
        </Link>
        <h1 style={d(0)} className="auth-enter mt-2 max-w-sm text-center text-[15px] font-medium text-slate-500" title={sub}>
          {headline}
        </h1>

        <div className="relative mt-4 w-full max-w-[440px]">
          {/* Leo mengintip di tepi atas kartu */}
          <div style={d(1)} className="auth-enter pointer-events-none relative z-20 -mb-[30px] flex justify-center">
            <LeoMascot mood={mood} lookX={lookX} size={124} interactive />
          </div>
          <div style={d(1)} className="auth-enter relative z-10 rounded-[32px] border border-white bg-white/95 p-6 pt-9 shadow-[0_40px_80px_-30px_rgba(49,46,129,0.45)] backdrop-blur sm:p-9 sm:pt-11">
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
  "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-[15px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(79,70,229,0.7)] transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0";

export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

"use client";

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

// Kerangka halaman auth sekunder (lupa/reset password) — kartu yang sama dengan
// login/daftar, tanpa panel pratinjau supaya fokus ke satu aksi.
export function AuthCard({ badge, title, subtitle, children }: {
  badge: string;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const enter = (k: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.7, delay: k * 0.1, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fb] p-5 font-sans sm:p-6">
      <div className="hero-aurora" aria-hidden />
      <div className="dot-grid" aria-hidden />
      <div className="relative z-10 w-full max-w-[440px] space-y-7">
        <motion.div {...enter(0)} className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/Logo-new.png" alt="Leosiqra" width={34} height={34} />
            <span className="font-serif text-2xl font-black tracking-tight text-slate-900">Leosiqra</span>
          </Link>
        </motion.div>
        <motion.div {...enter(1)} className="lp-card space-y-6 rounded-[32px] p-7 sm:p-10">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-label font-bold uppercase text-indigo-600">
              {badge}
            </div>
            <h1 className="font-serif text-3xl leading-tight text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

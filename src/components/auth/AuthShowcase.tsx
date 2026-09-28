"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, CalendarClock, Check, ShieldCheck, Sparkles, Lock } from "lucide-react";
import { CountUp } from "@/components/landing/CountUp";

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// Notifikasi contoh yang bergantian — cuplikan hal yang benar-benar dilakukan
// aplikasi (pemasukan tercatat, pengingat kartu, setoran otomatis, input AI).
const NOTES = [
  { icon: ArrowDownLeft, tone: "bg-emerald-400/15 text-emerald-300", title: "Gaji September masuk", sub: "+Rp 18.500.000 ke BCA Platinum" },
  { icon: CalendarClock, tone: "bg-amber-400/15 text-amber-300", title: "Tagihan kartu 3 hari lagi", sub: "Minimum Rp 398.000 · jatuh tempo 5 Okt" },
  { icon: Check, tone: "bg-sky-400/15 text-sky-300", title: "Setoran otomatis tercatat", sub: "Dana Darurat +Rp 1.000.000" },
  { icon: Sparkles, tone: "bg-violet-400/15 text-violet-200", title: "“25rb kopi bca” dipahami", sub: "Makanan › Kopi · BCA Blue · hari ini" },
];

const LINE = "M0,70 C30,66 44,50 70,52 C98,54 108,36 136,33 C164,30 176,42 204,32 C232,22 246,12 280,8";

// Panel kiri halaman login/daftar (desktop): gradasi indigo dengan pratinjau
// aplikasi yang hidup — angka berjalan, garis tergambar, notifikasi bergantian.
export function AuthShowcase({ title, subtitle }: { title: React.ReactNode; subtitle: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % NOTES.length), 2800);
    return () => clearInterval(t);
  }, [reduce]);
  const note = NOTES[i];

  return (
    <div className="relative hidden flex-[1.05] flex-col overflow-hidden bg-gradient-to-br from-[#0f172a] via-indigo-800 to-violet-700 p-10 text-white lg:flex xl:p-14">
      <div aria-hidden className="dot-grid opacity-25" />
      <motion.div
        aria-hidden
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-400/30 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-400/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <Link href="/" className="relative flex w-fit items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/20">
          <Image src="/images/Logo-new.png" alt="Leosiqra" width={28} height={28} />
        </span>
        <span className="font-serif text-2xl font-black tracking-tight">Leosiqra</span>
      </Link>

      <motion.div
        className="relative mt-14 max-w-md"
        initial={reduce ? false : { opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-serif text-4xl leading-[1.08] xl:text-5xl">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-indigo-100/85">{subtitle}</p>
      </motion.div>

      {/* Pratinjau aplikasi */}
      <div className="relative mt-12 max-w-md">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-100/80">Saldo bersih</p>
            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">+12,4% bulan ini</span>
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums"><CountUp to={84_210_500} format={rp} /></p>
          <svg viewBox="0 0 280 80" preserveAspectRatio="none" className="mt-4 h-16 w-full" aria-hidden>
            <defs>
              <linearGradient id="auth-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path d={`${LINE} L280,80 L0,80 Z`} fill="url(#auth-area)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }} />
            <motion.path d={LINE} fill="none" stroke="#e0e7ff" strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </svg>
        </motion.div>

        {/* Notifikasi bergantian */}
        <div className="relative mt-4 h-[74px]">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-xl"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${note.tone}`}><note.icon size={18} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{note.title}</span>
                <span className="block truncate text-xs text-indigo-100/75">{note.sub}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {NOTES.map((_, k) => (
            <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === i ? "w-6 bg-white" : "w-2 bg-white/30"}`} />
          ))}
          <span className="ml-2 text-[10px] text-indigo-100/60">Contoh tampilan aplikasi</span>
        </div>
      </div>

      <div className="relative mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-10 text-xs text-indigo-100/80">
        <span className="flex items-center gap-2"><ShieldCheck size={14} /> Verifikasi 2 langkah (Authenticator)</span>
        <span className="flex items-center gap-2"><Lock size={14} /> Data hanya bisa dibuka akun Anda</span>
      </div>
    </div>
  );
}

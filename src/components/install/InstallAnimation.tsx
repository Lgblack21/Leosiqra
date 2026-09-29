"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Share, MoreVertical, PlusSquare, Download, Lock, RotateCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/pwaInstall";

export type InstallApp = "leosiqra" | "input-cepat";

export const APP_INFO: Record<InstallApp, { name: string; path: string; icon: string }> = {
  leosiqra: { name: "Leosiqra", path: "/app", icon: "/images/Logo-new.png" },
  "input-cepat": { name: "Input Cepat", path: "/input-cepat", icon: "/images/input-cepat-192.png" },
};

const STEPS: Record<"ios" | "android", (app: InstallApp) => string[]> = {
  ios: (app) => [
    `Buka leosiqra.com${APP_INFO[app].path} di Safari`,
    "Ketuk tombol Bagikan (kotak dengan panah ke atas)",
    "Pilih “Tambahkan ke Layar Utama”",
    "Ketuk “Tambah” di pojok kanan atas",
    `Selesai — buka ${APP_INFO[app].name} dari layar utama`,
  ],
  android: (app) => [
    `Buka leosiqra.com${APP_INFO[app].path} di Chrome`,
    "Ketuk menu ⋮ di pojok kanan atas",
    "Pilih “Instal aplikasi” (atau “Tambahkan ke layar utama”)",
    "Ketuk “Instal” untuk konfirmasi",
    `Selesai — buka ${APP_INFO[app].name} dari layar utama`,
  ],
};

export const installSteps = (platform: Platform, app: InstallApp) => STEPS[platform === "ios" ? "ios" : "android"](app);

const STEP_MS = 2400;

// Peraga cara memasang aplikasi: layar HP yang memutar tiap langkah secara
// berulang, dengan daftar langkah di sampingnya yang ikut menyala. Langkah
// bisa diketuk untuk dilihat lebih lama.
export function InstallAnimation({ platform, app, compact = false }: { platform: Platform; app: InstallApp; compact?: boolean }) {
  const reduce = useReducedMotion();
  const os: "ios" | "android" = platform === "ios" ? "ios" : "android";
  const steps = STEPS[os](app);
  const [step, setStep] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < pausedUntil) return;
      setStep((s) => (s + 1) % steps.length);
    }, reduce ? STEP_MS * 2 : STEP_MS);
    return () => clearInterval(t);
  }, [pausedUntil, reduce, steps.length]);

  return (
    <div className={cn("flex gap-6", compact ? "flex-col items-center" : "flex-col items-center sm:flex-row sm:items-start")}>
      <Phone os={os} app={app} step={step} />
      <ol className={cn("w-full space-y-2", compact ? "max-w-xs" : "sm:max-w-xs sm:pt-4")}>
        {steps.map((text, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => {
                setStep(i);
                setPausedUntil(Date.now() + 6000);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-all",
                i === step ? "bg-indigo-50 font-bold text-indigo-900 ring-1 ring-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                )}
              >
                {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className="leading-snug">{text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tap({ className }: { className: string }) {
  return (
    <motion.span
      aria-hidden
      className={cn("pointer-events-none absolute z-30 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-500 bg-indigo-400/30", className)}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: [0.3, 1, 1.25], opacity: [0, 1, 0] }}
      transition={{ duration: 1.1, delay: 0.7, repeat: 1, repeatDelay: 0.1 }}
    />
  );
}

function Phone({ os, app, step }: { os: "ios" | "android"; app: InstallApp; step: number }) {
  return (
    <div className="relative h-[460px] w-[228px] shrink-0 rounded-[42px] bg-slate-900 p-[9px] shadow-2xl shadow-indigo-900/25">
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-white">
        <div className="absolute left-1/2 top-2 z-40 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step === 4 ? "home" : "browser"}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            {step === 4 ? <HomeScreen app={app} /> : <BrowserScreen os={os} app={app} step={step} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PageContent({ app }: { app: InstallApp }) {
  // Tampilan halaman yang sedang dibuka (ringkas) — beda antara aplikasi
  // utama dan Input Cepat supaya jelas halaman mana yang dipasang.
  if (app === "input-cepat") {
    return (
      <div className="space-y-2 px-3 pt-3">
        <p className="text-[11px] font-black text-slate-800">Input Cepat</p>
        <div className="rounded-xl border-2 border-indigo-200 px-2.5 py-2 text-[10px] font-bold text-slate-400">25rb kopi gopay</div>
        <div className="grid grid-cols-3 gap-1">
          {["1", "2", "3", "4", "5", "6"].map((k) => (
            <div key={k} className="rounded-lg bg-slate-100 py-1.5 text-center text-[10px] font-bold text-slate-500">{k}</div>
          ))}
        </div>
        <div className="rounded-xl bg-indigo-600 py-2 text-center text-[10px] font-black text-white">Simpan</div>
      </div>
    );
  }
  return (
    <div className="space-y-2 px-3 pt-3">
      <p className="text-[11px] font-black text-slate-800">Hai, Rina</p>
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-3 text-white">
        <p className="text-[8px] font-bold uppercase tracking-widest opacity-80">Total saldo</p>
        <p className="text-sm font-black">Rp 12.475.000</p>
      </div>
      {[70, 45, 60].map((w, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
          <span className="h-6 w-6 rounded-lg bg-indigo-100" />
          <span className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

function BrowserScreen({ os, app, step }: { os: "ios" | "android"; app: InstallApp; step: number }) {
  const info = APP_INFO[app];
  const url = (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-semibold text-slate-600">
      <Lock size={9} className="shrink-0 text-slate-400" />
      <span className="truncate">leosiqra.com{info.path}</span>
      <RotateCw size={9} className="ml-auto shrink-0 text-slate-400" />
    </div>
  );

  if (os === "android") {
    return (
      <div className="relative h-full pt-8">
        <div className="flex items-center gap-2 px-2.5 pb-2">
          <div className="flex-1">{url}</div>
          <span className="relative flex h-6 w-5 items-center justify-center text-slate-600">
            <MoreVertical size={15} />
            {step === 1 && <Tap className="left-1/2 top-1/2" />}
          </span>
        </div>
        <div className="border-t border-slate-100">
          <PageContent app={app} />
        </div>
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ transformOrigin: "top right" }}
              className="absolute right-2 top-9 z-20 w-40 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200"
            >
              {["Tab baru", "Riwayat", "Download", "Bagikan…"].map((t) => (
                <p key={t} className="px-3 py-1.5 text-[10px] text-slate-600">{t}</p>
              ))}
              <p className="relative flex items-center gap-2 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700">
                <Download size={11} /> Instal aplikasi
                <Tap className="left-1/2 top-1/2" />
              </p>
              <p className="px-3 py-1.5 text-[10px] text-slate-600">Setelan</p>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full rounded-2xl bg-white p-4 shadow-xl">
                <p className="text-[11px] font-black text-slate-800">Instal aplikasi?</p>
                <div className="mt-3 flex items-center gap-2">
                  <Image src={info.icon} alt="" width={30} height={30} className="rounded-lg" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">{info.name}</p>
                    <p className="text-[9px] text-slate-400">leosiqra.com</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-3 text-[10px] font-bold">
                  <span className="text-slate-400">Batal</span>
                  <span className="relative text-indigo-600">
                    Instal
                    <Tap className="left-1/2 top-1/2" />
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // iOS Safari: alamat & toolbar di bawah
  return (
    <div className="relative flex h-full flex-col pt-8">
      <div className="flex-1 border-b border-slate-100">
        <PageContent app={app} />
      </div>
      <div className="space-y-2 bg-slate-50 px-2.5 pb-4 pt-2">
        {url}
        <div className="flex items-center justify-around text-indigo-500">
          <span className="text-[12px]">‹</span>
          <span className="text-[12px] text-slate-300">›</span>
          <span className="relative">
            <Share size={14} />
            {step === 1 && <Tap className="left-1/2 top-1/2" />}
          </span>
          <span className="text-[11px]">⌘</span>
          <span className="text-[11px]">⧉</span>
        </div>
      </div>
      <AnimatePresence>
        {step === 2 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-slate-100 p-2.5 pb-4 shadow-2xl"
          >
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-white p-2">
              <Image src={info.icon} alt="" width={22} height={22} className="rounded-md" />
              <p className="text-[9px] font-bold text-slate-700">leosiqra.com</p>
            </div>
            <div className="overflow-hidden rounded-xl bg-white">
              {["Salin", "Tambah ke Daftar Bacaan"].map((t) => (
                <p key={t} className="border-b border-slate-100 px-3 py-1.5 text-[10px] text-slate-600">{t}</p>
              ))}
              <p className="relative flex items-center justify-between bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700">
                Tambahkan ke Layar Utama <PlusSquare size={11} />
                <Tap className="left-1/2 top-1/2" />
              </p>
              <p className="px-3 py-1.5 text-[10px] text-slate-600">Cetak</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {step === 3 && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 260 }} className="absolute inset-0 z-20 bg-slate-100 pt-8">
            <div className="flex items-center justify-between px-3 text-[10px] font-bold">
              <span className="text-indigo-500">Batal</span>
              <span className="text-slate-700">Tambah ke Layar Utama</span>
              <span className="relative text-indigo-600">
                Tambah
                <Tap className="left-1/2 top-1/2" />
              </span>
            </div>
            <div className="m-3 flex items-center gap-3 rounded-xl bg-white p-3">
              <Image src={info.icon} alt="" width={38} height={38} className="rounded-xl" />
              <div>
                <p className="text-[11px] font-bold text-slate-800">{info.name}</p>
                <p className="text-[9px] text-slate-400">https://www.leosiqra.com{info.path}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HomeScreen({ app }: { app: InstallApp }) {
  const info = APP_INFO[app];
  const tones = ["bg-emerald-400", "bg-sky-400", "bg-amber-400", "bg-rose-400", "bg-slate-400", "bg-violet-400", "bg-teal-400", "bg-orange-400"];
  return (
    <div className="h-full bg-gradient-to-b from-indigo-300 via-violet-300 to-rose-200 px-4 pt-12">
      <div className="grid grid-cols-4 gap-x-3 gap-y-4">
        {tones.map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={cn("h-10 w-10 rounded-[11px] opacity-80", t)} />
            <span className="h-1.5 w-8 rounded-full bg-white/60" />
          </div>
        ))}
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="relative block h-10 w-10 overflow-hidden rounded-[11px] bg-white shadow-lg ring-2 ring-white">
            <Image src={info.icon} alt="" fill className="object-cover" sizes="40px" />
          </span>
          <span className="max-w-[52px] truncate text-[8px] font-bold text-white drop-shadow">{info.name}</span>
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Hammer, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Pemberitahuan "Leosiqra sedang dikembangkan" untuk member (permintaan Bos
// 2026-10-30): tampilan & fitur sedang sering berubah. Bisa ditutup; muncul lagi
// setelah HIDE_DAYS selama pengembangan masih berjalan. Matikan dengan ENABLED.
const ENABLED = true;
const KEY = "leosiqra-dev-notice-v1";
const HIDE_DAYS = 3;
const noopSubscribe = () => () => {};

export default function DevNoticeBanner({ variant = "web", saranHref }: { variant?: "web" | "app"; saranHref: string }) {
  // Snapshot server = false → tidak ada beda HTML prerender vs browser (hydration aman).
  const eligible = useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!ENABLED) return false;
      try {
        const at = Number(localStorage.getItem(KEY) || 0);
        return !at || Date.now() - at > HIDE_DAYS * 86400000;
      } catch {
        return true;
      }
    },
    () => false
  );
  const [closed, setClosed] = useState(false);
  if (!eligible || closed) return null;

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* abaikan */ }
    setClosed(true);
  };

  if (variant === "app") {
    return (
      <div role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex items-center gap-2.5 rounded-2xl bg-slate-900/95 px-3 py-2.5 text-white shadow-lg backdrop-blur">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
          <Hammer size={16} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-amber-300" />
        </span>
        <p className="min-w-0 flex-1 text-[12px] leading-snug">
          <b>Leosiqra sedang dikembangkan.</b> Tampilan & fitur bisa berubah.{" "}
          <Link href={saranHref} className="font-semibold text-amber-300 underline">Kasih masukan</Link>
        </p>
        <button type="button" onClick={close} aria-label="Tutup pemberitahuan" className="shrink-0 rounded-full p-1.5 text-white/60 hover:bg-white/10"><X size={15} /></button>
      </div>
    );
  }

  return (
    <div role="status" className={cn("mx-4 mt-3 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-4 py-2.5 ring-1 ring-amber-200/70 md:mx-8 md:mt-4 print:hidden")}>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
        <Hammer size={16} />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-amber-500" />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700">
        <b className="text-slate-900">Leosiqra sedang dalam pengembangan.</b> Kami terus menambah fitur & merapikan tampilan, jadi beberapa halaman bisa berubah atau sesekali kurang mulus. Datamu tetap aman.{" "}
        <Link href={saranHref} className="font-semibold text-amber-700 underline hover:text-amber-800">Ada yang aneh? Kabari kami</Link>
      </p>
      <button type="button" onClick={close} aria-label="Tutup pemberitahuan" className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700"><X size={16} /></button>
    </div>
  );
}

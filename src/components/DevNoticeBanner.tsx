"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Pemberitahuan "Leosiqra sedang dikembangkan" untuk member (permintaan Bos
// 2026-10-30): tampilan & fitur sedang sering berubah. Bisa ditutup; muncul lagi
// setelah HIDE_DAYS selama pengembangan masih berjalan. Matikan dengan ENABLED.
// Dibuat ringkas (satu baris, tanpa animasi) supaya tidak mengganggu; di app HP hanya di Beranda.
const ENABLED = true;
const KEY = "leosiqra-dev-notice-v1";
const HIDE_DAYS = 14;
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
  const pathname = usePathname() ?? "";
  // App HP: banner mengambang di atas tab bawah → hanya di Beranda, tidak menutupi halaman lain.
  if (!eligible || closed || (variant === "app" && pathname.replace(/\/+$/, "") !== "/app")) return null;

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* abaikan */ }
    setClosed(true);
  };

  if (variant === "app") {
    return (
      <div role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex items-center gap-2.5 rounded-2xl bg-slate-900/95 px-3 py-2.5 text-white shadow-lg backdrop-blur">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900">
          <Hammer size={14} />
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
    <div role="status" className={cn("mx-4 mt-2 flex items-center gap-2.5 rounded-xl bg-amber-50 py-1.5 pl-2 pr-1 ring-1 ring-amber-200/70 md:mx-8 md:mt-3 dark:bg-amber-500/10 dark:ring-amber-500/20 print:hidden")}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900">
        <Hammer size={13} />
      </span>
      <p className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200 md:text-[13px]">
        <b className="text-slate-900 dark:text-white">Leosiqra masih dikembangkan</b>
        <span className="hidden sm:inline"> — tampilan bisa berubah, datamu tetap aman</span>.{" "}
        <Link href={saranHref} className="font-semibold text-amber-700 underline hover:text-amber-800 dark:text-amber-300">Kabari kami</Link>
      </p>
      <button type="button" onClick={close} aria-label="Tutup pemberitahuan" className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 dark:hover:bg-white/10"><X size={15} /></button>
    </div>
  );
}

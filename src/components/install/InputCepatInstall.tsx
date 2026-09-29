"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, Check, ChevronDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { InstallAnimation } from "@/components/install/InstallAnimation";
import { useInstallPrompt, detectPlatform, isInAppBrowser, isStandaloneDisplay, type Platform } from "@/lib/pwaInstall";
import { cn } from "@/lib/utils";

// Pemasangan Input Cepat HARUS dari halaman /input-cepat: dialog install
// browser selalu memasang aplikasi milik halaman yang sedang dibuka
// (manifest Input Cepat), bukan aplikasi Leosiqra utama.
function InstallBody({ platform }: { platform: Platform }) {
  const { state, promptInstall } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(state !== "available");
  const inApp = isInAppBrowser();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] shadow-md">
          <Image src="/images/input-cepat-192.png" alt="" fill sizes="48px" className="object-cover" />
        </span>
        <p className="text-sm leading-snug text-slate-600">
          Pasang <b>Input Cepat</b> di layar utama supaya bisa mencatat transaksi dalam hitungan detik — ikonnya berbeda
          dari aplikasi Leosiqra, jadi tidak tertukar.
        </p>
      </div>
      {inApp && (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Buka halaman ini di {platform === "ios" ? "Safari" : "Chrome"} dulu — browser di dalam aplikasi lain tidak bisa
          memasang aplikasi.
        </p>
      )}
      {state === "installed" ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
          <Check size={16} /> Input Cepat terpasang — buka dari layar utama HP.
        </p>
      ) : state === "available" ? (
        <button
          type="button"
          onClick={() => promptInstall().then((r) => r !== "accepted" && setShowSteps(true))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99]"
        >
          <Download size={16} /> Pasang Input Cepat
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setShowSteps((v) => !v)}
        className="flex w-full items-center justify-center gap-1 text-xs font-bold text-slate-500"
      >
        {showSteps ? "Sembunyikan langkah" : "Lihat langkah pemasangan"}
        <ChevronDown size={14} className={cn("transition-transform", showSteps && "rotate-180")} />
      </button>
      {showSteps && <InstallAnimation platform={platform} app="input-cepat" compact />}
      <p className="text-center text-[11px] text-slate-400">
        Mau aplikasi lengkapnya juga? <Link href="/install" className="font-bold text-indigo-600">Pasang Leosiqra</Link>
      </p>
    </div>
  );
}

// Tampil sebagai tombol kecil; dibuka otomatis sebagai lembar bawah kalau
// datang dari /install (?install=1). Tidak tampil kalau sudah dibuka sebagai
// aplikasi terpasang.
export function InputCepatInstall() {
  const [platform, setPlatform] = useState<Platform>("android");
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Hanya bisa dideteksi di browser (halaman diprerender statis).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi perangkat & mode standalone setelah hydrate
    setPlatform(detectPlatform() === "ios" ? "ios" : "android");
    const standalone = isStandaloneDisplay();
    setHidden(standalone);
    const fromInstallPage = new URLSearchParams(window.location.search).get("install") === "1";
    if (fromInstallPage && !standalone) setOpen(true);
  }, []);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-100"
      >
        <span className="relative h-5 w-5 overflow-hidden rounded-md">
          <Image src="/images/input-cepat-192.png" alt="" fill sizes="20px" className="object-cover" />
        </span>
        Pasang Input Cepat di layar utama HP
      </button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Pasang Input Cepat">
        <InstallBody platform={platform} />
      </BottomSheet>
    </>
  );
}

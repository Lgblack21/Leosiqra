"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { useInstallPrompt, detectPlatform, isNativeApp, isStandaloneDisplay } from "@/lib/pwaInstall";
import { cn } from "@/lib/utils";

// Iklan "pasang aplikasi" yang tampil sebelum & sesudah login.
// - Tidak tampil kalau aplikasinya sudah terpasang: dibuka sebagai aplikasi,
//   Chrome melaporkannya terpasang (getInstalledRelatedApps), atau akun ini
//   membuka aplikasinya dalam 14 hari terakhir (dicatat server).
// - Muncul lagi kalau aplikasinya dihapus: Chrome kembali menawarkan install,
//   atau (iPhone) aplikasinya tidak dibuka lagi selama 14 hari.
// - Tombol X menyembunyikannya 30 hari di perangkat ini.
type Variant = "leosiqra" | "input-cepat";

const FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const dismissKey = (v: Variant) => `leosiqra:install-ad-dismissed:${v}`;

const PUBLIC_PREFIXES = ["/panduan", "/catatan-keuangan", "/hubungi-kami", "/privacy", "/terms"];

type Area = "public" | "member" | "app";
function areaFor(path: string): Area | null {
  if (path === "/") return "public";
  if (path.startsWith("/panduan/shortcut-ios")) return null;
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || (p === "/catatan-keuangan" && path.startsWith(p)))) return "public";
  if (path.startsWith("/membership") && !path.startsWith("/membership/onboarding")) return "member";
  if ((path === "/app" || path.startsWith("/app/")) && !path.startsWith("/app/onboarding")) return "app";
  return null; // /install, /input-cepat, /auth, /admin, dll.
}

const recent = (iso?: string) => Boolean(iso && Date.now() - Date.parse(iso) < FRESH_MS);

const readDismissed = (v: Variant) => {
  try {
    return Date.now() - Number(localStorage.getItem(dismissKey(v)) || 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};

const tourRunning = (area: Area) => {
  try {
    if (localStorage.getItem("leosiqra_onboarding_tour") === "1") return true;
    // Tur aplikasi HP muncul sendiri di kunjungan pertama — jangan bertumpuk.
    if (area === "app" && localStorage.getItem("leosiqra_app_tour_done") !== "1") return true;
  } catch {
    /* abaikan */
  }
  return false;
};

type RelatedApp = { platform: string; url?: string; id?: string };

export function InstallBanner() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const area = areaFor(pathname);
  const { state: promptState, promptInstall } = useInstallPrompt();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [signals, setSignals] = useState<{ related: boolean; opened: { leosiqra?: string; inputCepat?: string }; ready: boolean }>({
    related: false,
    opened: {},
    ready: false,
  });
  const [closed, setClosed] = useState(false);

  // Kumpulkan sinyal "sudah terpasang" sekali: laporan Chrome + catatan akun.
  useEffect(() => {
    if (!area || isStandaloneDisplay() || isNativeApp()) return;
    let alive = true;
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
    const related = nav.getInstalledRelatedApps
      ? nav.getInstalledRelatedApps().then((apps) => apps.some((a) => a.platform === "webapp")).catch(() => false)
      : Promise.resolve(false);
    const opened = cloudflareApi<{ user?: { appsOpened?: { leosiqra?: string; inputCepat?: string } } | null }>("/api/auth/me")
      .then((r) => r.user?.appsOpened ?? {})
      .catch(() => ({}));
    // Beri waktu sebentar supaya event install dari Chrome sempat masuk, dan
    // iklan tidak langsung menutupi halaman begitu dibuka.
    const wait = new Promise((r) => setTimeout(r, 2500));
    Promise.all([related, opened, wait]).then(([rel, op]) => {
      if (alive) setSignals({ related: rel as boolean, opened: op as { leosiqra?: string; inputCepat?: string }, ready: true });
    });
    return () => {
      alive = false;
    };
  }, [area]);

  // Tentukan iklan mana yang tampil (atau tidak sama sekali).
  useEffect(() => {
    if (!area || !signals.ready) return;
    let leosiqraInstalled = signals.related || recent(signals.opened.leosiqra);
    // Chrome hanya menawarkan install kalau aplikasinya BELUM terpasang di
    // perangkat ini — sinyal paling pasti, termasuk setelah aplikasinya dihapus.
    if (promptState === "available") leosiqraInstalled = false;
    if (promptState === "installed") leosiqraInstalled = true;
    const inputCepatInstalled = recent(signals.opened.inputCepat);
    let next: Variant | null = leosiqraInstalled ? (inputCepatInstalled ? null : "input-cepat") : "leosiqra";
    if (next && (readDismissed(next) || tourRunning(area))) next = null;
    // Nilai-nilai ini bergantung pada localStorage & API browser — hanya bisa
    // dihitung setelah hydrate.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keputusan tampil berdasarkan sinyal browser
    setVariant(next);
  }, [area, signals, promptState]);

  const dismiss = () => {
    if (variant) {
      try {
        localStorage.setItem(dismissKey(variant), String(Date.now()));
      } catch {
        /* tidak tersimpan — iklan bisa muncul lagi di kunjungan berikutnya */
      }
    }
    setClosed(true);
  };

  const install = async () => {
    const result = await promptInstall();
    if (result === "accepted") setClosed(true);
    else if (result === "unavailable") router.push("/install");
  };

  const show = Boolean(area && variant && !closed);
  const isPhone = typeof navigator !== "undefined" && detectPlatform() !== "desktop";
  const ad =
    variant === "input-cepat"
      ? {
          icons: ["/images/input-cepat-192.png"],
          title: "Pasang juga Input Cepat",
          text: "Catat transaksi dalam hitungan detik langsung dari layar utama — ikonnya beda, tidak tertukar.",
          cta: "Pasang Input Cepat",
          href: "/input-cepat?install=1",
        }
      : {
          icons: ["/images/Logo-new.png", "/images/input-cepat-192.png"],
          title: isPhone ? "Pasang Leosiqra di HP ini" : "Pasang Leosiqra di HP kamu",
          text: "Buka langsung dari layar utama seperti aplikasi — gratis, tanpa Play Store, selalu versi terbaru.",
          cta: "Pasang sekarang",
          href: "/install",
        };

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          role="complementary"
          aria-label="Pasang aplikasi Leosiqra"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={cn(
            "fixed z-[45] mx-auto rounded-[24px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[1.5px] shadow-2xl shadow-indigo-900/25",
            area === "app"
              ? "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+92px)] max-w-md"
              : "inset-x-3 bottom-3 max-w-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
          )}
        >
          <div className="relative flex items-center gap-3.5 rounded-[22px] bg-white p-4 dark:bg-slate-900">
            <button
              type="button"
              onClick={dismiss}
              aria-label="Tutup iklan"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X size={15} />
            </button>
            <div className="relative flex shrink-0 items-end">
              {ad.icons.map((src, i) => (
                <motion.span
                  key={src}
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0, y: [0, -4, 0] }}
                  transition={{ scale: { type: "spring", stiffness: 300, damping: 14, delay: 0.25 + i * 0.15 }, rotate: { delay: 0.25 + i * 0.15 }, y: { duration: 2.4, repeat: Infinity, delay: 1 + i * 0.4 } }}
                  className={cn("relative block overflow-hidden rounded-[14px] bg-white shadow-lg ring-2 ring-white", i === 0 ? "h-12 w-12" : "-ml-4 h-10 w-10")}
                >
                  <Image src={src} alt="" fill sizes="48px" className="object-cover" />
                </motion.span>
              ))}
            </div>
            <div className="min-w-0 flex-1 pr-5">
              <p className="text-sm font-black text-slate-900 dark:text-white">{ad.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{ad.text}</p>
              <div className="mt-2.5 flex items-center gap-3">
                {variant === "leosiqra" && promptState === "available" ? (
                  <button type="button" onClick={install} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[12px] font-black text-white shadow-md shadow-indigo-600/30 active:scale-95">
                    <Download size={13} /> {ad.cta}
                  </button>
                ) : (
                  <Link href={ad.href} onClick={() => setClosed(true)} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[12px] font-black text-white shadow-md shadow-indigo-600/30 active:scale-95">
                    <Download size={13} /> {ad.cta}
                  </Link>
                )}
                <button type="button" onClick={dismiss} className="text-[12px] font-bold text-slate-400 hover:text-slate-600">
                  Nanti saja
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

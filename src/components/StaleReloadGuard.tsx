"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "leosiqra_last_reload_at";
const HIDDEN_AT_KEY = "leosiqra_hidden_at";
const IDLE_RELOAD_THRESHOLD_MS = 30 * 60 * 1000; // 30 menit

const isChunkLoadError = (message: string) =>
  /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    message
  );

// Menangani "halaman beku" di HP: tab yang lama tidak dibuka bisa dibekukan
// browser lalu di-resume tanpa fetch jaringan baru (DOM lama tampil tapi tidak
// responsif), atau HTML lama tersimpan merujuk ke file JS yang sudah dihapus
// server gara-gara deploy baru (chunk 404 -> React tidak pernah hydrate).
// Reload penuh menyembuhkan keduanya; guard sessionStorage mencegah reload
// berulang tanpa henti kalau ternyata deploy-nya sendiri yang rusak.
export default function StaleReloadGuard() {
  useEffect(() => {
    const reloadOnce = () => {
      const last = sessionStorage.getItem(RELOAD_GUARD_KEY);
      if (last && Date.now() - Number(last) < 10_000) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message || "")) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const message =
        (event.reason && (event.reason as { message?: string }).message) ||
        String(event.reason ?? "");
      if (isChunkLoadError(message)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
        return;
      }
      const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT_KEY) || 0);
      if (hiddenAt && Date.now() - hiddenAt > IDLE_RELOAD_THRESHOLD_MS) {
        window.location.reload();
      }
    };
    // `pageshow` menangkap kasus tab dipulihkan dari bfcache (event.persisted).
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onVisibilityChange();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}

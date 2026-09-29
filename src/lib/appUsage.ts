"use client";

import { cloudflareApi } from "@/lib/cloudflare-api";
import { isStandaloneDisplay } from "@/lib/pushNotifications";

export type InstalledApp = "leosiqra" | "input-cepat";

const REPORT_EVERY_MS = 12 * 60 * 60 * 1000;

// Dipanggil saat aplikasi terpasang dibuka (mode standalone). Server menyimpan
// waktunya per akun, sehingga iklan "pasang aplikasi" di browser tidak tampil
// ke akun yang masih memakai aplikasinya — dan muncul lagi kalau aplikasinya
// lama tidak dibuka (kemungkinan sudah dihapus). Dibatasi ±sekali per 12 jam.
export function reportAppOpened(app: InstalledApp) {
  if (typeof window === "undefined" || !isStandaloneDisplay()) return;
  const key = `leosiqra:app-opened-reported:${app}`;
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < REPORT_EVERY_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage diblokir — tetap kirim, server yang menyimpan */
  }
  cloudflareApi("/api/member/app-opened", { method: "POST", json: { app } }).catch(() => {
    /* tidak penting kalau gagal — dicoba lagi saat dibuka berikutnya */
  });
}

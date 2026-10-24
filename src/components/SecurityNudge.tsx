"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { cn } from "@/lib/utils";

// Tawaran verifikasi 2 langkah. Daftar tidak lagi memaksa 2FA, jadi kartu ini
// muncul di Beranda/Dashboard mulai 3 hari setelah user pertama terlihat di
// perangkat ini, selama 2FA belum aktif. "Nanti saja" menyembunyikannya 30 hari.
// Catatan disimpan per perangkat (localStorage) — cukup untuk pengingat lembut.
const DAY = 86_400_000;
const FIRST_SEEN_DELAY = 3 * DAY;
const SNOOZE = 30 * DAY;

const readNum = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const writeNum = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage diblokir — kartu cukup tampil lagi nanti */
  }
};

export function SecurityNudge({ className }: { className?: string }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    cloudflareApi<{ user?: { id?: string; twoFactorEnabled?: boolean; hasPassword?: boolean } | null }>("/api/auth/me")
      .then(({ user }) => {
        // Akun Google tanpa password lokal: 2FA tidak melindungi apa pun di sini.
        if (!active || !user?.id || user.twoFactorEnabled || user.hasPassword === false) return;
        const now = Date.now();
        const seenKey = `leo-2fa-seen:${user.id}`;
        const first = readNum(seenKey);
        if (!first) {
          writeNum(seenKey, now);
          return;
        }
        if (now - first < FIRST_SEEN_DELAY || now < readNum(`leo-2fa-snooze:${user.id}`)) return;
        setUserId(user.id);
      })
      .catch(() => {
        /* pelengkap — gagal muat cukup disembunyikan */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!userId) return null;

  const snooze = () => {
    writeNum(`leo-2fa-snooze:${userId}`, Date.now() + SNOOZE);
    setUserId(null);
  };

  return (
    <div className={cn("relative flex gap-3 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 p-4 pr-10", className)}>
      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
        <ShieldCheck size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Amankan akunmu dengan verifikasi 2 langkah</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          Walau password-mu bocor, akun tetap aman — masuk butuh kode dari aplikasi Authenticator di HP-mu.
        </p>
        <div className="flex items-center gap-3 mt-2.5">
          <Link
            href="/membership/profile?tab=keamanan"
            className="inline-flex items-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            Aktifkan sekarang
          </Link>
          <button type="button" onClick={snooze} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">
            Nanti saja
          </button>
        </div>
      </div>
      <button type="button" onClick={snooze} aria-label="Tutup" className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:text-slate-600">
        <X size={16} />
      </button>
    </div>
  );
}

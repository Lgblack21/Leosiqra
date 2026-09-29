"use client";

import { useSyncExternalStore } from "react";
import { isStandaloneDisplay } from "@/lib/pushNotifications";

// Event install PWA dari Chrome/Edge/Samsung Internet. Belum ada tipe standar
// di lib.dom, jadi didefinisikan seperlunya.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chrome memancarkan `beforeinstallprompt` SEKALI, di awal halaman. Kalau
// belum ada yang mendengarkan saat itu, kesempatannya hilang — makanya
// ditangkap di root (InstallPromptCatcher) dan disimpan di sini, lalu dibaca
// tombol install mana pun lewat useInstallPrompt.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let started = false;
export function startInstallPromptCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // tahan dulu; ditampilkan saat user menekan tombol kita
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

type Snapshot = "available" | "installed" | "unavailable";
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = (): Snapshot => (installed ? "installed" : deferred ? "available" : "unavailable");

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => "unavailable" as Snapshot);
  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const ev = deferred;
    if (!ev) return "unavailable";
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null; // satu event hanya bisa dipakai sekali
    if (outcome === "accepted") installed = true;
    notify();
    return outcome;
  };
  return { state, promptInstall };
}

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku sebagai Mac — kenali dari layar sentuh.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// Browser bawaan aplikasi lain (Instagram, Facebook, TikTok, LINE, WhatsApp…)
// tidak bisa memasang aplikasi — user harus membuka di Chrome/Safari dulu.
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined" || isNativeApp()) return false;
  return /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Twitter|WhatsApp|; wv\)/i.test(navigator.userAgent);
}

// Aplikasi native Leosiqra (Capacitor/APK) — sudah berupa aplikasi, tidak
// perlu (dan tidak bisa) dipasang lagi sebagai PWA.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export { isStandaloneDisplay };

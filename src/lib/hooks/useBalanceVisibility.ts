"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "leosiqra-balance-hidden";
const listeners = new Set<() => void>();

// useState lokal per-komponen gak cukup di sini — BalanceCard, WalletList,
// dan halaman Wallet masing-masing manggil hook ini secara independen, dan
// nulis ke localStorage TIDAK otomatis nge-trigger re-render komponen lain
// di halaman yang sama (beda dari event `storage` yang cuma nyala antar
// tab/window). useSyncExternalStore + pub/sub kecil ini yang bikin semua
// instance ke-notify begitu salah satu toggle.
const getSnapshot = () => (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1");
const getServerSnapshot = () => false;

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notify = () => {
  listeners.forEach((listener) => listener());
};

export function useBalanceVisibility() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next = !hidden;
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    notify();
  };

  return [hidden, toggle] as const;
}

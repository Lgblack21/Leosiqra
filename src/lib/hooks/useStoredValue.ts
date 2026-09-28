"use client";

import { useCallback, useSyncExternalStore } from "react";

// Nilai string di localStorage yang dibaca lewat useSyncExternalStore (pola
// sama dengan useBalanceVisibility): saat prerender statis nilainya null, di
// browser langsung nilai tersimpan — tanpa setState di useEffect yang bikin
// render dobel. Semua pemakai key yang sama ikut ter-update saat ditulis.
const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // mode privat / storage diblokir
  }
};

export function useStoredValue(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );

  const setValue = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* storage diblokir: pilihan tidak tersimpan, tampilan tetap nilai default */
      }
      listeners.forEach((listener) => listener());
    },
    [key]
  );

  return [value, setValue] as const;
}

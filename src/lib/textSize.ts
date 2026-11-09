'use client';

import { useSyncExternalStore } from 'react';
import { TEXT_SIZE_KEY } from '@/lib/textSizeBoot';

export { TEXT_SIZE_KEY };

// Ukuran teks (Pengaturan → Tampilan). Disimpan per perangkat; diterapkan sebagai data-teks di <html>
// oleh skrip kecil di <head> (src/app/layout.tsx) supaya tidak berkedip saat halaman dibuka.
// Skalanya ada di globals.css (--fs / --fs-h).
export type TextSize = 'kecil' | 'sedang' | 'besar';
export const TEXT_SIZES: { id: TextSize; label: string; desc: string }[] = [
  { id: 'kecil', label: 'Kecil', desc: 'Paling ringkas — lebih banyak isi muat di layar.' },
  { id: 'sedang', label: 'Sedang', desc: 'Seimbang untuk sehari-hari (bawaan).' },
  { id: 'besar', label: 'Besar', desc: 'Lebih mudah dibaca.' },
];
export const TEXT_SIZE_LABEL: Record<TextSize, string> = { kecil: 'Kecil', sedang: 'Sedang', besar: 'Besar' };

const read = (): TextSize => {
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    return v === 'kecil' || v === 'besar' ? v : 'sedang';
  } catch {
    return 'sedang';
  }
};
const apply = (v: TextSize) => {
  if (v === 'sedang') delete document.documentElement.dataset.teks;
  else document.documentElement.dataset.teks = v;
};

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  // Diubah di tab lain → ikut berubah di sini.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== TEXT_SIZE_KEY) return;
    apply(read());
    cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};

export function useTextSize() {
  // Server/prerender selalu 'sedang'; di browser dibaca dari penyimpanan perangkat.
  const size = useSyncExternalStore<TextSize>(subscribe, read, () => 'sedang');
  const setSize = (v: TextSize) => {
    try {
      if (v === 'sedang') localStorage.removeItem(TEXT_SIZE_KEY);
      else localStorage.setItem(TEXT_SIZE_KEY, v);
    } catch {
      /* penyimpanan diblokir — tetap berlaku sampai halaman ditutup */
    }
    apply(v);
    listeners.forEach((l) => l());
  };
  return { size, setSize };
}

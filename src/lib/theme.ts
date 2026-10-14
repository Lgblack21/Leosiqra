"use client";

import { useEffect } from 'react';
import { useStoredValue } from '@/lib/hooks/useStoredValue';

// Tema web member: 'light' | 'dark' | 'system'. Disimpan per perangkat.
// data-theme dipasang di <html> hanya di halaman /membership (lihat juga
// skrip kecil di app/layout.tsx yang memasangnya sebelum render, anti-kedip).
import { THEME_KEY } from '@/lib/themeBoot';
export { THEME_KEY };
export type ThemePref = 'light' | 'dark' | 'system';

export function useThemePref(): [ThemePref, (t: ThemePref) => void] {
  const [v, set] = useStoredValue(THEME_KEY);
  const pref: ThemePref = v === 'dark' || v === 'system' ? v : 'light';
  return [pref, (t) => set(t)];
}

export function useApplyTheme() {
  const [pref] = useThemePref();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      if (dark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      document.documentElement.removeAttribute('data-theme');
    };
  }, [pref]);
}


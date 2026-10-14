"use client";

import { useSyncExternalStore } from 'react';

// Kostum musiman Leo: Oktober = penyihir (Halloween), Desember = Santa.
// Bisa dimatikan di Pengaturan → Tampilan (disimpan per perangkat).
export const COSTUME_KEY = 'leo-costume-off:v1';
export type Season = 'halloween' | 'natal' | null;

const noop = () => () => {};
const read = (): Season => {
  try {
    if (localStorage.getItem(COSTUME_KEY) === '1') return null;
  } catch {}
  const m = new Date().getMonth();
  return m === 9 ? 'halloween' : m === 11 ? 'natal' : null;
};
// Saat prerender: tanpa kostum (hindari hydration mismatch).
export const useSeason = () => useSyncExternalStore(noop, read, () => null);

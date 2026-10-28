"use client";

import { useCallback, useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';
import { useModal } from '@/context/ModalContext';

// Preferensi cara mencatat (prefs.inputMode & prefs.amountKeypad) — satu
// salinan di memori dibagi panel Pengaturan, tombol + dan kolom nominal.
export type InputMode = 'ketik' | 'suara' | 'foto';
export type AmountKeypad = 'standar' | 'kalkulator';
type RecordingPrefs = { inputMode: InputMode; amountKeypad: AmountKeypad };

const EVENT = 'leosiqra:recording-prefs';
const DEFAULTS: RecordingPrefs = { inputMode: 'ketik', amountKeypad: 'standar' };
let shared: RecordingPrefs | null = null;
let loading: Promise<RecordingPrefs> | null = null;

const load = () => {
  loading ??= cloudflareApi<{ item?: { inputMode?: InputMode | null; amountKeypad?: AmountKeypad } }>('/api/member/preferences')
    .then((r) => (shared = { inputMode: r.item?.inputMode ?? 'ketik', amountKeypad: r.item?.amountKeypad ?? 'standar' }))
    .catch(() => {
      loading = null;
      return DEFAULTS;
    });
  return loading;
};

const publish = (next: RecordingPrefs) => {
  shared = next;
  window.dispatchEvent(new CustomEvent<RecordingPrefs>(EVENT, { detail: next }));
};

export function useRecordingPrefs() {
  const [prefs, setPrefs] = useState<RecordingPrefs>(shared ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    void load().then((p) => alive && setPrefs(p));
    const onChange = (e: Event) => setPrefs((e as CustomEvent<RecordingPrefs>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  const save = useCallback(async (patch: Partial<RecordingPrefs>) => {
    const before = shared ?? DEFAULTS;
    publish({ ...before, ...patch });
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: patch });
    } catch (e) {
      publish(before);
      throw e;
    }
  }, []);
  return { ...prefs, save };
}

// Tombol "+" utama: buka cara catat pilihan user.
export function usePrimaryAdd() {
  const { inputMode } = useRecordingPrefs();
  const { openModal } = useModal();
  return useCallback(() => {
    // Navigasi penuh (bukan router.push): Input Cepat membaca ?mulai= saat
    // dimuat — lewat router.push query-nya belum terbaca di render pertama.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (inputMode === 'suara' || inputMode === 'foto') window.location.href = `/input-cepat?mulai=${inputMode}`;
    else openModal('harian');
  }, [inputMode, openModal]);
}

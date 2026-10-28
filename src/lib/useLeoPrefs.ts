"use client";

import { useCallback, useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';

// Preferensi maskot (prefs.showMascot & prefs.seasonal) — satu salinan di
// memori dibagi panel Pengaturan, Ringkasan & kartu Profil. Pola sama dengan
// useRecordingPrefs.
type LeoPrefs = { showMascot: boolean; seasonal: boolean };

const EVENT = 'leosiqra:leo-prefs';
const DEFAULTS: LeoPrefs = { showMascot: true, seasonal: true };
let shared: LeoPrefs | null = null;
let loading: Promise<LeoPrefs> | null = null;

const load = () => {
  loading ??= cloudflareApi<{ item?: Partial<LeoPrefs> }>('/api/member/preferences')
    .then((r) => (shared = { showMascot: r.item?.showMascot !== false, seasonal: r.item?.seasonal !== false }))
    .catch(() => {
      loading = null;
      return DEFAULTS;
    });
  return loading;
};

const publish = (next: LeoPrefs) => {
  shared = next;
  window.dispatchEvent(new CustomEvent<LeoPrefs>(EVENT, { detail: next }));
};

export function useLeoPrefs() {
  const [prefs, setPrefs] = useState<LeoPrefs>(shared ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    void load().then((p) => alive && setPrefs(p));
    const onChange = (e: Event) => setPrefs((e as CustomEvent<LeoPrefs>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  const save = useCallback(async (patch: Partial<LeoPrefs>) => {
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

"use client";

import { useCallback, useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';
import { DEFAULT_FEATURES, isShownFeature, type FeatureId } from './features';

// Fitur aktif user (urutan = urutan di menu samping). Disimpan di server
// ($.prefs.features); satu salinan di memori dibagi Sidebar & panel Fitur
// supaya perubahan langsung terlihat di keduanya tanpa muat ulang.

const EVENT = 'leosiqra:features-changed';
let shared: FeatureId[] | null = null;
let loading: Promise<FeatureId[]> | null = null;

const load = () => {
  loading ??= cloudflareApi<{ item?: { features?: FeatureId[] | null } }>('/api/member/preferences')
    // Id fitur yang sudah dihapus (mis. 'kartu') dibuang supaya hitungan & menu pas.
    .then((r) => (shared = (r.item?.features ?? DEFAULT_FEATURES).filter(isShownFeature)))
    .catch(() => {
      loading = null;
      return DEFAULT_FEATURES;
    });
  return loading;
};

// Ambil ulang dari server (panel Fitur dibuka / tab aktif lagi) — perubahan
// dari perangkat atau tab lain tidak tertinggal. Tidak menimpa saat ada simpan
// yang sedang berjalan.
let saving = 0;
const refresh = async () => {
  if (saving) return;
  try {
    const r = await cloudflareApi<{ item?: { features?: FeatureId[] | null } }>('/api/member/preferences');
    if (saving) return;
    const ids = (r.item?.features ?? DEFAULT_FEATURES).filter(isShownFeature);
    loading = Promise.resolve(ids);
    if (!shared || ids.join() !== shared.join()) publish(ids);
  } catch {
    /* offline — pakai yang ada */
  }
};

const publish = (ids: FeatureId[]) => {
  shared = ids;
  window.dispatchEvent(new CustomEvent<FeatureId[]>(EVENT, { detail: ids }));
};

export function useFeatures() {
  const [active, setActive] = useState<FeatureId[]>(shared ?? DEFAULT_FEATURES);
  const [ready, setReady] = useState(shared !== null);

  useEffect(() => {
    let alive = true;
    void load().then((ids) => {
      if (!alive) return;
      setActive(ids);
      setReady(true);
    });
    const onChange = (e: Event) => setActive((e as CustomEvent<FeatureId[]>).detail);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener(EVENT, onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Optimistis: menu langsung berubah, dikembalikan kalau server menolak.
  const save = useCallback(async (next: FeatureId[]) => {
    const before = shared ?? DEFAULT_FEATURES;
    publish(next);
    saving += 1;
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { features: next } });
    } catch (e) {
      publish(before);
      throw e;
    } finally {
      saving -= 1;
    }
  }, []);

  return { active, ready, save, refresh };
}

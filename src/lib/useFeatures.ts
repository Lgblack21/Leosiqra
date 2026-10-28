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
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  // Optimistis: menu langsung berubah, dikembalikan kalau server menolak.
  const save = useCallback(async (next: FeatureId[]) => {
    const before = shared ?? DEFAULT_FEATURES;
    publish(next);
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { features: next } });
    } catch (e) {
      publish(before);
      throw e;
    }
  }, []);

  return { active, ready, save };
}

"use client";

import { useCallback, useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';

// Awal periode anggaran (1–28) dari preferensi akun; satu salinan di memori
// dibagi semua tampilan anggaran supaya perubahan langsung terlihat.
const EVENT = 'leosiqra:budget-start-day';
let shared: number | null = null;
let loading: Promise<number> | null = null;

const load = () => {
  loading ??= cloudflareApi<{ item?: { budgetStartDay?: number } }>('/api/member/preferences')
    .then((r) => (shared = r.item?.budgetStartDay ?? 1))
    .catch(() => {
      loading = null;
      return 1;
    });
  return loading;
};

const publish = (day: number) => {
  shared = day;
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: day }));
};

export function useBudgetStartDay() {
  const [day, setDay] = useState(shared ?? 1);
  useEffect(() => {
    let alive = true;
    void load().then((d) => alive && setDay(d));
    const onChange = (e: Event) => setDay((e as CustomEvent<number>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  const save = useCallback(async (next: number) => {
    const before = shared ?? 1;
    publish(next);
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { budgetStartDay: next } });
    } catch (e) {
      publish(before);
      throw e;
    }
  }, []);
  return { day, save };
}

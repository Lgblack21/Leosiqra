"use client";

import { useCallback, useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';

// Tag transaksi (prefs.tags): nyala/mati + daftar tag berwarna. Satu salinan
// di memori dibagi panel Pengaturan, form transaksi & Riwayat.
export type TagItem = { name: string; color: string };
export type TagsPref = { enabled: boolean; list: TagItem[] };

// Warna = CATEGORY_COLORS di Worker; kelas Tailwind ditulis utuh supaya ikut ter-build.
export const TAG_COLORS: Record<string, { dot: string; chip: string }> = {
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  sky: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
  indigo: { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  teal: { dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 ring-teal-200' },
  green: { dot: 'bg-green-500', chip: 'bg-green-50 text-green-700 ring-green-200' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  red: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200' },
  pink: { dot: 'bg-pink-500', chip: 'bg-pink-50 text-pink-700 ring-pink-200' },
  purple: { dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 ring-purple-200' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  slate: { dot: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700 ring-slate-200' },
};
export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS);
export const TAG_MAX_PER_TX = 5;
export const tagStyle = (color?: string) => TAG_COLORS[color ?? ''] ?? TAG_COLORS.slate;

const EVENT = 'leosiqra:tags-changed';
const EMPTY: TagsPref = { enabled: false, list: [] };
let shared: TagsPref | null = null;
let loading: Promise<TagsPref> | null = null;

const load = () => {
  loading ??= cloudflareApi<{ item?: { tags?: TagsPref } }>('/api/member/preferences')
    .then((r) => (shared = r.item?.tags ?? EMPTY))
    .catch(() => {
      loading = null;
      return EMPTY;
    });
  return loading;
};

const publish = (next: TagsPref) => {
  shared = next;
  window.dispatchEvent(new CustomEvent<TagsPref>(EVENT, { detail: next }));
};

export function useTags() {
  const [tags, setTags] = useState<TagsPref>(shared ?? EMPTY);
  useEffect(() => {
    let alive = true;
    void load().then((t) => alive && setTags(t));
    const onChange = (e: Event) => setTags((e as CustomEvent<TagsPref>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  // Optimistis; dikembalikan kalau server menolak.
  const save = useCallback(async (next: TagsPref) => {
    const before = shared ?? EMPTY;
    publish(next);
    try {
      const r = await cloudflareApi<{ item?: { tags?: TagsPref } }>('/api/member/preferences', { method: 'PUT', json: { tags: next } });
      if (r.item?.tags) publish(r.item.tags);
    } catch (e) {
      publish(before);
      throw e;
    }
  }, []);
  const colorOf = useCallback((name: string) => (shared ?? tags).list.find((t) => t.name.toLowerCase() === name.toLowerCase())?.color, [tags]);
  return { tags, save, colorOf };
}

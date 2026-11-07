'use client';

import { cloudflareApi } from '@/lib/cloudflare-api';

// Cerita Hari Ini — layanan API (/api/member/stories). Lihat handleMemberStories di Worker.
export type StoryMood = 1 | 2 | 3 | 4 | 5;
export type StoryListItem = {
  date: string;
  mood: StoryMood | null;
  text: string | null;
  has_photo: 0 | 1;
  has_ai: 0 | 1;
  updated_at: string;
};
export type StoryYear = {
  items: StoryListItem[];
  spend: Record<string, number>;
  streak: number;
  total: number;
  ready: boolean;
};
export type StoryDay = {
  story: {
    date: string;
    mood: StoryMood | null;
    text: string | null;
    has_photo: boolean;
    has_ai: boolean;
    updated_at: string;
  } | null;
  summary: { out: number; in: number; count: number; focusSec: number };
  ai: { freeLeft: number; freePerDay: number; price: number; coins: number };
};

// Mood bertema cuaca (bukan "Berat/Lesu/Biasa/…"): warna dipakai kalender setahun.
export const MOODS: { id: StoryMood; label: string; emoji: string; color: string; soft: string }[] = [
  { id: 1, label: 'Badai', emoji: '⛈️', color: '#475569', soft: 'from-slate-200 to-slate-300' },
  { id: 2, label: 'Mendung', emoji: '☁️', color: '#94A3B8', soft: 'from-slate-100 to-indigo-100' },
  { id: 3, label: 'Berawan', emoji: '⛅', color: '#38BDF8', soft: 'from-sky-100 to-cyan-100' },
  { id: 4, label: 'Cerah', emoji: '☀️', color: '#FBBF24', soft: 'from-amber-100 to-yellow-100' },
  { id: 5, label: 'Pelangi', emoji: '🌈', color: '#F472B6', soft: 'from-pink-100 via-violet-100 to-sky-100' },
];
// Gaya ilustrasi AI (foto → ilustrasi, atau dari tulisan).
export type StoryStyle = 'anime' | 'kartun' | 'chibi' | 'catair';
export const STYLES: { id: StoryStyle; label: string; emoji: string }[] = [
  { id: 'anime', label: 'Anime', emoji: '🌸' },
  { id: 'kartun', label: 'Kartun 3D', emoji: '🧸' },
  { id: 'chibi', label: 'Chibi', emoji: '🍡' },
  { id: 'catair', label: 'Cat air', emoji: '🎨' },
];
export const moodOf = (m: number | null | undefined) => MOODS.find((x) => x.id === m) ?? null;

export const wibToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const longDate = (date: string, withYear = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

export const storyImageUrl = (date: string, kind: 'photo' | 'ai', v: string) =>
  `/api/member/stories/${date}/${kind}?v=${encodeURIComponent(v)}`;

export const storyService = {
  year: (year: string) => cloudflareApi<StoryYear>(`/api/member/stories?year=${year}`, { cache: 'no-store' }),
  day: (date: string) => cloudflareApi<StoryDay>(`/api/member/stories/${date}`, { cache: 'no-store' }),
  save: (date: string, body: { mood?: StoryMood | null; text?: string }) =>
    cloudflareApi<{ ok: true }>(`/api/member/stories/${date}`, { method: 'PUT', json: body }),
  remove: (date: string) => cloudflareApi<{ ok: true }>(`/api/member/stories/${date}`, { method: 'DELETE' }),
  setPhoto: (date: string, imageBase64: string) =>
    cloudflareApi<{ ok: true }>(`/api/member/stories/${date}/photo`, { method: 'PUT', json: { imageBase64 } }),
  removeImage: (date: string, kind: 'photo' | 'ai') =>
    cloudflareApi<{ ok: true }>(`/api/member/stories/${date}/${kind}`, { method: 'DELETE' }),
  makeAi: (date: string, style: StoryStyle) =>
    cloudflareApi<{ ok: true; charged: 'free' | 'coin'; ai: StoryDay['ai'] }>(`/api/member/stories/${date}/ai`, {
      method: 'POST',
      json: { style },
    }),
};

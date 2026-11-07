'use client';

import type { FocusTrack } from './audio';

// Fokus bareng Leo — keadaan timer, pengaturan & riwayat sesi.
// Timer dihitung dari waktu selesai (endsAt), BUKAN hitung mundur per detik: tetap tepat
// walau tab di belakang, layar mati, atau halaman dimuat ulang. Disimpan di localStorage
// (event "storage" menyamakan tab lain). Riwayat → server (/api/member/focus); kalau
// server belum siap / offline, sesi antre di perangkat lalu dikirim ulang.

export type FocusKind = 'belajar' | 'kerja' | 'baca' | 'usaha' | 'lainnya';
export const FOCUS_KINDS: { id: FocusKind; label: string; emoji: string }[] = [
  { id: 'belajar', label: 'Belajar', emoji: '✏️' },
  { id: 'kerja', label: 'Kerja', emoji: '💻' },
  { id: 'baca', label: 'Baca', emoji: '📖' },
  { id: 'usaha', label: 'Usaha', emoji: '🧾' },
  { id: 'lainnya', label: 'Lainnya', emoji: '✨' },
];

export type FocusSettings = {
  kind: FocusKind;
  minutes: number;
  breakMin: number;
  longBreakMin: number;
  longEvery: number;
  autoBreak: boolean;
  autoNext: boolean;
  track: FocusTrack | null; // null = hening
  volume: number;
  musicInBreak: boolean;
  keepAwake: boolean;
  notify: boolean;
};
export const DEFAULT_SETTINGS: FocusSettings = {
  kind: 'kerja',
  minutes: 25,
  breakMin: 5,
  longBreakMin: 15,
  longEvery: 4,
  autoBreak: true,
  autoNext: false,
  track: 'lofi',
  volume: 0.55,
  musicInBreak: false,
  keepAwake: true,
  notify: true,
};

export type FocusRun = {
  phase: 'focus' | 'break';
  long: boolean;
  sessionId: string;
  kind: FocusKind;
  label: string;
  minutes: number; // durasi rencana fase ini (menit)
  startedAt: number;
  endsAt: number;
  pausedAt: number | null;
  pausedMs: number;
  cycle: number; // jumlah sesi fokus selesai dalam rangkaian ini
};

export type FocusSession = {
  id: string;
  kind: FocusKind;
  label: string | null;
  planned_min: number;
  focus_sec: number;
  completed: 0 | 1;
  started_at: string;
  ended_at: string;
  date: string;
};

const K_SETTINGS = 'leosiqra:focus:settings';
const K_RUN = 'leosiqra:focus:run';
const K_SESSIONS = 'leosiqra:focus:sessions';
const K_PENDING = 'leosiqra:focus:pending';

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan penuh / diblokir — timer tetap jalan di memori */
  }
};

export const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

export const loadSettings = (): FocusSettings => {
  const s = { ...DEFAULT_SETTINGS, ...read<Partial<FocusSettings>>(K_SETTINGS, {}) };
  return {
    ...s,
    kind: FOCUS_KINDS.some((k) => k.id === s.kind) ? s.kind : 'kerja',
    minutes: clampInt(s.minutes, 5, 180, 25),
    breakMin: clampInt(s.breakMin, 1, 30, 5),
    longBreakMin: clampInt(s.longBreakMin, 5, 60, 15),
    longEvery: clampInt(s.longEvery, 2, 8, 4),
    volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : 0.55,
  };
};
export const saveSettings = (s: FocusSettings) => write(K_SETTINGS, s);

export const loadRun = (): FocusRun | null => {
  const r = read<FocusRun | null>(K_RUN, null);
  if (!r || (r.phase !== 'focus' && r.phase !== 'break') || typeof r.endsAt !== 'number') return null;
  return r;
};
export const saveRun = (r: FocusRun | null) => write(K_RUN, r);
export const RUN_STORAGE_KEY = K_RUN;

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

/** Sisa waktu fase (ms), memperhitungkan jeda. */
export const remainingMs = (r: FocusRun, now = Date.now()) => Math.max(0, r.endsAt - (r.pausedAt ?? now));
/** Waktu fokus yang benar-benar berjalan (detik), tanpa jeda. */
export const elapsedSec = (r: FocusRun, at = Date.now()) => {
  const end = Math.min(r.pausedAt ?? at, r.endsAt);
  return Math.max(0, Math.round((end - r.startedAt - r.pausedMs) / 1000));
};

export const wibDate = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
export const todayWib = () => wibDate(Date.now());

// ── Riwayat ────────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
export const subscribeSessions = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());

let serverReady: boolean | null = null;
export const isServerReady = () => serverReady;

const sortSessions = (list: FocusSession[]) => [...list].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
const keep90 = (list: FocusSession[]) => {
  const since = wibDate(Date.now() - 90 * 86400_000);
  return list.filter((s) => s.date >= since).slice(0, 1000);
};
export const localSessions = (): FocusSession[] => read<FocusSession[]>(K_SESSIONS, []);
const pendingIds = () => new Set(read<string[]>(K_PENDING, []));

async function post(s: FocusSession) {
  const res = await fetch('/api/member/focus', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: s.id,
      kind: s.kind,
      label: s.label,
      planned_min: s.planned_min,
      focus_sec: s.focus_sec,
      completed: s.completed === 1,
      started_at: s.started_at,
      ended_at: s.ended_at,
    }),
  });
  return res.status;
}

let flushing: Promise<void> | null = null;
/** Kirim sesi yang masih antre di perangkat. Aman dipanggil berkali-kali. */
export const flushPending = () => {
  if (flushing) return flushing;
  flushing = (async () => {
    const pending = pendingIds();
    if (!pending.size) return;
    const all = localSessions();
    for (const id of [...pending]) {
      const s = all.find((x) => x.id === id);
      if (!s) {
        pending.delete(id);
        continue;
      }
      try {
        const status = await post(s);
        if (status === 200 || status === 201) {
          pending.delete(id);
          serverReady = true;
        } else if (status === 400)
          pending.delete(id); // data tidak valid → jangan diulang terus
        else if (status === 503) {
          serverReady = false;
          break;
        } else break; // offline / sesi habis → coba lagi nanti
      } catch {
        break;
      }
    }
    write(K_PENDING, [...pending]);
  })().finally(() => {
    flushing = null;
    emit();
  });
  return flushing;
};

/** Ambil riwayat dari server (gabung dengan yang masih antre). */
export const syncSessions = async () => {
  await flushPending();
  try {
    const res = await fetch('/api/member/focus', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return localSessions();
    const data = (await res.json()) as { items?: FocusSession[]; ready?: boolean };
    serverReady = data.ready !== false;
    if (!serverReady) {
      emit();
      return localSessions();
    }
    const pending = pendingIds();
    const stillPending = localSessions().filter((s) => pending.has(s.id));
    const merged = keep90(sortSessions([...(data.items ?? []).filter((s) => !pending.has(s.id)), ...stillPending]));
    write(K_SESSIONS, merged);
    emit();
    return merged;
  } catch {
    return localSessions();
  }
};

/** Catat satu sesi (selesai / dihentikan). Id = id run → tab lain/ulang tidak dobel. */
export const recordSession = (s: FocusSession) => {
  const list = localSessions();
  if (list.some((x) => x.id === s.id)) return;
  write(K_SESSIONS, keep90(sortSessions([s, ...list])));
  const pending = pendingIds();
  pending.add(s.id);
  write(K_PENDING, [...pending]);
  emit();
  void flushPending();
};

export const deleteSession = async (id: string) => {
  const pending = pendingIds();
  if (!pending.has(id)) {
    const res = await fetch(`/api/member/focus/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok && res.status !== 404)
      throw new Error(res.status === 503 ? 'Rekap belum aktif di server.' : 'Gagal menghapus sesi.');
  } else {
    pending.delete(id);
    write(K_PENDING, [...pending]);
  }
  write(
    K_SESSIONS,
    localSessions().filter((s) => s.id !== id),
  );
  emit();
};

// ── Ringkasan Rekap ────────────────────────────────────────────────────────
export const summarize = (list: FocusSession[]) => {
  const today = todayWib();
  const byDate = new Map<string, number>();
  for (const s of list) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.focus_sec);
  const todayList = list.filter((s) => s.date === today);
  // Beruntun: hari berturut-turut dengan ≥ 10 menit fokus, sampai hari ini (atau kemarin).
  let streak = 0;
  for (let d = 0; d < 400; d++) {
    const key = wibDate(Date.now() - d * 86400_000);
    if ((byDate.get(key) ?? 0) >= 600) streak += 1;
    else if (d > 0) break;
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const ms = Date.now() - (6 - i) * 86400_000;
    const key = wibDate(ms);
    return {
      date: key,
      label: new Date(ms + 7 * 3600_000).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' }),
      sec: byDate.get(key) ?? 0,
    };
  });
  const weekSet = new Set(week.map((w) => w.date));
  const byKind = new Map<FocusKind, number>();
  for (const s of list) if (weekSet.has(s.date)) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + s.focus_sec);
  return {
    todaySec: todayList.reduce((a, s) => a + s.focus_sec, 0),
    todayDone: todayList.filter((s) => s.completed).length,
    streak,
    week,
    weekSec: week.reduce((a, w) => a + w.sec, 0),
    byKind: [...byKind].sort((a, b) => b[1] - a[1]),
  };
};

export const fmtMin = (sec: number) => {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  return `${h} j${m % 60 ? ` ${m % 60} mnt` : ''}`;
};
export const fmtClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

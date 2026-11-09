import { cloudflareApi } from '@/lib/cloudflare-api';
import type { FitProfile } from './types';

// Olahragaku — data di akun (/api/member/fit, migrasi 0044). Tabel belum ada (ready:false / 503) →
// profil & timbangan disimpan di perangkat (localStorage) seperti Kanvas & Pajak Center.

export type Timbangan = { date: string; kg: number; waist_cm: number | null };
export type FitData = {
  ready: boolean;
  where: 'akun' | 'perangkat';
  pro: boolean;
  today: string;
  profile: FitProfile | null;
  weights: Timbangan[]; // terbaru dulu
  historyDays: number | null; // FREE: 7, PRO: null (semua)
  prefill: Partial<FitProfile> & { fromCheck?: string };
};

const LOCAL = 'leosiqra-olahraga';
type Local = { profile: FitProfile | null; weights: Timbangan[] };
const readLocal = (): Local => {
  try {
    const raw = window.localStorage.getItem(LOCAL);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Local>;
      return { profile: v.profile ?? null, weights: Array.isArray(v.weights) ? v.weights : [] };
    }
  } catch {
    /* storage diblokir */
  }
  return { profile: null, weights: [] };
};
const writeLocal = (v: Local) => {
  try {
    window.localStorage.setItem(LOCAL, JSON.stringify(v));
  } catch {
    /* storage diblokir */
  }
};
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const upsertLocalWeight = (list: Timbangan[], w: Timbangan) =>
  [w, ...list.filter((x) => x.date !== w.date)].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 800);

type Raw = {
  ready: boolean;
  pro?: boolean;
  today?: string;
  profile: FitProfile | null;
  weights: Timbangan[];
  history_days?: number | null;
  prefill?: FitData['prefill'] | null;
};

export async function loadFit(): Promise<FitData> {
  const local = readLocal();
  try {
    const r = await cloudflareApi<Raw>('/api/member/fit', { cache: 'no-store' });
    if (r.ready) {
      return {
        ready: true,
        where: 'akun',
        pro: Boolean(r.pro),
        today: r.today ?? todayWib(),
        profile: r.profile,
        weights: r.weights ?? [],
        historyDays: r.history_days ?? null,
        prefill: { ...(r.prefill ?? {}), ...(local.profile ?? {}) },
      };
    }
    return {
      ready: false,
      where: 'perangkat',
      pro: false,
      today: todayWib(),
      profile: local.profile,
      weights: local.weights,
      historyDays: null,
      prefill: r.prefill ?? {},
    };
  } catch {
    return {
      ready: false,
      where: 'perangkat',
      pro: false,
      today: todayWib(),
      profile: local.profile,
      weights: local.weights,
      historyDays: null,
      prefill: {},
    };
  }
}

// Akun dulu; gagal (tabel belum ada / jaringan) → perangkat. Error validasi (400) diteruskan ke pemanggil.
async function toAccountOrLocal(run: () => Promise<unknown>, local: () => void): Promise<'akun' | 'perangkat'> {
  try {
    await run();
    return 'akun';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/belum aktif|Failed to fetch|NetworkError|jaringan/i.test(msg)) {
      local();
      return 'perangkat';
    }
    throw e;
  }
}

export const saveProfile = (p: FitProfile) =>
  toAccountOrLocal(
    () => cloudflareApi('/api/member/fit/profile', { method: 'PUT', json: { profile: p } }),
    () => {
      const l = readLocal();
      writeLocal({
        profile: p,
        weights: upsertLocalWeight(l.weights, { date: todayWib(), kg: p.weightKg, waist_cm: p.waistCm }),
      });
    },
  );

export const saveWeight = (w: Timbangan) =>
  toAccountOrLocal(
    () => cloudflareApi('/api/member/fit/weights', { method: 'POST', json: w }),
    () => {
      const l = readLocal();
      writeLocal({ ...l, weights: upsertLocalWeight(l.weights, w) });
    },
  );

export const deleteWeight = (date: string) =>
  toAccountOrLocal(
    () => cloudflareApi(`/api/member/fit/weights/${date}`, { method: 'DELETE' }),
    () => {
      const l = readLocal();
      writeLocal({ ...l, weights: l.weights.filter((x) => x.date !== date) });
    },
  );

export async function deleteAllFit() {
  writeLocal({ profile: null, weights: [] });
  try {
    await cloudflareApi('/api/member/fit', { method: 'DELETE' });
  } catch {
    /* tabel belum ada → tidak ada data di akun */
  }
}

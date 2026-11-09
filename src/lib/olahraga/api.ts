import { cloudflareApi } from '@/lib/cloudflare-api';
import { KERJA_DEFAULT, type Evaluasi, type FitKerja, type LatihanItem, type MenuHarian, type Plan } from './program';
import type { FitProfile, MetodeKey } from './types';

// Olahragaku — data di akun (/api/member/fit, migrasi 0044). Tabel belum ada (ready:false / 503) →
// profil & timbangan disimpan di perangkat (localStorage) seperti Kanvas & Pajak Center.

export type Timbangan = { date: string; kg: number; waist_cm: number | null };
export type Latihan = {
  id: string;
  date: string;
  program_id: string | null;
  kind: 'program' | 'bebas';
  minutes: number | null;
  kcal: number | null;
  items: LatihanItem[];
};
export type ProgramAktif = { id: string; diet_key: MetodeKey; start: string; plan: Plan | null };
export type CoachItem =
  | { id: string; kind: 'menu'; date: string; created_at: string; result: MenuHarian }
  | { id: string; kind: 'eval'; date: string; created_at: string; result: Evaluasi }
  | { id: string; kind: 'ask'; date: string; created_at: string; q: string; result: { jawaban: string } };
export type Harga = { eval: number; ask: number; ask_free: number; menu_ulang: number };
export type FitData = {
  ready: boolean;
  where: 'akun' | 'perangkat';
  pro: boolean;
  today: string;
  profile: FitProfile | null;
  weights: Timbangan[]; // terbaru dulu
  historyDays: number | null; // FREE: 7, PRO: null (semua)
  workouts: Latihan[];
  program: ProgramAktif | null;
  coins: number | null;
  kerja: FitKerja;
  coach: CoachItem[];
  prices: Harga;
  prefill: Partial<FitProfile> & { fromCheck?: string };
};

const LOCAL = 'leosiqra-olahraga';
const HARGA_DEFAULT: Harga = { eval: 1500, ask: 300, ask_free: 3, menu_ulang: 300 };
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
  workouts?: Latihan[];
  program?: ProgramAktif | null;
  coins?: number | null;
  kerja?: FitKerja;
  coach?: CoachItem[];
  prices?: Harga;
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
        workouts: r.workouts ?? [],
        program: r.program ?? null,
        coins: r.coins ?? null,
        kerja: r.kerja ?? KERJA_DEFAULT,
        coach: r.coach ?? [],
        prices: r.prices ?? HARGA_DEFAULT,
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
      workouts: [],
      program: null,
      coins: null,
      kerja: KERJA_DEFAULT,
      coach: [],
      prices: HARGA_DEFAULT,
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
      workouts: [],
      program: null,
      coins: null,
      kerja: KERJA_DEFAULT,
      coach: [],
      prices: HARGA_DEFAULT,
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

// ── Rilis 2: program & latihan (butuh akun; tidak ada cadangan di perangkat) ─────────────────────────
export async function startProgram(input: {
  requestId: string;
  dietKey: MetodeKey;
  jawaban: Record<string, string | number>;
  jendelaMulai?: string;
}): Promise<ProgramAktif> {
  const r = await cloudflareApi<{ program: ProgramAktif }>('/api/member/fit/programs', {
    method: 'POST',
    json: {
      request_id: input.requestId,
      diet_key: input.dietKey,
      jawaban: input.jawaban,
      jendela_mulai: input.jendelaMulai,
    },
  });
  return r.program;
}

export const endProgram = (id: string) => cloudflareApi(`/api/member/fit/programs/${id}/end`, { method: 'POST' });

export const saveWorkout = (w: { id: string; date: string; items: LatihanItem[]; programId?: string | null }) =>
  cloudflareApi<{ minutes: number; kcal: number }>('/api/member/fit/workouts', {
    method: 'POST',
    json: { id: w.id, date: w.date, items: w.items, program_id: w.programId ?? undefined },
  });

export const deleteWorkout = (id: string) => cloudflareApi(`/api/member/fit/workouts/${id}`, { method: 'DELETE' });

// ── Rilis 3 ────────────────────────────────────────────────────────────────────────────────────────────
export const saveKerja = (k: FitKerja) =>
  cloudflareApi<{ kerja: FitKerja }>('/api/member/fit/kerja', { method: 'PUT', json: { kerja: k } });
export const setShiftHari = (date: string, shift: string | null) =>
  cloudflareApi<{ kerja: FitKerja }>('/api/member/fit/kerja/hari', { method: 'PUT', json: { date, shift } });
export const mintaMenu = (ulang: boolean) =>
  cloudflareApi<{ menu: CoachItem }>('/api/member/fit/menu', {
    method: 'POST',
    json: { request_id: crypto.randomUUID(), ulang },
  });
export const mintaEvaluasi = (requestId: string) =>
  cloudflareApi<{ eval: CoachItem }>('/api/member/fit/coach/eval', { method: 'POST', json: { request_id: requestId } });
export const tanyaCoach = (requestId: string, pertanyaan: string) =>
  cloudflareApi<{ ask: CoachItem; free_left?: number }>('/api/member/fit/coach/ask', {
    method: 'POST',
    json: { request_id: requestId, pertanyaan },
  });

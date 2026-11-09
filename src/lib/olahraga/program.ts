import { OBESITAS_BERAT, imtDari } from './hitung';
import type { FitProfile, Gerakan } from './types';

// Olahragaku — program 4 minggu (rilis 2). Murni (tanpa fetch/DOM): dipakai Worker untuk menyaring output AI
// dan klien untuk menampilkan hari ini. Angka kalori/protein TIDAK dari AI — selalu dari hitung.ts.

export const PROGRAM_HARI = 28;
export const PROGRAM_PRICE = 5000; // koin — satu-satunya sumber harga (Worker & UI)

export type LatihanItem = { key: string; set: number; jumlah: number };
export type HariLatihan = { hari: number; judul: string; gerakan: LatihanItem[] }; // hari 1..7 dalam minggu
export type MenuHari = { nama: string; makan: { jam: string; isi: string }[] };
export type MingguPlan = { ke: number; fokus: string; tips: string[]; menu: MenuHari[]; latihan: HariLatihan[] };
export type Plan = {
  versi: 1;
  targetKalori: number;
  proteinG: { min: number; max: number };
  jendela: { mulai: string; puasa: number; makan: number } | null;
  ringkasan: string;
  aturanMakan: string[];
  minggu: MingguPlan[];
};

const teks = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';
const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const JAM = /^([01]\d|2[0-3])[.:]([0-5]\d)$/;

// Batas jumlah per set menurut satuan (pengaman kalau AI memberi dosis berlebihan untuk pemula).
const BATAS: Record<Gerakan['satuan'], number> = { ulang: 30, detik: 90, menit: 60 };

// Menyaring rencana dari AI. null = tidak layak dipakai (klien diberi pesan, koin dikembalikan).
export function sanitizePlan(
  raw: unknown,
  allowed: Record<string, Gerakan>,
  angka: Pick<Plan, 'targetKalori' | 'proteinG' | 'jendela'>,
): Plan | null {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!r || !Array.isArray(r.minggu)) return null;
  // Jam makan di luar jendela (metode puasa) dibuang — jangan hanya percaya instruksi ke AI.
  const dalamJendela = (jam: string) => {
    if (!angka.jendela) return true;
    const [h, m] = jam.split('.').map(Number);
    const t = h * 60 + m;
    const buka = Number(angka.jendela.mulai.slice(0, 2)) * 60;
    const tutup = buka + angka.jendela.makan * 60;
    return tutup <= 1440 ? t >= buka && t <= tutup : t >= buka || t <= tutup - 1440;
  };
  const minggu: MingguPlan[] = [];
  for (let ke = 1; ke <= 4; ke++) {
    const w =
      (r.minggu as unknown[]).find((x) => Number((x as Record<string, unknown>)?.ke) === ke) ??
      (r.minggu as unknown[])[ke - 1];
    if (!w || typeof w !== 'object') return null;
    const wr = w as Record<string, unknown>;
    const menu = (Array.isArray(wr.menu) ? wr.menu : []).slice(0, 3).flatMap((m) => {
      const mr = (m ?? {}) as Record<string, unknown>;
      const makan = (Array.isArray(mr.makan) ? mr.makan : []).slice(0, 7).flatMap((x) => {
        const xr = (x ?? {}) as Record<string, unknown>;
        const jam = teks(xr.jam, 5).replace(':', '.');
        const isi = teks(xr.isi, 160);
        return JAM.test(jam) && isi && dalamJendela(jam) ? [{ jam, isi }] : [];
      });
      return makan.length >= 2 ? [{ nama: teks(mr.nama, 40) || 'Contoh menu', makan }] : [];
    });
    const byHari = new Map<number, HariLatihan>();
    for (const h of Array.isArray(wr.latihan) ? wr.latihan : []) {
      const hr = (h ?? {}) as Record<string, unknown>;
      const hari = int(hr.hari, 1, 7, 0);
      if (!hari || byHari.has(hari)) continue;
      const gerakan = (Array.isArray(hr.gerakan) ? hr.gerakan : []).slice(0, 8).flatMap((g) => {
        const gr = (g ?? {}) as Record<string, unknown>;
        const def = typeof gr.key === 'string' ? allowed[gr.key] : undefined;
        if (!def) return []; // gerakan di luar perpustakaan / tidak aman untuk profil ini → dibuang
        const set = int(gr.set, 1, 5, def.bawaan.set);
        // Kardio bermenit: total per gerakan maks 60 menit (mis. 2 set × 60 menit → 2 × 30).
        const max = def.satuan === 'menit' ? Math.floor(BATAS.menit / set) : BATAS[def.satuan];
        return [{ key: def.key, set, jumlah: int(gr.jumlah, 1, max, Math.min(def.bawaan.jumlah, max)) }];
      });
      byHari.set(hari, {
        hari,
        judul: teks(hr.judul, 60) || (gerakan.length ? 'Latihan' : 'Istirahat aktif'),
        gerakan,
      });
    }
    const latihan = Array.from(
      { length: 7 },
      (_, i) => byHari.get(i + 1) ?? { hari: i + 1, judul: 'Istirahat aktif', gerakan: [] },
    );
    if (!menu.length || latihan.filter((h) => h.gerakan.length).length < 2) return null;
    minggu.push({
      ke,
      fokus: teks(wr.fokus, 140) || `Minggu ${ke}`,
      tips: (Array.isArray(wr.tips) ? wr.tips : [])
        .map((t) => teks(t, 180))
        .filter(Boolean)
        .slice(0, 4),
      menu,
      latihan,
    });
  }
  return {
    versi: 1,
    ...angka,
    ringkasan: teks(r.ringkasan, 400),
    aturanMakan: (Array.isArray(r.aturanMakan) ? r.aturanMakan : [])
      .map((t) => teks(t, 180))
      .filter(Boolean)
      .slice(0, 6),
    minggu,
  };
}

// Gerakan yang boleh dipakai untuk profil ini (alat, kondisi, IMT, pengalaman).
export function gerakanAman(
  semua: Gerakan[],
  p: Pick<FitProfile, 'equipment' | 'conditions' | 'experience' | 'weightKg' | 'heightCm'>,
) {
  const alat = new Set<Gerakan['alat']>(['tanpa', 'kursi']);
  if (p.equipment === 'dumbbell' || p.equipment === 'gym') alat.add('dumbbell');
  if (p.equipment === 'gym') alat.add('gym');
  const imt = imtDari(p.weightKg, p.heightCm) ?? 0;
  const ringan = imt >= OBESITAS_BERAT || p.conditions.includes('sendi');
  const jantung = p.conditions.includes('jantung') || p.conditions.includes('pingsan');
  return semua.filter(
    (g) =>
      alat.has(g.alat) &&
      !g.hindariKalau.some((k) => p.conditions.includes(k)) &&
      (!ringan || g.lowImpact) &&
      // Jantung/pernah pingsan: hanya jalan santai, latihan kursi, & peregangan (rancangan bagian 3).
      (!jantung || (g.lowImpact && g.tingkat === 'pemula' && (g.duduk || g.kategori === 'kelenturan' || g.met <= 3))) &&
      (p.experience === 'rutin' || g.tingkat !== 'lanjut'),
  );
}

// Hari ke-berapa program (1..28) dari tanggal mulai (YYYY-MM-DD, WIB). > 28 = selesai.
export const hariKe = (mulai: string, today: string) =>
  Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${mulai}T00:00:00Z`)) / 86400_000) + 1;

export const latihanHariIni = (plan: Plan, hari: number) => {
  if (hari < 1 || hari > PROGRAM_HARI) return null;
  const w = plan.minggu[Math.ceil(hari / 7) - 1];
  return w ? { minggu: w, latihan: w.latihan[(hari - 1) % 7], menu: w.menu[(hari - 1) % w.menu.length] } : null;
};

// Perkiraan durasi & kalori (MET × kg × jam). Ulangan ≈ 3 detik; jeda antarset 45 detik.
export function perkiraanLatihan(items: LatihanItem[], byKey: Record<string, Gerakan>, kg: number) {
  let detik = 0;
  let kkal = 0;
  for (const it of items) {
    const g = byKey[it.key];
    if (!g) continue;
    const kerja = it.set * it.jumlah * (g.satuan === 'menit' ? 60 : g.satuan === 'detik' ? 1 : 3);
    const jeda = g.satuan === 'menit' ? 0 : Math.max(0, it.set - 1) * 45;
    detik += kerja + jeda;
    kkal += g.met * kg * (kerja / 3600);
  }
  return { menit: Math.max(1, Math.round(detik / 60)), kkal: Math.round(kkal) };
}

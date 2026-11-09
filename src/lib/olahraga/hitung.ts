import { AKTIVITAS, type FitProfile } from './types';

// Olahragaku — hitungan tubuh dengan rumus tetap (bukan AI): konsisten, gratis, bisa diperiksa.
// Dipakai web, app HP, dan (rilis berikutnya) Worker untuk membatasi angka dari AI.

export const KKAL_PER_KG = 7700; // ≈ energi 1 kg lemak tubuh
export const DEFISIT_DEFAULT = 500;
export const KALORI_MIN = { l: 1500, p: 1200 } as const; // batas bawah aman tanpa pengawasan dokter
export const LAJU_MAKS_PER_MINGGU = 0.01; // turun maks 1% berat badan per minggu

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export const umurDari = (birthYear: number, today = new Date()) => today.getFullYear() - birthYear;

export const imtDari = (kg: number, cm: number) => (kg > 0 && cm > 0 ? round(kg / (cm / 100) ** 2, 1) : null);

// Kategori IMT dewasa Kemenkes (P2PTM) — sama dengan bmiClass di src/lib/healthChecks.ts (tab Cek Sehatku).
export type KategoriImt = 'Kurus' | 'Normal' | 'Gemuk' | 'Obesitas';
export const kategoriImt = (imt: number): KategoriImt =>
  imt < 18.5 ? 'Kurus' : imt <= 25 ? 'Normal' : imt <= 27 ? 'Gemuk' : 'Obesitas';
export const OBESITAS_BERAT = 30; // dipakai untuk aturan latihan low-impact

// Lingkar perut berisiko (kriteria Asia): pria ≥ 90 cm, wanita ≥ 80 cm.
export const perutBerisiko = (sex: 'l' | 'p', waistCm: number | null) =>
  waistCm ? waistCm >= (sex === 'l' ? 90 : 80) : null;

// BMR Mifflin-St Jeor (kkal/hari saat istirahat).
export const bmrDari = (p: Pick<FitProfile, 'sex' | 'weightKg' | 'heightCm'>, umur: number) =>
  Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * umur + (p.sex === 'l' ? 5 : -161));

export const faktorAktivitas = (key: FitProfile['activity']) => AKTIVITAS.find((a) => a.key === key)?.faktor ?? 1.2;

// Berat dengan IMT normal Kemenkes (18,5–25).
export const rentangBeratNormal = (cm: number) => {
  const m2 = (cm / 100) ** 2;
  return { min: round(18.5 * m2, 1), max: round(25 * m2, 1) };
};

export type HasilHitung = {
  umur: number;
  imt: number | null;
  kategori: KategoriImt | null;
  perutBerisiko: boolean | null;
  bmr: number;
  tdee: number;
  turun: boolean; // target menurunkan berat badan
  defisit: number; // kkal/hari yang benar-benar dipakai (setelah batas aman)
  targetKalori: number;
  kaloriMin: number;
  dibatasi: string | null; // kenapa target kalori/defisit diubah oleh batas aman
  proteinG: { min: number; max: number };
  beratNormal: { min: number; max: number };
  perkiraanMinggu: { min: number; max: number } | null; // ke berat target, rentang (bukan janji)
  tanpaDefisit: string | null; // alasan tidak boleh defisit (hamil, < 18 th)
};

export function hitung(p: FitProfile, today = new Date()): HasilHitung {
  const umur = umurDari(p.birthYear, today);
  const imt = imtDari(p.weightKg, p.heightCm);
  const bmr = bmrDari(p, umur);
  const tdee = Math.round(bmr * faktorAktivitas(p.activity));
  const kaloriMin = KALORI_MIN[p.sex];
  const beratNormal = rentangBeratNormal(p.heightCm);

  const tanpaDefisit = p.conditions.includes('hamil')
    ? 'Saat hamil atau menyusui, tubuh butuh energi cukup — fokus ke pola makan seimbang, bukan mengurangi kalori.'
    : umur < 18
      ? 'Di bawah 18 tahun tubuh masih tumbuh — fokus ke pola makan seimbang & aktif bergerak, bukan diet kalori.'
      : null;
  const turun = !tanpaDefisit && p.goalKg !== null && p.goalKg < p.weightKg;

  let defisit = 0;
  let dibatasi: string | null = null;
  if (turun) {
    const lajuMaks = Math.round((p.weightKg * LAJU_MAKS_PER_MINGGU * KKAL_PER_KG) / 7);
    defisit = Math.min(DEFISIT_DEFAULT, lajuMaks);
    if (defisit < DEFISIT_DEFAULT)
      dibatasi = 'Defisit dikecilkan supaya turunnya tidak lebih dari 1% berat badan per minggu.';
    if (tdee - defisit < kaloriMin) {
      defisit = Math.max(0, tdee - kaloriMin);
      dibatasi = `Kalori tidak diturunkan di bawah ${kaloriMin.toLocaleString('id-ID')} kkal/hari (batas aman tanpa pengawasan dokter). Tambah gerak supaya defisitnya dari aktivitas.`;
    }
  }
  const targetKalori = tdee - defisit;

  // Protein dihitung dari berat acuan (berat target, atau batas atas berat normal kalau lebih berat dari itu).
  const acuan = Math.min(p.weightKg, p.goalKg ?? beratNormal.max);
  const proteinG = { min: Math.round(acuan * 1.2), max: Math.round(acuan * 1.6) };

  const perkiraanMinggu =
    turun && defisit > 0 && p.goalKg !== null
      ? (() => {
          const minggu = ((p.weightKg - p.goalKg) * KKAL_PER_KG) / (defisit * 7);
          return { min: Math.max(1, Math.round(minggu * 0.8)), max: Math.max(1, Math.round(minggu * 1.3)) };
        })()
      : null;

  return {
    umur,
    imt,
    kategori: imt === null ? null : kategoriImt(imt),
    perutBerisiko: perutBerisiko(p.sex, p.waistCm),
    bmr,
    tdee,
    turun,
    defisit,
    targetKalori,
    kaloriMin,
    dibatasi,
    proteinG,
    beratNormal,
    perkiraanMinggu,
    tanpaDefisit,
  };
}

import { cloudflareApi } from '@/lib/cloudflare-api';

// Sehatku › Cek. Daftar cek rutin = paket Cek Kesehatan Gratis (CKG) dewasa & lansia menurut
// Kepmenkes HK.01.07/MENKES/84/2026 (Petunjuk Teknis CKG, ditetapkan 9 Feb 2026, bab II.D):
// dilaksanakan setahun sekali, jadwal dipilih peserta. Syarat usia/jenis kelamin mengikuti teks juknis.
// Vaksin dewasa TIDAK diatur juknis ini → hanya pencatatan dosis, tanpa klaim jadwal.

export type Sex = 'p' | 'l';
export type HealthProfile = { birthYear: number; sex: Sex; catin?: boolean };
export type CheckItem = {
  key: string;
  label: string;
  group: string;
  desc: string;
  minAge?: number;
  sex?: Sex;
  note?: string; // syarat tambahan dari juknis
  catinOnly?: boolean;
  lansiaOnly?: boolean;
};
export type CheckRecord = {
  id: string;
  item_key: string;
  date: string;
  place: string | null;
  free: number;
  cost: number | null;
  dose: number | null;
  note: string | null;
  recorded: number;
  results?: Record<string, number> | null;
};

// Angka hasil cek yang bisa dicatat (batas wajar sama dengan Worker). Hanya untuk dipantau trennya —
// tidak ada label diagnosis kecuali IMT (klasifikasi Kemenkes dewasa).
export type ResultField = { key: string; label: string; unit: string; min: number; max: number };
export const RESULT_FIELDS: Record<string, ResultField[]> = {
  'tekanan-darah': [
    { key: 'sis', label: 'Sistolik', unit: 'mmHg', min: 50, max: 300 },
    { key: 'dia', label: 'Diastolik', unit: 'mmHg', min: 30, max: 200 },
  ],
  'gula-darah': [{ key: 'gd', label: 'Gula darah', unit: 'mg/dL', min: 20, max: 800 }],
  'status-gizi': [
    { key: 'bb', label: 'Berat badan', unit: 'kg', min: 2, max: 400 },
    { key: 'tb', label: 'Tinggi badan', unit: 'cm', min: 40, max: 250 },
    { key: 'lp', label: 'Lingkar perut', unit: 'cm', min: 30, max: 250 },
  ],
  'risiko-stroke-jantung-ginjal': [{ key: 'kol', label: 'Kolesterol total', unit: 'mg/dL', min: 50, max: 1000 }],
};

export const bmiOf = (r?: Record<string, number> | null) =>
  r?.bb && r?.tb ? Math.round((r.bb / (r.tb / 100) ** 2) * 10) / 10 : null;
// Klasifikasi IMT dewasa Kemenkes (P2PTM): <18,5 kurus · 18,5–25,0 normal · >25,0–27,0 gemuk · >27,0 obesitas.
export const bmiClass = (b: number) => (b < 18.5 ? 'Kurus' : b <= 25 ? 'Normal' : b <= 27 ? 'Gemuk' : 'Obesitas');
export type ChecksData = {
  ready: boolean;
  today: string;
  profile: HealthProfile | null;
  records: CheckRecord[];
  accounts: { id: string; name: string }[];
};

export const CKG_SOURCE = {
  title: 'Kepmenkes HK.01.07/MENKES/84/2026 tentang Petunjuk Teknis Cek Kesehatan Gratis',
  url: 'https://kesprimkom.kemkes.go.id/assets/uploads/contents/others/2026kepmenkes084.pdf',
  readAt: '2026-11-07',
};

export const CHECK_ITEMS: CheckItem[] = [
  {
    key: 'tekanan-darah',
    label: 'Tekanan darah',
    group: 'Jantung & pembuluh darah',
    desc: 'Mengukur tekanan darah untuk deteksi dini hipertensi.',
  },
  {
    key: 'gula-darah',
    label: 'Gula darah',
    group: 'Jantung & pembuluh darah',
    desc: 'Pemeriksaan kadar gula darah untuk deteksi dini diabetes.',
  },
  {
    key: 'status-gizi',
    label: 'Status gizi',
    group: 'Jantung & pembuluh darah',
    desc: 'Tinggi & berat badan, indeks massa tubuh, dan lingkar perut.',
  },
  {
    key: 'gaya-hidup',
    label: 'Merokok & aktivitas fisik',
    group: 'Jantung & pembuluh darah',
    desc: 'Kuesioner kebiasaan merokok dan tingkat aktivitas fisik.',
  },
  {
    key: 'risiko-stroke-jantung-ginjal',
    label: 'Risiko stroke, jantung & ginjal',
    group: 'Jantung & pembuluh darah',
    desc: 'Pemeriksaan risiko stroke, penyakit jantung, dan penyakit ginjal.',
    minAge: 40,
    note: 'Pada penyandang hipertensi dan/atau diabetes.',
  },
  { key: 'tbc', label: 'Tuberkulosis (TBC)', group: 'Paru', desc: 'Skrining tuberkulosis.' },
  { key: 'ppok', label: 'PPOK', group: 'Paru', desc: 'Penyakit paru obstruktif kronis.', minAge: 40 },
  {
    key: 'kanker-payudara',
    label: 'Kanker payudara',
    group: 'Kanker',
    desc: 'Deteksi dini kanker payudara.',
    sex: 'p',
    minAge: 30,
  },
  {
    key: 'kanker-leher-rahim',
    label: 'Kanker leher rahim',
    group: 'Kanker',
    desc: 'Deteksi dini kanker leher rahim.',
    sex: 'p',
    minAge: 30,
    note: 'Bagi yang telah menikah atau pernah melakukan hubungan seksual.',
  },
  { key: 'kanker-paru', label: 'Kanker paru', group: 'Kanker', desc: 'Deteksi dini kanker paru.', minAge: 45 },
  { key: 'kanker-usus', label: 'Kanker usus', group: 'Kanker', desc: 'Deteksi dini kanker usus.', minAge: 45 },
  { key: 'mata', label: 'Mata', group: 'Indera, gigi & jiwa', desc: 'Pemeriksaan fungsi penglihatan.' },
  { key: 'telinga', label: 'Telinga', group: 'Indera, gigi & jiwa', desc: 'Pemeriksaan fungsi pendengaran.' },
  {
    key: 'gigi-mulut',
    label: 'Gigi & mulut',
    group: 'Indera, gigi & jiwa',
    desc: 'Pemeriksaan gigi dan mulut (jaringan periodontal mulai usia 25 tahun).',
  },
  { key: 'jiwa', label: 'Kesehatan jiwa', group: 'Indera, gigi & jiwa', desc: 'Skrining kesehatan jiwa.' },
  {
    key: 'hepatitis',
    label: 'Hepatitis B & C',
    group: 'Hati & kulit',
    desc: 'Skrining hepatitis B dan hepatitis C.',
    note: 'Fibrosis/sirosis hati diperiksa pada kondisi tertentu sesuai petugas.',
  },
  {
    key: 'kulit',
    label: 'Kulit',
    group: 'Hati & kulit',
    desc: 'Kusta, skabies, dan frambusia (frambusia di daerah endemis).',
  },
  {
    key: 'geriatri',
    label: 'Geriatri',
    group: 'Lansia',
    desc: 'Penilaian kesehatan khusus lanjut usia.',
    lansiaOnly: true,
  },
  {
    key: 'catin',
    label: 'Pemeriksaan calon pengantin',
    group: 'Calon pengantin',
    desc: 'Sifilis dan HIV; untuk perempuan juga anemia dan status imunisasi tetanus.',
    catinOnly: true,
  },
];

export const VACCINES = [
  'Influenza',
  'Tetanus-difteri (Td/Tdap)',
  'Hepatitis B',
  'HPV',
  'Pneumokokus',
  'Herpes zoster',
  'Dengue',
  'Campak, gondongan, rubela (MMR)',
  'Varisela (cacar air)',
  'Hepatitis A',
  'Tifoid',
  'COVID-19',
].map((label) => ({
  key: `vaksin:${label
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)}`,
  label,
}));

export const ageOf = (p: HealthProfile | null, today: string) => (p ? Number(today.slice(0, 4)) - p.birthYear : null);
export const appliesTo = (item: CheckItem, p: HealthProfile | null, today: string) => {
  const age = ageOf(p, today);
  if (item.catinOnly) return Boolean(p?.catin);
  if (item.lansiaOnly) return age !== null && age >= 60;
  if (item.sex && p && p.sex !== item.sex) return false;
  if (item.minAge && age !== null && age < item.minAge) return false;
  return true;
};
export const nextDueOf = (lastDate: string) => `${Number(lastDate.slice(0, 4)) + 1}${lastDate.slice(4)}`;

export const checkService = {
  load: () => cloudflareApi<ChecksData>('/api/member/health/checks', { cache: 'no-store' }),
  saveProfile: (p: HealthProfile) =>
    cloudflareApi<{ ok: true }>('/api/member/health/profile', {
      method: 'PUT',
      json: { birth_year: p.birthYear, sex: p.sex, catin: Boolean(p.catin) },
    }),
  add: (body: {
    request_id: string;
    item_key: string;
    label: string;
    date: string;
    place: string;
    free: boolean;
    cost: number | null;
    account_id: string | null;
    dose: number | null;
    note: string;
    results?: Record<string, number>;
  }) =>
    cloudflareApi<{ ok: true; tx_id?: string | null; results_saved?: boolean }>('/api/member/health/checks', {
      method: 'POST',
      json: body,
    }),
  remove: (id: string) =>
    cloudflareApi<{ ok: true; tx_kept: boolean }>(`/api/member/health/checks/${id}`, { method: 'DELETE' }),
};

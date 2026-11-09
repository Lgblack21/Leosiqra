import {
  Bot,
  Dumbbell,
  Footprints,
  Gauge,
  Map as MapIcon,
  Leaf,
  HeartPulse,
  NotebookPen,
  PieChart,
  Radar,
  Repeat,
  ShieldCheck,
  Sprout,
  Sticker,
  Timer,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

// Fitur yang bisa dinyalakan/dimatikan user (panel Pengaturan → Fitur).
// Mematikan = hanya disembunyikan dari menu samping; halaman & datanya tetap
// ada. Keuangan inti (Ringkasan, Transaksi, Laporan, Rekening) selalu aktif.
// Daftar id WAJIB sama dengan PREF_FEATURES di Worker (validasi server).

export type FeatureId =
  | 'ai'
  | 'kartu'
  | 'tabungan'
  | 'hutang'
  | 'investasi'
  | 'transfer'
  | 'rutin'
  | 'dompet_bersama'
  | 'pasar'
  | 'tahunan'
  | 'pajak'
  | 'impor'
  | 'kotak_masuk'
  | 'jejak'
  | 'langganan'
  | 'ladang'
  | 'fokus'
  | 'cerita'
  | 'sehat'
  | 'olahraga'
  | 'stiker'
  | 'kanvas'
  | 'cek'
  | 'peta'
  | 'teduh';

export type Feature = { id: FeatureId; label: string; href: string; icon: LucideIcon; tint: string };

export const FEATURES: Feature[] = [
  {
    id: 'ai',
    label: 'AI Leo',
    href: '/membership/ai-leosiqra',
    icon: Bot,
    tint: 'from-indigo-50 to-indigo-100 text-indigo-600',
  },
  {
    id: 'investasi',
    label: 'Investasiku',
    href: '/membership/investment',
    icon: TrendingUp,
    tint: 'from-blue-50 to-blue-100 text-blue-600',
  },
  // id 'tabungan' dipertahankan (preferensi tersimpan & validasi Worker); isinya kini halaman Kekayaan.
  {
    id: 'tabungan',
    label: 'Kekayaan',
    href: '/membership/kekayaan',
    icon: PieChart,
    tint: 'from-emerald-50 to-emerald-100 text-emerald-600',
  },
  {
    id: 'jejak',
    label: 'Jejak Uang',
    href: '/membership/jejak-uang',
    icon: Footprints,
    tint: 'from-lime-50 to-lime-100 text-lime-600',
  },
  {
    id: 'langganan',
    label: 'Langgananku',
    href: '/membership/langganan',
    icon: Radar,
    tint: 'from-violet-50 to-violet-100 text-violet-600',
  },
  {
    id: 'ladang',
    label: 'Ladangku',
    href: '/membership/ladang',
    icon: Sprout,
    tint: 'from-emerald-50 to-emerald-100 text-emerald-600',
  },
  {
    id: 'fokus',
    label: 'Fokus bareng Leo',
    href: '/membership/fokus',
    icon: Timer,
    tint: 'from-indigo-50 to-violet-100 text-indigo-600',
  },
  {
    id: 'cerita',
    label: 'Cerita Hari Ini',
    href: '/membership/cerita',
    icon: NotebookPen,
    tint: 'from-amber-50 to-pink-100 text-pink-600',
  },
  {
    id: 'stiker',
    label: 'Stikerku',
    href: '/membership/stiker',
    icon: Sticker,
    tint: 'from-fuchsia-50 to-amber-100 text-fuchsia-600',
  },
  {
    id: 'kanvas',
    label: 'Kanvas',
    href: '/membership/kanvas',
    icon: Waypoints,
    tint: 'from-slate-100 to-emerald-100 text-emerald-700',
  },
  {
    id: 'peta',
    label: 'Peta Belanja',
    href: '/membership/peta',
    icon: MapIcon,
    tint: 'from-sky-50 to-indigo-100 text-indigo-600',
  },
  {
    id: 'teduh',
    label: 'Teduh',
    href: '/membership/teduh',
    icon: Leaf,
    tint: 'from-emerald-50 to-teal-100 text-emerald-700',
  },
  {
    id: 'cek',
    label: 'Rapor Keuangan',
    href: '/membership/cek-keuangan',
    icon: Gauge,
    tint: 'from-emerald-50 to-indigo-100 text-indigo-600',
  },
  {
    id: 'sehat',
    label: 'Sehatku',
    href: '/membership/sehat',
    icon: HeartPulse,
    tint: 'from-orange-50 to-rose-100 text-orange-600',
  },
  {
    id: 'olahraga',
    label: 'Olahragaku',
    href: '/membership/olahraga',
    icon: Dumbbell,
    tint: 'from-emerald-50 to-lime-100 text-emerald-600',
  },
  {
    id: 'rutin',
    label: 'Transaksi Rutin',
    href: '/membership/recurring',
    icon: Repeat,
    tint: 'from-teal-50 to-teal-100 text-teal-600',
  },
  {
    id: 'pajak',
    label: 'Pajak Center',
    href: '/membership/pajak-center',
    icon: ShieldCheck,
    tint: 'from-emerald-50 to-emerald-100 text-emerald-600',
  },
];

// Bawaan = isi menu samping sebelum fitur ini ada (perilaku lama tidak berubah).
// Id yang sudah dilebur/keluar menu (kartu, pasar, transfer, hutang, tahunan,
// dompet_bersama, impor, kotak_masuk) tetap sah di tipe & Worker untuk
// preferensi lama, tapi tidak lagi ditampilkan — lihat normalizeFeatures.
export const DEFAULT_FEATURES: FeatureId[] = [
  'ai',
  'tabungan',
  'investasi',
  'jejak',
  'langganan',
  'ladang',
  'fokus',
  'cerita',
  'stiker',
  'kanvas',
  'peta',
  'teduh',
  'cek',
  'sehat',
  'olahraga',
];

const BY_ID = new Map(FEATURES.map((f) => [f.id, f]));
export const isShownFeature = (id: string) => BY_ID.has(id as FeatureId);
// Preferensi lama → id yang sekarang: 'hutang' kini bagian dari Kekayaan
// ('tabungan'). Id yang tidak ditampilkan dibuang, duplikat dibuang.
export const normalizeFeatures = (ids: readonly string[]): FeatureId[] => {
  const out: FeatureId[] = [];
  for (const raw of ids) {
    // 'makan' (3.3.0, Makanku) kini bagian dari Olahragaku (dulu Sehatku).
    const id = (raw === 'hutang' ? 'tabungan' : raw === 'makan' ? 'olahraga' : raw) as FeatureId;
    if (BY_ID.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
};
// Urutan tampil selalu mengikuti FEATURES (bukan urutan saat dinyalakan),
// supaya menu konsisten: AI Leo, Investasiku, lalu yang lain.
const ORDER = new Map(FEATURES.map((f, i) => [f.id, i]));
export const featuresFromIds = (ids: readonly string[]) =>
  ids
    .map((id) => BY_ID.get(id as FeatureId))
    .filter((f): f is Feature => Boolean(f))
    .sort((a, b) => (ORDER.get(a.id) ?? 99) - (ORDER.get(b.id) ?? 99));

// Menu samping memuat paling banyak SIDEBAR_LIMIT fitur aktif (urutan FEATURES); sisanya ada di
// halaman Fitur lainnya. Halaman itu menyembunyikan fitur yang sudah tampil di menu samping.
export const SIDEBAR_LIMIT = 6;
export const sidebarFeatures = (ids: readonly string[]) => featuresFromIds(ids).slice(0, SIDEBAR_LIMIT);

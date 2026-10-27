import {
  Bot, CreditCard, PiggyBank, HandCoins, TrendingUp, ArrowLeftRight, Repeat, Users, Globe, CalendarRange, ShieldCheck, UploadCloud, Inbox,
  type LucideIcon,
} from 'lucide-react';

// Fitur yang bisa dinyalakan/dimatikan user (panel Pengaturan → Fitur).
// Mematikan = hanya disembunyikan dari menu samping; halaman & datanya tetap
// ada. Keuangan inti (Ringkasan, Transaksi, Laporan, Rekening) selalu aktif.
// Daftar id WAJIB sama dengan PREF_FEATURES di Worker (validasi server).

export type FeatureId =
  | 'ai' | 'kartu' | 'tabungan' | 'hutang' | 'investasi' | 'transfer' | 'rutin'
  | 'dompet_bersama' | 'pasar' | 'tahunan' | 'pajak' | 'impor' | 'kotak_masuk';

export type Feature = { id: FeatureId; label: string; href: string; icon: LucideIcon; tint: string };

export const FEATURES: Feature[] = [
  { id: 'ai', label: 'AI Leosiqra', href: '/membership/ai-leosiqra', icon: Bot, tint: 'from-indigo-50 to-indigo-100 text-indigo-600' },
  { id: 'kartu', label: 'Kartu Saya', href: '/membership/cards', icon: CreditCard, tint: 'from-slate-50 to-slate-200 text-slate-700' },
  { id: 'tabungan', label: 'Tabungan', href: '/membership/tabungan', icon: PiggyBank, tint: 'from-rose-50 to-rose-100 text-rose-500' },
  { id: 'hutang', label: 'Hutang & Piutang', href: '/membership/transactions/debt', icon: HandCoins, tint: 'from-orange-50 to-orange-100 text-orange-500' },
  { id: 'investasi', label: 'Investasi', href: '/membership/investment', icon: TrendingUp, tint: 'from-blue-50 to-blue-100 text-blue-600' },
  { id: 'transfer', label: 'Transfer & Top Up', href: '/membership/transactions/topup', icon: ArrowLeftRight, tint: 'from-cyan-50 to-cyan-100 text-cyan-600' },
  { id: 'rutin', label: 'Transaksi Rutin', href: '/membership/recurring', icon: Repeat, tint: 'from-teal-50 to-teal-100 text-teal-600' },
  { id: 'dompet_bersama', label: 'Dompet Bersama', href: '/membership/dompet-bersama', icon: Users, tint: 'from-violet-50 to-violet-100 text-violet-600' },
  { id: 'pasar', label: 'Data Pasar', href: '/membership/market-data', icon: Globe, tint: 'from-lime-50 to-lime-100 text-lime-700' },
  { id: 'tahunan', label: 'Laporan Tahunan', href: '/membership/annual', icon: CalendarRange, tint: 'from-amber-50 to-amber-100 text-amber-600' },
  { id: 'pajak', label: 'Pajak Center', href: '/membership/pajak-center', icon: ShieldCheck, tint: 'from-emerald-50 to-emerald-100 text-emerald-600' },
  { id: 'impor', label: 'Impor', href: '/membership/impor', icon: UploadCloud, tint: 'from-sky-50 to-sky-100 text-sky-600' },
  { id: 'kotak_masuk', label: 'Kotak Masuk', href: '/membership/kotak-masuk', icon: Inbox, tint: 'from-pink-50 to-pink-100 text-pink-500' },
];

// Bawaan = isi menu samping sebelum fitur ini ada (perilaku lama tidak berubah).
export const DEFAULT_FEATURES: FeatureId[] = ['ai', 'kartu', 'tabungan', 'hutang', 'investasi'];

const BY_ID = new Map(FEATURES.map((f) => [f.id, f]));
export const featuresFromIds = (ids: readonly string[]) => ids.map((id) => BY_ID.get(id as FeatureId)).filter((f): f is Feature => Boolean(f));

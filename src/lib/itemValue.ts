import { Car, Dumbbell, Package, Shirt, Smartphone, Sofa, Watch, WashingMachine, type LucideIcon } from 'lucide-react';
import { toLocalDateString } from '@/lib/utils';

// Barangku: kategori + perkiraan nilai sekarang. Penyusutan saldo menurun per
// tahun dengan batas bawah (barang jarang laku di bawah itu). Perkiraan kasar
// untuk kekayaan bersih — user bisa pilih "tetap" atau isi nilai sendiri.
export const ITEM_CATEGORIES = ['Elektronik', 'Kendaraan', 'Rumah tangga', 'Perabot', 'Fashion', 'Jam & perhiasan', 'Hobi & olahraga', 'Lainnya'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export type ItemValueMode = 'auto' | 'tetap' | 'manual';
export type ItemStatus = 'aktif' | 'terjual' | 'hilang';

export const CATEGORY_META: Record<ItemCategory, { icon: LucideIcon; rate: number; floor: number; hint: string; tone: string }> = {
  Elektronik: { icon: Smartphone, rate: 0.25, floor: 0.1, hint: 'HP, laptop, TV, kamera', tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
  Kendaraan: { icon: Car, rate: 0.12, floor: 0.2, hint: 'Motor, mobil, sepeda', tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  'Rumah tangga': { icon: WashingMachine, rate: 0.15, floor: 0.1, hint: 'Kulkas, mesin cuci, AC', tone: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300' },
  Perabot: { icon: Sofa, rate: 0.1, floor: 0.15, hint: 'Sofa, kasur, lemari', tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  Fashion: { icon: Shirt, rate: 0.2, floor: 0.1, hint: 'Tas, sepatu, jaket', tone: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300' },
  'Jam & perhiasan': { icon: Watch, rate: 0, floor: 1, hint: 'Jam tangan, cincin, kalung', tone: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300' },
  'Hobi & olahraga': { icon: Dumbbell, rate: 0.15, floor: 0.1, hint: 'Konsol, gitar, alat gym', tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
  Lainnya: { icon: Package, rate: 0.1, floor: 0.1, hint: 'Barang lain', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export const categoryMeta = (c: string) => CATEGORY_META[(ITEM_CATEGORIES as readonly string[]).includes(c) ? (c as ItemCategory) : 'Lainnya'];

export type Item = {
  id: string;
  name: string;
  brand?: string;
  variant?: string;
  category: ItemCategory;
  purchasePrice: number;
  currency: string;
  purchaseDate?: string; // YYYY-MM-DD
  warrantyUntil?: string; // YYYY-MM-DD
  valueMode: ItemValueMode;
  manualValue?: number;
  note?: string;
  status: ItemStatus;
  hasPhoto: boolean;
  createdAt: string;
  updatedAt: string;
};

const DAY = 86400e3;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Perkiraan nilai sekarang (mata uang barang). */
export function itemCurrentValue(item: Pick<Item, 'category' | 'purchasePrice' | 'purchaseDate' | 'createdAt' | 'valueMode' | 'manualValue'>, today = toLocalDateString()): number {
  const price = Math.max(0, Number(item.purchasePrice) || 0);
  if (item.valueMode === 'manual') return Math.max(0, Number(item.manualValue) || 0);
  if (item.valueMode === 'tetap') return price;
  const meta = categoryMeta(item.category);
  if (meta.rate <= 0) return price;
  const start = item.purchaseDate || item.createdAt.slice(0, 10);
  const years = Math.max(0, daysBetween(start, today) / 365.25);
  return Math.round(Math.max(price * meta.floor, price * Math.pow(1 - meta.rate, years)));
}

/** Umur barang, mis. "8 bulan", "2 tahun 3 bulan". */
export function itemAgeLabel(purchaseDate: string | undefined, today = toLocalDateString()): string | null {
  if (!purchaseDate) return null;
  const [y1, m1, d1] = purchaseDate.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 0) return null;
  if (months === 0) return 'Baru';
  const years = Math.floor(months / 12);
  months %= 12;
  return [years ? `${years} tahun` : '', months ? `${months} bulan` : ''].filter(Boolean).join(' ');
}

/** Status garansi untuk lencana. */
export function warrantyStatus(until: string | undefined, today = toLocalDateString()): { label: string; tone: 'ok' | 'soon' | 'over' } | null {
  if (!until) return null;
  const n = daysBetween(today, until);
  if (n < 0) return { label: 'Garansi habis', tone: 'over' };
  if (n === 0) return { label: 'Garansi habis hari ini', tone: 'soon' };
  if (n <= 30) return { label: `Garansi ${n} hari lagi`, tone: 'soon' };
  const short = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${until}T00:00:00Z`));
  return { label: `Garansi s/d ${short}`, tone: 'ok' };
}

/** Tanggal + N bulan (untuk tombol cepat garansi 1/2 tahun). */
export const addMonths = (dateStr: string, months: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

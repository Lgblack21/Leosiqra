import { useSyncExternalStore } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

// Ikon emoji + warna latar untuk baris transaksi, ditebak dari nama kategori
// (kategori user bebas diketik, jadi dicocokkan lewat kata kunci, bukan nama persis).

const RULES: { keys: string[]; emoji: string; tile: string }[] = [
  { keys: ['kopi', 'coffee', 'cafe'], emoji: '☕', tile: 'bg-amber-50' },
  { keys: ['makan', 'minum', 'kuliner', 'resto', 'jajan', 'snack'], emoji: '🍛', tile: 'bg-orange-50' },
  { keys: ['transport', 'ojek', 'bensin', 'bbm', 'parkir', 'tol', 'grab', 'gojek', 'kendaraan'], emoji: '🛵', tile: 'bg-indigo-50' },
  { keys: ['belanja', 'groceries', 'supermarket', 'shopping', 'pakaian', 'fashion'], emoji: '🛒', tile: 'bg-emerald-50' },
  { keys: ['listrik', 'pln', 'air', 'pdam', 'internet', 'wifi', 'pulsa', 'tagihan', 'langganan'], emoji: '💡', tile: 'bg-yellow-50' },
  { keys: ['hiburan', 'film', 'netflix', 'spotify', 'game', 'nonton', 'liburan', 'wisata'], emoji: '🎬', tile: 'bg-violet-50' },
  { keys: ['rumah', 'sewa', 'kos', 'kontrakan', 'tempat tinggal'], emoji: '🏠', tile: 'bg-sky-50' },
  { keys: ['cicilan', 'kredit', 'angsuran', 'hutang', 'pinjaman'], emoji: '📆', tile: 'bg-rose-50' },
  { keys: ['kesehatan', 'obat', 'dokter', 'rumah sakit', 'apotek', 'bpjs'], emoji: '💊', tile: 'bg-teal-50' },
  { keys: ['pendidikan', 'sekolah', 'kursus', 'buku', 'kuliah'], emoji: '📚', tile: 'bg-blue-50' },
  { keys: ['anak', 'keluarga', 'orang tua'], emoji: '👨‍👩‍👧', tile: 'bg-pink-50' },
  { keys: ['donasi', 'sedekah', 'zakat', 'infaq', 'amal'], emoji: '🤲', tile: 'bg-emerald-50' },
  { keys: ['asuransi'], emoji: '🛡️', tile: 'bg-slate-100' },
  { keys: ['gaji', 'salary', 'upah'], emoji: '💼', tile: 'bg-emerald-50' },
  { keys: ['bonus', 'thr', 'hadiah'], emoji: '🎁', tile: 'bg-pink-50' },
  { keys: ['investasi', 'saham', 'reksa', 'deposito', 'emas', 'dividen', 'bunga'], emoji: '📈', tile: 'bg-violet-50' },
  { keys: ['tabungan', 'nabung'], emoji: '🐷', tile: 'bg-pink-50' },
  { keys: ['transfer', 'top up', 'topup'], emoji: '🔁', tile: 'bg-slate-100' },
  { keys: ['usaha', 'bisnis', 'freelance', 'penjualan', 'pendapatan'], emoji: '💰', tile: 'bg-emerald-50' },
];

export function categoryVisual(category?: string, type?: string): { emoji: string; tile: string } {
  const custom = category ? styles[category] : undefined;
  if (custom) return { emoji: custom.emoji, tile: CATEGORY_COLORS[custom.color]?.tile ?? 'bg-slate-100' };
  const text = (category || '').toLowerCase();
  const hit = RULES.find((r) => r.keys.some((k) => text.includes(k)));
  if (hit) return { emoji: hit.emoji, tile: hit.tile };
  if (type === 'transfer' || type === 'topup') return { emoji: '🔁', tile: 'bg-slate-100' };
  if (type === 'pemasukan') return { emoji: '💰', tile: 'bg-emerald-50' };
  return { emoji: '🧾', tile: 'bg-slate-100' };
}

// ---- Ikon & warna pilihan user (disimpan di preferensi akun) ----------------
// Komponen yang memakai categoryVisual memanggil useCategoryStyles() supaya
// ikut tergambar ulang begitu gaya dimuat/diubah.

export const CATEGORY_COLORS: Record<string, { tile: string; swatch: string }> = {
  blue: { tile: 'bg-blue-100', swatch: 'bg-blue-500' },
  sky: { tile: 'bg-sky-100', swatch: 'bg-sky-500' },
  indigo: { tile: 'bg-indigo-100', swatch: 'bg-indigo-500' },
  teal: { tile: 'bg-teal-100', swatch: 'bg-teal-500' },
  green: { tile: 'bg-green-100', swatch: 'bg-green-500' },
  amber: { tile: 'bg-amber-100', swatch: 'bg-amber-400' },
  orange: { tile: 'bg-orange-100', swatch: 'bg-orange-500' },
  red: { tile: 'bg-red-100', swatch: 'bg-red-500' },
  pink: { tile: 'bg-pink-100', swatch: 'bg-pink-500' },
  purple: { tile: 'bg-purple-100', swatch: 'bg-purple-500' },
  violet: { tile: 'bg-violet-100', swatch: 'bg-violet-400' },
  slate: { tile: 'bg-slate-200', swatch: 'bg-slate-400' },
};

export const CATEGORY_ICONS = [
  '🍜', '🍽️', '☕', '🧋', '🍔', '🍕', '🛒', '🛍️', '👕', '👟', '💄', '🎁',
  '🛵', '🚕', '🚗', '⛽', '🚆', '✈️', '🏠', '🛋️', '💡', '💧', '📱', '💻',
  '🧾', '💳', '🏦', '💰', '💵', '💼', '📈', '🐷', '🎬', '🎮', '🎵', '📚',
  '💊', '🏥', '🏋️', '👶', '🐱', '🤝', '🤲', '🛡️', '📆', '🔁', '✨', '🎉',
];

export type CategoryStyle = { emoji: string; color: string };
let styles: Record<string, CategoryStyle> = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const load = () => {
  if (loaded) return;
  loaded = true;
  cloudflareApi<{ item?: { categoryStyles?: Record<string, CategoryStyle> } }>('/api/member/preferences')
    .then((r) => { styles = r.item?.categoryStyles ?? {}; emit(); })
    .catch(() => { loaded = false; });
};

export function useCategoryStyles() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); load(); return () => { listeners.delete(cb); }; },
    () => styles,
    () => styles,
  );
}

export const getCategoryStyle = (name: string): CategoryStyle | undefined => styles[name];

// Simpan (atau hapus dengan null) gaya satu kategori. Optimis: langsung
// tampil, dikembalikan kalau server menolak.
export async function setCategoryStyle(name: string, style: CategoryStyle | null) {
  const prev = styles;
  const next = { ...styles };
  if (style) next[name] = style; else delete next[name];
  styles = next;
  emit();
  try {
    await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { categoryStyle: style ? { name, ...style } : { name, remove: true } } });
  } catch (e) {
    styles = prev;
    emit();
    throw e;
  }
}

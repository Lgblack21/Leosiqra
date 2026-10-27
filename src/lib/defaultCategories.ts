// Template kategori Leosiqra (v1): dipakai setup awal (/membership/onboarding),
// /mulai, saran "Kategori baru", dan sinkronisasi user lama (Worker:
// CATEGORY_TEMPLATE — isinya WAJIB sama). Nama grup lama sengaja tidak diubah:
// transaksi menyimpan nama kategori sebagai teks, jadi mengganti nama =
// transaksi lama lepas dari kategorinya.
export type CategoryKind = 'pengeluaran' | 'pemasukan';
export interface CategoryGroup { category: string; subs: string[]; }
export interface CategoryTemplate extends CategoryGroup { kind: CategoryKind; emoji: string; color: string }

export const CATEGORY_TEMPLATE: CategoryTemplate[] = [
  { category: 'Makanan & Minuman', kind: 'pengeluaran', emoji: '🍜', color: 'orange', subs: ['Makan', 'Jajan & Kopi', 'Belanja Dapur'] },
  { category: 'Transportasi', kind: 'pengeluaran', emoji: '🛵', color: 'indigo', subs: ['Bensin', 'Parkir & Tol', 'Transportasi Online'] },
  { category: 'Tagihan & Utilitas', kind: 'pengeluaran', emoji: '💡', color: 'amber', subs: ['Listrik', 'Air', 'Internet & Pulsa'] },
  { category: 'Belanja', kind: 'pengeluaran', emoji: '🛍️', color: 'pink', subs: ['Pakaian', 'Elektronik', 'Rumah Tangga'] },
  { category: 'Hiburan', kind: 'pengeluaran', emoji: '🎬', color: 'violet', subs: ['Langganan', 'Nonton & Musik', 'Jalan-jalan'] },
  { category: 'Kesehatan', kind: 'pengeluaran', emoji: '💊', color: 'teal', subs: ['Obat', 'Dokter', 'Olahraga'] },
  { category: 'Tempat Tinggal', kind: 'pengeluaran', emoji: '🏠', color: 'sky', subs: ['Sewa & Kos', 'Cicilan Rumah', 'Perawatan Rumah'] },
  { category: 'Pendidikan', kind: 'pengeluaran', emoji: '📚', color: 'blue', subs: ['Sekolah & Kuliah', 'Kursus', 'Buku'] },
  { category: 'Keluarga & Sosial', kind: 'pengeluaran', emoji: '🤝', color: 'green', subs: ['Kirim ke Keluarga', 'Kondangan & Hadiah', 'Donasi'] },
  { category: 'Perawatan Diri', kind: 'pengeluaran', emoji: '💈', color: 'purple', subs: ['Salon & Cukur', 'Skincare'] },
  { category: 'Gaji', kind: 'pemasukan', emoji: '💼', color: 'green', subs: ['Gaji Bulanan', 'Bonus & THR'] },
  { category: 'Usaha & Freelance', kind: 'pemasukan', emoji: '💻', color: 'teal', subs: ['Proyek', 'Penjualan'] },
  { category: 'Hasil Investasi', kind: 'pemasukan', emoji: '📈', color: 'violet', subs: ['Dividen', 'Bunga'] },
  { category: 'Hadiah & Cashback', kind: 'pemasukan', emoji: '🎁', color: 'pink', subs: ['Hadiah', 'Cashback'] },
  { category: 'Pemasukan', kind: 'pemasukan', emoji: '✨', color: 'slate', subs: ['Pendapatan Lain'] },
];

export const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = CATEGORY_TEMPLATE.map(({ category, subs }) => ({ category, subs }));

// "Riwayat" tiruan untuk parser lokal (src/lib/quick/parse.ts): kata kunci umum
// → kategori bawaan, supaya "kopi 25rb" di /mulai langsung tertebak kategorinya.
export const GUEST_CATEGORY_HINTS = [
  { type: 'pengeluaran', category: 'Makanan & Minuman', subCategory: 'Jajan & Kopi', note: 'kopi jajan ngopi boba teh es snack' },
  { type: 'pengeluaran', category: 'Makanan & Minuman', subCategory: 'Makan', note: 'makan nasi sarapan siang malam padang bakso mie warteg' },
  { type: 'pengeluaran', category: 'Transportasi', subCategory: 'Parkir & Tol', note: 'parkir tol' },
  { type: 'pengeluaran', category: 'Transportasi', subCategory: 'Bensin', note: 'bensin pertalite pertamax bbm' },
  { type: 'pengeluaran', category: 'Transportasi', subCategory: 'Transportasi Online', note: 'ojek ojol gojek grab maxim taksi krl mrt busway' },
  { type: 'pengeluaran', category: 'Tagihan & Utilitas', subCategory: 'Internet & Pulsa', note: 'pulsa kuota internet wifi' },
  { type: 'pengeluaran', category: 'Tagihan & Utilitas', subCategory: 'Listrik', note: 'listrik token pln' },
  { type: 'pengeluaran', category: 'Hiburan', subCategory: 'Langganan', note: 'netflix spotify youtube langganan' },
  { type: 'pemasukan', category: 'Gaji', subCategory: 'Gaji Bulanan', note: 'gaji gajian salary' },
  { type: 'pemasukan', category: 'Gaji', subCategory: 'Bonus & THR', note: 'bonus thr' },
];

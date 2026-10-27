// Kategori bawaan yang ditawarkan saat setup awal (/membership/onboarding),
// juga dipakai /mulai untuk menebak kategori catatan pertama sebelum punya akun.
export interface CategoryGroup { category: string; subs: string[]; }
export const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = [
  { category: 'Makanan & Minuman', subs: ['Makan', 'Jajan & Kopi', 'Belanja Dapur'] },
  { category: 'Transportasi', subs: ['Bensin', 'Parkir & Tol', 'Transportasi Online'] },
  { category: 'Tagihan & Utilitas', subs: ['Listrik', 'Air', 'Internet & Pulsa'] },
  { category: 'Belanja', subs: ['Pakaian', 'Elektronik', 'Rumah Tangga'] },
  { category: 'Hiburan', subs: ['Langganan', 'Nonton & Musik', 'Jalan-jalan'] },
  { category: 'Kesehatan', subs: ['Obat', 'Dokter', 'Olahraga'] },
  { category: 'Pemasukan', subs: ['Gaji', 'Bonus', 'Pendapatan Lain'] },
];

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
  { type: 'pemasukan', category: 'Pemasukan', subCategory: 'Gaji', note: 'gaji gajian salary' },
  { type: 'pemasukan', category: 'Pemasukan', subCategory: 'Bonus', note: 'bonus thr' },
];

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORLD_CURRENCIES } from '@/lib/data/worldCurrencies';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (val: number, currency: string = 'IDR') => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(val);
};

export const getCurrencySymbol = (code: string): string => {
  return WORLD_CURRENCIES.find(c => c.code === code)?.symbol || code || 'Rp';
};

// Transfer internal antar rekening sendiri (TopUpModal) menyimpan KEDUA sisi
// dengan type yang sama persis ("transfer") — sisi "Keluar" (dari rekening
// sumber) dan sisi "Masuk" (ke rekening tujuan) cuma dibedakan lewat
// subCategory ("Transfer Masuk" / "Top Up Masuk"). Banyak halaman list
// transaksi cuma mengecek `type === 'pemasukan'` untuk warna/tanda +/-, jadi
// sisi "Masuk" ikut ketampil merah/minus seolah pengeluaran — pakai helper
// ini di semua tempat itu, bukan pengecekan type mentah.
export const isIncomingTransaction = (trx: { type?: string; subCategory?: string }): boolean => {
  if (trx.type === 'pemasukan') return true;
  if (trx.type === 'transfer' && trx.subCategory?.includes('Masuk')) return true;
  return false;
};

// "YYYY-MM-DD" dari tanggal LOKAL device (bukan UTC). `date.toISOString()`
// selalu mengonversi ke UTC dulu — jadi antara tengah malam s.d. jam offset
// timezone user (mis. 00:00-06:59 WIB/UTC+7), `.toISOString().split('T')[0]`
// diam-diam menunjukkan tanggal KEMARIN. Pakai ini untuk default tanggal apa
// pun di form (transaksi, hutang, investasi, dll) supaya selalu tanggal hari
// ini yang benar sesuai jam device user.
export const toLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

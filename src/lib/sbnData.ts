// Angka resmi untuk tab SBN & Belajar di Investasiku. DIPERBARUI MANUAL —
// ubah AS_OF + angkanya saat BI-Rate/LPS/seri SBN berubah (lihat sumber).
// Halaman menampilkan peringatan kalau AS_OF sudah lebih dari STALE_DAYS.
//
// Sumber: Bank Indonesia (BI-Rate), LPS (tingkat bunga penjaminan), DJPPR
// Kemenkeu (kupon SBN ritel). Kupon ORI/SR tetap sampai jatuh tempo; kupon
// SBR/ST mengambang = BI-Rate + spread, dengan kupon awal sebagai batas bawah.

export const AS_OF = '2026-10-29';
export const STALE_DAYS = 45;

export const BI_RATE = { rate: 5.75, decided: '2026-10-21', source: 'https://www.bi.go.id/id/fungsi-utama/moneter/bi-rate/default.aspx' };
export const LPS = {
  bankUmum: 3.75,
  bpr: 6.25,
  valas: 2,
  from: '2026-10-01',
  to: '2027-01-31',
  maxCover: 2_000_000_000,
  source: 'https://lps.go.id/tingkat-bunga-penjaminan/',
};

export type SbnKind = 'ORI' | 'SR' | 'SBR' | 'ST';
export type SbnSeries = { code: string; kind: SbnKind; coupon: number; tenorYears: number; floating: boolean; maturity?: string };

// Seri ritel yang beredar & tercatat per AS_OF (urut kupon tertinggi).
export const SBN_RETAIL: SbnSeries[] = [
  { code: 'ST016T4', kind: 'ST', coupon: 7.25, tenorYears: 4, floating: true },
  { code: 'ST016T2', kind: 'ST', coupon: 7.05, tenorYears: 2, floating: true },
  { code: 'ORI030T6', kind: 'ORI', coupon: 7.0, tenorYears: 6, floating: false },
  { code: 'ORI030T3', kind: 'ORI', coupon: 6.9, tenorYears: 3, floating: false },
  { code: 'SR025T5', kind: 'SR', coupon: 6.9, tenorYears: 5, floating: false },
  { code: 'SR025T3', kind: 'SR', coupon: 6.8, tenorYears: 3, floating: false },
  { code: 'ORI027T6', kind: 'ORI', coupon: 6.75, tenorYears: 6, floating: false },
  { code: 'ORI027T3', kind: 'ORI', coupon: 6.65, tenorYears: 3, floating: false },
];

export const SBN_KIND_INFO: Record<SbnKind, { label: string; syariah: boolean; tradable: boolean; color: string }> = {
  ORI: { label: 'Obligasi Negara Ritel', syariah: false, tradable: true, color: '#3b82f6' },
  SR: { label: 'Sukuk Ritel', syariah: true, tradable: true, color: '#16a34a' },
  SBR: { label: 'Savings Bond Ritel', syariah: false, tradable: false, color: '#0ea5e9' },
  ST: { label: 'Sukuk Tabungan', syariah: true, tradable: false, color: '#0d9488' },
};

export const SBN_SOURCES = [
  { name: 'DJPPR Kemenkeu', what: 'Kupon & penawaran SBN ritel', url: 'https://www.djppr.kemenkeu.go.id/sbnritel' },
  { name: 'Bank Indonesia', what: 'Keputusan BI-Rate', url: BI_RATE.source },
  { name: 'LPS', what: 'Tingkat bunga penjaminan', url: LPS.source },
];

// Pajak final (PP 91/2021 untuk kupon SBN; bunga deposito 20%).
export const TAX_SBN = 10;
export const TAX_DEPOSITO = 20;

/** Hasil bersih per bulan dari nominal tertentu. */
export const monthlyNet = (amount: number, couponPct: number, taxPct: number) => Math.round((amount * (couponPct / 100) * (1 - taxPct / 100)) / 12);

export const isStale = (now = new Date()) => (now.getTime() - Date.parse(`${AS_OF}T00:00:00+07:00`)) / 86400000 > STALE_DAYS;

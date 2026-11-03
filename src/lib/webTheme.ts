// Mode gelap web (bertahap). Kerangka (sidebar, header, tab bar, panel
// Pengaturan) selalu ikut tema; isi halaman hanya untuk rute yang sudah dicek
// tampilannya. Tambah prefix di sini setiap kali satu halaman selesai dirapikan.
// Dicek 2026-11-03 (screenshot 1280px, data contoh): Transaksi, Laporan,
// Rekening (kartu saldo pakai .web-keep), Anggaran, Transaksi berulang, AI Leo.
// + Investasiku, Kekayaan/Tabungan, Kotak Masuk (kartu gelap pakai .web-keep).
// Belum dicek: halaman lain (Pajak, Jejak Uang, Profil, Panduan, …).
export const WEB_DARK_READY = [
  '/membership/dashboard',
  '/membership/transactions',
  '/membership/laporan',
  '/membership/rekening',
  '/membership/budget',
  '/membership/recurring',
  '/membership/ai-leosiqra',
  '/membership/investment',
  '/membership/kekayaan',
  '/membership/tabungan',
  '/membership/kotak-masuk',
];

export const isWebDarkReady = (pathname: string | null) =>
  !!pathname && WEB_DARK_READY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

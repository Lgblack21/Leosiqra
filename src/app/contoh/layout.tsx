import type { Metadata } from 'next';

// Mode contoh: aplikasi dengan data rekaan, tanpa akun — bukan halaman konten.
export const metadata: Metadata = {
  title: 'Contoh Aplikasi | Leosiqra',
  description: 'Coba Leosiqra dengan data contoh: ringkasan harian, transaksi, laporan bulanan, dan dompet — tanpa daftar.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/contoh' },
};

export default function ContohLayout({ children }: { children: React.ReactNode }) {
  return children;
}

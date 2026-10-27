import type { Metadata } from 'next';

// Layar sambutan aplikasi (sebelum daftar) — bukan halaman konten, jadi tidak diindeks.
export const metadata: Metadata = {
  title: 'Mulai | Leosiqra',
  description: 'Mulai catat keuanganmu di Leosiqra: pilih tujuan, cara mencatat, dan buat catatan pertama sebelum membuat akun.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/mulai' },
};

export default function MulaiLayout({ children }: { children: React.ReactNode }) {
  return children;
}

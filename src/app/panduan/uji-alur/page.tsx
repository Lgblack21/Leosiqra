import type { Metadata } from 'next';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Halaman Uji Alur Penerbitan | Leosiqra',
  description: 'Halaman uji internal untuk memeriksa alur penerbitan otomatis. Tidak berisi panduan keuangan.',
  alternates: { canonical: '/panduan/uji-alur' },
  robots: { index: false, follow: false },
};

const faq: GuideFaq[] = [
  { q: 'Halaman ini untuk apa?', a: 'Hanya uji teknis alur penerbitan otomatis. Isinya tidak relevan dan akan dihapus.' },
];

export default function UjiAlurPage() {
  return (
    <GuideLayout
      eyebrow="Uji internal"
      title="Halaman uji alur penerbitan"
      lead="Halaman ini dibuat untuk memastikan tombol Terbitkan di Telegram, validasi, build, dan deploy berjalan. Tidak berisi saran keuangan."
      updated="11 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/dana-darurat', label: 'Panduan dana darurat' }}
    >
      <h2>Tujuan</h2>
      <p>Jika halaman ini bisa dibuka, berarti alur penerbitan otomatis bekerja dari ujung ke ujung.</p>
    </GuideLayout>
  );
}

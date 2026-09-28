import type { Metadata } from 'next';

// Halaman kontak adalah client component, jadi metadatanya ditaruh di sini.
export const metadata: Metadata = {
  title: 'Hubungi Kami | Leosiqra',
  description: 'Hubungi tim Leosiqra lewat WhatsApp atau email untuk pertanyaan, kendala akun, atau pembayaran paket Pro.',
};

export default function HubungiKamiLayout({ children }: { children: React.ReactNode }) {
  return children;
}

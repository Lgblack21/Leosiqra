import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pasang Aplikasi Leosiqra & Input Cepat di HP | Leosiqra',
  description:
    'Cara memasang aplikasi Leosiqra dan Input Cepat di layar utama HP Android & iPhone — tanpa Play Store, gratis, dan bisa dipasang berdampingan.',
  alternates: { canonical: '/install' },
};

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return children;
}

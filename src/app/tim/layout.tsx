import type { Metadata, Viewport } from 'next';

// Aplikasi Tim bisa dipasang sendiri di layar utama (Android Chrome & iPhone Safari), terpisah dari
// aplikasi Leosiqra pemilik: id & scope /tim, ikon hijau "TIM", judul "Tim". Pola sama dengan /input-cepat.
export const metadata: Metadata = {
  title: 'Tim · Leosiqra',
  description: 'Aplikasi tim usaha: kasir, petugas, dan penagih.',
  manifest: '/tim-manifest.json',
  icons: {
    icon: '/images/tim-192.png',
    apple: '/images/tim-180.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Tim',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function TimLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Masuk — Leosiqra', robots: { index: false, follow: false } };

// Sama dengan /app: zoom dikunci supaya kolom tidak membesar saat diketuk.
export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MasukLayout({ children }: { children: React.ReactNode }) {
  return children;
}

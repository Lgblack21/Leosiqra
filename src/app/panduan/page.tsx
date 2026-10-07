import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, HandCoins, LifeBuoy, NotebookPen, Wallet } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';

export const metadata: Metadata = {
  title: 'Panduan Keuangan Pribadi | Leosiqra',
  description:
    'Kumpulan panduan praktis keuangan pribadi: catatan keuangan pribadi & harian, mengatur gaji bulanan, dana darurat, dan cara melunasi utang.',
  alternates: { canonical: '/panduan' },
  openGraph: {
    title: 'Panduan Keuangan Pribadi | Leosiqra',
    description: 'Panduan praktis: catatan keuangan, mengatur gaji, dana darurat, dan melunasi utang.',
    url: 'https://www.leosiqra.com/panduan',
    type: 'website',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Panduan Keuangan Pribadi | Leosiqra',
    description: 'Panduan praktis: catatan keuangan, mengatur gaji, dana darurat, dan melunasi utang.',
    images: ['/images/Logo-new.png'],
  },
};

const GUIDES = [
  { href: '/catatan-keuangan-pribadi', icon: NotebookPen, title: 'Catatan Keuangan Pribadi', desc: 'Apa saja yang dicatat, contoh format, dan cara memulainya.' },
  { href: '/catatan-keuangan-harian', icon: CalendarDays, title: 'Catatan Keuangan Harian', desc: 'Contoh format harian dan tips agar konsisten mencatat.' },
  { href: '/panduan/cara-mengatur-gaji', icon: Wallet, title: 'Cara Mengatur Gaji Bulanan', desc: 'Metode 50/30/20 dengan contoh pembagian gaji 5 juta.' },
  { href: '/panduan/dana-darurat', icon: LifeBuoy, title: 'Dana Darurat', desc: 'Berapa idealnya, disimpan di mana, dan cara mengumpulkannya.' },
  { href: '/panduan/cara-melunasi-utang', icon: HandCoins, title: 'Cara Melunasi Utang', desc: 'Metode snowball vs avalanche, lengkap dengan contoh urutan.' },
];

export default function PanduanIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-900">
      <Navbar />
      <header className="relative overflow-hidden px-5 pb-12 pt-36 sm:px-6 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Panduan</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">Belajar mengatur keuangan pribadi</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Panduan singkat dan praktis — dari mencatat pengeluaran harian sampai melunasi utang.
          </p>
        </div>
      </header>
      <main className="relative flex-1 px-5 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link key={g.href} href={g.href} className="lp-card lift group flex h-full flex-col rounded-[28px] p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <g.icon size={20} />
              </span>
              <h2 className="mt-5 font-serif text-2xl">{g.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{g.desc}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600">
                Baca panduan <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

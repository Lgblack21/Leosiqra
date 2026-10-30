import type { Metadata } from 'next';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, FileSpreadsheet, HandCoins, Store, Home, LifeBuoy, NotebookPen, PiggyBank, Wallet } from 'lucide-react';
import { FileCheck, Smartphone, Users } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { ClipboardList } from 'lucide-react';
import { Target } from 'lucide-react';
import { Bot } from 'lucide-react';
import { BarChart3 } from 'lucide-react';

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
  { href: '/panduan/mengatur-gaji-mingguan', icon: CalendarClock, title: 'Cara Mengatur Gaji Mingguan', desc: 'Tagihan bulanan jadi jatah mingguan, bulan 5 minggu, contoh 500 ribu per minggu.' },
  { href: '/panduan/dana-darurat', icon: LifeBuoy, title: 'Dana Darurat', desc: 'Berapa idealnya, disimpan di mana, dan cara mengumpulkannya.' },
  { href: '/panduan/cara-membuat-anggaran-bulanan', icon: ClipboardList, title: 'Cara Membuat Anggaran Bulanan', desc: 'Dari pengeluaran nyata ke batas per kategori, contoh gaji 4 juta, cek laju di tengah bulan.' },
  { href: '/panduan/laporan-keuangan-pribadi', icon: BarChart3, title: 'Laporan Keuangan Pribadi', desc: 'Contoh laporan arus kas bulanan dan kekayaan bersih, cara membacanya, dan kesalahan yang sering terjadi.' },
  { href: '/panduan/cara-melunasi-utang', icon: HandCoins, title: 'Cara Melunasi Utang', desc: 'Metode snowball vs avalanche, lengkap dengan contoh urutan.' },
  { href: '/panduan/catat-keuangan-rumah-tangga', icon: Home, title: 'Catatan Keuangan Rumah Tangga', desc: 'Kategori yang dicatat, contoh tabel sebulan, dan cara mencatat berdua.' },
  { href: '/panduan/catat-pengeluaran-di-excel', icon: FileSpreadsheet, title: 'Catat Pengeluaran di Excel vs Aplikasi', desc: 'Template Excel sederhana, rumus SUMIF, dan kapan sebaiknya pindah ke aplikasi.' },
  { href: '/panduan/aplikasi-pencatat-pengeluaran', icon: Smartphone, title: 'Memilih Aplikasi Pencatat Pengeluaran', desc: '7 hal yang perlu dicek: kecepatan mencatat, banyak rekening, budget, biaya, privasi.' },
  { href: '/panduan/catat-keuangan-usaha-kecil', icon: Store, title: 'Catatan Keuangan Jualan (UMKM)', desc: 'Pisahkan uang usaha, catat omzet, HPP, dan biaya, lalu hitung untung bersih.' },
  { href: '/panduan/bukti-lapor-spt-coretax', icon: FileCheck, title: 'Bukti Lapor SPT Coretax (BPE)', desc: 'Di mana BPE SPT Tahunan ditemukan, cara menyimpannya, dan langkah kalau belum muncul.' },
  { href: '/panduan/cara-mencatat-uang-kas', icon: Users, title: 'Cara Mencatat Uang Kas', desc: 'Buku kas kelas, RT, arisan: kolom wajib, contoh tabel sebulan, cara melapor ke anggota.' },
  { href: '/panduan/cara-menabung-yang-benar', icon: PiggyBank, title: 'Cara Menabung yang Benar', desc: 'Sisihkan di awal, urutan dana darurat–utang–tujuan, contoh gaji 5 juta.' },
  { href: '/panduan/cara-menabung-10-juta', icon: Target, title: 'Cara Menabung 10 Juta dalam 3 Bulan', desc: 'Jatah per bulan, minggu, dan hari, cek realistis dari gaji, alternatif 6 atau 12 bulan.' },
  { href: '/panduan/cara-mengatur-gaji-3-juta', icon: Wallet, title: 'Cara Mengatur Gaji 3 Juta', desc: 'Contoh pembagian untuk anak kos, jatah makan per hari, tetap menabung walau kecil.' },
  { href: '/panduan/cara-mencatat-keuangan-di-hp', icon: Smartphone, title: 'Cara Mencatat Keuangan di HP', desc: 'Pilih alat, format catatan beberapa detik, contoh sehari, dan transfer yang bukan pengeluaran.' },
  { href: '/panduan/catatan-hutang-piutang', icon: HandCoins, title: 'Catatan Hutang Piutang', desc: 'Kolom wajib, contoh tabel, mencatat cicilan dan pelunasan, dan kesalahan yang membuat sisa salah.' },
  { href: '/panduan/mcp', icon: Bot, title: 'Hubungkan ke Claude & ChatGPT', desc: 'Tanya saldo dan catat transaksi lewat AI (MCP), plus cara memutus akses kapan saja.' },
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
        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="font-serif text-3xl">Mulai dari mana?</h2>
          <p className="mt-4 leading-relaxed text-slate-600">
            Kalau kamu belum pernah mengatur keuangan sama sekali, jangan baca semuanya sekaligus. Urutan di bawah ini
            dibuat supaya tiap langkah memakai hasil langkah sebelumnya.
          </p>
          <ol className="mt-6 list-decimal space-y-3 pl-6 leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-900">Catat dulu selama dua minggu.</strong> Tanpa catatan, semua rencana hanya
              tebakan. Mulai dari <Link href="/catatan-keuangan-harian" className="font-semibold text-indigo-600 hover:underline">catatan keuangan harian</Link>,
              atau pakai <Link href="/panduan/catat-pengeluaran-di-excel" className="font-semibold text-indigo-600 hover:underline">Excel</Link> kalau
              lebih nyaman. Untuk keluarga, lihat <Link href="/panduan/catat-keuangan-rumah-tangga" className="font-semibold text-indigo-600 hover:underline">catatan rumah tangga</Link>.
            </li>
            <li>
              <strong className="text-slate-900">Bagi gaji dengan sadar.</strong> Setelah tahu ke mana uang pergi, susun
              pembagian gaji bulanan dengan <Link href="/panduan/cara-mengatur-gaji" className="font-semibold text-indigo-600 hover:underline">metode 50/30/20</Link>.
            </li>
            <li>
              <strong className="text-slate-900">Bangun dana darurat.</strong> Sisihkan sedikit tiap bulan sampai mencapai
              target <Link href="/panduan/dana-darurat" className="font-semibold text-indigo-600 hover:underline">dana darurat</Link>, supaya kejadian
              mendadak tidak menambah utang baru.
            </li>
            <li>
              <strong className="text-slate-900">Lunasi utang berbunga.</strong> Pilih urutan pelunasan dengan
              <Link href="/panduan/cara-melunasi-utang" className="font-semibold text-indigo-600 hover:underline"> metode snowball atau avalanche</Link>.
            </li>
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-slate-500">
            Panduan ini bersifat edukasi umum, bukan nasihat keuangan pribadi. Sesuaikan dengan kondisimu sendiri.
          </p>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

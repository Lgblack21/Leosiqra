import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Dana Darurat: Berapa Idealnya & Cara Mengumpulkannya | Leosiqra',
  description:
    'Berapa dana darurat yang ideal untuk lajang, menikah, dan yang punya tanggungan, di mana sebaiknya menyimpannya, dan langkah mengumpulkannya dari gaji bulanan.',
  keywords: ['dana darurat', 'berapa dana darurat ideal', 'cara mengumpulkan dana darurat', 'dana darurat adalah', 'simpan dana darurat di mana'],
  alternates: { canonical: '/panduan/dana-darurat' },
  openGraph: {
    title: 'Dana Darurat: Berapa Idealnya & Cara Mengumpulkannya',
    description: 'Hitung target dana darurat Anda dan mulai kumpulkan dari gaji bulanan.',
    url: 'https://www.leosiqra.com/panduan/dana-darurat',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Dana Darurat: Berapa Idealnya & Cara Mengumpulkannya',
    description: 'Hitung target dana darurat Anda dan mulai kumpulkan dari gaji bulanan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya dana darurat dengan tabungan biasa?',
    a: 'Dana darurat hanya dipakai untuk kejadian tak terduga yang mendesak — kehilangan penghasilan, sakit, atau perbaikan penting. Tabungan biasa untuk tujuan yang sudah direncanakan seperti liburan atau gawai baru.',
  },
  {
    q: 'Apakah dana darurat boleh diinvestasikan di saham?',
    a: 'Sebaiknya tidak. Nilai saham bisa turun tepat saat Anda butuh uangnya. Dana darurat harus aman dan bisa dicairkan cepat.',
  },
  {
    q: 'Kalau terpakai, apa yang harus dilakukan?',
    a: 'Itu memang fungsinya. Setelah keadaan kembali normal, isi ulang pelan-pelan dengan porsi yang sama seperti saat pertama kali mengumpulkannya.',
  },
  {
    q: 'Lebih dulu dana darurat atau melunasi utang?',
    a: 'Umumnya kumpulkan dana darurat minimal satu bulan pengeluaran dulu, lalu fokus melunasi utang berbunga tinggi, kemudian lanjutkan dana darurat sampai target penuh.',
  },
];

export default function DanaDaruratPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Dana Darurat: Berapa Idealnya dan Cara Mengumpulkannya"
      lead="Dana darurat adalah bantalan saat hal tak terduga terjadi — kehilangan pekerjaan, sakit, atau kendaraan rusak — supaya Anda tidak perlu berutang. Berikut cara menghitung targetnya dan mulai mengumpulkannya."
      updated="29 September 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji bulanan' }}
    >
      <h2>Berapa dana darurat yang ideal?</h2>
      <p>Patokan yang umum dipakai adalah kelipatan <strong>pengeluaran bulanan</strong> (bukan gaji):</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kondisi</th><th>Target</th><th className="num">Contoh (pengeluaran 4 jt/bulan)</th></tr>
          </thead>
          <tbody>
            <tr><td>Lajang</td><td>3–6× pengeluaran</td><td className="num">12–24 jt</td></tr>
            <tr><td>Menikah</td><td>6–9× pengeluaran</td><td className="num">24–36 jt</td></tr>
            <tr><td>Menikah + anak / tanggungan</td><td>9–12× pengeluaran</td><td className="num">36–48 jt</td></tr>
            <tr><td>Penghasilan tidak tetap (freelance, usaha)</td><td>12× pengeluaran</td><td className="num">48 jt</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Karena itu, langkah pertama adalah tahu berapa pengeluaran bulanan Anda yang sebenarnya — dari{' '}
        <Link href="/catatan-keuangan-pribadi">catatan keuangan pribadi</Link>, bukan dari perkiraan.
      </p>

      <h2>Di mana menyimpan dana darurat?</h2>
      <ul>
        <li><strong>Rekening terpisah</strong> dari rekening harian, supaya tidak ikut terpakai.</li>
        <li><strong>Mudah dicairkan</strong> dalam 1–2 hari — tabungan bank, reksa dana pasar uang, atau deposito bertenor pendek.</li>
        <li><strong>Nilainya stabil</strong> — hindari instrumen yang harganya naik-turun seperti saham atau kripto.</li>
      </ul>

      <h2>Cara mengumpulkannya langkah demi langkah</h2>
      <ol>
        <li><strong>Hitung target</strong> dari tabel di atas.</li>
        <li><strong>Mulai dari target kecil</strong> — satu bulan pengeluaran dulu, supaya cepat terasa hasilnya.</li>
        <li><strong>Setor otomatis di hari gajian</strong>, misalnya 10–20% dari gaji.</li>
        <li><strong>Masukkan uang tak terduga</strong> seperti bonus atau THR sebagian ke dana darurat.</li>
        <li><strong>Pantau progresnya</strong> setiap bulan sampai target penuh.</li>
      </ol>

      <h2>Memantau dana darurat dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, dana darurat bisa dibuat sebagai tujuan tabungan tersendiri. Setiap setoran tercatat,
        saldo rekening sumbernya ikut berkurang otomatis, dan setoran bulanan bisa dijadwalkan sebagai transaksi rutin
        supaya tidak lupa. Dengan begitu Anda selalu tahu sudah berapa persen menuju target.
      </p>
    </GuideLayout>
  );
}

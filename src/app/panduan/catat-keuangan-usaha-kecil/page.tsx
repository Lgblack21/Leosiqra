import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mencatat Pemasukan & Pengeluaran Jualan | Leosiqra',
  description:
    'Cara mencatat keuangan jualan untuk UMKM: pisahkan uang pribadi dan usaha, apa yang dicatat, contoh catatan harian, dan cara menghitung untung bersih.',
  keywords: [
    'cara mencatat pengeluaran dan pemasukan jualan',
    'catatan keuangan umkm',
    'cara mencatat keuangan usaha kecil',
    'contoh catatan keuangan jualan',
    'cara menghitung untung bersih jualan',
  ],
  alternates: { canonical: '/panduan/catat-keuangan-usaha-kecil' },
  openGraph: {
    title: 'Cara Mencatat Pemasukan & Pengeluaran Jualan (UMKM)',
    description: 'Pisahkan uang usaha, catat modal, omzet, biaya, dan stok, lalu hitung untung bersih dengan contoh sederhana.',
    url: 'https://www.leosiqra.com/panduan/catat-keuangan-usaha-kecil',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mencatat Pemasukan & Pengeluaran Jualan (UMKM)',
    description: 'Pisahkan uang usaha, catat modal, omzet, biaya, dan stok, lalu hitung untung bersih dengan contoh sederhana.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apakah omzet sama dengan untung?',
    a: 'Tidak. Omzet adalah total uang hasil penjualan. Untung bersih baru didapat setelah omzet dikurangi harga pokok barang yang terjual dan semua biaya operasional seperti kemasan, ongkir, dan iklan.',
  },
  {
    q: 'Usaha masih kecil, perlu rekening terpisah?',
    a: 'Sangat disarankan, walaupun hanya dompet atau e-wallet terpisah. Tanpa pemisahan, uang belanja pribadi dan uang modal tercampur sehingga untung usaha tidak pernah benar-benar terlihat.',
  },
  {
    q: 'Bolehkah pemilik mengambil uang dari kas usaha?',
    a: 'Boleh, asalkan dicatat sebagai pengambilan pribadi (prive) atau gaji pemilik dengan jumlah tetap. Yang membuat usaha kecil kehabisan modal biasanya pengambilan yang tidak dicatat.',
  },
  {
    q: 'Seberapa sering stok perlu dihitung?',
    a: 'Untuk usaha kecil, hitung stok fisik minimal sebulan sekali dan cocokkan dengan catatan. Selisih yang besar menandakan ada barang rusak, hilang, atau penjualan yang lupa dicatat.',
  },
];

export default function CatatKeuanganUsahaKecilPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mencatat Pemasukan & Pengeluaran Jualan (UMKM)"
      lead="Banyak usaha kecil terlihat ramai pembeli tapi uangnya tidak pernah terasa bertambah. Penyebabnya sering sederhana: omzet dianggap untung, dan uang usaha tercampur dengan uang pribadi. Berikut cara mencatat keuangan jualan yang cukup sederhana untuk dilakukan setiap hari."
      updated="12 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/catat-pengeluaran-di-excel', label: 'Catat pengeluaran di Excel vs aplikasi' }}
    >
      <h2>1. Pisahkan uang pribadi dan uang usaha</h2>
      <p>
        Ini langkah paling penting dan paling sering dilewati. Pakai rekening, e-wallet, atau minimal dompet terpisah
        khusus usaha. Semua uang hasil jualan masuk ke sana, dan semua belanja usaha keluar dari sana. Kalau Anda
        mengambil uang usaha untuk keperluan pribadi, catat sebagai <strong>pengambilan pribadi (prive)</strong> —
        bukan biaya usaha.
      </p>
      <p>
        Cara yang lebih rapi: tetapkan <strong>gaji untuk diri sendiri</strong> dengan jumlah tetap setiap bulan. Untuk
        mengatur gaji itu di sisi pribadi, lihat panduan <Link href="/panduan/cara-mengatur-gaji">mengatur gaji bulanan</Link>.
      </p>

      <h2>2. Yang perlu dicatat: modal, omzet, biaya, stok</h2>
      <ul>
        <li><strong>Modal</strong> — uang awal yang dimasukkan ke usaha, termasuk tambahan modal di tengah jalan.</li>
        <li><strong>Omzet (pemasukan penjualan)</strong> — setiap penjualan: tanggal, barang, jumlah, harga, dan cara bayar (tunai/transfer/e-wallet).</li>
        <li><strong>Harga pokok penjualan (HPP)</strong> — biaya bahan atau harga beli barang yang benar-benar terjual.</li>
        <li><strong>Biaya operasional</strong> — kemasan, ongkir yang Anda tanggung, iklan, potongan marketplace, listrik dan internet bagian usaha, upah pegawai.</li>
        <li><strong>Stok</strong> — jumlah barang masuk, keluar, dan sisa, supaya HPP bisa dihitung dan barang tidak kosong mendadak.</li>
      </ul>

      <h2>3. Contoh catatan harian jualan</h2>
      <p>Contoh satu hari penjual keripik online dengan harga jual Rp15.000 dan HPP Rp8.000 per bungkus (angka ilustrasi):</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th></tr>
          </thead>
          <tbody>
            <tr><td>Penjualan 20 bungkus</td><td className="num">300.000</td><td className="num"></td></tr>
            <tr><td>HPP 20 bungkus × 8.000</td><td className="num"></td><td className="num">160.000</td></tr>
            <tr><td>Plastik &amp; stiker kemasan</td><td className="num"></td><td className="num">20.000</td></tr>
            <tr><td>Iklan media sosial</td><td className="num"></td><td className="num">25.000</td></tr>
            <tr><td><strong>Untung bersih hari ini</strong></td><td className="num"><strong>95.000</strong></td><td className="num"></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Perhatikan bahwa dari omzet Rp300.000, yang benar-benar menjadi untung hanya Rp95.000. Kalau seluruh Rp300.000
        dianggap boleh dibelanjakan, modal untuk produksi berikutnya ikut habis.
      </p>

      <h2>4. Hitung untung bersih sederhana</h2>
      <p>Rumus dasarnya:</p>
      <ol>
        <li><strong>Laba kotor</strong> = omzet − HPP</li>
        <li><strong>Laba bersih</strong> = laba kotor − biaya operasional</li>
      </ol>
      <p>Contoh rekap satu bulan dari usaha yang sama, 500 bungkus terjual (angka ilustrasi):</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Omzet (500 × 15.000)</td><td className="num">7.500.000</td></tr>
            <tr><td>HPP (500 × 8.000)</td><td className="num">−4.000.000</td></tr>
            <tr><td><strong>Laba kotor</strong></td><td className="num"><strong>3.500.000</strong></td></tr>
            <tr><td>Kemasan</td><td className="num">−500.000</td></tr>
            <tr><td>Subsidi ongkir</td><td className="num">−300.000</td></tr>
            <tr><td>Iklan</td><td className="num">−600.000</td></tr>
            <tr><td>Listrik &amp; internet (bagian usaha)</td><td className="num">−200.000</td></tr>
            <tr><td><strong>Laba bersih</strong></td><td className="num"><strong>1.900.000</strong></td></tr>
            <tr><td>Gaji pemilik (prive)</td><td className="num">−1.500.000</td></tr>
            <tr><td><strong>Sisa untuk kas usaha</strong></td><td className="num"><strong>400.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dengan rekap seperti ini Anda tahu pos mana yang paling besar menggerus untung — misalnya iklan — dan bisa
        menyisihkan sebagian sisa kas usaha sebagai cadangan, mirip <Link href="/panduan/dana-darurat">dana darurat</Link>{' '}
        untuk usaha.
      </p>

      <h2>5. Tips mencatat cepat supaya tidak bolong</h2>
      <ul>
        <li><strong>Catat saat transaksi terjadi</strong>, bukan malam hari dari ingatan.</li>
        <li><strong>Simpan foto struk belanja bahan</strong> — lebih cepat daripada mengetik ulang semua angka.</li>
        <li><strong>Pakai kategori yang sama setiap hari</strong> supaya rekap bulanan bisa dibandingkan.</li>
        <li><strong>Cocokkan saldo</strong> kas/rekening usaha dengan catatan setiap akhir minggu.</li>
      </ul>
      <p>
        Kalau masih ragu memilih alat, bandingkan dulu di panduan{' '}
        <Link href="/panduan/catat-pengeluaran-di-excel">catat pengeluaran di Excel vs aplikasi</Link>.
      </p>

      <h2>Mencatat keuangan jualan dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, transaksi bisa dicatat dengan mengetik singkat, lewat suara, atau dengan memindai
        foto struk. Buat sumber dana terpisah untuk usaha — misalnya rekening usaha dan kas tunai jualan — di samping
        rekening pribadi, lalu lihat rekap per kategori setiap bulan. Untuk dasar-dasar mencatat, lihat juga{' '}
        <Link href="/catatan-keuangan-harian">contoh catatan keuangan harian</Link>.
      </p>
      <p>
        <em>Panduan ini bersifat edukasi umum, bukan nasihat keuangan, akuntansi, atau pajak. Sesuaikan dengan kondisi usaha Anda.</em>
      </p>
    </GuideLayout>
  );
}

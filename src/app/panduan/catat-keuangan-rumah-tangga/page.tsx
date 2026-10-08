import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mencatat Keuangan Rumah Tangga + Contoh | Leosiqra',
  description:
    'Cara mencatat pemasukan dan pengeluaran rumah tangga: kategori yang perlu dicatat, contoh tabel satu bulan, dan aturan sederhana mencatat berdua.',
  keywords: [
    'cara mencatat pengeluaran dan pemasukan rumah tangga',
    'catatan keuangan rumah tangga',
    'contoh catatan keuangan rumah tangga',
    'mengatur keuangan rumah tangga',
  ],
  alternates: { canonical: '/panduan/catat-keuangan-rumah-tangga' },
  openGraph: {
    title: 'Cara Mencatat Keuangan Rumah Tangga (Contoh & Template)',
    description: 'Kategori yang perlu dicatat, contoh tabel sebulan, dan cara mencatat berdua tanpa ribut.',
    url: 'https://www.leosiqra.com/panduan/catat-keuangan-rumah-tangga',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mencatat Keuangan Rumah Tangga (Contoh & Template)',
    description: 'Kategori yang perlu dicatat, contoh tabel sebulan, dan cara mencatat berdua tanpa ribut.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Siapa yang sebaiknya mencatat keuangan rumah tangga?',
    a: 'Siapa pun yang memegang uang saat transaksi terjadi. Yang penting semua transaksi masuk ke satu catatan yang sama, bukan siapa yang mencatat.',
  },
  {
    q: 'Perlu dicatat sampai uang parkir dan jajan anak?',
    a: 'Ya, setidaknya di awal. Pengeluaran kecil yang sering terjadi biasanya justru yang membuat uang terasa cepat habis. Setelah polanya terlihat, Anda bisa menggabungkannya ke satu kategori.',
  },
  {
    q: 'Bagaimana kalau pemasukan suami dan istri berbeda rekening?',
    a: 'Tidak masalah. Catat setiap rekening sebagai sumber terpisah, lalu lihat totalnya bersama setiap akhir bulan.',
  },
  {
    q: 'Berapa lama sampai catatan terasa manfaatnya?',
    a: 'Umumnya setelah satu bulan penuh. Di titik itu Anda sudah punya angka pengeluaran per kategori yang nyata untuk dijadikan dasar anggaran bulan berikutnya.',
  },
];

export default function CatatKeuanganRumahTanggaPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mencatat Keuangan Rumah Tangga (Contoh & Template)"
      lead="Uang rumah tangga sering terasa habis sebelum akhir bulan tanpa jelas ke mana perginya. Catatan yang rapi membuat kebocoran itu terlihat. Berikut kategori yang perlu dicatat, contoh tabel satu bulan, dan aturan sederhana kalau mencatat berdua."
      updated="8 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji bulanan' }}
    >
      <h2>Kenapa keuangan rumah tangga sering bocor?</h2>
      <ul>
        <li><strong>Banyak pemegang uang</strong> — suami, istri, kadang orang tua atau asisten rumah tangga ikut belanja.</li>
        <li><strong>Banyak pengeluaran kecil</strong> — jajan, parkir, ongkir, isi ulang pulsa — yang tidak terasa satu per satu.</li>
        <li><strong>Pengeluaran tidak rutin</strong> — kondangan, servis kendaraan, biaya sekolah tahunan — yang tidak disiapkan.</li>
        <li><strong>Tidak ada angka pembanding</strong>, sehingga sulit tahu apakah bulan ini lebih boros dari bulan lalu.</li>
      </ul>

      <h2>Kategori yang perlu dicatat</h2>
      <p>Mulai dengan kategori sedikit tapi jelas. Contoh susunan yang umum dipakai rumah tangga:</p>
      <ul>
        <li><strong>Pemasukan</strong> — gaji, usaha sampingan, bonus/THR, pemasukan lain.</li>
        <li><strong>Kebutuhan pokok</strong> — belanja dapur, listrik, air, gas, internet, pulsa.</li>
        <li><strong>Cicilan &amp; utang</strong> — KPR/kontrakan, kendaraan, paylater, kartu kredit.</li>
        <li><strong>Anak</strong> — sekolah, les, susu, popok, uang jajan.</li>
        <li><strong>Transportasi</strong> — bensin, ojek, parkir, tol.</li>
        <li><strong>Sosial</strong> — kondangan, arisan, sumbangan, keluarga besar.</li>
        <li><strong>Tabungan &amp; dana darurat</strong> — dicatat sebagai pos tersendiri, bukan sisa.</li>
      </ul>

      <h2>Contoh tabel catatan satu bulan</h2>
      <p>Contoh ringkasan bulanan sebuah keluarga dengan pemasukan gabungan Rp8.000.000 (angka ilustrasi):</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kategori</th><th className="num">Anggaran</th><th className="num">Realisasi</th><th className="num">Selisih</th></tr>
          </thead>
          <tbody>
            <tr><td>Kebutuhan pokok</td><td className="num">2.800.000</td><td className="num">3.050.000</td><td className="num">−250.000</td></tr>
            <tr><td>Cicilan &amp; utang</td><td className="num">1.800.000</td><td className="num">1.800.000</td><td className="num">0</td></tr>
            <tr><td>Anak</td><td className="num">1.000.000</td><td className="num">1.150.000</td><td className="num">−150.000</td></tr>
            <tr><td>Transportasi</td><td className="num">600.000</td><td className="num">520.000</td><td className="num">+80.000</td></tr>
            <tr><td>Sosial</td><td className="num">400.000</td><td className="num">650.000</td><td className="num">−250.000</td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">1.400.000</td><td className="num">830.000</td><td className="num">−570.000</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>8.000.000</strong></td><td className="num"><strong>8.000.000</strong></td><td className="num"></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dari tabel seperti ini langsung terlihat bahwa kelebihan belanja dapur dan kondangan &quot;memakan&quot; jatah
        tabungan. Itulah gunanya mencatat: keputusan bulan depan berdasarkan angka, bukan perasaan. Untuk format
        pencatatan per hari, lihat <Link href="/catatan-keuangan-harian">contoh catatan keuangan harian</Link>.
      </p>

      <h2>Mencatat berdua: aturan sederhana</h2>
      <ol>
        <li><strong>Satu catatan bersama</strong>, bukan dua buku terpisah yang tidak pernah digabung.</li>
        <li><strong>Catat di hari yang sama</strong> saat transaksi terjadi — menunda sampai akhir pekan membuat banyak yang lupa.</li>
        <li><strong>Sepakati kategori</strong> di awal supaya pengeluaran yang sama tidak masuk ke kategori berbeda.</li>
        <li><strong>Rapat singkat di akhir bulan</strong> — 15 menit membandingkan anggaran dan realisasi, tanpa saling menyalahkan.</li>
        <li><strong>Tetapkan pos tabungan di awal</strong>, dengan metode seperti di panduan{' '}
          <Link href="/panduan/cara-mengatur-gaji">mengatur gaji bulanan</Link>.</li>
      </ol>

      <h2>Setelah catatan rapi, lalu apa?</h2>
      <p>
        Angka pengeluaran bulanan yang nyata adalah dasar untuk menentukan target{' '}
        <Link href="/panduan/dana-darurat">dana darurat</Link> keluarga, dan menunjukkan berapa yang bisa dialokasikan
        untuk <Link href="/panduan/cara-melunasi-utang">melunasi utang</Link> lebih cepat.
      </p>

      <h2>Mencatat keuangan rumah tangga dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, transaksi bisa dicatat dengan mengetik singkat, lewat suara, atau dengan memindai foto
        struk belanja. Setiap rekening — misalnya rekening gaji suami, rekening istri, dan dompet tunai — dicatat sebagai
        sumber terpisah, lalu rekap bulanan per kategori tersusun otomatis sehingga rapat akhir bulan cukup melihat satu
        layar. Lihat juga <Link href="/catatan-keuangan-pribadi">panduan catatan keuangan pribadi</Link> untuk dasar-dasarnya.
      </p>
    </GuideLayout>
  );
}

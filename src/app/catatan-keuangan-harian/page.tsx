import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Catatan Keuangan Harian: Contoh Format & Tips | Leosiqra',
  description:
    'Cara membuat catatan keuangan harian yang konsisten: contoh format pemasukan dan pengeluaran, tips agar tidak lupa mencatat, dan aplikasi yang cepat diisi.',
  keywords: ['catatan keuangan harian', 'contoh catatan keuangan harian', 'format catatan keuangan harian', 'aplikasi catatan keuangan harian'],
  alternates: { canonical: '/catatan-keuangan-harian' },
  openGraph: {
    title: 'Catatan Keuangan Harian: Contoh Format & Cara Konsisten',
    description: 'Contoh format, tips konsisten, dan cara cepat mencatat pemasukan & pengeluaran harian.',
    url: 'https://www.leosiqra.com/catatan-keuangan-harian',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Catatan Keuangan Harian: Contoh Format & Cara Konsisten',
    description: 'Contoh format, tips konsisten, dan cara cepat mencatat pemasukan & pengeluaran harian.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa itu catatan keuangan harian?',
    a: 'Catatan keuangan harian adalah daftar semua pemasukan dan pengeluaran yang terjadi setiap hari, dicatat di hari yang sama — lengkap dengan tanggal, keterangan, kategori, jumlah, dan dari rekening mana uangnya.',
  },
  {
    q: 'Apakah pengeluaran kecil seperti parkir perlu dicatat?',
    a: 'Perlu. Pengeluaran kecil yang terjadi hampir setiap hari justru yang paling sering membuat anggaran jebol, karena jumlahnya baru terasa setelah dijumlahkan sebulan.',
  },
  {
    q: 'Kapan waktu terbaik mencatat keuangan harian?',
    a: 'Idealnya langsung setelah transaksi terjadi. Kalau tidak sempat, sisihkan 2–3 menit sebelum tidur untuk mencatat semua transaksi hari itu dari struk atau riwayat e-wallet.',
  },
  {
    q: 'Bagaimana kalau sempat lupa mencatat beberapa hari?',
    a: 'Jangan berhenti. Cek riwayat mutasi bank dan e-wallet untuk melengkapi yang terlewat, lalu cocokkan saldo di catatan dengan saldo sebenarnya. Setelah itu lanjutkan kebiasaan mencatat seperti biasa.',
  },
  {
    q: 'Aplikasi apa yang cocok untuk catatan keuangan harian?',
    a: 'Pilih aplikasi yang paling cepat diisi dan menghitung saldo otomatis. Di Leosiqra, transaksi bisa dicatat dengan mengetik singkat seperti "25rb kopi", dengan suara, atau foto struk.',
  },
];

export default function CatatanKeuanganHarianPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Catatan Keuangan Harian: Contoh Format & Cara Konsisten Mencatat"
      lead="Catatan keuangan harian adalah fondasi dari semua pengelolaan uang. Kuncinya bukan format yang rumit, tapi konsisten mencatat setiap hari. Berikut contoh format dan cara membuatnya jadi kebiasaan."
      updated="28 September 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-pribadi', label: 'Panduan lengkap catatan keuangan pribadi' }}
    >
      <h2>Apa yang dicatat setiap hari?</h2>
      <p>Setiap transaksi cukup punya lima informasi:</p>
      <ul>
        <li><strong>Tanggal</strong> transaksi.</li>
        <li><strong>Keterangan</strong> singkat — misalnya &quot;makan siang&quot; atau &quot;isi bensin&quot;.</li>
        <li><strong>Kategori</strong> — makan, transportasi, belanja, tagihan, dan seterusnya.</li>
        <li><strong>Jumlah</strong>, dan apakah itu pemasukan atau pengeluaran.</li>
        <li><strong>Sumber dana</strong> — rekening bank, e-wallet, atau uang tunai.</li>
      </ul>

      <h2>Contoh format catatan keuangan harian</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Sumber</th><th className="num">Masuk</th><th className="num">Keluar</th></tr>
          </thead>
          <tbody>
            <tr><td>1 Okt</td><td>Gaji Oktober</td><td>Gaji</td><td>Bank</td><td className="num">8.000.000</td><td className="num"></td></tr>
            <tr><td>1 Okt</td><td>Kopi pagi</td><td>Makan &amp; minum</td><td>E-wallet</td><td className="num"></td><td className="num">25.000</td></tr>
            <tr><td>1 Okt</td><td>Makan siang</td><td>Makan &amp; minum</td><td>Tunai</td><td className="num"></td><td className="num">35.000</td></tr>
            <tr><td>1 Okt</td><td>Isi bensin</td><td>Transportasi</td><td>Bank</td><td className="num"></td><td className="num">50.000</td></tr>
            <tr><td>1 Okt</td><td>Token listrik</td><td>Tagihan</td><td>E-wallet</td><td className="num"></td><td className="num">200.000</td></tr>
            <tr><td><strong>Total</strong></td><td></td><td></td><td></td><td className="num"><strong>8.000.000</strong></td><td className="num"><strong>310.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Kolom <strong>Sumber</strong> penting supaya saldo tiap rekening bisa dicocokkan. Di akhir bulan, semua baris ini
        dijumlahkan per kategori menjadi rekap bulanan di <Link href="/catatan-keuangan-pribadi">catatan keuangan pribadi</Link>.
      </p>

      <h2>Tips agar konsisten mencatat setiap hari</h2>
      <ol>
        <li><strong>Catat langsung saat transaksi.</strong> Menunda sampai malam membuat banyak transaksi kecil terlupa.</li>
        <li><strong>Buat secepat mungkin.</strong> Semakin sedikit langkah untuk mencatat, semakin besar kemungkinan Anda tetap melakukannya.</li>
        <li><strong>Simpan struk</strong> atau foto struk untuk transaksi yang belum sempat dicatat.</li>
        <li><strong>Cocokkan saldo seminggu sekali</strong> dengan saldo bank dan e-wallet yang sebenarnya.</li>
        <li><strong>Jangan mengejar sempurna.</strong> Lupa satu-dua transaksi tidak apa-apa — yang penting kebiasaannya tidak berhenti.</li>
      </ol>

      <h2>Catatan keuangan harian lewat aplikasi</h2>
      <p>
        Hambatan terbesar catatan keuangan harian adalah repotnya mencatat. <strong>Leosiqra</strong> dirancang supaya satu
        transaksi bisa dicatat dalam hitungan detik:
      </p>
      <ul>
        <li><strong>Ketik singkat</strong> seperti &quot;25rb kopi&quot; — jumlah dan kategori dikenali otomatis.</li>
        <li><strong>Pakai suara</strong> saat sedang di jalan.</li>
        <li><strong>Foto struk</strong> belanja, isinya dibaca otomatis.</li>
        <li><strong>Transaksi rutin</strong> seperti tagihan bulanan tercatat otomatis sesuai jadwal.</li>
        <li>Saldo setiap rekening langsung ter-update, dan rekap harian, bulanan, serta tahunan tersusun sendiri.</li>
      </ul>
      <p>
        Lihat cara kerjanya di halaman <Link href="/#input-cepat">Input Cepat</Link>, atau{' '}
        <Link href="/auth/register">coba gratis 14 hari</Link>.
      </p>
    </GuideLayout>
  );
}

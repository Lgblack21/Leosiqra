import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Laporan Keuangan Pribadi: Contoh Sederhana | Leosiqra',
  description:
    'Cara membuat laporan keuangan pribadi bulanan: contoh arus kas dan kekayaan bersih (aset − utang), cara membacanya, dan kesalahan yang sering terjadi.',
  keywords: [
    'laporan keuangan pribadi',
    'contoh laporan keuangan pribadi',
    'contoh laporan keuangan pribadi sederhana',
    'cara membuat laporan keuangan pribadi',
    'laporan keuangan pribadi bulanan',
  ],
  alternates: { canonical: '/panduan/laporan-keuangan-pribadi' },
  openGraph: {
    title: 'Laporan Keuangan Pribadi: Contoh Sederhana dan Cara Membuatnya',
    description: 'Contoh laporan arus kas bulanan dan kekayaan bersih, cara membacanya, dan kesalahan yang membuat laporan menyesatkan.',
    url: 'https://www.leosiqra.com/panduan/laporan-keuangan-pribadi',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Laporan Keuangan Pribadi: Contoh Sederhana dan Cara Membuatnya',
    description: 'Contoh laporan arus kas bulanan dan kekayaan bersih, cara membacanya, dan kesalahan yang membuat laporan menyesatkan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya catatan keuangan dan laporan keuangan pribadi?',
    a: 'Catatan keuangan adalah daftar transaksi satu per satu: tanggal, nominal, kategori, rekening. Laporan keuangan adalah ringkasan dari catatan itu untuk satu periode, misalnya sebulan: berapa yang masuk, berapa yang keluar, ke mana saja, dan berapa kekayaan bersih Anda di akhir periode. Tanpa catatan yang rapi, laporan tidak bisa dibuat.',
  },
  {
    q: 'Seberapa sering laporan keuangan pribadi perlu dibuat?',
    a: 'Sebulan sekali sudah cukup untuk kebanyakan orang, misalnya setiap tanggal gajian atau akhir bulan. Yang penting tanggalnya konsisten supaya laporan bulan ini bisa dibandingkan dengan bulan lalu.',
  },
  {
    q: 'Apakah setoran ke tabungan dihitung sebagai pengeluaran?',
    a: 'Tidak. Uang yang dipindah ke tabungan atau rekening lain masih milik Anda, jadi bukan pengeluaran. Di laporan arus kas, setoran tabungan diambil dari sisa (pemasukan dikurangi pengeluaran). Di laporan kekayaan, tabungan tetap dihitung sebagai aset.',
  },
  {
    q: 'Investasi dinilai pakai harga beli atau harga sekarang?',
    a: 'Untuk kekayaan bersih, pakai perkiraan nilai saat ini pada tanggal laporan, misalnya harga pasar terakhir atau nilai yang tertera di aplikasi investasi. Harga beli tetap disimpan supaya Anda tahu sedang untung atau rugi.',
  },
];

export default function LaporanKeuanganPribadiPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Laporan Keuangan Pribadi: Contoh Sederhana dan Cara Membuatnya"
      lead="Mencatat pengeluaran setiap hari baru setengah jalan. Supaya catatan itu berguna, Anda perlu meringkasnya menjadi laporan: berapa yang masuk, berapa yang keluar, dan apakah kekayaan Anda bertambah. Panduan ini membahas dua bagian laporan keuangan pribadi, lengkap dengan contoh sederhana, cara membacanya, dan kesalahan yang paling sering membuat laporan menyesatkan."
      updated="30 Oktober 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-pribadi', label: 'Catatan keuangan pribadi: apa saja yang dicatat' }}
    >
      <h2>1. Dua bagian laporan keuangan pribadi</h2>
      <p>Laporan keuangan pribadi yang sederhana cukup terdiri dari dua bagian:</p>
      <ul>
        <li>
          <strong>Laporan arus kas</strong> — pemasukan dan pengeluaran selama satu periode (misalnya Oktober). Menjawab
          pertanyaan: <em>bulan ini saya surplus atau minus?</em>
        </li>
        <li>
          <strong>Laporan kekayaan bersih</strong> — semua yang Anda miliki (aset) dikurangi semua yang harus Anda bayar
          (utang) pada satu tanggal (misalnya 31 Oktober). Menjawab pertanyaan: <em>kondisi keuangan saya makin kuat atau
          makin lemah?</em>
        </li>
      </ul>
      <p>
        Keduanya saling melengkapi. Seseorang bisa surplus setiap bulan tetapi kekayaan bersihnya tidak naik karena
        sisanya habis untuk membayar utang lama, atau sebaliknya.
      </p>

      <h2>2. Bahan yang perlu disiapkan</h2>
      <ol>
        <li>
          <strong>Catatan transaksi sebulan</strong> — setiap pemasukan dan pengeluaran beserta kategorinya. Kalau belum
          punya, mulai dari format di <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
        </li>
        <li><strong>Saldo semua rekening</strong> pada tanggal laporan: bank, e-wallet, dan uang tunai.</li>
        <li><strong>Nilai tabungan dan investasi</strong> pada tanggal yang sama.</li>
        <li>
          <strong>Sisa utang dan piutang</strong> — termasuk tagihan kartu kredit dan cicilan. Cara mencatatnya ada di{' '}
          <Link href="/panduan/catatan-hutang-piutang">catatan hutang piutang</Link>.
        </li>
      </ol>

      <h2>3. Contoh laporan arus kas bulanan</h2>
      <p>Contoh <em>ilustrasi</em> laporan bulan Oktober seorang karyawan:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Pemasukan</strong></td><td className="num"></td></tr>
            <tr><td>Gaji</td><td className="num">6.000.000</td></tr>
            <tr><td>Penghasilan sampingan</td><td className="num">500.000</td></tr>
            <tr><td><strong>Total pemasukan</strong></td><td className="num"><strong>6.500.000</strong></td></tr>
            <tr><td><strong>Pengeluaran</strong></td><td className="num"></td></tr>
            <tr><td>Tempat tinggal</td><td className="num">1.500.000</td></tr>
            <tr><td>Makan &amp; minum</td><td className="num">1.800.000</td></tr>
            <tr><td>Transportasi</td><td className="num">600.000</td></tr>
            <tr><td>Tagihan (listrik, pulsa, internet)</td><td className="num">400.000</td></tr>
            <tr><td>Cicilan</td><td className="num">500.000</td></tr>
            <tr><td>Lain-lain</td><td className="num">700.000</td></tr>
            <tr><td><strong>Total pengeluaran</strong></td><td className="num"><strong>5.500.000</strong></td></tr>
            <tr><td><strong>Sisa (surplus)</strong></td><td className="num"><strong>1.000.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Sisa Rp1.000.000 berarti sekitar 15% dari pemasukan berhasil disisihkan (1.000.000 ÷ 6.500.000). Sisa inilah yang
        bisa dipindah ke tabungan atau dana darurat. Pemindahan itu tidak ditulis lagi sebagai pengeluaran.
      </p>

      <h2>4. Contoh laporan kekayaan bersih</h2>
      <p>Masih <em>ilustrasi</em> orang yang sama, posisi per 31 Oktober:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Aset</strong></td><td className="num"></td></tr>
            <tr><td>Rekening bank &amp; uang tunai</td><td className="num">3.200.000</td></tr>
            <tr><td>E-wallet</td><td className="num">300.000</td></tr>
            <tr><td>Tabungan (target dana darurat)</td><td className="num">4.000.000</td></tr>
            <tr><td>Investasi (nilai saat ini)</td><td className="num">5.500.000</td></tr>
            <tr><td>Piutang (uang yang dipinjam orang)</td><td className="num">750.000</td></tr>
            <tr><td><strong>Total aset</strong></td><td className="num"><strong>13.750.000</strong></td></tr>
            <tr><td><strong>Utang</strong></td><td className="num"></td></tr>
            <tr><td>Tagihan kartu kredit</td><td className="num">1.200.000</td></tr>
            <tr><td>Sisa cicilan HP</td><td className="num">2.000.000</td></tr>
            <tr><td><strong>Total utang</strong></td><td className="num"><strong>3.200.000</strong></td></tr>
            <tr><td><strong>Kekayaan bersih</strong></td><td className="num"><strong>10.550.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Kekayaan bersih = total aset − total utang = Rp13.750.000 − Rp3.200.000 = <strong>Rp10.550.000</strong>. Utang
        setara sekitar 23% dari aset (3.200.000 ÷ 13.750.000).
      </p>
      <p>
        Supaya sederhana, contoh ini tidak memasukkan barang pakai seperti HP atau motor karena nilainya terus turun dan
        sulit ditaksir. Kalau ingin memasukkannya, pakai taksiran harga jual bekas yang wajar, bukan harga beli.
      </p>

      <h2>5. Cara membaca laporan</h2>
      <p>Tidak perlu analisis rumit. Cukup lihat tiga hal setiap bulan:</p>
      <ul>
        <li>
          <strong>Sisa arus kas</strong> — positif atau negatif? Kalau minus dua bulan berturut-turut, cek kategori
          pengeluaran terbesar dan tetapkan batasnya di <Link href="/panduan/cara-membuat-anggaran-bulanan">anggaran
          bulanan</Link>.
        </li>
        <li>
          <strong>Kekayaan bersih dibanding bulan lalu</strong> — naik, tetap, atau turun? Angka ini juga dipengaruhi naik
          turunnya harga investasi, jadi jangan panik karena satu bulan saja; lihat arahnya dalam beberapa bulan.
        </li>
        <li>
          <strong>Porsi utang terhadap aset</strong> — kalau makin besar dari bulan ke bulan, prioritaskan pelunasan.
          Urutannya bisa dipilih dengan <Link href="/panduan/cara-melunasi-utang">metode snowball atau avalanche</Link>.
        </li>
      </ul>

      <h2>6. Kesalahan yang membuat laporan menyesatkan</h2>
      <ul>
        <li>
          <strong>Transfer antar rekening dihitung sebagai pengeluaran.</strong> Pindah dari bank ke e-wallet bukan uang
          keluar; kalau dicatat dua kali, pengeluaran terlihat membengkak.
        </li>
        <li>
          <strong>Uang pinjaman dihitung sebagai pemasukan.</strong> Pinjaman menambah saldo sekaligus utang, jadi tidak
          menambah kekayaan bersih.
        </li>
        <li>
          <strong>Tagihan kartu kredit dilupakan.</strong> Belanja pakai kartu kredit sudah mengurangi kekayaan walau
          tagihannya baru dibayar bulan depan.
        </li>
        <li>
          <strong>Investasi dinilai dengan harga beli.</strong> Kekayaan bersih jadi tidak mencerminkan nilai sebenarnya.
        </li>
        <li>
          <strong>Saldo di laporan tidak dicocokkan.</strong> Sebelum menutup laporan, samakan saldo rekening di catatan
          dengan saldo di aplikasi bank. Selisih biasanya berarti ada transaksi yang lupa dicatat.
        </li>
      </ul>

      <h2>7. Membuat laporan di Excel atau spreadsheet</h2>
      <p>
        Kalau memakai spreadsheet, buat dua lembar: <strong>Arus kas</strong> yang menjumlah transaksi per kategori
        dengan rumus SUMIF, dan <strong>Kekayaan</strong> berisi daftar aset dan utang per tanggal laporan, satu kolom
        per bulan. Contoh tabel dan rumusnya ada di{' '}
        <Link href="/panduan/catat-pengeluaran-di-excel">catat pengeluaran di Excel</Link>. Kelemahannya: saldo, nilai
        investasi, dan sisa utang harus diperbarui manual setiap bulan.
      </p>

      <h2>Laporan keuangan pribadi di Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, menu <strong>Laporan</strong> menyusun ringkasan dari transaksi yang Anda catat,
        per bulan atau per tahun: total keluar, masuk, dan sisa; tren pengeluaran dibanding periode sebelumnya; serta
        kategori dan tempat dengan pengeluaran terbesar. Laporan bisa dicetak atau disimpan sebagai PDF lewat tombol{' '}
        <strong>Cetak / PDF</strong>.
      </p>
      <p>
        Menu <strong>Kekayaan</strong> menghitung kekayaan bersih (aset − utang) dari rekening, tabungan, investasi, dan
        piutang, dikurangi kartu kredit yang terpakai dan hutang yang belum lunas, lengkap dengan persentase utang
        terhadap aset. Semua fitur bisa dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan atau pajak.
        Sesuaikan dengan kondisi Anda.</em>
      </p>
    </GuideLayout>
  );
}

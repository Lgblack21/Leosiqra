import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Catatan Hutang Piutang: Cara Mencatat & Contohnya | Leosiqra',
  description:
    'Cara membuat catatan hutang piutang pribadi: kolom wajib, contoh tabel, cara mencatat cicilan dan pelunasan, serta kesalahan yang membuat sisa salah.',
  keywords: [
    'catatan hutang piutang',
    'cara mencatat hutang piutang',
    'contoh catatan hutang piutang',
    'buku catatan hutang piutang',
    'aplikasi catatan hutang piutang',
  ],
  alternates: { canonical: '/panduan/catatan-hutang-piutang' },
  openGraph: {
    title: 'Catatan Hutang Piutang: Cara Mencatat dan Contohnya',
    description: 'Kolom wajib, contoh tabel, cara mencatat cicilan dan pelunasan, dan kesalahan yang membuat sisa hutang salah.',
    url: 'https://www.leosiqra.com/panduan/catatan-hutang-piutang',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Catatan Hutang Piutang: Cara Mencatat dan Contohnya',
    description: 'Kolom wajib, contoh tabel, cara mencatat cicilan dan pelunasan, dan kesalahan yang membuat sisa hutang salah.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya hutang dan piutang?',
    a: 'Hutang adalah uang yang Anda pinjam dan wajib Anda bayar ke orang lain. Piutang adalah uang Anda yang dipinjam orang lain dan nanti akan Anda terima kembali. Keduanya dicatat di tempat yang sama, tetapi dipisah jenisnya supaya total yang harus dibayar dan total yang akan diterima tidak tercampur.',
  },
  {
    q: 'Apakah uang pinjaman yang diterima dicatat sebagai pemasukan?',
    a: 'Sebaiknya tidak. Uang pinjaman memang menambah saldo, tetapi bukan penghasilan karena harus dikembalikan. Catat sebagai hutang dengan sisa sebesar pinjaman. Kalau dicatat sebagai pemasukan, penghasilan bulan itu terlihat lebih besar dari kenyataan.',
  },
  {
    q: 'Bagaimana mencatat hutang yang dibayar dengan cara dicicil?',
    a: 'Jangan mengubah nominal awal hutang. Tambahkan baris pembayaran setiap kali mencicil, lalu hitung sisa = nominal awal dikurangi total pembayaran. Dengan begitu riwayatnya tetap utuh dan mudah dicocokkan kalau ada selisih dengan pihak lain.',
  },
  {
    q: 'Perlukah bukti saat meminjamkan uang ke teman atau keluarga?',
    a: 'Catatan pribadi membantu Anda mengingat, tetapi bukan bukti bagi kedua pihak. Untuk jumlah yang berarti bagi Anda, simpan bukti transfer dan kesepakatan tertulis sederhana (misalnya pesan chat yang menyebut jumlah dan rencana pengembalian). Untuk urusan hukum, tanyakan ke pihak yang berwenang.',
  },
];

export default function CatatanHutangPiutangPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Catatan Hutang Piutang: Cara Mencatat dan Contohnya"
      lead="Pinjam ke teman, cicilan barang, atau uang yang Anda pinjamkan ke saudara sering hanya diingat di kepala — sampai jumlahnya tidak lagi cocok. Panduan ini membahas kolom yang wajib ada di catatan hutang piutang, contoh tabelnya, cara mencatat cicilan dan pelunasan, serta kesalahan yang paling sering membuat sisa hutang salah."
      updated="27 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-melunasi-utang', label: 'Cara melunasi utang: metode snowball vs avalanche' }}
    >
      <h2>1. Kenapa hutang piutang perlu dicatat terpisah</h2>
      <p>
        Hutang dan piutang bukan pengeluaran atau pemasukan biasa. Saat meminjam, saldo Anda naik tetapi uangnya bukan
        milik Anda. Saat meminjamkan, saldo turun tetapi uangnya masih hak Anda. Kalau dicampur dengan catatan pengeluaran
        harian, laporan bulanan jadi menyesatkan: pengeluaran terlihat membengkak di bulan Anda meminjamkan uang, dan
        penghasilan terlihat naik di bulan Anda meminjam.
      </p>
      <p>
        Karena itu, buat satu catatan khusus hutang piutang. Catatan harian tetap dipakai untuk belanja sehari-hari —
        formatnya ada di <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
      </p>

      <h2>2. Kolom yang wajib ada</h2>
      <ol>
        <li><strong>Tanggal</strong> — kapan uang dipinjam atau dipinjamkan.</li>
        <li><strong>Jenis</strong> — hutang (Anda yang membayar) atau piutang (Anda yang menerima).</li>
        <li><strong>Nama pihak</strong> — orang, toko, atau lembaga. Tanpa nama, catatan cepat tidak berguna.</li>
        <li><strong>Nominal awal</strong> — jumlah saat transaksi terjadi. Jangan diubah sesudahnya.</li>
        <li><strong>Sudah dibayar</strong> — total pembayaran atau cicilan sejauh ini.</li>
        <li><strong>Sisa</strong> — nominal awal dikurangi yang sudah dibayar.</li>
        <li><strong>Rencana bayar</strong> — tanggal atau kesepakatan pengembalian, kalau ada.</li>
        <li><strong>Keterangan</strong> — untuk apa, dan di mana buktinya (misalnya &ldquo;bukti transfer di chat&rdquo;).</li>
      </ol>

      <h2>3. Contoh catatan hutang piutang</h2>
      <p>Contoh <em>ilustrasi</em> catatan seorang karyawan di akhir bulan:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th><th>Jenis</th><th>Pihak</th>
              <th className="num">Nominal awal (Rp)</th><th className="num">Sudah dibayar (Rp)</th><th className="num">Sisa (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>3 Okt</td><td>Hutang</td><td>Kakak</td><td className="num">1.500.000</td><td className="num">500.000</td><td className="num">1.000.000</td></tr>
            <tr><td>10 Okt</td><td>Hutang</td><td>Cicilan HP di toko</td><td className="num">2.400.000</td><td className="num">400.000</td><td className="num">2.000.000</td></tr>
            <tr><td>12 Okt</td><td>Piutang</td><td>Teman kantor</td><td className="num">300.000</td><td className="num">300.000</td><td className="num">0 (lunas)</td></tr>
            <tr><td>20 Okt</td><td>Piutang</td><td>Sepupu</td><td className="num">750.000</td><td className="num">0</td><td className="num">750.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dari tabel ini terbaca dua angka penting: <strong>total sisa hutang Rp3.000.000</strong> (yang masih harus Anda
        bayar) dan <strong>total sisa piutang Rp750.000</strong> (yang masih akan Anda terima). Piutang teman kantor yang
        sudah lunas tetap disimpan sebagai riwayat, tetapi tidak dihitung lagi.
      </p>

      <h2>4. Cara mencatat cicilan dan pelunasan</h2>
      <p>Setiap kali ada pembayaran, lakukan dua hal:</p>
      <ul>
        <li>
          <strong>Tambah kolom &ldquo;sudah dibayar&rdquo;</strong> di baris hutang atau piutang tersebut, lalu hitung
          ulang sisanya. Nominal awal tetap.
        </li>
        <li>
          <strong>Catat pembayarannya di catatan harian</strong> — bayar hutang sebagai uang keluar dari rekening yang
          dipakai, terima pembayaran piutang sebagai uang masuk. Dengan begitu saldo rekening di catatan tetap cocok
          dengan saldo sebenarnya.
        </li>
      </ul>
      <p>
        Kalau sisanya sudah nol, tandai <strong>lunas</strong> dan jangan hapus barisnya. Riwayat ini berguna kalau suatu
        saat ada yang lupa sudah membayar atau belum.
      </p>

      <h2>5. Kesalahan yang membuat sisa hutang salah</h2>
      <ul>
        <li>
          <strong>Mengubah nominal awal setiap kali mencicil.</strong> Riwayatnya hilang dan sulit dicocokkan dengan
          catatan pihak lain.
        </li>
        <li>
          <strong>Mencatat uang pinjaman sebagai pemasukan</strong> — penghasilan terlihat lebih besar dari kenyataan.
        </li>
        <li>
          <strong>Mencampur hutang dan piutang dalam satu total.</strong> Rp3.000.000 hutang dan Rp750.000 piutang bukan
          berarti &ldquo;hutang bersih&rdquo; Rp2.250.000 yang aman — piutang belum tentu kembali tepat waktu, sedangkan
          hutang tetap harus dibayar.
        </li>
        <li>
          <strong>Lupa mencatat pinjaman kecil.</strong> Rp50.000 di sana-sini mudah terlupa, padahal justru itu yang
          sering memicu salah paham.
        </li>
      </ul>

      <h2>6. Setelah tercatat: susun rencana pelunasan</h2>
      <p>
        Dengan sisa hutang yang jelas, Anda bisa menentukan mana yang dilunasi lebih dulu — dua strateginya dijelaskan di{' '}
        <Link href="/panduan/cara-melunasi-utang">cara melunasi utang</Link>. Masukkan cicilan bulanan ke pos tetap di{' '}
        <Link href="/panduan/cara-membuat-anggaran-bulanan">anggaran bulanan</Link>, dan sisihkan{' '}
        <Link href="/panduan/dana-darurat">dana darurat</Link> supaya kebutuhan mendadak tidak berujung pinjaman baru.
        Untuk usaha yang memberi tempo ke pelanggan, lihat juga{' '}
        <Link href="/panduan/catat-keuangan-usaha-kecil">catat keuangan usaha kecil</Link>.
      </p>

      <h2>Mencatat hutang piutang di Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong> ada menu <strong>Hutang &amp; Piutang</strong> yang menampilkan total sisa hutang
        dan total sisa piutang. Setiap catatan menyimpan nama pihak, nominal, dan rekening yang dipakai. Saat Anda mencatat
        cicilan, sisanya dihitung dari total pembayaran dan catatan otomatis ditandai lunas begitu sisanya habis. Setiap
        cicilan dan pelunasan juga tercatat sebagai transaksi, sehingga saldo rekening ikut disesuaikan. Semua fitur bisa
        dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan atau hukum.
        Sesuaikan dengan kondisi Anda.</em>
      </p>
    </GuideLayout>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mencatat Pengeluaran dan Pemasukan di HP | Leosiqra',
  description:
    'Cara mencatat pengeluaran dan pemasukan di HP: pilih alat (catatan, spreadsheet, aplikasi), format singkat, contoh catatan sehari, dan tips tidak lupa.',
  keywords: [
    'cara mencatat pengeluaran dan pemasukan di hp',
    'mencatat keuangan di hp',
    'catat pengeluaran di hp',
    'mencatat pemasukan dan pengeluaran harian di hp',
    'catatan keuangan di hp',
  ],
  alternates: { canonical: '/panduan/cara-mencatat-keuangan-di-hp' },
  openGraph: {
    title: 'Cara Mencatat Pengeluaran dan Pemasukan di HP',
    description: 'Tiga cara mencatat keuangan di HP, format catatan singkat, contoh sehari, dan kebiasaan agar tidak lupa.',
    url: 'https://www.leosiqra.com/panduan/cara-mencatat-keuangan-di-hp',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mencatat Pengeluaran dan Pemasukan di HP',
    description: 'Tiga cara mencatat keuangan di HP, format catatan singkat, contoh sehari, dan kebiasaan agar tidak lupa.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa cara paling mudah mencatat pengeluaran di HP?',
    a: 'Cara paling mudah adalah yang paling sedikit langkahnya, karena itulah yang bertahan. Untuk pemula, aplikasi catatan bawaan HP sudah cukup selama formatnya konsisten. Kalau sudah rutin dan ingin melihat total per kategori atau saldo per rekening, pindah ke spreadsheet atau aplikasi pencatat keuangan.',
  },
  {
    q: 'Apakah transfer antar rekening sendiri dicatat sebagai pengeluaran?',
    a: 'Tidak. Memindahkan uang dari rekening bank ke e-wallet milik sendiri bukan pengeluaran, karena total uang Anda tidak berubah. Catat sebagai transfer (keluar dari satu dompet, masuk ke dompet lain). Kalau dicatat sebagai pengeluaran, total pengeluaran bulan itu akan terlihat lebih besar dari kenyataan.',
  },
  {
    q: 'Bagaimana kalau lupa mencatat beberapa hari?',
    a: 'Jangan berhenti. Lihat riwayat transaksi di aplikasi bank atau e-wallet dan foto struk yang tersimpan untuk mengisi hari yang terlewat, lalu cocokkan saldo di catatan dengan saldo sebenarnya. Selisih kecil dari uang tunai yang tidak teringat bisa dicatat sebagai satu baris "tidak tercatat" supaya saldo kembali cocok.',
  },
  {
    q: 'Perlu mencatat pemasukan juga, atau pengeluaran saja?',
    a: 'Catat keduanya. Tanpa pemasukan, Anda hanya tahu uang keluar ke mana, tetapi tidak tahu berapa sisa yang seharusnya ada. Pemasukan biasanya hanya beberapa kali sebulan (gaji, bonus, hasil jualan), jadi tidak menambah banyak kerja.',
  },
];

export default function CaraMencatatKeuanganDiHpPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mencatat Pengeluaran dan Pemasukan di HP"
      lead="HP selalu ada di tangan saat uang keluar, jadi tempat paling masuk akal untuk mencatat. Panduan ini membahas tiga pilihan alat di HP, format catatan yang cukup beberapa detik, contoh catatan satu hari, dan kebiasaan kecil supaya pencatatan tidak berhenti di minggu kedua."
      updated="26 Oktober 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-harian', label: 'Catatan keuangan harian: contoh format dan tips konsisten' }}
    >
      <h2>1. Tiga pilihan alat untuk mencatat di HP</h2>
      <p>
        Tidak ada alat yang paling benar. Pilih yang sesuai dengan seberapa detail laporan yang Anda butuhkan:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Alat</th><th>Kelebihan</th><th>Kekurangan</th></tr>
          </thead>
          <tbody>
            <tr><td>Aplikasi catatan bawaan HP</td><td>Sudah ada, tanpa belajar apa pun</td><td>Total dan rekap dihitung manual</td></tr>
            <tr><td>Spreadsheet di HP</td><td>Bisa dijumlahkan per kategori dengan rumus</td><td>Mengetik di sel kecil terasa lambat</td></tr>
            <tr><td>Aplikasi pencatat keuangan</td><td>Total, saldo per rekening, dan grafik otomatis</td><td>Perlu memilih aplikasi yang cocok</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Kalau memilih spreadsheet, template dan rumus SUMIF-nya ada di panduan{' '}
        <Link href="/panduan/catat-pengeluaran-di-excel">catat pengeluaran di Excel</Link>. Kalau memilih aplikasi,
        tujuh hal yang perlu dicek sebelum memakainya ada di panduan{' '}
        <Link href="/panduan/aplikasi-pencatat-pengeluaran">memilih aplikasi pencatat pengeluaran</Link>.
      </p>

      <h2>2. Siapkan dua hal sebelum mulai</h2>
      <ol>
        <li>
          <strong>Daftar &ldquo;dompet&rdquo;</strong> — semua tempat uang Anda berada: rekening bank, e-wallet, dan uang
          tunai. Tulis saldo masing-masing hari ini sebagai titik awal.
        </li>
        <li>
          <strong>6–8 kategori</strong> — misalnya makan, transportasi, tagihan, belanja, hiburan, keluarga, dan lain-lain.
          Terlalu banyak kategori membuat Anda ragu setiap kali mencatat.
        </li>
      </ol>

      <h2>3. Format catatan yang cukup beberapa detik</h2>
      <p>
        Setiap transaksi cukup berisi empat hal: <strong>jumlah, untuk apa, kategori, dan dari dompet mana</strong>.
        Contoh baris di aplikasi catatan:
      </p>
      <p>
        <code>25rb kopi – makan – e-wallet</code>
      </p>
      <p>Tiga aturan yang mencegah catatan berantakan:</p>
      <ul>
        <li><strong>Catat saat itu juga</strong>, sebelum HP masuk saku. Menunda sampai malam membuat transaksi kecil terlupa.</li>
        <li><strong>Pemasukan ikut dicatat</strong> — gaji, bonus, hasil jualan, uang kembalian pinjaman.</li>
        <li>
          <strong>Transfer antar dompet sendiri bukan pengeluaran</strong>. Isi saldo e-wallet dari rekening bank dicatat
          sebagai pindah dompet, bukan belanja.
        </li>
      </ul>

      <h2>4. Contoh catatan satu hari</h2>
      <p>Contoh <em>ilustrasi</em> catatan seorang karyawan pada hari gajian:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Jenis</th><th>Keterangan</th><th>Kategori</th><th>Dompet</th><th className="num">Jumlah (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Pemasukan</td><td>Gaji</td><td>Gaji</td><td>Bank</td><td className="num">4.000.000</td></tr>
            <tr><td>Transfer</td><td>Isi saldo e-wallet</td><td>—</td><td>Bank → e-wallet</td><td className="num">200.000</td></tr>
            <tr><td>Pengeluaran</td><td>Kopi</td><td>Makan</td><td>E-wallet</td><td className="num">25.000</td></tr>
            <tr><td>Pengeluaran</td><td>Ojek ke kantor</td><td>Transportasi</td><td>E-wallet</td><td className="num">18.000</td></tr>
            <tr><td>Pengeluaran</td><td>Makan siang</td><td>Makan</td><td>Tunai</td><td className="num">22.000</td></tr>
            <tr><td>Pengeluaran</td><td>Bayar kos</td><td>Tagihan</td><td>Bank</td><td className="num">1.000.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Total pengeluaran hari itu Rp1.065.000. Isi saldo e-wallet Rp200.000 <strong>tidak</strong> ikut dihitung karena
        uangnya hanya pindah dompet. Kalau ikut dihitung, pengeluaran akan tercatat Rp1.265.000 — lebih besar dari yang
        sebenarnya.
      </p>

      <h2>5. Kebiasaan kecil supaya tidak lupa</h2>
      <ul>
        <li><strong>Taruh alat pencatat di layar utama HP</strong>, di posisi yang paling mudah dijangkau jempol.</li>
        <li><strong>Foto struk</strong> kalau sedang tidak sempat mengetik, lalu catat saat ada waktu.</li>
        <li>
          <strong>Cek 2 menit sebelum tidur</strong>: bandingkan saldo di catatan dengan saldo di aplikasi bank dan
          e-wallet. Selisih berarti ada transaksi yang terlewat.
        </li>
      </ul>
      <p>
        Tips lain agar konsisten, termasuk contoh format harian, ada di{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
      </p>

      <h2>6. Rekap seminggu sekali</h2>
      <p>
        Catatan baru berguna kalau dibaca. Seminggu sekali, jumlahkan pengeluaran per kategori dan lihat mana yang paling
        besar. Dari situ Anda bisa menentukan batas per kategori untuk bulan berikutnya — langkahnya dijelaskan di{' '}
        <Link href="/panduan/cara-membuat-anggaran-bulanan">cara membuat anggaran bulanan</Link>. Kalau gaji Anda sekitar
        3 juta, contoh pembagiannya ada di{' '}
        <Link href="/panduan/cara-mengatur-gaji-3-juta">cara mengatur gaji 3 juta</Link>.
      </p>

      <h2>Mencatat di HP dengan Leosiqra</h2>
      <p>
        <strong>Leosiqra</strong> bisa dipasang di layar utama HP Android dan iPhone tanpa Play Store atau App Store —
        caranya ada di halaman <Link href="/install">pasang aplikasi</Link>. Selain aplikasi lengkap, ada{' '}
        <Link href="/input-cepat">Input Cepat</Link> yang langsung terbuka di form catat: ketik &ldquo;25rb kopi&rdquo;,
        ucapkan, atau foto struk. Rekening, e-wallet, dan uang tunai dicatat terpisah, dan transfer antar rekening sendiri
        punya jenis transaksi tersendiri, terpisah dari pengeluaran. Semua fitur bisa dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan
        dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

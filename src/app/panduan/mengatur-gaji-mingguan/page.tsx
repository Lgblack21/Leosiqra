import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mengatur Gaji Mingguan & Harian | Leosiqra',
  description:
    'Cara mengatur gaji mingguan atau penghasilan harian: sisihkan pos bulanan per minggu, siasati bulan 5 minggu, dan contoh gaji 500 ribu per minggu.',
  keywords: [
    'cara mengatur gaji mingguan',
    'cara mengatur keuangan gaji 500 ribu per minggu',
    'cara mengatur penghasilan harian',
    'mengatur keuangan penghasilan tidak tetap',
    'gaji mingguan',
  ],
  alternates: { canonical: '/panduan/mengatur-gaji-mingguan' },
  openGraph: {
    title: 'Cara Mengatur Gaji Mingguan & Penghasilan Harian',
    description: 'Ubah tagihan bulanan jadi jatah mingguan, manfaatkan bulan 5 minggu, dan atur penghasilan yang naik-turun — dengan contoh 500 ribu per minggu.',
    url: 'https://www.leosiqra.com/panduan/mengatur-gaji-mingguan',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mengatur Gaji Mingguan & Penghasilan Harian',
    description: 'Ubah tagihan bulanan jadi jatah mingguan, manfaatkan bulan 5 minggu, dan atur penghasilan yang naik-turun — dengan contoh 500 ribu per minggu.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Gaji mingguan lebih sulit diatur daripada gaji bulanan?',
    a: 'Tidak harus. Tantangannya berbeda: uang datang lebih sering tetapi dalam jumlah kecil, sementara tagihan besar seperti sewa atau cicilan tetap datang sebulan sekali. Kuncinya adalah menyisihkan sebagian tagihan bulanan itu setiap minggu, bukan menunggu akhir bulan.',
  },
  {
    q: 'Bagaimana kalau sebulan ada 5 kali gajian?',
    a: 'Setahun ada 52 minggu, sedangkan 12 bulan × 4 minggu hanya 48. Artinya sekitar 4 kali setahun ada bulan dengan 5 kali gajian. Kalau anggaran disusun dengan hitungan 4 minggu per bulan, gajian kelima itu bisa langsung dipakai untuk dana darurat, tabungan, atau pelunasan utang.',
  },
  {
    q: 'Penghasilan harian saya naik-turun, pakai patokan yang mana?',
    a: 'Pakai penghasilan pada minggu-minggu yang sepi sebagai dasar anggaran, bukan rata-rata atau minggu terbaik. Kelebihan di minggu ramai ditabung sebagai cadangan untuk menutup minggu sepi berikutnya.',
  },
  {
    q: 'Berapa yang sebaiknya ditabung dari gaji mingguan?',
    a: 'Mulai dari nominal tetap yang terasa ringan, misalnya 5–10% dan disisihkan di hari gajian. Patokan 20% dari metode 50/30/20 bisa jadi target berikutnya setelah pos wajib tertutup dengan aman.',
  },
];

export default function MengaturGajiMingguanPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mengatur Gaji Mingguan & Penghasilan Harian"
      lead="Gajian tiap minggu terasa lebih lega: uang datang lebih sering. Masalahnya, sewa, cicilan, dan tagihan tetap datang sebulan sekali — dan sering kali uangnya sudah habis duluan. Berikut cara mengatur gaji mingguan atau penghasilan harian supaya tagihan besar tetap aman."
      updated="20 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji bulanan (50/30/20)' }}
    >
      <h2>1. Daftar pengeluaran, lalu pisahkan mingguan dan bulanan</h2>
      <p>
        Langkah pertama sama seperti gaji bulanan: tahu dulu ke mana uang pergi. Bedanya, pengeluaran perlu dibagi dua
        kelompok:
      </p>
      <ul>
        <li>
          <strong>Pengeluaran mingguan</strong> — makan, bensin atau ongkos, pulsa, kebutuhan dapur. Ini dibayar dari gaji
          minggu itu juga.
        </li>
        <li>
          <strong>Pengeluaran bulanan</strong> — sewa kos, cicilan, listrik, iuran. Ini jatuh tempo sekali sebulan, jadi
          harus <strong>dicicil ke diri sendiri</strong> setiap minggu.
        </li>
      </ul>
      <p>
        Kalau belum tahu angkanya, catat pengeluaran selama dua sampai empat minggu. Format sederhananya ada di panduan{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
      </p>

      <h2>2. Ubah tagihan bulanan menjadi jatah mingguan</h2>
      <p>
        Bagi setiap tagihan bulanan dengan 4, lalu sisihkan hasilnya di hari gajian — bukan di akhir bulan. Simpan di
        rekening atau kantong terpisah supaya tidak ikut terpakai untuk belanja harian. Dengan begitu, saat tanggal jatuh
        tempo tiba, uangnya sudah terkumpul.
      </p>
      <p>
        Kenapa dibagi 4 dan bukan 4,33 (rata-rata minggu per bulan)? Supaya anggaran sedikit lebih ketat dan aman. Sisanya
        akan muncul sebagai &ldquo;bonus&rdquo; di bulan yang punya 5 kali gajian.
      </p>

      <h2>3. Contoh gaji 500 ribu per minggu</h2>
      <p>
        Contoh pembagian untuk pekerja lajang dengan gaji Rp500.000 per minggu dan kos Rp500.000 per bulan (angka ilustrasi,
        sesuaikan dengan kondisi Anda):
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th>Keterangan</th><th className="num">Per minggu (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Sewa kos</td><td>Rp500.000 per bulan ÷ 4</td><td className="num">125.000</td></tr>
            <tr><td>Makan</td><td>Sekitar Rp28.500 per hari</td><td className="num">200.000</td></tr>
            <tr><td>Transportasi</td><td>Bensin atau ongkos kerja</td><td className="num">75.000</td></tr>
            <tr><td>Pulsa &amp; keperluan lain</td><td>Sabun, kuota, dan lain-lain</td><td className="num">50.000</td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td>Disisihkan di hari gajian (10%)</td><td className="num">50.000</td></tr>
            <tr><td><strong>Total</strong></td><td></td><td className="num"><strong>500.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Kalau setelah dicatat ternyata total pengeluaran wajib melebihi gaji, yang pertama dicari adalah pos yang bisa
        dikurangi (sering kali jajan kecil yang berulang), bukan memotong setoran sewa.
      </p>

      <h2>4. Manfaatkan bulan dengan 5 kali gajian</h2>
      <p>
        Setahun ada 52 minggu, sedangkan 12 bulan × 4 minggu hanya 48 minggu. Jadi sekitar 4 kali setahun ada bulan dengan
        5 kali gajian. Karena tagihan bulanan sudah tertutup dari 4 gajian, gajian kelima itu bebas dari kewajiban rutin.
      </p>
      <p>
        Jangan biarkan gajian kelima habis untuk belanja. Tetapkan dari awal tugasnya: menambah{' '}
        <Link href="/panduan/dana-darurat">dana darurat</Link>, melunasi utang lebih cepat (lihat{' '}
        <Link href="/panduan/cara-melunasi-utang">metode snowball vs avalanche</Link>), atau mengisi tabungan tujuan.
      </p>

      <h2>5. Penghasilan harian yang tidak tetap</h2>
      <p>
        Pengemudi ojek online, pedagang, atau pekerja lepas sering menerima uang setiap hari dengan jumlah yang naik-turun.
        Prinsipnya tetap sama, ditambah dua aturan:
      </p>
      <ul>
        <li>
          <strong>Susun anggaran dari minggu yang sepi</strong>, bukan dari minggu terbaik. Kalau penghasilan seminggu
          biasanya antara Rp600.000 dan Rp900.000, pakai angka yang dekat dengan batas bawah sebagai dasar.
        </li>
        <li>
          <strong>Gaji diri sendiri.</strong> Kumpulkan semua pendapatan di satu tempat, lalu &ldquo;bayar&rdquo; diri Anda
          jumlah tetap setiap minggu. Kelebihan di minggu ramai menjadi cadangan untuk menutup minggu sepi.
        </li>
        <li>
          <strong>Pisahkan modal kerja</strong> seperti bensin, servis, atau belanja dagangan dari uang pribadi. Untuk usaha,
          lihat panduan <Link href="/panduan/catat-keuangan-usaha-kecil">catatan keuangan jualan (UMKM)</Link>.
        </li>
      </ul>

      <h2>6. Evaluasi setiap minggu</h2>
      <p>
        Gaji mingguan punya satu kelebihan: Anda bisa mengevaluasi lebih sering. Setiap gajian, luangkan lima menit untuk
        mengecek pos mana yang melewati jatah minggu lalu dan apakah setoran sewa serta tabungan sudah masuk. Kebocoran yang
        ketahuan di minggu pertama jauh lebih mudah diperbaiki daripada yang baru ketahuan di akhir bulan.
      </p>

      <h2>Mengatur gaji mingguan dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, gaji mingguan bisa dijadwalkan sebagai transaksi rutin dengan interval mingguan,
        begitu juga setoran mingguan ke tujuan tabungan seperti dana darurat atau uang sewa. Pengeluaran harian dicatat
        dengan mengetik singkat, suara, atau foto struk, dan ringkasan mingguan di dashboard menunjukkan kategori yang naik
        dibanding biasanya. Anggaran per kategori dapat diatur per bulan untuk melihat total pengeluaran sebulan penuh.
      </p>
      <p>
        <em>Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

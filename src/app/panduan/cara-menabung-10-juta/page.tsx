import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Menabung 10 Juta dalam 3 Bulan | Leosiqra',
  description:
    'Cara menabung 10 juta dalam 3 bulan: hitung jatah per bulan, minggu, dan hari, cek apakah realistis dari gaji, cari sumber uangnya, dan pantau tiap minggu.',
  keywords: [
    'cara menabung 10 juta dalam 3 bulan',
    'cara menabung 10 juta',
    'menabung 10 juta dalam 6 bulan',
    'menabung 10 juta dalam setahun',
    'target tabungan 10 juta',
  ],
  alternates: { canonical: '/panduan/cara-menabung-10-juta' },
  openGraph: {
    title: 'Cara Menabung 10 Juta dalam 3 Bulan (Hitungan Realistis)',
    description: 'Jatah per bulan, minggu, dan hari, cara mengecek apakah targetnya masuk akal, dan alternatif 6 atau 12 bulan.',
    url: 'https://www.leosiqra.com/panduan/cara-menabung-10-juta',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Menabung 10 Juta dalam 3 Bulan (Hitungan Realistis)',
    description: 'Jatah per bulan, minggu, dan hari, cara mengecek apakah targetnya masuk akal, dan alternatif 6 atau 12 bulan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Berapa yang harus ditabung per bulan untuk dapat 10 juta dalam 3 bulan?',
    a: 'Sekitar Rp3.340.000 per bulan (10 juta dibagi 3, dibulatkan ke atas). Kalau dipecah per minggu, sekitar Rp770.000 selama 13 minggu; per hari sekitar Rp111.200 selama 90 hari.',
  },
  {
    q: 'Gaji 5 juta, apakah bisa menabung 10 juta dalam 3 bulan?',
    a: 'Dari gaji saja sulit: Rp3.340.000 berarti sekitar dua pertiga gaji. Biasanya perlu tambahan pemasukan (bonus, jualan barang tak terpakai, kerja sampingan) atau tenggat diperpanjang ke 6 bulan, yang hanya butuh sekitar Rp1.670.000 per bulan.',
  },
  {
    q: 'Uang tabungan 3 bulan sebaiknya disimpan di mana?',
    a: 'Untuk target sependek ini, prioritasnya aman dan mudah dicairkan tepat waktu, bukan imbal hasil. Rekening atau kantong tabungan terpisah dari rekening belanja sudah cukup. Hindari instrumen yang nilainya bisa turun saat uangnya dibutuhkan.',
  },
  {
    q: 'Bagaimana kalau di tengah jalan setoran tertinggal?',
    a: 'Hitung ulang sisa target dibagi sisa minggu, lalu putuskan: naikkan setoran mingguan, tambah pemasukan, atau mundurkan tenggat. Yang penting keputusannya diambil sadar, bukan dibiarkan tertinggal sampai akhir.',
  },
];

export default function CaraMenabung10JutaPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Menabung 10 Juta dalam 3 Bulan"
      lead="Target 10 juta dalam 3 bulan terdengar jelas, tapi baru terasa nyata setelah dipecah jadi angka per minggu dan dibandingkan dengan pemasukan Anda. Panduan ini membantu menghitung jatahnya, mengecek apakah realistis, mencari sumber uangnya, dan memantau supaya tidak meleset."
      updated="24 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-menabung-yang-benar', label: 'Cara menabung yang benar dari gaji' }}
    >
      <h2>1. Pecah targetnya: per bulan, per minggu, per hari</h2>
      <p>
        Angka 10 juta terlalu besar untuk dipantau. Pecah menjadi setoran kecil, lalu bulatkan <em>ke atas</em> supaya
        totalnya tidak kurang di akhir:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Setoran</th><th className="num">Jumlah setoran</th><th className="num">Per setoran (Rp)</th><th className="num">Total (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Bulanan</td><td className="num">3</td><td className="num">3.340.000</td><td className="num">10.020.000</td></tr>
            <tr><td>Mingguan</td><td className="num">13</td><td className="num">770.000</td><td className="num">10.010.000</td></tr>
            <tr><td>Harian</td><td className="num">90</td><td className="num">111.200</td><td className="num">10.008.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Setoran mingguan paling mudah dijaga: cukup sering untuk ketahuan kalau tertinggal, tapi tidak serepot setoran
        harian. Kalau gaji Anda mingguan, cara membagi jatahnya ada di panduan{' '}
        <Link href="/panduan/mengatur-gaji-mingguan">mengatur gaji mingguan</Link>.
      </p>

      <h2>2. Cek dulu: realistis atau tidak?</h2>
      <p>
        Bandingkan setoran bulanan dengan pemasukan bersih. Contoh <em>ilustrasi</em>: pemasukan Rp6.000.000 per bulan
        berarti Rp3.340.000 adalah sekitar 56% dari pemasukan. Artinya seluruh kebutuhan hidup harus muat di sekitar
        Rp2.660.000. Untuk sebagian orang itu mungkin; untuk banyak orang tidak.
      </p>
      <ul>
        <li><strong>Di bawah 20% pemasukan</strong> — umumnya bisa dari gaji saja dengan sedikit penyesuaian.</li>
        <li><strong>20–40%</strong> — perlu memangkas beberapa pos dengan sengaja selama 3 bulan.</li>
        <li><strong>Di atas 40%</strong> — hampir pasti butuh tambahan pemasukan atau tenggat yang lebih panjang.</li>
      </ul>
      <p>
        Patokan ini bukan aturan baku, hanya alat bantu untuk jujur pada diri sendiri sebelum mulai. Pastikan juga
        kebutuhan wajib, cicilan, dan <Link href="/panduan/dana-darurat">dana darurat</Link> tidak dikorbankan demi target ini.
      </p>

      <h2>3. Cari Rp3,34 juta per bulan dari mana</h2>
      <p>
        Mulailah dari pengeluaran yang sebenarnya, bukan perkiraan. Catat semua pengeluaran selama dua minggu, lalu cari
        sumber setoran dari empat arah:
      </p>
      <ul>
        <li><strong>Pos variabel</strong> — makan di luar, jajan, ongkir, hiburan. Pos kecil yang berulang sering paling besar totalnya.</li>
        <li><strong>Langganan</strong> — layanan yang jarang dipakai bisa dihentikan sementara selama 3 bulan.</li>
        <li><strong>Pengeluaran besar yang bisa ditunda</strong> — ganti gawai, belanja pakaian, liburan.</li>
        <li><strong>Pemasukan tambahan</strong> — bonus, menjual barang yang tidak terpakai, lembur, atau kerja sampingan. Semuanya langsung masuk tabungan.</li>
      </ul>
      <p>
        Cara menyusun batas per kategori setelah tahu pengeluaran nyata dijelaskan di panduan{' '}
        <Link href="/panduan/cara-membuat-anggaran-bulanan">cara membuat anggaran bulanan</Link>.
      </p>

      <h2>4. Sisihkan di awal, simpan terpisah</h2>
      <p>
        Setoran yang menunggu &ldquo;sisa akhir bulan&rdquo; hampir selalu gagal. Transfer jatahnya di hari gajian (atau di hari
        yang sama setiap minggu) ke rekening atau kantong tabungan yang terpisah dari uang belanja. Untuk target 3 bulan,
        pilih tempat yang aman dan bisa dicairkan tepat waktu; imbal hasil kecil tidak masalah. Alasan urutan ini dibahas
        di <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>.
      </p>

      <h2>5. Pantau setiap minggu</h2>
      <p>
        Siapkan target kumulatif supaya ketinggalan langsung terlihat. Dengan setoran Rp770.000 per minggu (ilustrasi):
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Akhir minggu ke-</th><th className="num">Seharusnya terkumpul (Rp)</th><th className="num">Progres</th></tr>
          </thead>
          <tbody>
            <tr><td>4</td><td className="num">3.080.000</td><td className="num">±31%</td></tr>
            <tr><td>8</td><td className="num">6.160.000</td><td className="num">±62%</td></tr>
            <tr><td>13</td><td className="num">10.010.000</td><td className="num">100%</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Kalau tertinggal, hitung ulang: sisa target dibagi sisa minggu. Contoh: di akhir minggu ke-8 baru terkumpul
        Rp5.000.000, maka sisa Rp5.000.000 dibagi 5 minggu menjadi Rp1.000.000 per minggu. Kalau angka itu tidak
        sanggup, putuskan sekarang untuk mundurkan tenggat — jangan menunggu minggu terakhir.
      </p>

      <h2>6. Kalau 3 bulan terlalu berat: 6 atau 12 bulan</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tenggat</th><th className="num">Per bulan (Rp)</th><th className="num">Per minggu (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>3 bulan</td><td className="num">3.340.000</td><td className="num">770.000 × 13</td></tr>
            <tr><td>6 bulan</td><td className="num">1.670.000</td><td className="num">385.000 × 26</td></tr>
            <tr><td>12 bulan</td><td className="num">835.000</td><td className="num">193.000 × 52</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Semua angka dibulatkan ke atas, jadi totalnya sedikit di atas 10 juta. Target yang lebih lama tapi benar-benar
        tercapai lebih baik daripada target 3 bulan yang ditinggalkan di bulan kedua.
      </p>

      <h2>Menabung 10 juta dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, target seperti ini bisa dibuat sebagai goal tabungan dengan nominal target dan
        setoran otomatis berkala, lalu progresnya terlihat dalam persen. Pengeluaran harian dicatat lewat Input Cepat —
        ketik singkat, ucapkan, atau foto struk — sehingga Anda tahu pos mana yang bisa dipangkas untuk setoran berikutnya.
        Semua fitur bisa dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan
        dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

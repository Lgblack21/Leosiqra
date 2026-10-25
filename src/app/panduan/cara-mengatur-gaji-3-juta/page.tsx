import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mengatur Gaji 3 Juta per Bulan | Leosiqra',
  description:
    'Cara mengatur gaji 3 juta per bulan: contoh pembagian untuk anak kos, kenapa 50/30/20 sering tidak muat, jatah harian, dan cara tetap menabung.',
  keywords: [
    'cara mengatur keuangan gaji 3 juta per bulan',
    'cara mengatur gaji 3 juta',
    'gaji 3 juta untuk anak kos',
    'pembagian gaji 3 juta',
    'menabung dari gaji 3 juta',
  ],
  alternates: { canonical: '/panduan/cara-mengatur-gaji-3-juta' },
  openGraph: {
    title: 'Cara Mengatur Gaji 3 Juta per Bulan (Contoh Rinci)',
    description: 'Contoh pembagian gaji 3 juta, jatah makan per hari, dan cara tetap menabung walau sedikit.',
    url: 'https://www.leosiqra.com/panduan/cara-mengatur-gaji-3-juta',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mengatur Gaji 3 Juta per Bulan (Contoh Rinci)',
    description: 'Contoh pembagian gaji 3 juta, jatah makan per hari, dan cara tetap menabung walau sedikit.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apakah metode 50/30/20 cocok untuk gaji 3 juta?',
    a: 'Sering tidak muat. 50% dari 3 juta hanya Rp1.500.000 untuk semua kebutuhan pokok, padahal sewa, makan, dan transportasi biasanya sudah lebih dari itu. Lebih realistis memakai patokan yang disesuaikan, misalnya kebutuhan pokok sampai sekitar 70%, tabungan minimal 10%, dan sisanya untuk keinginan.',
  },
  {
    q: 'Berapa yang bisa ditabung dari gaji 3 juta?',
    a: 'Tidak ada angka yang sama untuk semua orang. Mulailah dari 10% (Rp300.000) yang disisihkan di hari gajian. Kalau itu pun berat, mulai dari Rp100.000–Rp150.000 dan naikkan pelan-pelan setelah pengeluaran tercatat rapi. Konsisten lebih penting daripada besar.',
  },
  {
    q: 'Gaji 3 juta dan ngekos, berapa jatah makan per hari?',
    a: 'Pada contoh di panduan ini, jatah makan dan belanja dapur Rp900.000 per bulan, atau sekitar Rp30.000 per hari. Angka Anda bisa berbeda tergantung kota dan kebiasaan; yang penting jatahnya ditentukan di awal bulan lalu dipantau, bukan ditebak.',
  },
  {
    q: 'Bagaimana kalau ada cicilan?',
    a: 'Masukkan cicilan sebagai kebutuhan pokok yang dibayar paling awal. Kalau total cicilan membuat kebutuhan pokok jauh melewati gaji, fokus dulu menyusun rencana pelunasan sebelum menambah tabungan atau keinginan.',
  },
];

export default function CaraMengaturGaji3JutaPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mengatur Gaji 3 Juta per Bulan"
      lead="Dengan gaji 3 juta, setiap ratus ribu terasa. Rumus umum seperti 50/30/20 sering tidak muat, jadi yang dibutuhkan adalah urutan prioritas yang jelas dan angka yang dipantau. Panduan ini memberi contoh pembagian, jatah harian, dan cara tetap menabung walau jumlahnya kecil."
      updated="25 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji dengan metode 50/30/20' }}
    >
      <h2>1. Kenapa 50/30/20 sering tidak muat di gaji 3 juta</h2>
      <p>
        Metode 50/30/20 membagi gaji menjadi 50% kebutuhan, 30% keinginan, dan 20% tabungan. Pada gaji Rp3.000.000,
        artinya kebutuhan pokok hanya boleh Rp1.500.000. Bagi yang ngekos atau tinggal jauh dari tempat kerja, sewa,
        makan, dan ongkos saja biasanya sudah melewati angka itu. Penjelasan metodenya dengan contoh gaji 5 juta ada di
        panduan <Link href="/panduan/cara-mengatur-gaji">cara mengatur gaji</Link>.
      </p>
      <p>
        Daripada memaksakan rumus, pakai patokan yang disesuaikan, misalnya: <strong>kebutuhan pokok sampai sekitar 70%</strong>,
        <strong> tabungan minimal 10%</strong>, dan <strong>sisanya untuk keinginan</strong> serta cadangan. Ini bukan aturan baku,
        hanya titik awal yang lebih jujur untuk penghasilan terbatas.
      </p>

      <h2>2. Contoh pembagian gaji 3 juta (anak kos)</h2>
      <p>
        Contoh <em>ilustrasi</em> untuk satu orang yang ngekos. Ganti angkanya dengan pengeluaran Anda yang sebenarnya:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th><th className="num">Porsi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kos / tempat tinggal</td><td className="num">800.000</td><td className="num">±27%</td></tr>
            <tr><td>Makan &amp; belanja dapur</td><td className="num">900.000</td><td className="num">30%</td></tr>
            <tr><td>Transportasi</td><td className="num">300.000</td><td className="num">10%</td></tr>
            <tr><td>Pulsa, internet, listrik</td><td className="num">150.000</td><td className="num">5%</td></tr>
            <tr><td><strong>Subtotal kebutuhan pokok</strong></td><td className="num"><strong>2.150.000</strong></td><td className="num"><strong>±72%</strong></td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">300.000</td><td className="num">10%</td></tr>
            <tr><td>Keinginan (jajan, hiburan)</td><td className="num">250.000</td><td className="num">±8%</td></tr>
            <tr><td>Kiriman keluarga / sosial</td><td className="num">200.000</td><td className="num">±7%</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">100.000</td><td className="num">±3%</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>3.000.000</strong></td><td className="num"><strong>100%</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Pos &ldquo;cadangan tak terduga&rdquo; penting di gaji kecil: tanpa pos ini, satu pengeluaran mendadak (obat, ban bocor)
        langsung menggerus tabungan. Kalau sampai akhir bulan tidak terpakai, pindahkan ke tabungan.
      </p>

      <h2>3. Urutan saat gajian</h2>
      <ol>
        <li><strong>Bayar yang wajib dulu</strong> — kos, cicilan (kalau ada), tagihan.</li>
        <li><strong>Sisihkan tabungan di hari yang sama</strong> — pindahkan ke rekening atau kantong terpisah sebelum uang terpakai.</li>
        <li><strong>Tentukan jatah variabel</strong> — makan, transportasi, dan jajan diberi batas untuk sebulan.</li>
        <li><strong>Baru sisanya</strong> untuk keinginan.</li>
      </ol>
      <p>
        Menabung dari sisa akhir bulan hampir selalu gagal di gaji berapa pun. Alasannya dibahas di{' '}
        <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>.
      </p>

      <h2>4. Ubah jatah bulanan jadi jatah harian</h2>
      <p>
        Pos variabel paling mudah jebol karena dipakai sedikit-sedikit. Pecah jadi angka harian supaya terasa batasnya.
        Pada contoh di atas, makan Rp900.000 dibagi 30 hari menjadi sekitar <strong>Rp30.000 per hari</strong>. Kalau hari ini
        hanya terpakai Rp22.000, sisa Rp8.000 bisa menutup hari lain yang lebih mahal.
      </p>
      <p>
        Kalau gaji Anda dibayar per minggu, cara membagi tagihan bulanan ke jatah mingguan ada di panduan{' '}
        <Link href="/panduan/mengatur-gaji-mingguan">mengatur gaji mingguan</Link>.
      </p>

      <h2>5. Tetap menabung walau kecil</h2>
      <p>
        Rp300.000 per bulan terlihat kecil, tapi tetap membangun bantalan. Sebagai <em>ilustrasi</em>, dengan pengeluaran
        pokok Rp2.150.000 per bulan:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Target</th><th className="num">Jumlah (Rp)</th><th className="num">Waktu dengan Rp300.000/bulan</th></tr>
          </thead>
          <tbody>
            <tr><td>Dana darurat awal (1× pengeluaran pokok)</td><td className="num">2.150.000</td><td className="num">±8 bulan</td></tr>
            <tr><td>Dana darurat 3× pengeluaran pokok</td><td className="num">6.450.000</td><td className="num">±22 bulan</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Target awal yang kecil membuat kemajuan terasa lebih cepat. Bonus, THR, atau uang lembur yang masuk sebaiknya
        sebagian langsung ditambahkan supaya waktunya lebih pendek. Kenapa dana darurat didahulukan dibahas di{' '}
        <Link href="/panduan/dana-darurat">panduan dana darurat</Link>.
      </p>

      <h2>6. Catat dua minggu, lalu sesuaikan</h2>
      <p>
        Pembagian di atas hanya titik awal. Catat semua pengeluaran selama dua minggu pertama, lalu bandingkan dengan
        jatahnya. Pos yang selalu lewat batas perlu dinaikkan dengan mengurangi pos lain, bukan dibiarkan. Kalau ada
        cicilan yang membuat kebutuhan pokok jauh di atas gaji, susun dulu rencana di panduan{' '}
        <Link href="/panduan/cara-melunasi-utang">cara melunasi utang</Link>. Cara menyusun batas per kategori dijelaskan
        di <Link href="/panduan/cara-membuat-anggaran-bulanan">cara membuat anggaran bulanan</Link>.
      </p>

      <h2>Mengatur gaji 3 juta dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, pengeluaran harian dicatat lewat Input Cepat — ketik singkat, ucapkan, atau foto
        struk — sehingga Anda tahu kapan jatah makan atau jajan mulai menipis. Tabungan bisa dibuat sebagai goal dengan
        nominal target dan progres dalam persen. Semua fitur bisa dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan
        dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

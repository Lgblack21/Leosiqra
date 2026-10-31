import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mengatur Gaji 2 Juta per Bulan + Contoh | Leosiqra',
  description:
    'Cara mengatur gaji 2 juta per bulan: contoh pembagian untuk yang tinggal dengan orang tua dan anak kos, saat ada cicilan, dan kalau gaji 2,5 juta.',
  keywords: [
    'cara mengatur keuangan gaji 2 juta',
    'cara mengatur gaji 2 juta per bulan',
    'cara mengatur gaji 2 juta anak kos',
    'cara mengatur gaji 2 juta ada cicilan',
    'cara mengatur keuangan gaji 2,5 juta',
  ],
  alternates: { canonical: '/panduan/cara-mengatur-gaji-2-juta' },
  openGraph: {
    title: 'Cara Mengatur Gaji 2 Juta per Bulan (Contoh Rinci)',
    description: 'Dua contoh pembagian gaji 2 juta: tinggal dengan orang tua dan ngekos, plus saat ada cicilan.',
    url: 'https://www.leosiqra.com/panduan/cara-mengatur-gaji-2-juta',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mengatur Gaji 2 Juta per Bulan (Contoh Rinci)',
    description: 'Dua contoh pembagian gaji 2 juta: tinggal dengan orang tua dan ngekos, plus saat ada cicilan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apakah gaji 2 juta bisa untuk menabung?',
    a: 'Bisa, walau jumlahnya kecil. Kuncinya menyisihkan di hari gajian, bukan menunggu sisa akhir bulan. Pada contoh di panduan ini, yang tinggal dengan orang tua bisa menyisihkan Rp400.000 dan anak kos Rp200.000 per bulan. Kalau itu pun berat, mulai dari Rp50.000–Rp100.000 lalu naikkan pelan-pelan.',
  },
  {
    q: 'Gaji 2 juta dan ngekos, berapa jatah makan per hari?',
    a: 'Pada contoh anak kos di panduan ini, jatah makan dan belanja dapur Rp750.000 per bulan, atau sekitar Rp25.000 per hari. Angka Anda bisa berbeda tergantung kota dan harga kos; yang penting jatahnya ditentukan di awal bulan lalu dipantau.',
  },
  {
    q: 'Bagaimana mengatur gaji 2 juta kalau ada cicilan?',
    a: 'Bayar cicilan paling awal bersama kebutuhan pokok, lalu potong pos keinginan lebih dulu, bukan jatah makan. Kalau setelah cicilan dan kebutuhan pokok tidak ada sisa sama sekali, fokus pada rencana pelunasan dan hindari mengambil pinjaman baru untuk menutup cicilan lama.',
  },
  {
    q: 'Apa bedanya mengatur gaji 2 juta dan 2,5 juta?',
    a: 'Polanya sama; tambahan Rp500.000 sebaiknya tidak langsung habis untuk keinginan. Pada contoh di panduan ini, separuhnya (Rp250.000) masuk tabungan dan sisanya menambah jatah kebutuhan serta keinginan.',
  },
];

export default function CaraMengaturGaji2JutaPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mengatur Gaji 2 Juta per Bulan"
      lead="Gaji 2 juta cukup atau tidak sangat bergantung pada satu hal: apakah Anda masih tinggal bersama orang tua atau harus membayar tempat tinggal sendiri. Panduan ini memberi dua contoh pembagian, cara mengatur kalau ada cicilan, dan apa yang berubah kalau gajinya 2,5 juta."
      updated="31 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji-3-juta', label: 'Cara mengatur gaji 3 juta per bulan' }}
    >
      <h2>1. Mulai dari biaya tempat tinggal</h2>
      <p>
        Rumus umum seperti 50/30/20 (50% kebutuhan, 30% keinginan, 20% tabungan) bisa dipakai kalau Anda tinggal bersama
        orang tua. Tapi kalau harus membayar kos, 50% dari Rp2.000.000 hanya Rp1.000.000 untuk semua kebutuhan pokok, dan
        sewa saja sering sudah memakan lebih dari separuhnya. Penjelasan metodenya ada di panduan{' '}
        <Link href="/panduan/cara-mengatur-gaji">cara mengatur gaji</Link>.
      </p>
      <p>
        Karena itu, tentukan dulu kondisi Anda, lalu pakai contoh yang paling mendekati. Kedua contoh di bawah adalah{' '}
        <em>ilustrasi</em> — ganti angkanya dengan pengeluaran Anda yang sebenarnya.
      </p>

      <h2>2. Contoh pembagian gaji 2 juta (tinggal dengan orang tua)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th><th className="num">Porsi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kontribusi untuk rumah / orang tua</td><td className="num">400.000</td><td className="num">20%</td></tr>
            <tr><td>Makan siang &amp; jajan kerja</td><td className="num">500.000</td><td className="num">25%</td></tr>
            <tr><td>Transportasi</td><td className="num">300.000</td><td className="num">15%</td></tr>
            <tr><td>Pulsa &amp; internet</td><td className="num">100.000</td><td className="num">5%</td></tr>
            <tr><td><strong>Subtotal kebutuhan pokok</strong></td><td className="num"><strong>1.300.000</strong></td><td className="num"><strong>65%</strong></td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">400.000</td><td className="num">20%</td></tr>
            <tr><td>Keinginan (hiburan, nongkrong)</td><td className="num">200.000</td><td className="num">10%</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">100.000</td><td className="num">5%</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>2.000.000</strong></td><td className="num"><strong>100%</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Tanpa biaya sewa, ini saat terbaik untuk membangun tabungan. Porsi 20% di contoh ini masih masuk akal dan akan
        jauh lebih sulit dicapai setelah Anda pindah dan mulai membayar tempat tinggal sendiri.
      </p>

      <h2>3. Contoh pembagian gaji 2 juta (anak kos)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th><th className="num">Porsi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kos / tempat tinggal</td><td className="num">600.000</td><td className="num">30%</td></tr>
            <tr><td>Makan &amp; belanja dapur</td><td className="num">750.000</td><td className="num">37,5%</td></tr>
            <tr><td>Transportasi</td><td className="num">200.000</td><td className="num">10%</td></tr>
            <tr><td>Pulsa, internet, listrik</td><td className="num">100.000</td><td className="num">5%</td></tr>
            <tr><td><strong>Subtotal kebutuhan pokok</strong></td><td className="num"><strong>1.650.000</strong></td><td className="num"><strong>82,5%</strong></td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">200.000</td><td className="num">10%</td></tr>
            <tr><td>Keinginan</td><td className="num">100.000</td><td className="num">5%</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">50.000</td><td className="num">2,5%</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>2.000.000</strong></td><td className="num"><strong>100%</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Di sini kebutuhan pokok memakan lebih dari 80%, jadi ruangnya sempit. Jatah makan Rp750.000 berarti sekitar{' '}
        <strong>Rp25.000 per hari</strong>. Pecah jatah bulanan menjadi angka harian seperti ini supaya batasnya terasa; sisa
        hari ini bisa menutup hari lain yang lebih mahal. Kalau gaji Anda dibayar per minggu, caranya ada di panduan{' '}
        <Link href="/panduan/mengatur-gaji-mingguan">mengatur gaji mingguan</Link>.
      </p>

      <h2>4. Urutan saat gajian</h2>
      <ol>
        <li><strong>Bayar yang wajib dulu</strong> — kos atau kontribusi rumah, cicilan (kalau ada), tagihan.</li>
        <li><strong>Sisihkan tabungan di hari yang sama</strong> — pindahkan ke rekening atau kantong terpisah sebelum terpakai.</li>
        <li><strong>Tentukan jatah variabel</strong> — makan, transportasi, dan jajan diberi batas untuk sebulan.</li>
        <li><strong>Baru sisanya</strong> untuk keinginan.</li>
      </ol>
      <p>
        Menabung dari sisa akhir bulan hampir selalu gagal di gaji berapa pun; alasannya dibahas di{' '}
        <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>.
      </p>

      <h2>5. Kalau ada cicilan</h2>
      <p>
        Cicilan dibayar paling awal, bersama kebutuhan pokok. Ruang untuk menampungnya diambil dari pos yang paling
        lentur lebih dulu: keinginan, lalu sebagian tabungan — jatah makan sebaiknya tidak dipotong. Pada contoh anak kos di
        atas, pos keinginan dan cadangan hanya Rp150.000, jadi cicilan yang lebih besar dari itu sudah mulai memakan
        tabungan.
      </p>
      <p>
        Kalau setelah cicilan dan kebutuhan pokok tidak ada sisa sama sekali, itu tanda untuk menyusun rencana pelunasan
        dan tidak menambah utang baru. Langkahnya ada di panduan{' '}
        <Link href="/panduan/cara-melunasi-utang">cara melunasi utang</Link>.
      </p>

      <h2>6. Kalau gajinya 2,5 juta</h2>
      <p>
        Tambahan Rp500.000 paling sering habis tanpa terasa. Tentukan tujuannya sejak awal. Sebagai <em>ilustrasi</em> pada
        contoh anak kos:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Gaji 2 juta (Rp)</th><th className="num">Gaji 2,5 juta (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Kebutuhan pokok</td><td className="num">1.650.000</td><td className="num">1.800.000</td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">200.000</td><td className="num">450.000</td></tr>
            <tr><td>Keinginan</td><td className="num">100.000</td><td className="num">200.000</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">50.000</td><td className="num">50.000</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>2.000.000</strong></td><td className="num"><strong>2.500.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Separuh tambahan (Rp250.000) masuk tabungan, sehingga porsi tabungan naik dari 10% menjadi 18%. Untuk contoh
        pembagian gaji yang lebih besar, lihat <Link href="/panduan/cara-mengatur-gaji-3-juta">cara mengatur gaji 3 juta</Link>.
      </p>

      <h2>7. Dana darurat dari gaji 2 juta</h2>
      <p>
        Mulailah dengan target kecil: satu kali pengeluaran pokok sebulan. Sebagai <em>ilustrasi</em> dari kedua contoh di atas:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kondisi</th><th className="num">1× pengeluaran pokok (Rp)</th><th className="num">Setoran/bulan (Rp)</th><th className="num">Waktu</th></tr>
          </thead>
          <tbody>
            <tr><td>Tinggal dengan orang tua</td><td className="num">1.300.000</td><td className="num">400.000</td><td className="num">±4 bulan</td></tr>
            <tr><td>Anak kos</td><td className="num">1.650.000</td><td className="num">200.000</td><td className="num">±9 bulan</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Setelah target pertama tercapai, lanjutkan ke tiga kali pengeluaran pokok. Kenapa dana darurat didahulukan dibahas
        di <Link href="/panduan/dana-darurat">panduan dana darurat</Link>.
      </p>

      <h2>8. Catat dua minggu, lalu sesuaikan</h2>
      <p>
        Pembagian di atas hanya titik awal. Catat semua pengeluaran selama dua minggu, lalu bandingkan dengan jatahnya. Pos
        yang selalu lewat batas perlu dinaikkan dengan mengurangi pos lain, bukan dibiarkan. Cara menyusun batas per
        kategori dijelaskan di <Link href="/panduan/cara-membuat-anggaran-bulanan">cara membuat anggaran bulanan</Link>. Kalau
        gaji 2 juta ini untuk kebutuhan keluarga, cara mencatatnya ada di{' '}
        <Link href="/panduan/catat-keuangan-rumah-tangga">catatan keuangan rumah tangga</Link>.
      </p>

      <h2>Mengatur gaji 2 juta dengan Leosiqra</h2>
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

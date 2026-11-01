import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mengatur Gaji 5 Juta per Bulan + Contoh | Leosiqra',
  description:
    'Cara mengatur gaji 5 juta per bulan: contoh pembagian untuk lajang yang ngekos dan rumah tangga dengan satu anak, saat ada cicilan, dan kalau gaji 4 juta.',
  keywords: [
    'cara mengatur keuangan gaji 5 juta',
    'cara mengatur keuangan dengan gaji 5 juta per bulan',
    'cara mengatur keuangan rumah tangga gaji 5 juta',
    'cara mengatur keuangan gaji 4 juta',
    'cara mengatur gaji 5 juta ada cicilan',
  ],
  alternates: { canonical: '/panduan/cara-mengatur-gaji-5-juta' },
  openGraph: {
    title: 'Cara Mengatur Gaji 5 Juta per Bulan (Contoh Rinci)',
    description: 'Dua contoh pembagian gaji 5 juta: lajang yang ngekos dan rumah tangga dengan satu anak, plus saat ada cicilan.',
    url: 'https://www.leosiqra.com/panduan/cara-mengatur-gaji-5-juta',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mengatur Gaji 5 Juta per Bulan (Contoh Rinci)',
    description: 'Dua contoh pembagian gaji 5 juta: lajang yang ngekos dan rumah tangga dengan satu anak, plus saat ada cicilan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Gaji 5 juta idealnya ditabung berapa?',
    a: 'Untuk lajang, menyisihkan sekitar 20% atau Rp1.000.000 per bulan masih masuk akal, seperti pada contoh di panduan ini. Untuk rumah tangga dengan satu penghasilan dan anak, porsinya biasanya jauh lebih kecil; pada contoh di sini Rp400.000 (8%). Yang lebih penting dari persentasenya adalah menyisihkan di hari gajian, bukan dari sisa akhir bulan.',
  },
  {
    q: 'Apakah gaji 5 juta cukup untuk rumah tangga?',
    a: 'Bisa cukup, tetapi ruangnya sempit kalau masih membayar sewa dan hanya ada satu penghasilan. Pada contoh di panduan ini, kebutuhan pokok keluarga dengan satu anak memakan 86% gaji. Karena itu jatah tiap pos perlu ditentukan di awal bulan dan dipantau, terutama belanja dapur yang paling mudah membengkak.',
  },
  {
    q: 'Bagaimana mengatur gaji 5 juta kalau ada cicilan?',
    a: 'Bayar cicilan paling awal bersama kebutuhan pokok, lalu ambil ruangnya dari pos keinginan dan cadangan lebih dulu sebelum menyentuh tabungan. Kalau cicilan sudah memakan seluruh pos keinginan dan sebagian besar tabungan, hindari menambah cicilan baru sampai salah satunya lunas.',
  },
  {
    q: 'Apa bedanya mengatur gaji 4 juta dan 5 juta?',
    a: 'Polanya sama. Pada contoh lajang di panduan ini, gaji 4 juta tetap bisa menabung Rp700.000 per bulan dengan biaya kos dan makan yang sedikit lebih hemat. Kalau gaji naik dari 4 ke 5 juta, usahakan sebagian besar kenaikannya masuk tabungan, bukan langsung habis untuk keinginan.',
  },
];

export default function CaraMengaturGaji5JutaPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mengatur Gaji 5 Juta per Bulan"
      lead="Gaji 5 juta terasa longgar untuk lajang, tetapi bisa cepat habis kalau harus menghidupi keluarga. Panduan ini memberi dua contoh pembagian — lajang yang ngekos dan rumah tangga dengan satu anak — lalu cara mengatur kalau ada cicilan dan apa yang berubah kalau gajinya 4 juta."
      updated="1 November 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji-3-juta', label: 'Cara mengatur gaji 3 juta per bulan' }}
    >
      <h2>1. Tentukan dulu: untuk berapa orang?</h2>
      <p>
        Rumus 50/30/20 (50% kebutuhan, 30% keinginan, 20% tabungan) cukup pas untuk lajang dengan gaji 5 juta. Tapi kalau
        gaji yang sama menanggung pasangan dan anak, kebutuhan pokok hampir pasti jauh melewati 50%. Penjelasan metodenya
        ada di panduan <Link href="/panduan/cara-mengatur-gaji">cara mengatur gaji</Link>.
      </p>
      <p>
        Pilih contoh yang paling mendekati kondisi Anda. Kedua contoh di bawah adalah <em>ilustrasi</em> — ganti angkanya
        dengan pengeluaran Anda yang sebenarnya, karena biaya sewa dan makan sangat berbeda antarkota.
      </p>

      <h2>2. Contoh pembagian gaji 5 juta (lajang, ngekos)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th><th className="num">Porsi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kos / tempat tinggal</td><td className="num">1.200.000</td><td className="num">24%</td></tr>
            <tr><td>Makan &amp; belanja dapur</td><td className="num">1.500.000</td><td className="num">30%</td></tr>
            <tr><td>Transportasi</td><td className="num">400.000</td><td className="num">8%</td></tr>
            <tr><td>Pulsa, internet, listrik</td><td className="num">200.000</td><td className="num">4%</td></tr>
            <tr><td><strong>Subtotal kebutuhan pokok</strong></td><td className="num"><strong>3.300.000</strong></td><td className="num"><strong>66%</strong></td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">1.000.000</td><td className="num">20%</td></tr>
            <tr><td>Keinginan (hiburan, nongkrong, belanja)</td><td className="num">500.000</td><td className="num">10%</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">200.000</td><td className="num">4%</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>5.000.000</strong></td><td className="num"><strong>100%</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Jatah makan Rp1.500.000 berarti sekitar <strong>Rp50.000 per hari</strong>. Kebutuhan pokok di sini 66%, sedikit di
        atas patokan 50%, tetapi tabungan 20% tetap terjaga karena pos keinginan dibuat lebih kecil. Cara membagi Rp1.000.000
        tabungan itu antara dana darurat, utang, dan tujuan lain dibahas di{' '}
        <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>.
      </p>

      <h2>3. Contoh pembagian gaji 5 juta (rumah tangga, satu anak)</h2>
      <p>
        Contoh ini untuk pasangan dengan satu anak kecil, satu penghasilan Rp5.000.000, dan masih mengontrak.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Jumlah (Rp)</th><th className="num">Porsi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kontrakan / sewa</td><td className="num">1.300.000</td><td className="num">26%</td></tr>
            <tr><td>Belanja dapur &amp; makan</td><td className="num">1.700.000</td><td className="num">34%</td></tr>
            <tr><td>Kebutuhan anak (susu, popok, dll.)</td><td className="num">500.000</td><td className="num">10%</td></tr>
            <tr><td>Transportasi</td><td className="num">350.000</td><td className="num">7%</td></tr>
            <tr><td>Listrik, air, gas</td><td className="num">300.000</td><td className="num">6%</td></tr>
            <tr><td>Pulsa &amp; internet</td><td className="num">150.000</td><td className="num">3%</td></tr>
            <tr><td><strong>Subtotal kebutuhan pokok</strong></td><td className="num"><strong>4.300.000</strong></td><td className="num"><strong>86%</strong></td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">400.000</td><td className="num">8%</td></tr>
            <tr><td>Keinginan &amp; acara keluarga</td><td className="num">150.000</td><td className="num">3%</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">150.000</td><td className="num">3%</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>5.000.000</strong></td><td className="num"><strong>100%</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Di sini kebutuhan pokok memakan 86%, jadi setiap pos perlu batas yang jelas. Belanja dapur Rp1.700.000 berarti
        sekitar <strong>Rp425.000 per minggu</strong>; belanja mingguan dengan daftar lebih mudah dikendalikan daripada
        belanja harian tanpa rencana. Cara mencatat pengeluaran keluarga — termasuk kalau dicatat berdua — ada di{' '}
        <Link href="/panduan/catat-keuangan-rumah-tangga">catatan keuangan rumah tangga</Link>.
      </p>

      <h2>4. Urutan saat gajian</h2>
      <ol>
        <li><strong>Bayar yang wajib dulu</strong> — sewa, cicilan (kalau ada), tagihan listrik dan air.</li>
        <li><strong>Sisihkan tabungan di hari yang sama</strong> — pindahkan ke rekening atau kantong terpisah sebelum terpakai.</li>
        <li><strong>Tentukan jatah variabel</strong> — belanja dapur, transportasi, dan jajan diberi batas untuk sebulan.</li>
        <li><strong>Baru sisanya</strong> untuk keinginan.</li>
      </ol>
      <p>
        Batas per pos ini pada dasarnya anggaran bulanan; cara menyusunnya per kategori dijelaskan di{' '}
        <Link href="/panduan/cara-membuat-anggaran-bulanan">cara membuat anggaran bulanan</Link>.
      </p>

      <h2>5. Kalau ada cicilan</h2>
      <p>
        Cicilan dibayar paling awal, bersama kebutuhan pokok. Ruangnya diambil dari pos yang paling lentur lebih dulu:
        keinginan dan cadangan, baru kemudian sebagian tabungan. Sebagai <em>ilustrasi</em> pada contoh lajang dengan
        cicilan Rp700.000 per bulan:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Tanpa cicilan (Rp)</th><th className="num">Cicilan 700 ribu (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Kebutuhan pokok</td><td className="num">3.300.000</td><td className="num">3.300.000</td></tr>
            <tr><td>Cicilan</td><td className="num">0</td><td className="num">700.000</td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">1.000.000</td><td className="num">800.000</td></tr>
            <tr><td>Keinginan</td><td className="num">500.000</td><td className="num">100.000</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">200.000</td><td className="num">100.000</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>5.000.000</strong></td><td className="num"><strong>5.000.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Pada contoh rumah tangga, pos keinginan dan cadangan hanya Rp300.000, sehingga cicilan yang lebih besar dari itu
        langsung memakan tabungan. Kalau setelah cicilan dan kebutuhan pokok tidak ada sisa, susun rencana pelunasan dan
        jangan menambah utang baru. Langkahnya ada di panduan{' '}
        <Link href="/panduan/cara-melunasi-utang">cara melunasi utang</Link>.
      </p>

      <h2>6. Kalau gajinya 4 juta</h2>
      <p>
        Untuk lajang yang ngekos, polanya tetap sama dengan biaya kos dan makan yang sedikit lebih hemat. Sebagai{' '}
        <em>ilustrasi</em>:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th className="num">Gaji 4 juta (Rp)</th><th className="num">Gaji 5 juta (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Kos / tempat tinggal</td><td className="num">1.000.000</td><td className="num">1.200.000</td></tr>
            <tr><td>Makan &amp; belanja dapur</td><td className="num">1.300.000</td><td className="num">1.500.000</td></tr>
            <tr><td>Transportasi</td><td className="num">350.000</td><td className="num">400.000</td></tr>
            <tr><td>Pulsa, internet, listrik</td><td className="num">150.000</td><td className="num">200.000</td></tr>
            <tr><td>Tabungan &amp; dana darurat</td><td className="num">700.000</td><td className="num">1.000.000</td></tr>
            <tr><td>Keinginan</td><td className="num">350.000</td><td className="num">500.000</td></tr>
            <tr><td>Cadangan tak terduga</td><td className="num">150.000</td><td className="num">200.000</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>4.000.000</strong></td><td className="num"><strong>5.000.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dengan gaji 4 juta, kebutuhan pokok menjadi Rp2.800.000 (70%) dan tabungan Rp700.000 (17,5%). Untuk contoh gaji
        yang lebih kecil, lihat <Link href="/panduan/cara-mengatur-gaji-3-juta">cara mengatur gaji 3 juta</Link> dan{' '}
        <Link href="/panduan/cara-mengatur-gaji-2-juta">cara mengatur gaji 2 juta</Link>.
      </p>

      <h2>7. Dana darurat dari gaji 5 juta</h2>
      <p>
        Mulailah dengan target pertama: satu kali pengeluaran pokok sebulan. Sebagai <em>ilustrasi</em> dari kedua contoh di atas:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kondisi</th><th className="num">1× pengeluaran pokok (Rp)</th><th className="num">Setoran/bulan (Rp)</th><th className="num">Waktu</th></tr>
          </thead>
          <tbody>
            <tr><td>Lajang, ngekos</td><td className="num">3.300.000</td><td className="num">1.000.000</td><td className="num">±4 bulan</td></tr>
            <tr><td>Rumah tangga, satu anak</td><td className="num">4.300.000</td><td className="num">400.000</td><td className="num">±11 bulan</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Setelah target pertama tercapai, lanjutkan bertahap. Berapa kali pengeluaran yang sebaiknya disiapkan untuk lajang
        dan untuk keluarga dengan tanggungan dibahas di <Link href="/panduan/dana-darurat">panduan dana darurat</Link>.
      </p>

      <h2>8. Catat dua minggu, lalu sesuaikan</h2>
      <p>
        Pembagian di atas hanya titik awal. Catat semua pengeluaran selama dua minggu, lalu bandingkan dengan jatahnya. Pos
        yang selalu lewat batas perlu dinaikkan dengan mengurangi pos lain, bukan dibiarkan. Kalau mencatat di buku atau
        Excel terasa merepotkan, caranya di HP ada di{' '}
        <Link href="/panduan/cara-mencatat-keuangan-di-hp">cara mencatat keuangan di HP</Link>.
      </p>

      <h2>Mengatur gaji 5 juta dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, pengeluaran harian dicatat lewat Input Cepat — ketik singkat, ucapkan, atau foto
        struk — sehingga Anda tahu kapan jatah belanja dapur atau jajan mulai menipis. Tabungan bisa dibuat sebagai goal
        dengan nominal target dan progres dalam persen. Semua fitur bisa dicoba gratis selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan
        dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

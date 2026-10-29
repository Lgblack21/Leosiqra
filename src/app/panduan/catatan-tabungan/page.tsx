import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Catatan Tabungan: Contoh Harian, Bulanan & Target | Leosiqra',
  description:
    'Cara membuat catatan tabungan: kolom wajib, contoh catatan harian dan bulanan, menghitung setoran untuk mencapai target, dan kesalahan yang sering terjadi.',
  keywords: [
    'catatan tabungan',
    'catatan tabungan harian',
    'catatan tabungan bulanan',
    'catatan tabungan target',
    'catatan tabungan mingguan',
    'contoh catatan tabungan',
  ],
  alternates: { canonical: '/panduan/catatan-tabungan' },
  openGraph: {
    title: 'Catatan Tabungan: Contoh Harian, Bulanan, dan Target',
    description: 'Kolom wajib, contoh catatan harian dan bulanan, dan cara menghitung setoran untuk mencapai target tabungan.',
    url: 'https://www.leosiqra.com/panduan/catatan-tabungan',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Catatan Tabungan: Contoh Harian, Bulanan, dan Target',
    description: 'Kolom wajib, contoh catatan harian dan bulanan, dan cara menghitung setoran untuk mencapai target tabungan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Lebih baik catatan tabungan di buku tulis atau di aplikasi?',
    a: 'Keduanya bisa, yang penting konsisten. Buku tulis cocok untuk tabungan harian anak atau celengan di rumah. Kalau tabungan disimpan di rekening dan tujuannya lebih dari satu, aplikasi atau spreadsheet lebih praktis karena saldo dan persentase target dihitung otomatis.',
  },
  {
    q: 'Apakah uang yang ditabung dicatat sebagai pengeluaran?',
    a: 'Sebaiknya tidak. Uang yang ditabung masih milik Anda, hanya pindah tempat. Catat sebagai setoran tabungan, bukan belanja, supaya pengeluaran bulanan tidak terlihat lebih besar dari kenyataan dan total tabungan tetap terbaca.',
  },
  {
    q: 'Berapa yang sebaiknya ditabung setiap hari?',
    a: 'Tidak ada angka baku. Mulai dari jumlah yang tidak mengganggu kebutuhan pokok, lalu naikkan pelan-pelan. Kalau punya target, hitung mundur dari targetnya: sisa yang dibutuhkan dibagi sisa waktu. Cara menghitungnya ada di bagian target di atas.',
  },
  {
    q: 'Bagaimana kalau tabungan terpaksa diambil?',
    a: 'Catat sebagai penarikan dengan tanggal dan alasannya, jangan menghapus setoran lama. Saldo tetap benar, dan Anda bisa melihat berapa yang perlu dikejar lagi untuk kembali ke jalur target.',
  },
];

export default function CatatanTabunganPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Catatan Tabungan: Contoh Harian, Bulanan, dan Target"
      lead="Menabung terasa lebih ringan kalau terlihat hasilnya. Catatan tabungan membuat setiap setoran kecil terbaca, menunjukkan seberapa dekat Anda ke tujuan, dan mencegah tabungan terpakai diam-diam. Panduan ini membahas kolom yang perlu ada, contoh catatan harian dan bulanan, serta cara menghitung setoran untuk mencapai target."
      updated="29 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-menabung-yang-benar', label: 'Cara menabung yang benar: sisihkan di awal' }}
    >
      <h2>1. Kenapa tabungan perlu dicatat</h2>
      <p>
        Saldo rekening hanya menunjukkan angka hari ini. Catatan tabungan menunjukkan hal yang tidak terlihat dari saldo:
        berapa yang rutin Anda sisihkan, kapan tabungan pernah diambil, dan berapa lagi yang dibutuhkan untuk mencapai
        tujuan. Tanpa catatan, uang tabungan mudah tercampur dengan uang harian dan terpakai tanpa disadari.
      </p>
      <p>
        Catatan tabungan berbeda dari catatan belanja sehari-hari. Untuk belanja, formatnya ada di{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
      </p>

      <h2>2. Kolom yang wajib ada</h2>
      <ol>
        <li><strong>Tanggal</strong> — kapan uang disetor atau diambil.</li>
        <li><strong>Jenis</strong> — setor (uang masuk ke tabungan) atau ambil (uang keluar dari tabungan).</li>
        <li><strong>Nominal</strong> — jumlah yang disetor atau diambil.</li>
        <li><strong>Saldo tabungan</strong> — saldo sebelumnya ditambah setoran atau dikurangi penarikan.</li>
        <li><strong>Tujuan</strong> — untuk apa tabungan ini, misalnya dana darurat atau liburan.</li>
        <li><strong>Disimpan di</strong> — celengan, rekening, atau tempat lain, supaya mudah dicocokkan.</li>
        <li><strong>Keterangan</strong> — terutama untuk penarikan: dipakai untuk apa.</li>
      </ol>

      <h2>3. Contoh catatan tabungan harian</h2>
      <p>Contoh <em>ilustrasi</em> seminggu menabung dari uang saku harian:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th><th>Jenis</th><th className="num">Nominal (Rp)</th><th className="num">Saldo (Rp)</th><th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1 Nov</td><td>Setor</td><td className="num">10.000</td><td className="num">10.000</td><td></td></tr>
            <tr><td>2 Nov</td><td>Setor</td><td className="num">10.000</td><td className="num">20.000</td><td></td></tr>
            <tr><td>3 Nov</td><td>—</td><td className="num">0</td><td className="num">20.000</td><td>Tidak setor</td></tr>
            <tr><td>4 Nov</td><td>Setor</td><td className="num">15.000</td><td className="num">35.000</td><td>Ada sisa uang makan</td></tr>
            <tr><td>5 Nov</td><td>Setor</td><td className="num">10.000</td><td className="num">45.000</td><td></td></tr>
            <tr><td>6 Nov</td><td>Ambil</td><td className="num">5.000</td><td className="num">40.000</td><td>Ongkos parkir</td></tr>
            <tr><td>7 Nov</td><td>Setor</td><td className="num">10.000</td><td className="num">50.000</td><td></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dalam seminggu ada setoran Rp55.000 dan penarikan Rp5.000, sehingga saldo akhir <strong>Rp50.000</strong>. Hari
        tanpa setoran tetap ditulis — dari situ terlihat kebiasaan mana yang perlu dibenahi.
      </p>

      <h2>4. Contoh catatan tabungan bulanan</h2>
      <p>
        Kalau setoran harian terlalu banyak untuk dibaca, rekap per bulan. Cukup tiga angka: total setoran, total
        penarikan, dan saldo akhir. Contoh <em>ilustrasi</em>:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bulan</th><th className="num">Setoran (Rp)</th><th className="num">Penarikan (Rp)</th><th className="num">Saldo akhir (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Agustus</td><td className="num">500.000</td><td className="num">0</td><td className="num">500.000</td></tr>
            <tr><td>September</td><td className="num">500.000</td><td className="num">150.000</td><td className="num">850.000</td></tr>
            <tr><td>Oktober</td><td className="num">600.000</td><td className="num">0</td><td className="num">1.450.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Saldo akhir = saldo bulan lalu + setoran − penarikan. Dari rekap ini terlihat September tertahan karena ada
        penarikan, lalu Oktober dikejar dengan setoran lebih besar. Kalau gaji Anda mingguan, rekap per minggu dengan
        cara yang sama — lihat juga <Link href="/panduan/mengatur-gaji-mingguan">cara mengatur gaji mingguan</Link>.
      </p>

      <h2>5. Catatan tabungan dengan target</h2>
      <p>
        Target membuat tabungan punya arah. Target yang baik punya dua hal: <strong>nominal</strong> dan{' '}
        <strong>tanggal</strong>. Setelah keduanya jelas, setoran yang dibutuhkan bisa dihitung:
      </p>
      <p>
        <strong>Setoran per bulan = (target − yang sudah terkumpul) ÷ sisa bulan</strong>
      </p>
      <p>
        Contoh <em>ilustrasi</em>: target dana liburan Rp4.800.000 dalam 8 bulan, dan sudah terkumpul Rp800.000. Sisa
        yang dibutuhkan Rp4.000.000, dibagi 8 bulan = <strong>Rp500.000 per bulan</strong>. Progresnya saat ini
        Rp800.000 dari Rp4.800.000, atau sekitar 17%.
      </p>
      <p>Kalau tujuannya lebih dari satu, pisahkan per target supaya tidak saling memakan:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th><th className="num">Nominal (Rp)</th><th className="num">Terkumpul (Rp)</th><th className="num">Progres</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Dana darurat</td><td className="num">9.000.000</td><td className="num">3.000.000</td><td className="num">33%</td></tr>
            <tr><td>Liburan</td><td className="num">4.800.000</td><td className="num">800.000</td><td className="num">17%</td></tr>
            <tr><td>HP baru</td><td className="num">3.000.000</td><td className="num">1.500.000</td><td className="num">50%</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Target dengan nominal besar dan waktu pendek dihitung lebih rinci di{' '}
        <Link href="/panduan/cara-menabung-10-juta">cara menabung 10 juta dalam 3 bulan</Link>. Besaran dana darurat
        yang ideal dibahas di <Link href="/panduan/dana-darurat">panduan dana darurat</Link>.
      </p>

      <h2>6. Kesalahan yang sering terjadi</h2>
      <ul>
        <li>
          <strong>Tabungan disimpan di rekening harian.</strong> Saldo tabungan dan uang belanja bercampur, sehingga
          catatan tidak bisa dicocokkan dengan saldo sebenarnya.
        </li>
        <li>
          <strong>Mengambil tabungan tanpa mencatat.</strong> Saldo di catatan jadi lebih besar dari uang yang ada.
        </li>
        <li>
          <strong>Hanya mencatat saldo, tanpa riwayat.</strong> Anda tahu jumlahnya, tetapi tidak tahu kenapa naik atau
          turun.
        </li>
        <li>
          <strong>Target tanpa tanggal.</strong> Tanpa batas waktu, setoran yang dibutuhkan tidak bisa dihitung dan
          target mudah ditunda terus.
        </li>
      </ul>

      <h2>7. Supaya tabungan terisi rutin</h2>
      <p>
        Catatan hanya mencatat; yang membuat tabungan terisi adalah kebiasaan menyisihkan di awal, bukan dari sisa di akhir
        bulan. Caranya ada di <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>. Masukkan
        setoran tabungan sebagai pos tetap di <Link href="/panduan/cara-membuat-anggaran-bulanan">anggaran bulanan</Link>,
        dan kalau penghasilan masih pas-pasan, lihat contoh pembagian di{' '}
        <Link href="/panduan/cara-mengatur-gaji-3-juta">cara mengatur gaji 3 juta</Link>.
      </p>

      <h2>Mencatat tabungan di Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong> ada menu <strong>Tabungan</strong>. Anda bisa membuat target dengan nominal dan
        tanggal tercapai; setiap target menampilkan persentase progres dan perkiraan setoran per bulan yang dibutuhkan.
        Setoran bisa dibuat otomatis dari rekening yang Anda pilih, atau disetor manual. Setiap setoran dan penarikan
        tercatat beserta tanggalnya, dan saldo rekening sumbernya ikut disesuaikan. Semua fitur bisa dicoba gratis
        selama 14 hari tanpa kartu kredit.
      </p>
      <p>
        <em>Angka di panduan ini adalah ilustrasi. Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan
        dengan kondisi Anda.</em>
      </p>
    </GuideLayout>
  );
}

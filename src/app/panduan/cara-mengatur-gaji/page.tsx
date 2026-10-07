import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mengatur Gaji: Contoh Gaji 5 Juta (50/30/20) | Leosiqra',
  description:
    'Cara mengatur gaji bulanan dengan metode 50/30/20 — lengkap dengan contoh pembagian gaji 5 juta, urutan prioritas, dan cara memantaunya setiap bulan.',
  keywords: ['cara mengatur gaji', 'cara mengatur gaji 5 juta', 'metode 50 30 20', 'cara mengatur keuangan bulanan', 'budgeting gaji'],
  alternates: { canonical: '/panduan/cara-mengatur-gaji' },
  openGraph: {
    title: 'Cara Mengatur Gaji Bulanan: Contoh Gaji 5 Juta',
    description: 'Metode 50/30/20 dengan contoh angka nyata dan urutan prioritasnya.',
    url: 'https://www.leosiqra.com/panduan/cara-mengatur-gaji',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mengatur Gaji Bulanan: Contoh Gaji 5 Juta',
    description: 'Metode 50/30/20 dengan contoh angka nyata dan urutan prioritasnya.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa itu metode 50/30/20?',
    a: 'Cara membagi penghasilan bersih menjadi tiga pos: 50% untuk kebutuhan wajib, 30% untuk keinginan, dan 20% untuk tabungan, investasi, atau pelunasan utang.',
  },
  {
    q: 'Bagaimana kalau kebutuhan pokok sudah lebih dari 50% gaji?',
    a: 'Itu wajar di kota dengan biaya hidup tinggi. Kurangi porsi keinginan lebih dulu (misalnya jadi 60/20/20), tapi usahakan pos tabungan tidak turun di bawah 10%.',
  },
  {
    q: 'Kapan sebaiknya menyisihkan tabungan?',
    a: 'Di hari gajian, sebelum uang dipakai untuk hal lain. Menabung dari sisa di akhir bulan biasanya hasilnya nol.',
  },
  {
    q: 'Perlu dicatat setiap hari atau cukup di akhir bulan?',
    a: 'Idealnya setiap hari. Catatan harian membuat Anda tahu lebih awal kalau satu pos mulai melewati batas, sehingga masih sempat mengerem sebelum bulan berakhir.',
  },
];

export default function CaraMengaturGajiPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mengatur Gaji Bulanan: Contoh Gaji 5 Juta dengan Metode 50/30/20"
      lead="Gaji yang sama bisa terasa cukup atau selalu kurang, tergantung cara membaginya. Metode 50/30/20 adalah titik awal paling sederhana — berikut contoh angkanya dan cara menjalankannya."
      updated="29 September 2026"
      faq={faq}
      related={{ href: '/panduan/dana-darurat', label: 'Dana darurat: berapa idealnya?' }}
    >
      <h2>Metode 50/30/20 singkatnya</h2>
      <p>Setelah gaji masuk (angka bersih, sesudah potongan), bagi menjadi tiga pos:</p>
      <ul>
        <li><strong>50% kebutuhan</strong> — makan, tempat tinggal, transportasi, listrik, air, internet, cicilan wajib.</li>
        <li><strong>30% keinginan</strong> — nongkrong, hiburan, belanja non-pokok, langganan streaming.</li>
        <li><strong>20% masa depan</strong> — dana darurat, tabungan tujuan, investasi, atau melunasi utang lebih cepat.</li>
      </ul>

      <h2>Contoh pembagian gaji 5 juta</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Pos</th><th>Porsi</th><th className="num">Nominal</th><th>Contoh isi</th></tr>
          </thead>
          <tbody>
            <tr><td>Kebutuhan</td><td>50%</td><td className="num">2.500.000</td><td>Kos 1,2 jt · makan 900 rb · transport 250 rb · pulsa &amp; listrik 150 rb</td></tr>
            <tr><td>Keinginan</td><td>30%</td><td className="num">1.500.000</td><td>Nongkrong 600 rb · belanja 500 rb · hiburan 250 rb · langganan 150 rb</td></tr>
            <tr><td>Masa depan</td><td>20%</td><td className="num">1.000.000</td><td>Dana darurat 600 rb · tabungan liburan 250 rb · investasi 150 rb</td></tr>
            <tr><td><strong>Total</strong></td><td>100%</td><td className="num"><strong>5.000.000</strong></td><td></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Angka di atas hanya ilustrasi. Yang penting bukan persentasenya persis, tapi setiap rupiah sudah punya tujuan
        sebelum bulan berjalan.
      </p>

      <h2>Urutan prioritas saat gajian</h2>
      <ol>
        <li><strong>Sisihkan pos masa depan lebih dulu</strong> — pindahkan ke rekening atau tabungan terpisah di hari gajian.</li>
        <li><strong>Bayar tagihan wajib</strong> — sewa, listrik, internet, cicilan, tagihan kartu kredit.</li>
        <li><strong>Pasang batas untuk kebutuhan harian</strong> — makan dan transportasi per minggu.</li>
        <li><strong>Sisanya untuk keinginan</strong> — tanpa rasa bersalah, selama tidak melewati batasnya.</li>
      </ol>

      <h2>Menjaga agar tetap sesuai rencana</h2>
      <p>
        Rencana di awal bulan baru berguna kalau dipantau. Caranya: catat setiap pengeluaran di hari yang sama, lalu
        bandingkan dengan batas tiap pos. Kalau pos makan sudah terpakai 80% di minggu ketiga, Anda masih sempat
        menyesuaikan.
      </p>
      <p>
        Di <strong>Leosiqra</strong>, Anda bisa memasang budget per kategori, mencatat transaksi cukup dengan mengetik
        singkat seperti &quot;25rb kopi&quot;, dan melihat sisa budget setiap saat. Gaji dan tagihan bulanan juga bisa dijadwalkan
        sebagai transaksi rutin agar tercatat otomatis. Baca juga cara membuat{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link> yang konsisten.
      </p>
    </GuideLayout>
  );
}

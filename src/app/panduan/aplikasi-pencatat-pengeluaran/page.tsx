import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Aplikasi Pencatat Pengeluaran: Cara Memilih | Leosiqra',
  description:
    'Cara memilih aplikasi pencatat pengeluaran dan pemasukan: 7 hal yang perlu dicek, dari kecepatan mencatat, banyak rekening, budget, biaya, dan privasi.',
  keywords: [
    'aplikasi pencatat pengeluaran',
    'aplikasi pencatat pengeluaran dan pemasukan',
    'aplikasi pencatat pengeluaran harian',
    'aplikasi pencatat pengeluaran terbaik',
  ],
  alternates: { canonical: '/panduan/aplikasi-pencatat-pengeluaran' },
  openGraph: {
    title: 'Aplikasi Pencatat Pengeluaran: 7 Hal yang Perlu Dicek',
    description: 'Checklist memilih aplikasi pencatat pengeluaran yang benar-benar dipakai, bukan dihapus setelah seminggu.',
    url: 'https://www.leosiqra.com/panduan/aplikasi-pencatat-pengeluaran',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Aplikasi Pencatat Pengeluaran: 7 Hal yang Perlu Dicek',
    description: 'Checklist memilih aplikasi pencatat pengeluaran yang benar-benar dipakai, bukan dihapus setelah seminggu.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya aplikasi pencatat pengeluaran dengan aplikasi mobile banking?',
    a: 'Mobile banking hanya menampilkan mutasi satu rekening, tanpa kategori yang Anda tentukan sendiri. Aplikasi pencatat pengeluaran menggabungkan semua rekening, e-wallet, dan uang tunai di satu tempat lalu merangkumnya per kategori.',
  },
  {
    q: 'Lebih baik aplikasi gratis atau berbayar?',
    a: 'Yang penting jelas sejak awal: apa yang gratis, sampai kapan, dan apa yang terjadi pada data Anda kalau tidak berlangganan. Aplikasi gratis biasanya dibiayai iklan atau membatasi fitur; aplikasi berbayar sebaiknya bisa dicoba dulu sebelum membayar.',
  },
  {
    q: 'Berapa lama mencoba sebelum memutuskan cocok atau tidak?',
    a: 'Sekitar dua minggu pemakaian harian. Dalam waktu itu Anda sudah tahu apakah mencatat terasa cepat, dan sudah punya cukup data untuk melihat apakah rangkumannya berguna.',
  },
  {
    q: 'Apakah aman mencatat keuangan di aplikasi?',
    a: 'Periksa kebijakan privasinya: siapa yang bisa membuka data, apakah data dipakai untuk iklan, dan bagaimana cara menghapus akun. Aplikasi pencatat tidak perlu meminta PIN atau password mobile banking Anda.',
  },
];

export default function AplikasiPencatatPengeluaranPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Aplikasi Pencatat Pengeluaran: 7 Hal yang Perlu Dicek"
      lead="Banyak orang mengunduh aplikasi pencatat pengeluaran, mencatat dengan semangat tiga hari, lalu berhenti. Masalahnya jarang karena malas — lebih sering karena aplikasinya tidak cocok dengan cara mereka memegang uang. Berikut tujuh hal yang perlu dicek sebelum memilih."
      updated="19 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/catat-pengeluaran-di-excel', label: 'Catat pengeluaran di Excel vs aplikasi' }}
    >
      <h2>1. Seberapa cepat mencatat satu transaksi?</h2>
      <p>
        Ini faktor terpenting. Kalau mencatat satu jajan kopi butuh enam ketukan dan memilih tiga menu, Anda akan menundanya —
        dan transaksi yang ditunda biasanya terlupa. Coba catat lima transaksi kecil berturut-turut. Kalau terasa merepotkan,
        aplikasi itu kemungkinan besar tidak akan bertahan lama di HP Anda. Lihat juga tips agar konsisten di{' '}
        <Link href="/catatan-keuangan-harian">contoh catatan keuangan harian</Link>.
      </p>

      <h2>2. Bisa memisahkan banyak rekening dan uang tunai?</h2>
      <p>
        Uang jarang berada di satu tempat: ada rekening gaji, e-wallet, dompet tunai, kadang kartu kredit. Aplikasi yang baik
        mencatat setiap sumber secara terpisah, sehingga saldo di aplikasi bisa dicocokkan dengan saldo sebenarnya. Pindah
        uang antarrekening (misalnya top up e-wallet) juga harus tercatat sebagai <em>transfer</em>, bukan pengeluaran —
        kalau tidak, laporan Anda akan terlihat lebih boros dari kenyataannya.
      </p>

      <h2>3. Kategori bisa diatur sendiri?</h2>
      <p>
        Kategori bawaan jarang pas untuk semua orang. Pastikan Anda bisa menambah, mengganti nama, atau menggabungkan kategori.
        Untuk keluarga, susunan kategori yang umum dipakai ada di panduan{' '}
        <Link href="/panduan/catat-keuangan-rumah-tangga">catatan keuangan rumah tangga</Link>; untuk usaha, lihat{' '}
        <Link href="/panduan/catat-keuangan-usaha-kecil">catatan keuangan jualan</Link>.
      </p>

      <h2>4. Ada budget dan peringatan?</h2>
      <p>
        Mencatat saja hanya memberi tahu ke mana uang <em>sudah</em> pergi. Budget per kategori dengan peringatan sebelum
        batas terlampaui membantu Anda mengerem <em>sebelum</em> kebablasan. Cara menentukan angkanya dijelaskan di panduan{' '}
        <Link href="/panduan/cara-mengatur-gaji">mengatur gaji bulanan</Link>.
      </p>

      <h2>5. Transaksi rutin tercatat sendiri?</h2>
      <p>
        Gaji, cicilan, langganan, dan tagihan terjadi setiap bulan. Aplikasi yang bisa mencatatnya otomatis tiap periode
        menghemat waktu dan mengurangi transaksi yang terlewat — terutama cicilan, yang penting dipantau kalau Anda sedang{' '}
        <Link href="/panduan/cara-melunasi-utang">melunasi utang</Link>.
      </p>

      <h2>6. Laporannya menjawab pertanyaan nyata?</h2>
      <p>Grafik cantik tidak ada gunanya kalau tidak menjawab pertanyaan sehari-hari. Cek apakah laporan bisa menjawab:</p>
      <ul>
        <li>Bulan ini paling banyak habis di kategori apa?</li>
        <li>Apakah bulan ini lebih boros dari bulan lalu?</li>
        <li>Berapa yang benar-benar tersisa untuk tabungan dan <Link href="/panduan/dana-darurat">dana darurat</Link>?</li>
      </ul>

      <h2>7. Biaya, iklan, dan privasi jelas?</h2>
      <ul>
        <li><strong>Biaya</strong> — apa yang gratis, sampai kapan, dan berapa harga setelahnya.</li>
        <li><strong>Iklan</strong> — iklan yang muncul di tengah mencatat membuat proses terasa lambat.</li>
        <li><strong>Privasi</strong> — data keuangan bersifat pribadi; baca siapa yang bisa mengaksesnya.</li>
        <li><strong>Perangkat</strong> — apakah tersedia di HP yang Anda pakai, dan apakah data sama di HP dan laptop.</li>
      </ul>

      <h2>Kapan aplikasi tidak perlu?</h2>
      <p>
        Kalau transaksi Anda sedikit dan Anda nyaman dengan spreadsheet, Excel atau Google Sheets sudah cukup. Perbandingan
        jujurnya ada di panduan <Link href="/panduan/catat-pengeluaran-di-excel">Excel vs aplikasi</Link>. Aplikasi mulai
        terasa manfaatnya saat transaksi harian banyak, rekening lebih dari satu, atau Anda sering lupa mencatat.
      </p>

      <h2>Mencatat pengeluaran dengan Leosiqra</h2>
      <p>
        <strong>Leosiqra</strong> dibuat dengan checklist di atas sebagai patokan. Transaksi dicatat lewat Input Cepat — ketik
        singkat, ucapkan, atau foto struk. Setiap rekening, kartu, dan dompet tunai dicatat terpisah; transaksi rutin seperti
        gaji dan tagihan tercatat sendiri tiap periode; budget per kategori memberi peringatan sebelum kebablasan; dan rekap
        bulanan tersusun otomatis. Tersedia di Android, bisa dipasang di iPhone, dan versi web dengan data yang sama.
        Anda bisa mencoba semua fitur gratis selama 14 hari tanpa kartu kredit, lalu memutuskan sendiri apakah cocok.
      </p>
    </GuideLayout>
  );
}

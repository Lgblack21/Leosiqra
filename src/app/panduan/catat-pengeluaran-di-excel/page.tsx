import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Catat Pengeluaran di Excel vs Aplikasi | Leosiqra',
  description:
    'Cara mencatat pengeluaran dan pemasukan di Excel dengan template sederhana dan rumus SUMIF, kelemahannya, dan kapan sebaiknya pindah ke aplikasi.',
  keywords: [
    'cara mencatat pengeluaran dan pemasukan di excel',
    'template excel pengeluaran bulanan',
    'catatan keuangan excel',
    'rumus excel pengeluaran',
    'aplikasi catatan keuangan',
  ],
  alternates: { canonical: '/panduan/catat-pengeluaran-di-excel' },
  openGraph: {
    title: 'Catat Pengeluaran di Excel vs Aplikasi: Mana yang Cocok?',
    description: 'Template Excel sederhana, rumus yang dipakai, dan tanda kapan sebaiknya pindah ke aplikasi.',
    url: 'https://www.leosiqra.com/panduan/catat-pengeluaran-di-excel',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Catat Pengeluaran di Excel vs Aplikasi: Mana yang Cocok?',
    description: 'Template Excel sederhana, rumus yang dipakai, dan tanda kapan sebaiknya pindah ke aplikasi.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Rumus Excel apa yang paling berguna untuk catatan pengeluaran?',
    a: 'SUM untuk total, SUMIF untuk total per kategori (misalnya semua pengeluaran "Makan"), dan SUMIFS kalau ingin menyaring berdasarkan kategori sekaligus bulan. Tiga rumus itu sudah cukup untuk catatan pribadi.',
  },
  {
    q: 'Kenapa rumus saya error padahal sama persis dengan contoh?',
    a: 'Biasanya karena pemisah argumen. Excel dengan pengaturan regional Indonesia memakai titik koma (;), sedangkan pengaturan Inggris memakai koma (,). Ganti pemisahnya sesuai yang diminta Excel Anda.',
  },
  {
    q: 'Apakah data Excel lama bisa dipindahkan ke Leosiqra?',
    a: 'Bisa untuk riwayat transaksi. Simpan lembar Excel sebagai file CSV, lalu buka menu Input Transaksi → Impor Mutasi (CSV) di versi web. Anda memilih kolom mana yang berisi tanggal, keterangan, dan nominal sebelum data dimasukkan.',
  },
  {
    q: 'Lebih baik Excel atau aplikasi?',
    a: 'Excel cukup kalau Anda rajin membuka laptop setiap hari dan hanya punya satu-dua rekening. Aplikasi lebih cocok kalau sering lupa mencatat, banyak transaksi kecil dari HP, atau punya beberapa rekening dan e-wallet yang saldonya harus selalu cocok.',
  },
];

export default function CatatPengeluaranDiExcelPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Catat Pengeluaran di Excel vs Aplikasi: Mana yang Cocok?"
      lead="Excel adalah cara paling umum untuk mulai mencatat keuangan — gratis dan fleksibel. Berikut template sederhana yang bisa langsung Anda buat, rumus yang dipakai, kelemahannya, dan tanda-tanda kapan sebaiknya pindah ke aplikasi."
      updated="9 Oktober 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-harian', label: 'Contoh format catatan keuangan harian' }}
    >
      <h2>Template Excel sederhana untuk pengeluaran dan pemasukan</h2>
      <p>
        Cukup satu lembar (sheet) dengan lima kolom. Setiap baris adalah satu transaksi — jangan dipisah per hari atau per
        sheet, supaya rumusnya tetap sederhana.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>A: Tanggal</th><th>B: Keterangan</th><th>C: Kategori</th><th>D: Jenis</th><th className="num">E: Nominal</th></tr>
          </thead>
          <tbody>
            <tr><td>01/10</td><td>Gaji</td><td>Gaji</td><td>Masuk</td><td className="num">5.000.000</td></tr>
            <tr><td>01/10</td><td>Bayar kos</td><td>Tempat tinggal</td><td>Keluar</td><td className="num">1.200.000</td></tr>
            <tr><td>02/10</td><td>Makan siang</td><td>Makan</td><td>Keluar</td><td className="num">25.000</td></tr>
            <tr><td>02/10</td><td>Isi bensin</td><td>Transportasi</td><td>Keluar</td><td className="num">40.000</td></tr>
            <tr><td>03/10</td><td>Kopi</td><td>Makan</td><td>Keluar</td><td className="num">18.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>Angka di atas hanya ilustrasi. Beberapa aturan supaya lembar ini tetap rapi:</p>
      <ul>
        <li><strong>Nominal selalu angka positif</strong>; arah uangnya ditentukan kolom Jenis (Masuk/Keluar).</li>
        <li><strong>Kategori dibatasi</strong> dengan Data Validation (daftar pilihan), supaya &quot;Makan&quot; tidak tercatat
          sebagai &quot;makan&quot; atau &quot;Mkn&quot; dan totalnya tidak terpecah.</li>
        <li><strong>Format kolom Tanggal sebagai tanggal</strong>, bukan teks, agar bisa disaring per bulan.</li>
      </ul>

      <h2>Rumus yang dipakai</h2>
      <ul>
        <li>Total pengeluaran: <code>=SUMIF(D:D;&quot;Keluar&quot;;E:E)</code></li>
        <li>Total pemasukan: <code>=SUMIF(D:D;&quot;Masuk&quot;;E:E)</code></li>
        <li>Total per kategori: <code>=SUMIF(C:C;&quot;Makan&quot;;E:E)</code></li>
        <li>Sisa uang: total pemasukan dikurangi total pengeluaran.</li>
      </ul>
      <p>
        Kalau Excel menolak rumusnya, ganti titik koma (;) dengan koma (,) — tergantung pengaturan regional komputer Anda.
        Untuk menyaring per bulan sekaligus, pakai <code>SUMIFS</code> dengan syarat tambahan pada kolom Tanggal.
      </p>

      <h2>Kelemahan mencatat di Excel</h2>
      <ul>
        <li><strong>Mudah lupa.</strong> Pengeluaran kecil terjadi di luar rumah, sementara file Excel ada di laptop. Yang
          tidak dicatat saat itu juga sering tidak pernah dicatat.</li>
        <li><strong>Rumus bisa rusak diam-diam.</strong> Satu sel yang tertimpa angka manual, atau baris baru di luar rentang
          rumus, membuat total salah tanpa peringatan.</li>
        <li><strong>Tidak praktis di HP.</strong> Mengetik ke sel spreadsheet di layar kecil lambat, apalagi untuk transaksi
          Rp18.000.</li>
        <li><strong>Saldo rekening tidak ikut berubah.</strong> Excel hanya mencatat; mencocokkan saldo beberapa rekening dan
          e-wallet harus dilakukan manual.</li>
      </ul>

      <h2>Excel vs aplikasi: perbandingan singkat</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Aspek</th><th>Excel</th><th>Aplikasi catatan keuangan</th></tr>
          </thead>
          <tbody>
            <tr><td>Biaya awal</td><td>Gratis (kalau sudah punya)</td><td>Ada yang gratis, ada yang berbayar</td></tr>
            <tr><td>Fleksibilitas format</td><td>Bebas diatur sendiri</td><td>Mengikuti struktur aplikasi</td></tr>
            <tr><td>Mencatat dari HP</td><td>Lambat</td><td>Cepat, dirancang untuk HP</td></tr>
            <tr><td>Saldo per rekening</td><td>Dihitung manual</td><td>Berubah otomatis tiap transaksi</td></tr>
            <tr><td>Risiko rumus salah</td><td>Ada</td><td>Perhitungan dilakukan aplikasi</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Kapan sebaiknya pindah ke aplikasi?</h2>
      <p>Excel tetap pilihan yang baik kalau cara itu sudah berjalan untuk Anda. Pertimbangkan pindah kalau:</p>
      <ol>
        <li>Lebih dari seminggu sekali Anda &quot;merekap dari ingatan&quot; karena lupa mencatat.</li>
        <li>Anda punya lebih dari dua rekening atau e-wallet dan saldonya sering tidak cocok.</li>
        <li>Anda ingin melihat ringkasan bulanan tanpa menyusun ulang tabel pivot.</li>
        <li>Anda ingin anggaran seperti di <Link href="/panduan/cara-mengatur-gaji">metode 50/30/20</Link> terpantau
          otomatis.</li>
      </ol>

      <h2>Mulai di Leosiqra tanpa membuang data Excel</h2>
      <p>
        Di <strong>Leosiqra</strong>, riwayat dari Excel bisa dibawa: simpan sheet sebagai <strong>CSV</strong>, lalu buka{' '}
        <strong>Input Transaksi → Impor Mutasi (CSV)</strong> di versi web, pilih rekening tujuan, dan tentukan kolom
        tanggal, keterangan, serta nominal (satu kolom, atau debit/kredit terpisah). Setelah itu transaksi baru bisa dicatat
        dari HP. Untuk kebiasaan mencatatnya, lihat juga panduan{' '}
        <Link href="/catatan-keuangan-pribadi">catatan keuangan pribadi</Link> dan{' '}
        <Link href="/panduan/dana-darurat">dana darurat</Link>.
      </p>
    </GuideLayout>
  );
}

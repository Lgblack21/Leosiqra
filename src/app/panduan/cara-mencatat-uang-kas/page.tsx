import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Mencatat Uang Kas (Kelas, RT, Arisan) + Contoh | Leosiqra',
  description:
    'Cara mencatat uang kas kelas, RT, arisan, atau komunitas: kolom yang wajib ada, contoh tabel buku kas sebulan, cara melaporkan ke anggota, dan kebiasaan bendahara yang membuat kas tetap dipercaya.',
  keywords: [
    'cara mencatat pengeluaran uang kas',
    'cara mencatat uang kas',
    'contoh buku kas',
    'laporan uang kas kelas',
    'buku kas RT',
    'pembukuan kas arisan',
  ],
  alternates: { canonical: '/panduan/cara-mencatat-uang-kas' },
  openGraph: {
    title: 'Cara Mencatat Uang Kas (Kelas, RT, Arisan, Komunitas) + Contoh Tabel',
    description: 'Kolom buku kas yang wajib ada, contoh tabel sebulan, dan cara melapor ke anggota supaya kas tetap dipercaya.',
    url: 'https://www.leosiqra.com/panduan/cara-mencatat-uang-kas',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Mencatat Uang Kas (Kelas, RT, Arisan, Komunitas) + Contoh Tabel',
    description: 'Kolom buku kas yang wajib ada, contoh tabel sebulan, dan cara melapor ke anggota supaya kas tetap dipercaya.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya uang kas dengan iuran?',
    a: 'Iuran adalah uang yang dibayar anggota, sedangkan uang kas adalah kumpulan uang bersama yang dikelola bendahara — isinya dari iuran, sumbangan, atau sisa kegiatan, dan dipakai untuk keperluan bersama. Buku kas mencatat keduanya: uang yang masuk dan uang yang keluar.',
  },
  {
    q: 'Uang kas sebaiknya disimpan tunai atau di rekening?',
    a: 'Untuk jumlah kecil yang sering dipakai, tunai di dompet khusus kas cukup. Kalau saldonya sudah besar, simpan di rekening terpisah dari rekening pribadi bendahara supaya mudah dicek dan tidak tercampur. Apa pun tempatnya, saldo di buku harus sama dengan uang yang benar-benar ada.',
  },
  {
    q: 'Bagaimana kalau ada anggota yang belum bayar?',
    a: 'Catat di daftar iuran per anggota, terpisah dari buku kas. Buku kas hanya mencatat uang yang benar-benar diterima. Saat laporan, sebutkan jumlah tunggakan secara umum tanpa mempermalukan anggota tertentu.',
  },
  {
    q: 'Seberapa sering laporan kas dibagikan?',
    a: 'Sebulan sekali sudah cukup untuk kas kelas, RT, atau arisan. Untuk acara besar seperti tujuhbelasan atau study tour, buat laporan terpisah segera setelah acara selesai.',
  },
];

export default function CaraMencatatUangKasPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Mencatat Uang Kas (Kelas, RT, Arisan, Komunitas) + Contoh Tabel"
      lead="Jadi bendahara itu gampang-gampang susah: uangnya bukan milik sendiri, dan semua orang ingin tahu ke mana perginya. Buku kas yang rapi membuat pertanyaan itu bisa dijawab dalam semenit. Berikut kolom yang wajib ada, contoh tabel sebulan, dan cara melapor ke anggota."
      updated="23 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/catat-keuangan-usaha-kecil', label: 'Catatan keuangan jualan (UMKM)' }}
    >
      <h2>1. Kolom yang wajib ada di buku kas</h2>
      <p>Buku kas yang baik cukup punya enam kolom. Setiap baris adalah satu kejadian uang masuk atau keluar:</p>
      <ul>
        <li><strong>Tanggal</strong> — kapan uang diterima atau dibayarkan.</li>
        <li><strong>Keterangan</strong> — jelas dan spesifik: &ldquo;Iuran Mei, 25 siswa&rdquo;, bukan sekadar &ldquo;iuran&rdquo;.</li>
        <li><strong>Masuk</strong> — nominal uang yang diterima.</li>
        <li><strong>Keluar</strong> — nominal uang yang dibayarkan.</li>
        <li><strong>Saldo</strong> — saldo sebelumnya + masuk − keluar.</li>
        <li><strong>Bukti</strong> — nomor atau kode foto nota/kuitansi.</li>
      </ul>
      <p>
        Isi buku kas <strong>di hari yang sama</strong> dengan transaksinya. Menunda sampai akhir bulan adalah penyebab paling
        umum saldo buku tidak cocok dengan uang yang ada.
      </p>

      <h2>2. Contoh buku kas kelas selama sebulan</h2>
      <p>
        Contoh kas kelas dengan 25 siswa dan iuran Rp10.000 per orang per bulan, saldo awal Rp150.000 (angka ilustrasi,
        sesuaikan dengan kas Anda):
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Saldo</th><th>Bukti</th></tr>
          </thead>
          <tbody>
            <tr><td>01/05</td><td>Saldo awal (sisa April)</td><td className="num"></td><td className="num"></td><td className="num">150.000</td><td>—</td></tr>
            <tr><td>06/05</td><td>Iuran Mei, 25 siswa × 10.000</td><td className="num">250.000</td><td className="num"></td><td className="num">400.000</td><td>Daftar iuran</td></tr>
            <tr><td>10/05</td><td>Fotokopi materi ujian</td><td className="num"></td><td className="num">45.000</td><td className="num">355.000</td><td>N-01</td></tr>
            <tr><td>15/05</td><td>Sapu &amp; alat kebersihan kelas</td><td className="num"></td><td className="num">60.000</td><td className="num">295.000</td><td>N-02</td></tr>
            <tr><td>22/05</td><td>Hadiah ulang tahun wali kelas</td><td className="num"></td><td className="num">120.000</td><td className="num">175.000</td><td>N-03</td></tr>
            <tr><td>28/05</td><td>Sumbangan sisa bazar</td><td className="num">40.000</td><td className="num"></td><td className="num">215.000</td><td>Catatan panitia</td></tr>
            <tr><td><strong>31/05</strong></td><td><strong>Total Mei</strong></td><td className="num"><strong>290.000</strong></td><td className="num"><strong>225.000</strong></td><td className="num"><strong>215.000</strong></td><td></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Cara mengecek: saldo awal 150.000 + total masuk 290.000 − total keluar 225.000 = 215.000. Angka ini harus sama
        persis dengan uang tunai atau saldo rekening kas di akhir bulan.
      </p>

      <h2>3. Pisahkan daftar iuran dari buku kas</h2>
      <p>
        Siapa yang sudah dan belum bayar sebaiknya dicatat di tabel tersendiri: satu baris per anggota, satu kolom per bulan,
        diberi tanda centang saat iuran diterima. Buku kas cukup mencatat total uang yang benar-benar masuk hari itu.
        Dengan dua catatan terpisah, buku kas tetap ringkas dan tunggakan tetap terpantau.
      </p>

      <h2>4. Simpan bukti setiap pengeluaran</h2>
      <ul>
        <li>Foto nota atau kuitansi langsung setelah belanja, lalu beri kode berurutan (N-01, N-02, dan seterusnya).</li>
        <li>Kalau tidak ada nota (misalnya ongkos ojek), tulis keterangan lengkap dan minta satu pengurus lain mengetahui.</li>
        <li>Pengeluaran besar sebaiknya disetujui ketua atau disepakati di grup sebelum uangnya keluar.</li>
      </ul>

      <h2>5. Laporkan ke anggota setiap bulan</h2>
      <p>Laporan kas tidak perlu panjang. Format yang mudah dibaca di grup WhatsApp:</p>
      <ol>
        <li>Saldo awal bulan.</li>
        <li>Total uang masuk, dengan rincian singkat (iuran, sumbangan).</li>
        <li>Total uang keluar per keperluan.</li>
        <li>Saldo akhir dan di mana uangnya disimpan.</li>
        <li>Rencana pengeluaran bulan depan, kalau ada.</li>
      </ol>
      <p>
        Lampirkan foto halaman buku kas atau tabelnya. Keterbukaan seperti ini jauh lebih menenangkan anggota daripada
        jawaban &ldquo;aman kok&rdquo;.
      </p>

      <h2>6. Kebiasaan bendahara yang membuat kas dipercaya</h2>
      <ul>
        <li><strong>Jangan campur dengan uang pribadi</strong>, walau hanya &ldquo;meminjam sebentar&rdquo;.</li>
        <li><strong>Hitung uang fisik seminggu sekali</strong> dan cocokkan dengan saldo buku.</li>
        <li><strong>Serah terima tertulis</strong> saat ganti bendahara: saldo, buku kas, dan semua bukti.</li>
      </ul>

      <h2>Mencatat uang kas dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, uang kas bisa dibuat sebagai dompet tersendiri sehingga tidak tercampur dengan uang
        pribadi. Setiap pemasukan dan pengeluaran dicatat dengan mengetik singkat, suara, atau foto nota, diberi kategori,
        dan saldo dompet kas berubah otomatis. Rekap bulanan per kategori bisa dipakai sebagai bahan laporan ke anggota.
        Untuk dasar-dasar pencatatan, lihat juga <Link href="/catatan-keuangan-harian">contoh catatan keuangan harian</Link>.
      </p>
      <p>
        <em>Panduan ini bersifat edukasi umum. Sesuaikan aturan kas dengan kesepakatan kelompok Anda.</em>
      </p>
    </GuideLayout>
  );
}

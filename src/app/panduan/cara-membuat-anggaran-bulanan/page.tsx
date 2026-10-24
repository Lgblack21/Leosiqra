import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Membuat Anggaran Bulanan (Budgeting) | Leosiqra',
  description:
    'Cara membuat anggaran bulanan dari pengeluaran nyata: pos tetap, tabungan di depan, pos variabel, cek di tengah bulan, plus contoh gaji 4 juta.',
  keywords: [
    'cara membuat anggaran bulanan',
    'aplikasi budgeting bulanan',
    'aplikasi budgeting',
    'contoh anggaran bulanan gaji 4 juta',
    'budgeting keuangan pribadi',
  ],
  alternates: { canonical: '/panduan/cara-membuat-anggaran-bulanan' },
  openGraph: {
    title: 'Cara Membuat Anggaran Bulanan yang Benar-Benar Dipakai',
    description: 'Mulai dari pengeluaran nyata, sisihkan tabungan di depan, beri batas tiap kategori, lalu cek lajunya di tengah bulan.',
    url: 'https://www.leosiqra.com/panduan/cara-membuat-anggaran-bulanan',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Membuat Anggaran Bulanan yang Benar-Benar Dipakai',
    description: 'Mulai dari pengeluaran nyata, sisihkan tabungan di depan, beri batas tiap kategori, lalu cek lajunya di tengah bulan.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa bedanya anggaran (budget) dengan catatan keuangan?',
    a: 'Catatan keuangan merekam uang yang sudah keluar dan masuk. Anggaran adalah rencana di awal bulan: berapa batas untuk tiap kategori. Keduanya saling butuh — anggaran tanpa catatan tidak bisa dicek, catatan tanpa anggaran tidak punya patokan.',
  },
  {
    q: 'Berapa banyak kategori yang ideal dalam anggaran?',
    a: 'Untuk pemula, 6–10 kategori sudah cukup. Terlalu banyak kategori membuat anggaran melelahkan dirawat; terlalu sedikit membuat Anda tidak tahu pos mana yang bocor. Pecah kategori hanya kalau pos itu memang sering melebihi batas.',
  },
  {
    q: 'Bagaimana kalau satu kategori melebihi anggaran?',
    a: 'Ambil dari kategori variabel lain di bulan yang sama (misalnya hiburan), bukan dari tabungan. Di akhir bulan, evaluasi: kalau kategori itu melebihi batas tiga bulan berturut-turut, batasnya yang tidak realistis dan perlu disesuaikan.',
  },
  {
    q: 'Apakah perlu aplikasi budgeting, atau cukup Excel?',
    a: 'Excel atau buku cukup kalau Anda disiplin mencatat dan menghitung ulang setiap minggu. Aplikasi budgeting membantu kalau Anda sering lupa mencatat atau ingin realisasi tiap kategori terhitung otomatis dari transaksi yang dicatat.',
  },
];

export default function CaraMembuatAnggaranBulananPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Membuat Anggaran Bulanan yang Benar-Benar Dipakai"
      lead="Anggaran bulanan sering gagal di minggu kedua: angkanya dibuat dari perkiraan, lalu tidak pernah dicek lagi. Berikut cara membuat anggaran bulanan dari pengeluaran yang nyata, menentukan batas per kategori, dan memantaunya sebelum terlambat."
      updated="18 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji bulanan (50/30/20)' }}
    >
      <h2>1. Mulai dari pengeluaran nyata, bukan perkiraan</h2>
      <p>
        Kesalahan paling umum adalah menulis anggaran berdasarkan &ldquo;rasanya segini&rdquo;. Lihat dulu ke mana uang Anda
        benar-benar pergi selama 1–3 bulan terakhir: mutasi rekening, riwayat e-wallet, struk, atau{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>. Kelompokkan ke beberapa kategori, lalu hitung
        rata-ratanya. Angka inilah titik awal anggaran Anda.
      </p>

      <h2>2. Tentukan pemasukan yang pasti</h2>
      <p>
        Pakai pemasukan bersih yang benar-benar masuk ke rekening (gaji setelah potongan), bukan gaji kotor. Pemasukan yang
        tidak tentu — bonus, lembur, hasil jualan sampingan — sebaiknya tidak dipakai untuk menutup kebutuhan rutin. Kalau
        penghasilan Anda tidak tetap, pakai angka bulan terendah dalam beberapa bulan terakhir sebagai dasar.
      </p>

      <h2>3. Susun pos: tetap, tabungan di depan, lalu variabel</h2>
      <ol>
        <li>
          <strong>Pos tetap</strong> — sewa/kos, cicilan, listrik, internet, iuran. Nominalnya hampir sama tiap bulan, jadi
          masukkan lebih dulu.
        </li>
        <li>
          <strong>Tabungan dan dana darurat</strong> — perlakukan sebagai &ldquo;tagihan&rdquo; yang dibayar di hari gajian,
          bukan dari sisa. Urutan prioritasnya dibahas di panduan{' '}
          <Link href="/panduan/cara-menabung-yang-benar">cara menabung yang benar</Link>.
        </li>
        <li>
          <strong>Pos variabel</strong> — makan, transportasi, hiburan, belanja. Di sinilah batas per kategori paling
          penting, karena pos ini yang biasanya bocor.
        </li>
        <li>
          <strong>Cadangan kecil</strong> — sedikit ruang untuk hal tak terduga yang bukan darurat (hadiah, servis kecil),
          supaya satu kejadian tidak merusak seluruh anggaran.
        </li>
      </ol>

      <h2>4. Contoh anggaran bulanan gaji 4 juta</h2>
      <p>Contoh untuk lajang yang tinggal di kos tanpa cicilan (angka ilustrasi, sesuaikan dengan kota dan kondisi Anda):</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kategori</th><th>Jenis</th><th className="num">Anggaran (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Tabungan &amp; dana darurat</td><td>Di depan</td><td className="num">600.000</td></tr>
            <tr><td>Kos</td><td>Tetap</td><td className="num">1.000.000</td></tr>
            <tr><td>Listrik, air, pulsa &amp; internet</td><td>Tetap</td><td className="num">300.000</td></tr>
            <tr><td>Transportasi</td><td>Variabel</td><td className="num">400.000</td></tr>
            <tr><td>Makan &amp; belanja dapur</td><td>Variabel</td><td className="num">1.100.000</td></tr>
            <tr><td>Hiburan &amp; jajan</td><td>Variabel</td><td className="num">300.000</td></tr>
            <tr><td>Cadangan</td><td>Variabel</td><td className="num">300.000</td></tr>
            <tr><td><strong>Total</strong></td><td></td><td className="num"><strong>4.000.000</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Total anggaran sama persis dengan pemasukan: setiap rupiah sudah punya tugas. Kalau totalnya lebih besar dari
        pemasukan, kurangi pos variabel dulu, bukan tabungan.
      </p>

      <h2>5. Cek lajunya di tengah bulan</h2>
      <p>
        Anggaran baru berguna kalau dicek sebelum bulan berakhir. Cara sederhana: bandingkan persen anggaran yang sudah
        terpakai dengan persen bulan yang sudah lewat. Misalnya di tanggal 15 (sekitar 50% bulan), kategori makan sudah
        terpakai Rp700.000 dari Rp1.100.000 atau sekitar 64%. Dengan laju yang sama, akhir bulan kategori ini akan mencapai
        sekitar Rp1.400.000 — lewat Rp300.000 dari batas (angka ilustrasi).
      </p>
      <p>
        Saat itu Anda masih punya waktu untuk menyesuaikan: kurangi makan di luar selama dua minggu ke depan, atau pindahkan
        sebagian anggaran hiburan. Kalau baru dicek di akhir bulan, yang tersisa hanya penyesalan.
      </p>

      <h2>6. Evaluasi di akhir bulan</h2>
      <ul>
        <li><strong>Kategori yang selalu lewat batas</strong> tiga bulan berturut-turut: batasnya terlalu kecil, naikkan dan ambil dari pos lain.</li>
        <li><strong>Kategori yang selalu bersisa jauh</strong>: kecilkan batasnya dan alihkan selisihnya ke tabungan.</li>
        <li><strong>Pengeluaran tahunan</strong> (pajak kendaraan, perpanjangan langganan, biaya sekolah): bagi dua belas dan sisihkan tiap bulan supaya tidak mengejutkan.</li>
      </ul>

      <h2>Kapan butuh aplikasi budgeting?</h2>
      <p>
        Buku atau spreadsheet sudah cukup kalau Anda rutin mencatat dan menghitung ulang setiap minggu — template dan rumusnya
        ada di panduan <Link href="/panduan/catat-pengeluaran-di-excel">catat pengeluaran di Excel</Link>. Aplikasi
        budgeting mulai terasa manfaatnya ketika pencatatan sering tertunda, atau ketika menghitung realisasi tiap kategori
        secara manual mulai jadi pekerjaan tersendiri.
      </p>

      <h2>Membuat anggaran di Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, menu <strong>Budget &amp; Target</strong> memungkinkan Anda memasang target per kategori
        untuk pengeluaran maupun pemasukan, dengan periode bulanan atau tahunan. Realisasinya dihitung dari transaksi yang
        Anda catat, lengkap dengan persentase dan bilah progres yang berubah merah saat pengeluaran melewati batas. Di halaman
        AI Leosiqra, muncul peringatan bila laju belanja sebuah kategori diproyeksikan melewati targetnya sebelum akhir bulan.
        Transaksi bisa dicatat dengan mengetik singkat, suara, atau foto struk, di web maupun aplikasi Android.
      </p>
      <p>
        <em>Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

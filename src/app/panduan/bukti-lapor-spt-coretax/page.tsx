import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Bukti Lapor SPT Tahunan Coretax (BPE): Cara Mendapatkan | Leosiqra',
  description:
    'Apa itu Bukti Penerimaan Elektronik (BPE) SPT Tahunan di Coretax, cara mendapatkannya lewat email, Portal Saya > Dokumen Saya, atau Coretax Form, dan apa yang dilakukan kalau BPE belum muncul.',
  keywords: [
    'contoh bukti lapor spt tahunan coretax',
    'bukti penerimaan elektronik spt coretax',
    'cara download bpe spt coretax',
    'bpe spt tahunan',
    'bukti lapor spt tahunan',
  ],
  alternates: { canonical: '/panduan/bukti-lapor-spt-coretax' },
  openGraph: {
    title: 'Bukti Lapor SPT Tahunan Coretax (BPE): Cara Mendapatkan & Menyimpan',
    description: 'Di mana BPE SPT Tahunan Coretax bisa ditemukan, cara menyimpannya, dan langkah kalau belum muncul.',
    url: 'https://www.leosiqra.com/panduan/bukti-lapor-spt-coretax',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Bukti Lapor SPT Tahunan Coretax (BPE): Cara Mendapatkan & Menyimpan',
    description: 'Di mana BPE SPT Tahunan Coretax bisa ditemukan, cara menyimpannya, dan langkah kalau belum muncul.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apakah BPE sama dengan bukti bahwa SPT sudah dilaporkan?',
    a: 'Ya. Bukti Penerimaan Elektronik (BPE) adalah tanda terima dari Direktorat Jenderal Pajak bahwa SPT yang Anda kirim secara elektronik sudah diterima. Simpan BPE sebagai arsip bersama SPT dan bukti potong tahun yang sama.',
  },
  {
    q: 'Kenapa BPE belum muncul padahal SPT sudah dikirim?',
    a: 'Menurut panduan resmi DJP, data BPE atas SPT yang dikirim lewat Coretax Form baru masuk ke portal Coretax setelah sekitar 1 hari. Tunggu dulu, cek email terdaftar (termasuk folder spam), lalu buka Portal Saya > Dokumen Saya dan tekan Refresh.',
  },
  {
    q: 'BPE tidak ada di email maupun Dokumen Saya, harus bagaimana?',
    a: 'Cek juga menu notifikasi (ikon lonceng) di halaman utama Coretax. Kalau tetap tidak ada, hubungi Kring Pajak atau kanal resmi DJP, sebutkan tahun pajak dan tanggal pengiriman SPT.',
  },
  {
    q: 'Perlukah BPE dicetak?',
    a: 'Tidak wajib. Yang penting file PDF-nya tersimpan rapi dan mudah ditemukan saat diminta, misalnya untuk pengajuan kredit, beasiswa, atau administrasi kantor. Cetak hanya kalau pihak yang meminta memang membutuhkan salinan kertas.',
  },
];

export default function BuktiLaporSptCoretaxPage() {
  return (
    <GuideLayout
      eyebrow="Panduan Pajak"
      title="Bukti Lapor SPT Tahunan Coretax (BPE): Cara Mendapatkan & Menyimpan"
      lead="Setelah SPT Tahunan berhasil dikirim lewat Coretax, Anda akan menerima Bukti Penerimaan Elektronik (BPE) — tanda terima resmi bahwa SPT sudah diterima. Tampilan menu Coretax sempat berubah, jadi banyak yang bingung mencarinya. Berikut tempat BPE bisa ditemukan, cara menyimpannya, dan apa yang dilakukan kalau belum muncul."
      updated="23 Oktober 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-pribadi', label: 'Panduan catatan keuangan pribadi' }}
    >
      <h2>Apa itu Bukti Penerimaan Elektronik (BPE)?</h2>
      <p>
        BPE adalah tanda terima elektronik dari Direktorat Jenderal Pajak (DJP) atas SPT yang Anda sampaikan secara
        elektronik. Dokumen ini memuat nomor BPE dan tanggal penerimaan. Pada contoh di panduan resmi DJP, nomornya berformat
        seperti <strong>BPE-00048/KPP.1502/2026</strong>. BPE inilah yang biasanya diminta sebagai bukti bahwa Anda sudah
        melapor SPT Tahunan.
      </p>

      <h2>Di mana BPE bisa ditemukan</h2>
      <p>Ada tiga tempat yang perlu dicek, sesuai jalur pelaporan yang Anda pakai:</p>
      <ol>
        <li>
          <strong>Email terdaftar.</strong> Menurut penjelasan Kring Pajak, BPE atas pelaporan SPT di Coretax kini dikirim ke
          email wajib pajak. Cek kotak masuk email yang terdaftar di Coretax, termasuk folder spam atau junk.
        </li>
        <li>
          <strong>Portal Saya &gt; Dokumen Saya.</strong> Masuk ke Coretax, buka menu <em>Portal Saya</em>, lalu pilih{' '}
          <em>Dokumen Saya</em> dan cari BPE untuk SPT yang dimaksud. Kalau belum tampil, tekan tombol <em>Refresh</em>{' '}
          secara berkala. Selain itu, cek juga menu notifikasi (ikon lonceng) di bagian atas halaman utama.
        </li>
        <li>
          <strong>Coretax Form (formulir SPT PDF).</strong> Kalau melapor lewat aplikasi Coretax Form, panduan resmi DJP
          menyebutkan bahwa di halaman <em>SPT Dilaporkan</em> tersedia pilihan untuk melihat kembali SPT, mengunduh BPE, dan
          mencetak halaman induk SPT.
        </li>
      </ol>
      <p>
        Catatan dari panduan resmi DJP: BPE atas SPT yang disampaikan melalui Coretax Form baru masuk ke portal Coretax
        setelah sekitar <strong>1 hari</strong>. Jadi, kalau baru saja mengirim SPT dan BPE belum ada di Dokumen Saya, tunggu
        dulu sebelum panik.
      </p>

      <h2>Cara menyimpan arsip BPE supaya mudah dicari</h2>
      <ul>
        <li>
          <strong>Satu folder per tahun pajak</strong>, misalnya &ldquo;Pajak 2025&rdquo;, berisi BPE, SPT yang dilaporkan,
          dan bukti potong dari pemberi kerja.
        </li>
        <li>
          <strong>Beri nama file yang jelas</strong>, misalnya <code>BPE-SPT-Tahunan-2025.pdf</code>, bukan nama acak
          bawaan unduhan.
        </li>
        <li>
          <strong>Simpan di dua tempat</strong>: penyimpanan awan dan perangkat lain. BPE sering diminta mendadak, misalnya
          saat mengajukan KPR atau kredit, beasiswa, atau syarat administrasi kantor.
        </li>
      </ul>

      <h2>Kalau BPE belum muncul</h2>
      <ol>
        <li>Pastikan status SPT memang sudah terkirim, bukan masih konsep.</li>
        <li>Tunggu sekitar 1 hari setelah pengiriman.</li>
        <li>Cek email terdaftar, termasuk folder spam.</li>
        <li>Buka Portal Saya &gt; Dokumen Saya dan menu notifikasi, lalu tekan Refresh.</li>
        <li>Kalau tetap tidak ada, hubungi Kring Pajak atau kanal resmi DJP.</li>
      </ol>
      <p>
        Tampilan dan nama menu Coretax bisa berubah sewaktu-waktu. Kalau langkah di atas berbeda dengan yang Anda lihat,
        ikuti panduan terbaru di <a href="https://www.pajak.go.id" rel="noopener noreferrer" target="_blank">pajak.go.id</a>.
      </p>

      <h2>Menyiapkan data SPT tahun depan dengan Leosiqra</h2>
      <p>
        Bagian paling melelahkan dari lapor SPT biasanya justru mengumpulkan datanya: daftar harta, utang, dan penghasilan
        setahun. <strong>Pajak Center</strong> di Leosiqra membantu menyiapkan data SPT tahunan dari catatan keuangan Anda,
        sehingga saat musim lapor tiba, angkanya sudah tersusun. Untuk membangun kebiasaannya, mulai dari{' '}
        <Link href="/catatan-keuangan-pribadi">catatan keuangan pribadi</Link>.
      </p>
      <p>
        <em>
          Sumber: Panduan SPT Tahunan PPh Orang Pribadi Coretax Form (DJP, Februari 2026) dan penjelasan Kring Pajak yang
          dikutip DDTCNews (November–Desember 2025). Panduan ini bersifat edukasi umum, bukan konsultasi pajak.
        </em>
      </p>
    </GuideLayout>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Catatan Keuangan Pribadi: Cara Membuat & Contohnya | Leosiqra',
  description:
    'Panduan membuat catatan keuangan pribadi yang rapi: apa saja yang dicatat, contoh format, langkah memulai, dan aplikasi catatan keuangan pribadi yang menghitung saldo otomatis.',
  keywords: ['catatan keuangan pribadi', 'cara membuat catatan keuangan pribadi', 'contoh catatan keuangan pribadi', 'aplikasi catatan keuangan pribadi'],
  alternates: { canonical: '/catatan-keuangan-pribadi' },
  openGraph: {
    title: 'Catatan Keuangan Pribadi: Cara Membuat & Contohnya',
    description: 'Apa saja yang dicatat, contoh format, dan cara memulai catatan keuangan pribadi yang rapi.',
    url: 'https://www.leosiqra.com/catatan-keuangan-pribadi',
    type: 'article',
    locale: 'id_ID',
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apa itu catatan keuangan pribadi?',
    a: 'Catatan keuangan pribadi adalah rekaman semua uang yang masuk dan keluar milik Anda sendiri — gaji, belanja, tagihan, tabungan, hutang, dan investasi — supaya Anda tahu posisi keuangan yang sebenarnya dan bisa merencanakan ke depan.',
  },
  {
    q: 'Apa bedanya catatan keuangan pribadi dan catatan keuangan harian?',
    a: 'Catatan keuangan harian adalah kebiasaan mencatat setiap transaksi di hari itu juga. Catatan keuangan pribadi lebih luas: kumpulan catatan harian tadi ditambah saldo rekening, tabungan, hutang, investasi, dan rekap bulanan.',
  },
  {
    q: 'Lebih baik pakai buku, Excel, atau aplikasi?',
    a: 'Ketiganya bisa, yang penting konsisten. Buku dan Excel gratis tapi saldo harus dihitung manual dan mudah lupa diisi. Aplikasi catatan keuangan pribadi menghitung saldo, rekap, dan grafik otomatis, serta bisa diisi dari HP dalam hitungan detik.',
  },
  {
    q: 'Berapa lama sampai catatan keuangan terasa manfaatnya?',
    a: 'Biasanya setelah satu bulan penuh mencatat. Di akhir bulan pertama Anda sudah bisa melihat ke mana uang paling banyak pergi dan menentukan budget untuk bulan berikutnya.',
  },
  {
    q: 'Apakah Leosiqra gratis?',
    a: 'Leosiqra bisa dicoba gratis selama 14 hari tanpa kartu kredit. Setelah itu tersedia paket Pro untuk tetap memakai semua fitur.',
  },
];

export default function CatatanKeuanganPribadiPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Catatan Keuangan Pribadi: Cara Membuat yang Rapi & Mudah Dijaga"
      lead="Catatan keuangan pribadi membantu Anda tahu persis dari mana uang datang, ke mana perginya, dan berapa yang benar-benar tersisa. Berikut cara membuatnya — dari apa saja yang perlu dicatat sampai contoh formatnya."
      updated="28 September 2026"
      faq={faq}
      related={{ href: '/catatan-keuangan-harian', label: 'Cara membuat catatan keuangan harian' }}
    >
      <h2>Kenapa perlu catatan keuangan pribadi?</h2>
      <p>
        Tanpa catatan, kita cenderung mengira-ngira: &quot;gaji kok cepat habis ya?&quot; Catatan keuangan pribadi mengganti
        perkiraan itu dengan angka yang jelas. Manfaatnya:
      </p>
      <ul>
        <li><strong>Tahu kebocoran.</strong> Pengeluaran kecil yang rutin — kopi, ongkir, langganan — sering baru terasa besar setelah dijumlahkan.</li>
        <li><strong>Bisa menabung dengan target.</strong> Anda tahu berapa yang realistis disisihkan tiap bulan untuk dana darurat atau tujuan lain.</li>
        <li><strong>Hutang dan cicilan terkendali.</strong> Tagihan kartu kredit dan cicilan tidak lagi terlewat.</li>
        <li><strong>Siap untuk laporan pajak.</strong> Data penghasilan dan harta setahun sudah tercatat saat mengisi SPT tahunan.</li>
      </ul>

      <h2>Apa saja yang dicatat?</h2>
      <p>Catatan keuangan pribadi yang lengkap punya lima bagian:</p>
      <ol>
        <li><strong>Pemasukan</strong> — gaji, bonus, usaha sampingan, hasil investasi.</li>
        <li><strong>Pengeluaran</strong> — dikelompokkan per kategori: makan, transportasi, tagihan, belanja, hiburan, dan seterusnya.</li>
        <li><strong>Saldo setiap rekening</strong> — rekening bank, e-wallet, dan uang tunai, supaya jumlahnya selalu cocok dengan kenyataan.</li>
        <li><strong>Tabungan dan investasi</strong> — dana darurat, deposito, saham, emas, reksa dana.</li>
        <li><strong>Hutang dan piutang</strong> — kartu kredit, cicilan, serta uang yang Anda pinjamkan ke orang lain.</li>
      </ol>

      <h2>Contoh format catatan keuangan pribadi</h2>
      <p>Untuk rekap bulanan, format sederhana seperti ini sudah cukup:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kategori</th><th className="num">Budget</th><th className="num">Realisasi</th><th className="num">Sisa</th></tr>
          </thead>
          <tbody>
            <tr><td>Pemasukan (gaji)</td><td className="num">8.000.000</td><td className="num">8.000.000</td><td className="num">—</td></tr>
            <tr><td>Makan &amp; minum</td><td className="num">2.000.000</td><td className="num">1.850.000</td><td className="num">150.000</td></tr>
            <tr><td>Transportasi</td><td className="num">600.000</td><td className="num">720.000</td><td className="num">-120.000</td></tr>
            <tr><td>Tagihan &amp; langganan</td><td className="num">900.000</td><td className="num">900.000</td><td className="num">0</td></tr>
            <tr><td>Tabungan dana darurat</td><td className="num">1.500.000</td><td className="num">1.500.000</td><td className="num">0</td></tr>
            <tr><td>Hiburan</td><td className="num">500.000</td><td className="num">430.000</td><td className="num">70.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Dari tabel di atas langsung terlihat transportasi melebihi budget — itu yang perlu disesuaikan bulan depan.
        Angka realisasinya berasal dari <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link>.
      </p>

      <h2>Langkah memulai catatan keuangan pribadi</h2>
      <ol>
        <li><strong>Catat saldo awal</strong> setiap rekening, e-wallet, dan uang tunai hari ini.</li>
        <li><strong>Tentukan kategori</strong> pengeluaran — cukup 8–12 kategori supaya tidak membingungkan.</li>
        <li><strong>Catat setiap transaksi</strong> di hari yang sama, sekecil apa pun.</li>
        <li><strong>Buat budget</strong> per kategori setelah satu bulan mencatat, berdasarkan angka nyata.</li>
        <li><strong>Evaluasi di akhir bulan</strong>: bandingkan budget dengan realisasi, lalu sesuaikan.</li>
      </ol>

      <h2>Mencatat keuangan pribadi dengan aplikasi</h2>
      <p>
        Mencatat di buku atau Excel bisa, tapi menghitung saldo dan rekap secara manual melelahkan — ini alasan terbesar
        orang berhenti mencatat. <strong>Leosiqra</strong> adalah aplikasi catatan keuangan pribadi yang mengerjakan bagian
        itu untuk Anda:
      </p>
      <ul>
        <li>Saldo semua rekening, e-wallet, dan uang tunai ter-update otomatis setiap mencatat transaksi — termasuk mata uang asing.</li>
        <li>Transaksi bisa dicatat dengan mengetik singkat, suara, atau foto struk.</li>
        <li>Budget per kategori, tabungan per tujuan, hutang &amp; piutang, kartu kredit, dan investasi dalam satu tempat.</li>
        <li>Rekap bulanan dan tahunan, plus ringkasan untuk SPT tahunan.</li>
        <li>Bisa dipakai di Android, iPhone, dan web dengan data yang selalu sinkron.</li>
      </ul>
      <p>
        <Link href="/auth/register">Coba gratis 14 hari</Link> — tanpa kartu kredit.
      </p>
    </GuideLayout>
  );
}

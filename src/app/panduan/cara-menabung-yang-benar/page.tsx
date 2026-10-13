import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Menabung yang Benar dari Gaji | Leosiqra',
  description:
    'Cara menabung yang benar: sisihkan di awal saat gajian, urutan dana darurat, utang, lalu tabungan tujuan, plus contoh pembagian gaji 5 juta.',
  keywords: [
    'cara menabung yang benar',
    'cara menabung dari gaji',
    'urutan prioritas menabung',
    'cara menabung gaji 5 juta',
    'tips menabung rutin',
  ],
  alternates: { canonical: '/panduan/cara-menabung-yang-benar' },
  openGraph: {
    title: 'Cara Menabung yang Benar: Urutan Prioritas dari Gaji',
    description: 'Sisihkan di awal, isi dana darurat, lunasi utang berbunga tinggi, lalu tabung untuk tujuan — dengan contoh gaji 5 juta.',
    url: 'https://www.leosiqra.com/panduan/cara-menabung-yang-benar',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cara Menabung yang Benar: Urutan Prioritas dari Gaji',
    description: 'Sisihkan di awal, isi dana darurat, lunasi utang berbunga tinggi, lalu tabung untuk tujuan — dengan contoh gaji 5 juta.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Berapa persen gaji yang sebaiknya ditabung?',
    a: 'Patokan yang sering dipakai adalah 20% dari gaji (metode 50/30/20). Kalau belum sanggup, mulai dari 5–10% dan naikkan perlahan setiap kali penghasilan naik atau satu cicilan lunas. Yang paling penting adalah rutin, bukan besarnya di awal.',
  },
  {
    q: 'Lebih dulu menabung atau melunasi utang?',
    a: 'Umumnya kumpulkan dana darurat kecil dulu (sekitar satu bulan pengeluaran), lalu prioritaskan utang berbunga tinggi seperti kartu kredit atau pinjaman online, baru setelah itu lanjutkan tabungan untuk tujuan lain.',
  },
  {
    q: 'Apakah menabung harus di rekening terpisah?',
    a: 'Sangat disarankan. Tabungan yang berada di rekening yang sama dengan uang belanja mudah terpakai tanpa sadar. Rekening atau kantong terpisah, idealnya tanpa kartu debit, membuat uang tabungan lebih sulit diambil untuk hal yang tidak direncanakan.',
  },
  {
    q: 'Gaji pas-pasan, apakah tetap bisa menabung?',
    a: 'Bisa, dimulai dari nominal kecil yang disisihkan di hari gajian. Langkah pertama adalah mencatat pengeluaran selama sebulan untuk menemukan pos yang bisa dikurangi — sering kali pengeluaran kecil yang berulang.',
  },
];

export default function CaraMenabungYangBenarPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Menabung yang Benar: Urutan Prioritas dari Gaji"
      lead="Banyak orang berniat menabung dari sisa gaji, tapi di akhir bulan sisanya hampir selalu nol. Masalahnya biasanya bukan kurang disiplin, melainkan urutannya terbalik. Berikut cara menabung yang benar: kapan menyisihkan, untuk apa dulu, dan cara menjaganya tetap jalan."
      updated="13 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/dana-darurat', label: 'Berapa dana darurat yang ideal?' }}
    >
      <h2>1. Bayar diri sendiri dulu</h2>
      <p>
        Prinsip paling dasar: <strong>tabungan disisihkan di awal, bukan dari sisa</strong>. Begitu gaji masuk, langsung
        pindahkan porsi tabungan ke rekening atau kantong terpisah, baru sisanya dipakai untuk kebutuhan dan keinginan.
        Rumusnya bergeser dari <em>pemasukan − pengeluaran = tabungan</em> menjadi{' '}
        <em>pemasukan − tabungan = pengeluaran</em>.
      </p>
      <p>
        Berapa porsinya? Metode 50/30/20 memberi patokan 20% untuk masa depan. Pembahasan lengkapnya ada di panduan{' '}
        <Link href="/panduan/cara-mengatur-gaji">cara mengatur gaji bulanan</Link>.
      </p>

      <h2>2. Urutan prioritas: dana darurat, utang, lalu tabungan tujuan</h2>
      <p>Menabung tanpa urutan sering berakhir dengan tabungan liburan terpakai untuk biaya mendadak. Urutan yang umum dipakai:</p>
      <ol>
        <li>
          <strong>Dana darurat awal</strong> — kumpulkan sekitar satu bulan pengeluaran dulu sebagai bantalan.
        </li>
        <li>
          <strong>Utang berbunga tinggi</strong> — kartu kredit, paylater, atau pinjaman online. Bunga utang ini biasanya jauh
          lebih besar daripada imbal hasil tabungan, jadi melunasinya adalah &ldquo;tabungan&rdquo; yang paling menguntungkan.
          Lihat <Link href="/panduan/cara-melunasi-utang">metode snowball vs avalanche</Link>.
        </li>
        <li>
          <strong>Dana darurat penuh</strong> — lanjutkan sampai target, misalnya 3–6 kali pengeluaran bulanan untuk lajang.
          Patokan lengkapnya ada di panduan <Link href="/panduan/dana-darurat">dana darurat</Link>.
        </li>
        <li>
          <strong>Tabungan tujuan</strong> — DP rumah, pendidikan, liburan, kendaraan. Beri setiap tujuan nama, target
          nominal, dan tenggat waktu.
        </li>
      </ol>

      <h2>3. Contoh gaji 5 juta</h2>
      <p>
        Contoh pembagian porsi 20% (Rp1.000.000) dari gaji Rp5.000.000 untuk orang yang belum punya dana darurat dan masih
        punya cicilan paylater (angka ilustrasi):
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tahap</th><th>Pos</th><th className="num">Per bulan (Rp)</th></tr>
          </thead>
          <tbody>
            <tr><td>Bulan 1–4</td><td>Dana darurat awal (target 4 jt)</td><td className="num">1.000.000</td></tr>
            <tr><td>Setelah itu</td><td>Pelunasan ekstra utang paylater</td><td className="num">700.000</td></tr>
            <tr><td></td><td>Dana darurat (lanjut ke target penuh)</td><td className="num">300.000</td></tr>
            <tr><td>Setelah utang lunas</td><td>Dana darurat</td><td className="num">600.000</td></tr>
            <tr><td></td><td>Tabungan tujuan (misal liburan)</td><td className="num">400.000</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Pembagiannya boleh berbeda; yang penting setiap rupiah tabungan punya tugas yang jelas. Saat satu tahap selesai,
        porsinya dialihkan ke tahap berikutnya — bukan dialihkan ke belanja.
      </p>

      <h2>4. Otomatiskan supaya tidak bergantung niat</h2>
      <ul>
        <li><strong>Jadwalkan transfer di hari gajian</strong> ke rekening tabungan, supaya terjadi sebelum uangnya terpakai.</li>
        <li><strong>Pisahkan rekening</strong>: satu untuk belanja harian, satu untuk tabungan, idealnya tanpa kartu debit.</li>
        <li><strong>Naikkan porsi saat ada kesempatan</strong> — kenaikan gaji, bonus, THR, atau satu cicilan yang lunas.</li>
      </ul>

      <h2>5. Pantau, jangan hanya disimpan</h2>
      <p>
        Tabungan yang tidak dipantau mudah &ldquo;dipinjam&rdquo; sendiri. Cek progres setiap bulan: sudah berapa persen dari
        target, dan apakah pengeluaran bulan ini membuat setoran berikutnya terancam. Untuk itu Anda perlu tahu pengeluaran
        yang sebenarnya — mulai dari{' '}
        <Link href="/catatan-keuangan-harian">catatan keuangan harian</Link> yang sederhana.
      </p>

      <h2>Menabung dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, setiap tujuan — dana darurat, DP rumah, liburan — bisa dibuat sebagai tujuan tabungan
        tersendiri dengan target nominal. Setoran tercatat dan saldo rekening sumbernya ikut berkurang, setoran bulanan bisa
        dijadwalkan sebagai transaksi rutin, dan progres menuju target terlihat dalam persen. Pengeluaran harian bisa dicatat
        dengan mengetik singkat, suara, atau foto struk, supaya Anda tahu ruang untuk menabung yang sebenarnya.
      </p>
      <p>
        <em>Panduan ini bersifat edukasi umum, bukan nasihat keuangan. Sesuaikan dengan kondisi dan tujuan Anda.</em>
      </p>
    </GuideLayout>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

export const metadata: Metadata = {
  title: 'Cara Melunasi Utang: Metode Snowball vs Avalanche | Leosiqra',
  description:
    'Cara melunasi utang lebih cepat dengan metode snowball dan avalanche — contoh perhitungan, kapan memakai masing-masing, dan cara agar tidak menambah utang baru.',
  keywords: ['cara melunasi utang', 'metode snowball', 'metode avalanche', 'cara cepat lunas utang', 'melunasi paylater'],
  alternates: { canonical: '/panduan/cara-melunasi-utang' },
  openGraph: {
    title: 'Cara Melunasi Utang: Metode Snowball vs Avalanche',
    description: 'Dua strategi melunasi utang, contoh urutannya, dan kapan memakai masing-masing.',
    url: 'https://www.leosiqra.com/panduan/cara-melunasi-utang',
    type: 'article',
    locale: 'id_ID',
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Mana yang lebih baik, snowball atau avalanche?',
    a: 'Secara hitungan, avalanche lebih hemat bunga. Tapi snowball memberi rasa menang lebih cepat karena utang kecil cepat lunas, sehingga banyak orang lebih konsisten. Metode terbaik adalah yang benar-benar Anda jalankan sampai selesai.',
  },
  {
    q: 'Apakah boleh berutang baru untuk menutup utang lama?',
    a: 'Hanya jika bunganya jelas lebih rendah dan Anda berhenti menambah utang di tempat lama. Kalau tidak, cara ini hanya memindahkan masalah.',
  },
  {
    q: 'Bagaimana kalau tidak ada sisa uang untuk bayar lebih?',
    a: 'Mulai dari mencatat pengeluaran selama sebulan untuk menemukan pos yang bisa dipangkas. Bahkan tambahan kecil di atas pembayaran minimum mempercepat pelunasan.',
  },
];

export default function CaraMelunasiUtangPage() {
  return (
    <GuideLayout
      eyebrow="Panduan"
      title="Cara Melunasi Utang Lebih Cepat: Metode Snowball vs Avalanche"
      lead="Punya beberapa utang sekaligus — kartu kredit, paylater, cicilan — sering bikin bingung harus mulai dari mana. Dua metode ini memberi urutan yang jelas."
      updated="29 September 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mengatur-gaji', label: 'Cara mengatur gaji bulanan' }}
    >
      <h2>Langkah awal: daftar semua utang</h2>
      <p>Sebelum memilih metode, tuliskan setiap utang dengan empat informasi:</p>
      <ul>
        <li><strong>Pemberi utang</strong> — bank, kartu kredit, paylater, teman atau keluarga.</li>
        <li><strong>Sisa pokok</strong> yang belum dibayar.</li>
        <li><strong>Bunga</strong> per bulan atau per tahun.</li>
        <li><strong>Pembayaran minimum</strong> setiap bulan.</li>
      </ul>

      <h2>Contoh daftar utang</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Utang</th><th className="num">Sisa</th><th className="num">Bunga / bulan</th><th className="num">Minimum</th></tr>
          </thead>
          <tbody>
            <tr><td>Paylater</td><td className="num">1.200.000</td><td className="num">2,5%</td><td className="num">300.000</td></tr>
            <tr><td>Kartu kredit</td><td className="num">6.000.000</td><td className="num">1,75%</td><td className="num">600.000</td></tr>
            <tr><td>Pinjaman ke kakak</td><td className="num">3.000.000</td><td className="num">0%</td><td className="num">250.000</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Metode snowball: dari yang terkecil</h2>
      <p>
        Bayar minimum di semua utang, lalu arahkan <strong>seluruh uang lebih</strong> ke utang dengan{' '}
        <strong>sisa paling kecil</strong>. Setelah lunas, cicilannya dialihkan ke utang terkecil berikutnya — seperti bola
        salju yang makin besar.
      </p>
      <p>Urutan pada contoh: <strong>Paylater → Pinjaman ke kakak → Kartu kredit</strong>.</p>

      <h2>Metode avalanche: dari bunga tertinggi</h2>
      <p>
        Sama-sama bayar minimum di semua utang, tapi uang lebih diarahkan ke utang dengan <strong>bunga paling tinggi</strong>.
        Total bunga yang dibayar jadi paling kecil.
      </p>
      <p>Urutan pada contoh: <strong>Paylater → Kartu kredit → Pinjaman ke kakak</strong>.</p>

      <h2>Supaya utang tidak bertambah lagi</h2>
      <ol>
        <li><strong>Berhenti memakai</strong> kartu kredit dan paylater sampai utangnya lunas.</li>
        <li><strong>Siapkan dana darurat kecil</strong> — satu bulan pengeluaran — agar kejadian tak terduga tidak memaksa berutang lagi. Lihat panduan <Link href="/panduan/dana-darurat">dana darurat</Link>.</li>
        <li><strong>Catat pengeluaran setiap hari</strong> agar tahu dari mana uang lebih untuk mencicil bisa didapat.</li>
      </ol>

      <h2>Memantau utang dengan Leosiqra</h2>
      <p>
        Di <strong>Leosiqra</strong>, setiap utang dan piutang tercatat lengkap dengan sisa yang belum dibayar. Setiap kali
        mencicil, saldo rekening dan sisa utangnya diperbarui otomatis, dan tagihan kartu kredit punya pengingat jatuh
        tempo — jadi Anda bisa melihat progres pelunasan tanpa menghitung manual.
      </p>
    </GuideLayout>
  );
}

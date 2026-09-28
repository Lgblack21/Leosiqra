import Link from 'next/link';
import { LegalLayout, type LegalSection } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Kebijakan Privasi | Leosiqra',
  description: 'Kebijakan privasi Leosiqra — data apa saja yang kami kumpulkan, bagaimana digunakan, dan hak Anda atas data tersebut.',
};

const sections: LegalSection[] = [
  {
    id: 'data',
    title: 'Data yang kami kumpulkan',
    content: (
      <ul>
        <li><strong>Data akun:</strong> nama, alamat email, nomor WhatsApp, dan foto profil — yang Anda isi sendiri atau yang diberikan Google saat Anda masuk dengan Google.</li>
        <li><strong>Data keuangan yang Anda catat:</strong> transaksi, saldo rekening, kartu kredit, investasi, tabungan, hutang/piutang, budget, transaksi rutin, kategori, dan catatan lain yang Anda masukkan.</li>
        <li><strong>Bukti pembayaran:</strong> gambar bukti transfer saat Anda mengonfirmasi pembayaran paket Pro.</li>
        <li><strong>Riwayat percakapan AI:</strong> kalau Anda memakai asisten AI, riwayat chat disimpan (hingga 200 pesan terakhir) supaya percakapan bisa dilanjutkan.</li>
        <li><strong>Data teknis dasar:</strong> log login, perangkat/browser yang dipakai, dan langganan notifikasi untuk keamanan akun dan pengiriman pengingat.</li>
      </ul>
    ),
  },
  {
    id: 'penggunaan',
    title: 'Bagaimana data digunakan',
    content: (
      <>
        <p>Data di atas kami gunakan semata-mata untuk:</p>
        <ul>
          <li>Menjalankan fitur aplikasi — pencatatan, rekap, pengingat tagihan, kalkulasi pajak (PPh/SPT), dan portofolio investasi Anda.</li>
          <li>Memverifikasi pembayaran dan mengaktifkan langganan Pro.</li>
          <li>Menjawab pertanyaan atau kendala yang Anda sampaikan kepada kami.</li>
          <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
        </ul>
        <p>Kami <strong>tidak menjual</strong> data pribadi maupun data keuangan Anda kepada pihak mana pun.</p>
      </>
    ),
  },
  {
    id: 'pihak-ketiga',
    title: 'Pihak ketiga yang terlibat',
    content: (
      <>
        <p>Untuk menjalankan layanan, kami memakai beberapa penyedia berikut. Masing-masing hanya menerima data sejauh diperlukan untuk fungsinya:</p>
        <ul>
          <li><strong>Cloudflare</strong> — hosting aplikasi, database, dan server.</li>
          <li><strong>Google</strong> — login dengan Google (hanya nama, email, dan foto profil dasar).</li>
          <li><strong>Penyedia model AI melalui OpenRouter</strong> — saat Anda memakai asisten AI, ketik pintar dengan suara, atau foto struk, isi pertanyaan/foto Anda beserta ringkasan data keuangan yang relevan (mis. saldo, transaksi terbaru, kategori) dikirim untuk menghasilkan jawaban. Tanpa memakai fitur AI, tidak ada data yang dikirim ke sana.</li>
          <li><strong>Layanan pengenalan suara perangkat/browser</strong> — input suara diubah menjadi teks oleh layanan bawaan perangkat Anda (mis. Google atau Apple).</li>
          <li><strong>Cloudinary</strong> — penyimpanan gambar yang Anda unggah (bukti pembayaran, foto profil, logo).</li>
          <li><strong>Resend</strong> — pengiriman email, mis. link reset password.</li>
          <li><strong>Telegram</strong> — notifikasi internal ke admin saat ada konfirmasi pembayaran (nama, email, paket, dan nominal).</li>
          <li><strong>Layanan notifikasi browser</strong> — pengiriman notifikasi push ke perangkat yang Anda izinkan.</li>
        </ul>
        <p>Masing-masing penyedia terikat kebijakan privasinya sendiri.</p>
      </>
    ),
  },
  {
    id: 'keamanan',
    title: 'Keamanan data',
    content: (
      <p>
        Data disimpan di infrastruktur Cloudflare yang terenkripsi saat disimpan, dan seluruh komunikasi antara perangkat Anda dan
        server kami dienkripsi lewat HTTPS. Password disimpan dalam bentuk hash, sesi login memakai cookie aman, dan Anda dapat
        mengaktifkan verifikasi 2 langkah (Authenticator) — termasuk saat masuk dengan Google. Setiap data terikat ke akun Anda
        dan hanya bisa dibuka lewat sesi login Anda; akses database dibatasi untuk administrator yang berwenang.
      </p>
    ),
  },
  {
    id: 'hak',
    title: 'Hak Anda',
    content: (
      <p>
        Anda berhak mengakses, memperbaiki, atau meminta penghapusan data pribadi Anda kapan saja. Seluruh data keuangan dapat Anda
        hapus sendiri lewat <strong>Profil → Danger Zone</strong>. Untuk menghapus akun sepenuhnya atau permintaan lain, hubungi kami
        lewat halaman <Link href="/hubungi-kami">Hubungi Kami</Link>.
      </p>
    ),
  },
  {
    id: 'anak',
    title: 'Anak di bawah umur',
    content: <p>Layanan ini tidak ditujukan untuk anak di bawah 17 tahun. Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.</p>,
  },
  {
    id: 'perubahan',
    title: 'Perubahan kebijakan',
    content: <p>Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan penting akan tercermin lewat tanggal &quot;Terakhir diperbarui&quot; di atas.</p>,
  },
  {
    id: 'hukum',
    title: 'Hukum yang berlaku',
    content: <p>Kebijakan ini tunduk pada hukum Republik Indonesia, termasuk Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022).</p>,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Privasi"
      title="Kebijakan Privasi"
      updated="28 September 2026"
      intro={
        <p>
          Leosiqra (&quot;kami&quot;) menghargai privasi Anda. Halaman ini menjelaskan data apa yang kami kumpulkan saat Anda memakai
          Leosiqra di leosiqra.com dan aplikasinya, bagaimana data itu digunakan, siapa saja yang terlibat, dan hak Anda atasnya.
        </p>
      }
      sections={sections}
      footnote="Dokumen ini adalah kebijakan privasi umum untuk layanan Leosiqra dan bukan pengganti konsultasi hukum profesional untuk kebutuhan kepatuhan spesifik."
    />
  );
}

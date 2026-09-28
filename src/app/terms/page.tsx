import { LegalLayout, type LegalSection } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Syarat Layanan | Leosiqra',
  description: 'Syarat dan ketentuan penggunaan Leosiqra — aplikasi pencatat keuangan pribadi.',
};

const sections: LegalSection[] = [
  {
    id: 'layanan',
    title: 'Deskripsi layanan',
    content: (
      <p>
        Leosiqra adalah aplikasi pencatat keuangan pribadi yang membantu Anda mencatat transaksi, mengelola rekening dan investasi,
        serta menghitung estimasi Pajak Penghasilan (PPh) Orang Pribadi. Leosiqra <strong>bukan aplikasi resmi Direktorat Jenderal
        Pajak (DJP)</strong> dan hasil kalkulasi pajak di dalamnya adalah estimasi pribadi — bukan pengganti pelaporan SPT resmi melalui{' '}
        <a href="https://coretaxdjp.pajak.go.id/" target="_blank" rel="noopener noreferrer">coretaxdjp.pajak.go.id</a>.
      </p>
    ),
  },
  {
    id: 'akun',
    title: 'Akun pengguna',
    content: (
      <ul>
        <li>Anda bertanggung jawab menjaga kerahasiaan kredensial akun Anda.</li>
        <li>Anda bertanggung jawab atas keakuratan data keuangan yang Anda input sendiri.</li>
        <li>Kami berhak menangguhkan akun yang terindikasi disalahgunakan atau melanggar syarat ini.</li>
      </ul>
    ),
  },
  {
    id: 'pembayaran',
    title: 'Paket berlangganan & pembayaran',
    content: (
      <p>
        Leosiqra menyediakan paket gratis dengan masa uji coba dan paket Pro berbayar. Aktivasi paket Pro dilakukan setelah konfirmasi
        pembayaran diverifikasi oleh tim kami secara manual (maksimal 1×24 jam). Pembayaran yang sudah dikonfirmasi tidak dapat
        dikembalikan (non-refundable), kecuali ditentukan lain oleh kami secara tertulis.
      </p>
    ),
  },
  {
    id: 'penggunaan',
    title: 'Penggunaan yang wajar',
    content: (
      <>
        <p>Anda setuju untuk tidak:</p>
        <ul>
          <li>Menyalahgunakan Layanan untuk aktivitas ilegal.</li>
          <li>Mencoba mengakses data pengguna lain tanpa izin.</li>
          <li>Mengganggu atau membebani infrastruktur Layanan secara berlebihan (mis. scraping otomatis).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'hki',
    title: 'Kekayaan intelektual',
    content: <p>Seluruh desain, kode, logo, dan merek Leosiqra adalah milik pengembang Leosiqra. Data keuangan yang Anda input tetap menjadi milik Anda sepenuhnya.</p>,
  },
  {
    id: 'tanggung-jawab',
    title: 'Batasan tanggung jawab',
    content: (
      <p>
        Leosiqra disediakan &quot;sebagaimana adanya&quot; (as-is) sebagai alat bantu pencatatan dan estimasi. Kami tidak menjamin
        keakuratan mutlak dari kalkulasi pajak, nilai investasi real-time, atau kurs mata uang yang ditampilkan, dan tidak bertanggung
        jawab atas keputusan finansial atau pelaporan pajak yang Anda ambil berdasarkan informasi di aplikasi ini tanpa verifikasi mandiri.
      </p>
    ),
  },
  {
    id: 'penghentian',
    title: 'Penghentian layanan',
    content: <p>Anda dapat berhenti menggunakan Layanan kapan saja. Kami berhak menghentikan atau membatasi akses akun yang melanggar syarat ini.</p>,
  },
  {
    id: 'perubahan',
    title: 'Perubahan syarat',
    content: <p>Kami dapat memperbarui syarat ini dari waktu ke waktu. Penggunaan Layanan setelah perubahan berarti Anda menyetujui syarat yang diperbarui.</p>,
  },
  {
    id: 'hukum',
    title: 'Hukum yang berlaku',
    content: <p>Syarat ini tunduk pada hukum Republik Indonesia.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Ketentuan"
      title="Syarat Layanan"
      updated="18 Juli 2026"
      intro={
        <p>
          Dengan mengakses atau menggunakan Leosiqra (&quot;Layanan&quot;) di leosiqra.com dan aplikasinya, Anda setuju untuk terikat
          pada syarat dan ketentuan berikut. Jika Anda tidak setuju, mohon untuk tidak menggunakan Layanan ini.
        </p>
      }
      sections={sections}
    />
  );
}

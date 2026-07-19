import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';

export const metadata = {
  title: 'Kebijakan Privasi | Leosiqra',
  description: 'Kebijakan privasi Leosiqra — data apa saja yang kami kumpulkan, bagaimana digunakan, dan hak Anda atas data tersebut.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <section className="flex-1 px-6 pt-40 pb-24">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-black text-slate-900 tracking-tight">Kebijakan Privasi</h1>
            <p className="text-sm font-medium text-slate-400 mt-2">Terakhir diperbarui: 18 Juli 2026</p>
          </div>

          <div className="prose-custom space-y-8 text-sm text-slate-600 leading-relaxed">
            <p>
              Leosiqra ("kami") menghargai privasi Anda. Kebijakan ini menjelaskan data apa yang kami kumpulkan saat Anda
              menggunakan aplikasi pencatat keuangan pribadi Leosiqra di leosiqra.com, bagaimana data itu digunakan, dan
              hak Anda atasnya.
            </p>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">1. Data yang Kami Kumpulkan</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Data akun:</strong> nama, alamat email, dan foto profil — baik yang Anda isi manual maupun yang diberikan Google saat Anda masuk lewat "Login dengan Google".</li>
                <li><strong>Data keuangan yang Anda catat sendiri:</strong> transaksi, saldo rekening, investasi, tabungan, utang/piutang, kategori, dan catatan lain yang Anda input ke dalam aplikasi.</li>
                <li><strong>Bukti pembayaran:</strong> gambar bukti transfer yang Anda unggah saat konfirmasi pembayaran paket Pro.</li>
                <li><strong>Riwayat percakapan AI:</strong> jika Anda menggunakan fitur asisten AI, riwayat chat disimpan agar percakapan bisa dilanjutkan.</li>
                <li><strong>Data teknis dasar:</strong> log aktivitas login dan informasi perangkat/browser untuk keamanan akun.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">2. Bagaimana Data Digunakan</h2>
              <p>Data di atas kami gunakan semata-mata untuk:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Menjalankan fitur inti aplikasi — pencatatan transaksi, rekap keuangan, kalkulasi pajak (PPh/SPT), dan portofolio investasi Anda.</li>
                <li>Memverifikasi pembayaran dan mengaktifkan langganan Pro.</li>
                <li>Menjawab pertanyaan atau kendala yang Anda ajukan lewat halaman Hubungi Kami.</li>
                <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
              </ul>
              <p>Kami <strong>tidak menjual</strong> data pribadi atau data keuangan Anda kepada pihak ketiga mana pun.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">3. Pihak Ketiga yang Terlibat</h2>
              <p>Untuk menjalankan layanan, kami menggunakan beberapa penyedia infrastruktur tepercaya:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Google</strong> — untuk fitur login (OAuth), hanya menerima nama, email, dan foto profil dasar.</li>
                <li><strong>Cloudflare</strong> — hosting aplikasi, database, dan penyimpanan file (server berada di infrastruktur Cloudflare).</li>
                <li><strong>Cloudinary</strong> — penyimpanan gambar yang Anda unggah (bukti pembayaran, foto profil).</li>
              </ul>
              <p>Masing-masing penyedia ini terikat kebijakan privasi mereka sendiri dan hanya memproses data sejauh diperlukan untuk menjalankan fungsi teknis di atas.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">4. Keamanan Data</h2>
              <p>
                Data disimpan di infrastruktur Cloudflare yang terenkripsi saat disimpan (encryption at rest), dan seluruh
                komunikasi antara perangkat Anda dan server kami dienkripsi lewat HTTPS. Akses ke database dibatasi hanya
                untuk administrator yang berwenang, dan kami tidak membagikan data akun Anda kepada pengguna lain.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">5. Hak Anda</h2>
              <p>
                Anda berhak mengakses, memperbaiki, atau meminta penghapusan data pribadi Anda kapan saja. Untuk permintaan
                ini, silakan hubungi kami lewat halaman <a href="/hubungi-kami" className="text-indigo-600 font-bold hover:underline">Hubungi Kami</a>.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">6. Anak di Bawah Umur</h2>
              <p>Layanan ini tidak ditujukan untuk anak di bawah 17 tahun. Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">7. Perubahan Kebijakan</h2>
              <p>Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan signifikan akan tercermin lewat tanggal "Terakhir diperbarui" di atas.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">8. Hukum yang Berlaku</h2>
              <p>Kebijakan ini tunduk pada hukum Republik Indonesia, termasuk Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022).</p>
            </div>

            <p className="text-xs text-slate-400 italic pt-4 border-t border-slate-100">
              Dokumen ini adalah kebijakan privasi umum untuk layanan Leosiqra dan bukan pengganti konsultasi hukum profesional
              untuk kebutuhan kepatuhan spesifik.
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

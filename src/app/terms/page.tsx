import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';

export const metadata = {
  title: 'Syarat Layanan | Leosiqra',
  description: 'Syarat dan ketentuan penggunaan aplikasi pencatat keuangan pribadi Leosiqra.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <section className="flex-1 px-6 pt-40 pb-24">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-black text-slate-900 tracking-tight">Syarat Layanan</h1>
            <p className="text-sm font-medium text-slate-400 mt-2">Terakhir diperbarui: 18 Juli 2026</p>
          </div>

          <div className="prose-custom space-y-8 text-sm text-slate-600 leading-relaxed">
            <p>
              Dengan mengakses atau menggunakan Leosiqra ("Layanan") di leosiqra.com, Anda setuju untuk terikat pada
              syarat dan ketentuan berikut. Jika Anda tidak setuju, mohon untuk tidak menggunakan Layanan ini.
            </p>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">1. Deskripsi Layanan</h2>
              <p>
                Leosiqra adalah aplikasi pencatat keuangan pribadi yang membantu Anda mencatat transaksi, mengelola
                rekening dan investasi, serta menghitung estimasi Pajak Penghasilan (PPh) Orang Pribadi. Leosiqra
                <strong> bukan aplikasi resmi Direktorat Jenderal Pajak (DJP)</strong> dan hasil kalkulasi pajak di
                dalamnya adalah estimasi pribadi — bukan pengganti pelaporan SPT resmi melalui coretaxdjp.pajak.go.id.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">2. Akun Pengguna</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Anda bertanggung jawab menjaga kerahasiaan kredensial akun Anda.</li>
                <li>Anda bertanggung jawab atas keakuratan data keuangan yang Anda input sendiri.</li>
                <li>Kami berhak menangguhkan akun yang terindikasi disalahgunakan atau melanggar syarat ini.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">3. Paket Berlangganan &amp; Pembayaran</h2>
              <p>
                Leosiqra menyediakan paket gratis dengan masa uji coba dan paket Pro berbayar. Aktivasi paket Pro
                dilakukan setelah konfirmasi pembayaran diverifikasi oleh tim kami secara manual (maksimal 1x24 jam).
                Pembayaran yang sudah dikonfirmasi tidak dapat dikembalikan (non-refundable), kecuali ditentukan lain
                oleh kami secara tertulis.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">4. Penggunaan yang Wajar</h2>
              <p>Anda setuju untuk tidak:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Menyalahgunakan Layanan untuk aktivitas ilegal.</li>
                <li>Mencoba mengakses data pengguna lain tanpa izin.</li>
                <li>Mengganggu atau membebani infrastruktur Layanan secara berlebihan (mis. scraping otomatis).</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">5. Kekayaan Intelektual</h2>
              <p>Seluruh desain, kode, logo, dan merek Leosiqra adalah milik pengembang Leosiqra. Data keuangan yang Anda input tetap menjadi milik Anda sepenuhnya.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">6. Batasan Tanggung Jawab</h2>
              <p>
                Leosiqra disediakan "sebagaimana adanya" (as-is) sebagai alat bantu pencatatan dan estimasi. Kami tidak
                menjamin keakuratan mutlak dari kalkulasi pajak, nilai investasi real-time, atau kurs mata uang yang
                ditampilkan, dan tidak bertanggung jawab atas keputusan finansial atau pelaporan pajak yang Anda ambil
                berdasarkan informasi di aplikasi ini tanpa verifikasi mandiri.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">7. Penghentian Layanan</h2>
              <p>Anda dapat berhenti menggunakan Layanan kapan saja. Kami berhak menghentikan atau membatasi akses akun yang melanggar syarat ini.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">8. Perubahan Syarat</h2>
              <p>Kami dapat memperbarui syarat ini dari waktu ke waktu. Penggunaan Layanan setelah perubahan berarti Anda menyetujui syarat yang diperbarui.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">9. Hukum yang Berlaku</h2>
              <p>Syarat ini tunduk pada hukum Republik Indonesia.</p>
            </div>

            <p className="text-xs text-slate-400 italic pt-4 border-t border-slate-100">
              Ada pertanyaan soal syarat layanan ini? Hubungi kami lewat halaman{' '}
              <a href="/hubungi-kami" className="text-indigo-600 font-bold hover:underline not-italic">Hubungi Kami</a>.
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

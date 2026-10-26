import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideLayout, type GuideFaq } from '@/components/guide/GuideLayout';

// Tahap 4 Leosiqra MCP (docs/rancangan/mcp.md). Menu Claude & ChatGPT diambil dari
// dokumentasi resmi per 26 Oktober 2026: claude.com/docs/connectors/custom/add-unlisted
// dan developers.openai.com/apps-sdk/deploy/connect-chatgpt — cek ulang kalau menunya berubah.

const MCP_URL = 'https://www.leosiqra.com/mcp';

export const metadata: Metadata = {
  title: 'Hubungkan Leosiqra ke Claude & ChatGPT (MCP) | Leosiqra',
  description:
    'Cara menyambungkan akun Leosiqra ke Claude, ChatGPT, dan klien MCP lain: tanya saldo & laporan, catat transaksi lewat chat, plus cara memutus akses.',
  keywords: [
    'leosiqra mcp',
    'hubungkan aplikasi keuangan ke claude',
    'mcp keuangan pribadi',
    'catat keuangan lewat chatgpt',
    'custom connector claude',
  ],
  alternates: { canonical: '/panduan/mcp' },
  openGraph: {
    title: 'Hubungkan Leosiqra ke Claude & ChatGPT (MCP)',
    description: 'Tanya keuangan dan catat transaksi langsung dari Claude atau ChatGPT, dengan izin yang bisa dicabut kapan saja.',
    url: 'https://www.leosiqra.com/panduan/mcp',
    type: 'article',
    locale: 'id_ID',
    images: ['/images/Logo-new.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Hubungkan Leosiqra ke Claude & ChatGPT (MCP)',
    description: 'Tanya keuangan dan catat transaksi langsung dari Claude atau ChatGPT, dengan izin yang bisa dicabut kapan saja.',
    images: ['/images/Logo-new.png'],
  },
};

const faq: GuideFaq[] = [
  {
    q: 'Apakah AI bisa menghapus atau mentransfer uang saya?',
    a: 'Tidak. Leosiqra MCP hanya menyediakan alat untuk membaca data dan, kalau Anda izinkan, mencatat transaksi serta mengatur budget bulanan. Tidak ada alat untuk menghapus data, transfer antar rekening, atau mengubah password. Leosiqra juga tidak terhubung ke rekening bank Anda, jadi mencatat transaksi tidak memindahkan uang sungguhan.',
  },
  {
    q: 'Apakah fitur ini gratis?',
    a: 'Menghubungkan AI dan membaca data (saldo, transaksi, laporan, budget, kategori) bisa dipakai semua member. Izin mencatat transaksi dan mengatur budget lewat AI khusus member PRO. Biaya langganan Claude atau ChatGPT mengikuti aturan masing-masing penyedia.',
  },
  {
    q: 'Bagaimana cara memutus akses AI?',
    a: 'Buka Profil → Hubungkan ke AI di Leosiqra, lalu tekan ikon tempat sampah di koneksi yang ingin diputus. AI itu langsung tidak bisa mengakses akun Anda. Semua koneksi juga otomatis diputus saat Anda mengganti atau mereset password.',
  },
  {
    q: 'Data apa yang dilihat AI, dan ke mana datanya pergi?',
    a: 'AI hanya bisa membaca data milik akun Anda sendiri: rekening dan saldo, transaksi, laporan bulanan, budget, dan kategori. Data yang dibaca AI dikirim ke penyedia AI yang Anda pilih (misalnya Anthropic untuk Claude atau OpenAI untuk ChatGPT) dan tunduk pada kebijakan privasinya.',
  },
  {
    q: 'Menu "Add custom connector" atau "Add custom MCP server" tidak muncul. Kenapa?',
    a: 'Di Claude paket Team/Enterprise, hanya Owner organisasi yang bisa menambah connector. Di ChatGPT, fitur ini tergantung paket dan pengaturan workspace (Developer mode di web). Menu aplikasi pihak ketiga juga bisa berubah; ikuti dokumentasi resmi Claude atau OpenAI kalau tampilannya berbeda dari panduan ini.',
  },
];

export default function PanduanMcpPage() {
  return (
    <GuideLayout
      eyebrow="Panduan fitur"
      title="Hubungkan Leosiqra ke Claude & ChatGPT"
      lead="Tanya “berapa pengeluaranku bulan ini?” atau minta “catat kopi 25rb dari e-wallet” langsung dari Claude atau ChatGPT. Panduan ini menjelaskan apa itu MCP, apa yang boleh dan tidak boleh dilakukan AI di akun Anda, langkah pemasangan, dan cara memutus akses."
      updated="26 Oktober 2026"
      faq={faq}
      related={{ href: '/panduan/cara-mencatat-keuangan-di-hp', label: 'Cara mencatat pengeluaran dan pemasukan di HP' }}
    >
      <h2>1. Apa itu MCP?</h2>
      <p>
        <strong>MCP (Model Context Protocol)</strong> adalah semacam colokan standar yang membuat aplikasi AI seperti
        Claude dan ChatGPT bisa memakai data dan fitur aplikasi lain — tentu hanya setelah Anda mengizinkannya. Setelah
        Leosiqra dihubungkan, AI bisa membaca ringkasan keuangan Anda untuk menjawab pertanyaan, dan (kalau diizinkan)
        mencatat transaksi untuk Anda.
      </p>
      <p>Alamat server Leosiqra MCP:</p>
      <p>
        <code>{MCP_URL}</code>
      </p>

      <h2>2. Apa yang bisa dan tidak bisa dilakukan AI</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Izin</th><th>Yang bisa dilakukan AI</th><th>Siapa</th></tr>
          </thead>
          <tbody>
            <tr><td>Membaca</td><td>Rekening &amp; saldo, transaksi per bulan, laporan bulanan, budget, kategori</td><td>Semua member</td></tr>
            <tr><td>Mencatat</td><td>Menambah transaksi pemasukan/pengeluaran, membuat atau mengubah budget bulanan</td><td>Member PRO, dicentang sendiri</td></tr>
            <tr><td>Tidak pernah</td><td>Menghapus data, transfer, mengubah password atau data akun</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Izin mencatat <strong>tidak pernah aktif otomatis</strong> — Anda harus mencentangnya sendiri saat menghubungkan.
        Semua yang dilakukan AI tercatat di <strong>Profil → Hubungkan ke AI → Aktivitas AI terakhir</strong>.
      </p>

      <h2>3. Hubungkan ke Claude (claude.ai)</h2>
      <p>Tidak perlu token — Anda cukup login Leosiqra di layar izin.</p>
      <ol>
        <li>Di claude.ai, buka <strong>Customize → Connectors</strong>.</li>
        <li>Klik <strong>Add custom connector</strong>.</li>
        <li>Isi nama (mis. Leosiqra) dan URL server <code>{MCP_URL}</code>, lalu klik <strong>Add</strong>.</li>
        <li>Klik <strong>Connect</strong> pada connector Leosiqra. Halaman Leosiqra terbuka — login kalau diminta.</li>
        <li>
          Di layar <strong>Hubungkan aplikasi AI</strong>, cek domain di kotak &ldquo;Akan kembali ke&rdquo; (harus
          claude.ai atau claude.com). Centang izin mencatat kalau perlu, lalu tekan <strong>Izinkan</strong>.
        </li>
        <li>
          Di chat, klik tombol <strong>+</strong> → <strong>Connectors</strong> dan pastikan Leosiqra aktif untuk
          percakapan itu.
        </li>
      </ol>
      <p>
        Paket Free bisa menambah satu custom connector. Di paket Team/Enterprise, Owner organisasi yang menambahkan
        connector lewat <strong>Organization settings → Connectors</strong>, lalu tiap anggota cukup menekan{' '}
        <strong>Connect</strong> dengan akun Leosiqra masing-masing.
      </p>

      <h2>4. Hubungkan ke ChatGPT</h2>
      <p>
        Custom MCP server di ChatGPT memakai Developer mode di versi web, dan ketersediaannya tergantung paket serta
        pengaturan workspace Anda. Langkah dari dokumentasi OpenAI saat panduan ini ditulis:
      </p>
      <ol>
        <li>Buka <strong>chatgpt.com/plugins</strong>, tekan tombol <strong>+</strong>, pilih <strong>Add custom MCP server</strong>.</li>
        <li>Isi nama (mis. Leosiqra) dan deskripsi singkat.</li>
        <li>Di bagian <strong>Connection</strong>, masukkan URL <code>{MCP_URL}</code> dan pilih autentikasi OAuth.</li>
        <li>Baca peringatan risikonya, pilih <strong>I understand and want to continue</strong>, lalu <strong>Create as a plugin</strong>.</li>
        <li>Login Leosiqra di layar izin, cek domain (harus chatgpt.com atau openai.com), lalu tekan <strong>Izinkan</strong>.</li>
        <li>Pasang plugin-nya, mulai percakapan baru, ketik <strong>@</strong> dan pilih Leosiqra.</li>
      </ol>

      <h2>5. Claude Code &amp; klien MCP lain (pakai token)</h2>
      <p>
        Untuk klien yang memakai header, buat token di <strong>Profil → Hubungkan ke AI → + Token</strong>. Pilih masa
        berlaku 30, 90, atau 365 hari. Token hanya ditampilkan <strong>sekali</strong> — simpan seperti password. Untuk
        Claude Code, salin perintah yang muncul, bentuknya:
      </p>
      <p>
        <code>claude mcp add --transport http leosiqra {MCP_URL} --header &quot;Authorization: Bearer &lt;token&gt;&quot;</code>
      </p>
      <p>
        Klien lain: pakai URL yang sama dengan header <code>Authorization: Bearer &lt;token&gt;</code>. Jangan pernah
        menempel token di chat atau membagikannya ke orang lain.
      </p>

      <h2>6. Contoh perintah</h2>
      <ul>
        <li>&ldquo;Berapa total pengeluaranku bulan ini, dan kategori apa yang paling besar?&rdquo;</li>
        <li>&ldquo;Saldo semua rekeningku sekarang berapa?&rdquo;</li>
        <li>&ldquo;Budget makan bulan ini sudah terpakai berapa persen?&rdquo;</li>
        <li>&ldquo;Catat kopi 25rb dari e-wallet, kategori makanan.&rdquo; (butuh izin mencatat)</li>
        <li>&ldquo;Atur budget transportasi 600 ribu per bulan.&rdquo; (butuh izin mencatat)</li>
      </ul>
      <p>
        Leosiqra meminta AI mengonfirmasi ke Anda sebelum mencatat atau mengubah budget, dan Claude maupun ChatGPT
        umumnya meminta persetujuan sebelum memakai alat. Periksa nominal dan rekeningnya sebelum menyetujui. Permintaan
        yang terkirim dua kali tidak tercatat ganda.
      </p>

      <h2>7. Keamanan &amp; memutus akses</h2>
      <ul>
        <li>
          <strong>Satu koneksi = satu kunci</strong>. Setiap koneksi AI tampil di Profil → Hubungkan ke AI, lengkap dengan
          kapan terakhir dipakai, dan bisa diputus sendiri-sendiri.
        </li>
        <li>
          <strong>Ganti password = semua koneksi putus</strong>. Kalau merasa ada yang aneh, ganti password lalu hubungkan
          ulang AI yang Anda percaya.
        </li>
        <li>
          <strong>Cek domain di layar izin</strong>. Leosiqra menandai &ldquo;resmi&rdquo; hanya untuk claude.ai,
          claude.com, chatgpt.com, dan openai.com. Domain lain belum tentu berbahaya, tapi pastikan Anda mengenalnya.
        </li>
        <li>
          <strong>Catatan transaksi dibaca sebagai data</strong>. Hindari menulis instruksi untuk AI di catatan
          transaksi — tetap periksa setiap permintaan mencatat sebelum disetujui.
        </li>
      </ul>
      <p>
        Data yang dibaca AI dikirim ke penyedia AI yang Anda pilih. Detailnya ada di{' '}
        <Link href="/privacy">kebijakan privasi</Link>.
      </p>
    </GuideLayout>
  );
}

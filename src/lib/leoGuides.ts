// Popup Leo di halaman fitur: tiap halaman punya gaya Leo, materi singkat, dan pertanyaan sendiri.
// Pertanyaan dijawab langsung di popup (POST /api/member/ai/chat dengan `page` — nilai `page`
// WAJIB ada di AI_CHAT_PAGES di Worker supaya model tahu konteks halamannya).

export type LeoGuideTopic = 'makan' | 'asuransi' | 'kesehatan' | 'cerita' | 'fokus' | 'ladang' | 'investasi';
export type LeoAccessory = 'chef' | 'shield' | 'doctor' | 'beret' | 'headphones' | 'sprout' | 'glasses';

export type LeoGuide = {
  name: string;
  greeting: string;
  accessory: LeoAccessory;
  accent: string; // gradien header popup
  facts: { emoji: string; title: string; body: string }[];
  questions: string[];
};

export const LEO_GUIDES: Record<LeoGuideTopic, LeoGuide> = {
  makan: {
    name: 'Leo si Koki',
    greeting: 'Halo! Aku bantu soal makan & belanja makanmu hari ini.',
    accessory: 'chef',
    accent: 'from-orange-400 via-amber-400 to-rose-400',
    facts: [
      {
        emoji: '🥗',
        title: 'Isi piringmu',
        body: 'Setengah piring sayur & buah, setengahnya lagi makanan pokok dan lauk — patokan sederhana piring yang seimbang.',
      },
      {
        emoji: '💧',
        title: 'Minum air putih',
        body: 'Minuman manis menambah kalori tanpa bikin kenyang. Air putih tetap juara, dan gratis.',
      },
      {
        emoji: '💸',
        title: 'Hemat tanpa kurang gizi',
        body: 'Masak sendiri 2–3 kali seminggu dan bawa bekal bisa memangkas belanja makan. Pantau di kartu Minggu ini.',
      },
    ],
    questions: [
      'Gimana pola makanku minggu ini?',
      'Berapa total belanja makanku minggu ini?',
      'Kasih ide menu sehat di bawah Rp25 ribu',
      'Makanan tinggi protein yang murah apa aja?',
      'Gimana cara hemat uang makan tanpa ngorbanin gizi?',
    ],
  },
  asuransi: {
    name: 'Leo si Pelindung',
    greeting: 'Soal polis, premi, dan klaim — aku bantu jelaskan pakai bahasa sehari-hari.',
    accessory: 'shield',
    accent: 'from-blue-600 via-indigo-500 to-sky-400',
    facts: [
      {
        emoji: '🧾',
        title: 'Simpan semua kuitansi',
        body: 'Reimburse biasanya butuh kuitansi asli, resume medis, dan formulir klaim. Foto semuanya sebelum diserahkan.',
      },
      {
        emoji: '⏰',
        title: 'Perhatikan batas waktu klaim',
        body: 'Banyak polis membatasi pengajuan reimburse, misalnya 30–90 hari setelah perawatan. Cek di polismu.',
      },
      {
        emoji: '🛡️',
        title: 'Premi tepat waktu',
        body: 'Telat bayar bisa membuat polis tidak aktif. Leo mengingatkan H-3 dan H-1 sebelum jatuh tempo.',
      },
    ],
    questions: [
      'Beda cashless dan reimburse apa?',
      'Berapa total premi asuransiku setahun?',
      'Asuransi dari kantor sudah cukup belum?',
      'Kalau klaim ditolak, aku harus gimana?',
    ],
  },
  kesehatan: {
    name: 'Leo si Dokter',
    greeting: 'Yuk jaga badan sebelum sakit — tanya aku soal cek kesehatan rutin.',
    accessory: 'doctor',
    accent: 'from-teal-500 via-emerald-400 to-lime-300',
    facts: [
      {
        emoji: '🩺',
        title: 'Cek rutin itu murah',
        body: 'Cek tekanan darah, gula darah, dan berat badan setahun sekali jauh lebih murah daripada berobat saat sudah sakit.',
      },
      {
        emoji: '🏥',
        title: 'Ada yang gratis',
        body: 'Pemerintah punya program Cek Kesehatan Gratis di puskesmas. Tanyakan jadwalnya di puskesmas terdekat.',
      },
      {
        emoji: '📝',
        title: 'Catat hasilnya',
        body: 'Simpan angka hasil cek supaya perubahan dari tahun ke tahun kelihatan. Ini panduan umum, bukan diagnosis.',
      },
    ],
    questions: [
      'Cek kesehatan apa yang perlu aku lakukan tiap tahun?',
      'Gimana cara ikut cek kesehatan gratis?',
      'Berapa biaya kesehatanku tahun ini?',
      'Tips hidup sehat yang hemat apa aja?',
    ],
  },
  cerita: {
    name: 'Leo si Penulis',
    greeting: 'Mau cerita apa hari ini? Aku bantu merangkum hari-harimu.',
    accessory: 'beret',
    accent: 'from-pink-400 via-rose-400 to-amber-300',
    facts: [
      {
        emoji: '✍️',
        title: 'Sedikit tapi rutin',
        body: 'Dua-tiga kalimat tiap hari lebih awet daripada satu halaman seminggu sekali.',
      },
      {
        emoji: '📸',
        title: 'Foto jadi kenangan',
        body: 'Tambahkan foto, lalu ubah jadi ilustrasi AI supaya kalendermu makin hidup.',
      },
      {
        emoji: '🌤️',
        title: 'Mood & uang',
        body: 'Ringkasan belanja di tiap hari membantu melihat kapan kamu belanja karena emosi.',
      },
    ],
    questions: [
      'Ringkas mood-ku minggu ini',
      'Hari apa aku paling boros minggu ini?',
      'Kasih ide tulisan buat cerita hari ini',
    ],
  },
  fokus: {
    name: 'Leo si Fokus',
    greeting: 'Siap fokus bareng? Tanya aku soal teknik fokus & istirahat.',
    accessory: 'headphones',
    accent: 'from-indigo-500 via-violet-500 to-sky-400',
    facts: [
      {
        emoji: '⏱️',
        title: 'Pomodoro',
        body: 'Fokus 25 menit, istirahat 5 menit. Setelah 4 putaran, istirahat lebih panjang.',
      },
      {
        emoji: '🫁',
        title: 'Napas tenang',
        body: 'Tarik napas 4 hitungan, tahan 4, buang 4 — bantu tenang sebelum mulai.',
      },
      { emoji: '👀', title: 'Istirahat mata', body: 'Tiap 20 menit, lihat sesuatu yang jauh selama ±20 detik.' },
    ],
    questions: [
      'Kasih teknik fokus buat belajar',
      'Gimana cara pomodoro yang benar?',
      'Latihan napas biar tenang sebelum kerja',
    ],
  },
  ladang: {
    name: 'Leo si Juragan',
    greeting: 'Halo juragan! Tanya aku soal usaha, stok, dan untungmu.',
    accessory: 'sprout',
    accent: 'from-emerald-400 via-teal-400 to-lime-300',
    facts: [
      { emoji: '🧾', title: 'Pisahkan uangnya', body: 'Rekening usaha terpisah bikin untung-rugi kelihatan jelas.' },
      {
        emoji: '📦',
        title: 'Kenali HPP',
        body: 'Harga jual = modal bahan + biaya + untung. Catat resep supaya HPP terhitung.',
      },
      {
        emoji: '📈',
        title: 'Catat tiap hari',
        body: 'Penjualan kecil yang tercatat lebih berharga daripada tebakan di akhir bulan.',
      },
    ],
    questions: [
      'Gimana cara naikin omzet usahaku?',
      'Hitung untung bersih usahaku bulan ini',
      'Tips kasih harga jual barang bekas',
    ],
  },
  investasi: {
    name: 'Leo si Investor',
    greeting: 'Mau ngobrol soal portofolio? Aku bantu jelasin pelan-pelan.',
    accessory: 'glasses',
    accent: 'from-blue-500 via-indigo-500 to-violet-400',
    facts: [
      {
        emoji: '🛟',
        title: 'Dana darurat dulu',
        body: 'Siapkan dana darurat sebelum menaruh uang di instrumen yang naik-turun.',
      },
      {
        emoji: '🧺',
        title: 'Jangan satu keranjang',
        body: 'Sebar ke beberapa jenis investasi supaya risiko lebih terkendali.',
      },
      {
        emoji: '📅',
        title: 'Rutin lebih ringan',
        body: 'Investasi kecil tiap bulan lebih mudah dijalani daripada menunggu waktu yang pas.',
      },
    ],
    questions: [
      'Gimana kondisi portofolioku?',
      'Jelasin beda reksa dana dan saham',
      'Berapa dana darurat ideal buat aku?',
    ],
  },
};

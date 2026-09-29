// Bank konten video promo. Semua klaim tentang Leosiqra di sini harus SESUAI
// fitur yang benar-benar ada di aplikasi — AI cuma boleh memakai daftar ini.

export const HANDLES = { instagram: "@leosiqra_official", youtube: "Leosiqra", site: "leosiqra.com" };

export const OFFER = "Coba gratis 14 hari, tanpa kartu kredit. Ada di Android, iPhone, dan web.";

// Fitur nyata + layar mockup yang cocok untuk scene "phone".
export const FEATURES = [
  { id: "quick", name: "Input Cepat", fact: "Catat pengeluaran dalam hitungan detik, cukup ketik misalnya 'kopi 25rb'. Bisa dipasang di layar utama HP." },
  { id: "scan", name: "Scan Struk", fact: "Foto struk belanja, AI membaca total, kategori, dan tanggalnya otomatis." },
  { id: "voice", name: "Catat Pakai Suara", fact: "Ngomong saja, misalnya 'kemarin beli bensin 50 ribu pakai cash', langsung jadi transaksi." },
  { id: "ai", name: "AI Leosiqra", fact: "Asisten AI yang paham data keuanganmu: tanya saldo, di mana paling boros, atau minta tips hemat." },
  { id: "savings", name: "Tabungan & Target", fact: "Bikin target tabungan (misal dana darurat atau liburan) dan pantau progresnya." },
  { id: "budget", name: "Budget per Kategori", fact: "Atur batas belanja per kategori, lihat sisa budget bulan ini." },
  { id: "debt", name: "Hutang & Piutang", fact: "Catat hutang, piutang, dan cicilan supaya tidak ada yang lupa." },
  { id: "level", name: "Level & Challenge", fact: "Naik Level 1 sampai 10 dengan menyelesaikan challenge, misalnya streak catat 7 hari, setoran tabungan pertama, pasang budget pertama, atau bebas utang." },
  { id: "stats", name: "Statistik & Rekap", fact: "Grafik pemasukan dan pengeluaran per kategori, plus rekap tahunan." },
  { id: "market", name: "Investasi & Data Pasar", fact: "Pantau saham, deposito, kripto, dan emas dengan harga live." },
  { id: "recurring", name: "Transaksi Berulang", fact: "Tagihan atau gaji bulanan tercatat otomatis sesuai jadwal." },
  { id: "tax", name: "Pajak Center", fact: "Bantu menyiapkan data SPT tahunan dari catatan keuanganmu." },
];

// Format video — diputar bergiliran supaya tiap hari beda rasa.
export const FORMATS = {
  hitung: {
    label: "Hitung-hitungan bikin kaget",
    guide: "Ambil kebiasaan kecil sehari-hari, hitung dampaknya per bulan/tahun dengan ANGKA YANG BENAR, lalu tunjukkan Leosiqra membantu melacaknya.",
    topics: [
      "jajan kopi kekinian tiap hari", "ongkir belanja online", "langganan streaming yang lupa dipakai", "rokok sebungkus sehari",
      "makan siang pesan antar tiap hari kerja", "biaya admin & transfer antar bank", "top up game", "parkir dan tol harian",
      "boba seminggu tiga kali", "checkout flash sale tengah malam", "nongkrong tiap weekend", "beli air mineral botolan tiap hari",
    ],
  },
  tips: {
    label: "Tips singkat",
    guide: "Tiga tips praktis dan spesifik (bukan klise). Tutup dengan bagaimana Leosiqra membantu menjalankannya.",
    topics: [
      "cara bikin dana darurat dari nol", "mengatur gaji pakai 50/30/20", "biar tidak boncos di tanggal tua", "berhenti lapar mata saat promo",
      "mulai investasi pertama dengan aman", "melunasi hutang lebih cepat", "bikin budget bulanan yang realistis", "nabung untuk liburan",
      "mengelola THR atau bonus", "keuangan pasangan baru menikah", "anak kos biar uang bulanan cukup", "freelancer dengan gaji tidak tetap",
    ],
  },
  mitos: {
    label: "Mitos vs Fakta",
    guide: "Satu atau dua mitos keuangan populer yang dipatahkan dengan fakta yang akurat.",
    topics: [
      "mencatat keuangan itu ribet", "gaji kecil tidak bisa menabung", "investasi harus modal besar", "kartu kredit selalu buruk",
      "nabung cukup sisa gaji", "dana darurat tidak perlu kalau masih muda", "hemat berarti pelit", "cicilan 0% pasti untung",
    ],
  },
  kuis: {
    label: "Kuis cepat",
    guide: "Satu pertanyaan pilihan ganda seputar uang sehari-hari dengan jawaban yang benar dan masuk akal, lalu penjelasan singkat.",
    topics: [
      "berapa idealnya dana darurat", "pengeluaran kecil yang paling bikin boros", "urutan prioritas gaji", "bunga majemuk",
      "beda kebutuhan dan keinginan", "berapa persen gaji untuk cicilan maksimal", "kapan waktu terbaik mencatat pengeluaran",
    ],
  },
  fitur: {
    label: "Pamer fitur",
    guide: "Tunjukkan satu fitur Leosiqra beraksi di layar HP, dari masalah ke solusi, dengan bahasa santai.",
    topics: FEATURES.map((f) => `fitur ${f.name}`),
  },
  pov: {
    label: "POV / relatable",
    guide: "Mulai dengan situasi relatable ('POV: ...'), bikin penonton merasa 'ini gue banget', lalu solusi dengan Leosiqra.",
    topics: [
      "gajian tapi tanggal 20 sudah menipis", "lupa uang habis ke mana", "struk numpuk di dompet", "ditanya pasangan uangnya ke mana",
      "baru sadar langganan dobel", "mau nabung tapi selalu gagal", "tagihan kartu kredit bikin kaget", "nyatet di notes HP berantakan",
    ],
  },
};

export const FORMAT_ORDER = ["hitung", "fitur", "tips", "pov", "mitos", "kuis"];

// Naskah cadangan kalau AI tidak tersedia (saldo habis/gangguan). Visual tetap
// diacak, jadi video tetap terasa beda walaupun naskahnya dari sini.
export const FALLBACK_SCRIPTS = [
  {
    format: "hitung", topic: "jajan kopi kekinian tiap hari",
    scenes: [
      { type: "hook", text: "Kopi 25 ribu sehari?", emoji: "☕", say: "Kopi dua puluh lima ribu sehari. Kelihatannya kecil, kan?" },
      { type: "number", label: "Setahun jadi", prefix: "Rp", to: 9125000, suffix: "", say: "Setahun, itu jadi sembilan juta lebih!" },
      { type: "phone", screen: "quick", text: "Catat 3 detik", say: "Di Leosiqra, cukup ketik kopi dua puluh lima ribu, langsung tercatat." },
      { type: "cta", text: "Tahu uangmu ke mana", say: "Coba gratis empat belas hari. Follow buat tips berikutnya!" },
    ],
    caption: "Kopi 25rb/hari = Rp9,1 juta/tahun ☕😳 Kecil tapi kalau tiap hari, kerasa banget. Catat biar sadar!",
    hashtags: ["#keuangan", "#tipshemat", "#catatankeuangan", "#financialplanning", "#leosiqra"],
  },
  {
    format: "tips", topic: "cara bikin dana darurat dari nol",
    scenes: [
      { type: "hook", text: "Belum punya dana darurat?", emoji: "🚨", say: "Belum punya dana darurat? Mulai dari sini." },
      { type: "list", title: "3 langkah", items: ["Target 3–6x pengeluaran", "Sisihkan di awal gajian", "Pisahkan rekeningnya"], say: "Tentukan target tiga sampai enam kali pengeluaran, sisihkan pas gajian, dan pisahkan rekeningnya." },
      { type: "phone", screen: "savings", text: "Pantau progresnya", say: "Pantau progresnya pakai fitur tabungan di Leosiqra." },
      { type: "cta", text: "Mulai hari ini", say: "Coba gratis sekarang, dan follow untuk tips lainnya!" },
    ],
    caption: "Dana darurat itu bukan nanti, tapi sekarang 🚨 Simpan video ini biar gak lupa langkahnya!",
    hashtags: ["#danadarurat", "#tipskeuangan", "#nabung", "#financialtips", "#leosiqra"],
  },
  {
    format: "mitos", topic: "mencatat keuangan itu ribet",
    scenes: [
      { type: "hook", text: "Nyatet keuangan itu ribet?", emoji: "🤔", say: "Katanya nyatet keuangan itu ribet?" },
      { type: "mythfact", myth: "Harus buka Excel tiap hari", fact: "Cukup ketik atau foto struk", say: "Mitos. Sekarang cukup ketik, foto struk, atau ngomong aja." },
      { type: "phone", screen: "scan", text: "Foto struk, beres", say: "Scan struk, AI Leosiqra yang isi semuanya." },
      { type: "cta", text: "Buktikan sendiri", say: "Coba gratis empat belas hari. Follow ya!" },
    ],
    caption: "Nyatet keuangan gak harus ribet 🙅 Ketik, foto struk, atau ngomong aja. Beres!",
    hashtags: ["#mitosfakta", "#keuangan", "#catatankeuangan", "#scanstruk", "#leosiqra"],
  },
  {
    format: "kuis", topic: "berapa idealnya dana darurat",
    scenes: [
      { type: "hook", text: "Kuis cepat!", emoji: "🧠", say: "Kuis cepat! Jawab di kolom komentar." },
      { type: "quiz", question: "Idealnya dana darurat lajang berapa?", options: ["1x pengeluaran", "3–6x pengeluaran", "Setahun gaji"], answer: 1, say: "Idealnya dana darurat untuk yang masih lajang berapa? Jawabannya, tiga sampai enam kali pengeluaran bulanan." },
      { type: "phone", screen: "stats", text: "Tahu pengeluaranmu", say: "Biar tahu angkanya, lihat rekap pengeluaranmu di Leosiqra." },
      { type: "cta", text: "Benar gak jawabanmu?", say: "Follow untuk kuis besok!" },
    ],
    caption: "Kamu jawab apa? 🧠 Tulis di komentar! Dana darurat ideal lajang: 3–6x pengeluaran bulanan.",
    hashtags: ["#kuiskeuangan", "#danadarurat", "#literasikeuangan", "#tipskeuangan", "#leosiqra"],
  },
  {
    format: "pov", topic: "gajian tapi tanggal 20 sudah menipis",
    scenes: [
      { type: "hook", text: "POV: baru tanggal 20…", emoji: "🫠", say: "P O V, baru tanggal dua puluh, saldo udah tipis." },
      { type: "phone", screen: "ai", text: "Tanya AI-nya", say: "Tanya AI Leosiqra, bulan ini aku boros di mana?" },
      { type: "phone", screen: "budget", text: "Kasih batas", say: "Terus pasang budget per kategori biar gak kebablasan." },
      { type: "cta", text: "Tanggal tua? Aman.", say: "Coba gratis sekarang, dan follow ya!" },
    ],
    caption: "Tanggal tua datang lebih cepat? 🫠 Cek ke mana uangmu pergi, terus kasih batas. Tag temen yang relate!",
    hashtags: ["#tanggaltua", "#relatable", "#keuangan", "#budgeting", "#leosiqra"],
  },
  {
    format: "fitur", topic: "fitur Level & Challenge",
    scenes: [
      { type: "hook", text: "Nyatet uang tapi berasa main game?", emoji: "🎮", say: "Nyatet keuangan tapi berasa main game?" },
      { type: "phone", screen: "level", text: "Naik level!", say: "Selesaikan challenge, kumpulkan XP, dan naik sampai level sepuluh." },
      { type: "list", title: "Challenge-nya", items: ["Streak catat 7 hari", "Setoran tabungan pertama", "Pasang budget pertama"], say: "Mulai dari catat tujuh hari berturut-turut, setoran tabungan pertama, sampai pasang budget." },
      { type: "cta", text: "Level berapa kamu?", say: "Coba gratis, dan follow untuk update fitur!" },
    ],
    caption: "Siapa bilang ngatur uang ngebosenin? 🎮 Naik level sambil rapiin keuangan!",
    hashtags: ["#gamification", "#aplikasikeuangan", "#catatankeuangan", "#produktif", "#leosiqra"],
  },
];

export const FALLBACK_CAPTION_TAIL =
  "\n\n📲 Coba gratis 14 hari di leosiqra.com — tanpa kartu kredit.\nIG: @leosiqra_official · YouTube: Leosiqra";

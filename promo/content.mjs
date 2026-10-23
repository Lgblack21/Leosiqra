// Bank konten video promo. Semua klaim tentang Leosiqra di sini harus SESUAI
// fitur yang benar-benar ada di aplikasi — AI cuma boleh memakai daftar ini.

export const HANDLES = { instagram: "@leosiqra_official", youtube: "Leosiqra", site: "leosiqra.com" };

export const OFFER = "Coba gratis 14 hari, tanpa kartu kredit. Setelah itu PRO mulai Rp15.000/bulan, atau Rp129.000/tahun (paling hemat). Ada di Android, iPhone, dan web.";

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
// Prinsip konten (sejak 2026-10-23): NILAI DULU. Video harus berguna
// walaupun nama Leosiqra tidak disebut — penonton dapat angka, cara, atau
// pemahaman baru yang bisa langsung dipakai. Promosi produk hanya di video
// "promo" (±1 dari 3, diatur plan.mjs), dan itu pun cukup 1 scene.
export const FORMATS = {
  hitung: {
    label: "Hitung-hitungan bikin kaget",
    guide: "Satu kebiasaan spesifik + angka nyata (sebut asumsinya), hitung per bulan & per tahun dengan BENAR, lalu kasih 1 alternatif konkret yang menghemat dan berapa hasilnya. Penonton harus bisa mengulang hitungannya sendiri.",
    topics: [
      "ongkir belanja online 4x seminggu", "langganan streaming yang tumpang tindih", "rokok sebungkus sehari dibanding investasi reksa dana", "biaya admin & transfer antar bank setahun",
      "top up game Rp50 ribu tiap minggu", "parkir dan tol harian pekerja Jabodetabek", "beli air galon vs botolan", "paylater 3x cicilan dengan biaya layanan",
      "bunga kartu kredit kalau cuma bayar minimum", "biaya isi bensin naik turun motor vs transportasi umum", "nikahan: biaya rata-rata vs nabung dari sekarang", "nyicil HP 12 bulan vs nabung dulu",
    ],
  },
  studikasus: {
    label: "Studi kasus gaji",
    guide: "Bedah keuangan satu orang fiktif yang realistis (gaji, kota, tanggungan disebut jelas). Tunjukkan alokasi per pos dalam rupiah, di mana bocornya, dan versi yang lebih sehat. Angka harus jumlahnya pas.",
    topics: [
      "gaji UMR Jakarta Rp5,4 juta, belum menikah, ngekos", "gaji Rp3,5 juta di kota kecil, tinggal sama ortu", "pasangan baru menikah, gaji gabungan Rp12 juta", "freelancer penghasilan Rp4–9 juta tidak tetap",
      "fresh graduate gaji pertama Rp6 juta", "ojol penghasilan harian", "guru honorer Rp2,5 juta + les privat", "karyawan Rp8 juta dengan cicilan motor & KPR",
    ],
  },
  tips: {
    label: "Cara praktis",
    guide: "Satu masalah spesifik, 3 langkah yang bisa dikerjakan HARI INI (angka, contoh nyata, bukan nasihat umum seperti 'hemat' atau 'buat anggaran'). Penonton harus bisa menyimpan video ini sebagai panduan.",
    topics: [
      "dana darurat dari nol dengan gaji pas-pasan", "menghadapi tanggal tua 10 hari terakhir", "berhenti checkout impulsif saat flash sale", "melunasi beberapa hutang: metode snowball vs avalanche",
      "mengelola THR biar tidak habis seminggu", "anak kos biar uang bulanan cukup", "negosiasi kenaikan gaji pertama", "persiapan keuangan sebelum resign",
      "cara cek pinjol & investasi legal di OJK", "atur keuangan kalau gaji telat",
    ],
  },
  mitos: {
    label: "Mitos vs Fakta",
    guide: "Satu mitos keuangan populer, dipatahkan dengan fakta yang akurat + 1 contoh angka. Jangan menghakimi penonton.",
    topics: [
      "gaji kecil tidak bisa menabung", "investasi harus modal besar", "kartu kredit selalu buruk", "cicilan 0% pasti untung",
      "emas pasti naik terus", "deposito lebih aman dari SBN", "asuransi itu buang uang", "nabung cukup dari sisa gaji",
    ],
  },
  kuis: {
    label: "Kuis cepat",
    guide: "Satu pertanyaan pilihan ganda yang jawabannya mengejutkan tapi benar, lalu penjelasan singkat dengan angka. Ajak penonton jawab di komentar sebelum jawaban muncul.",
    topics: [
      "berapa idealnya dana darurat", "bunga majemuk 10 tahun", "pajak bunga deposito vs kupon SBN", "berapa persen gaji maksimal untuk cicilan",
      "biaya sebenarnya cicilan 0% dengan biaya admin", "berapa lama uang Rp10 juta habis kalau jajan Rp50 ribu sehari",
    ],
  },
  salahkaprah: {
    label: "Salah kaprah yang sering terjadi",
    guide: "Satu kesalahan keuangan yang umum dan relatable ('gue dulu juga gini'), kenapa merugikan (angka), dan cara yang benar. Nada santai, bukan menggurui.",
    topics: [
      "ambil KTA buat liburan", "beli barang karena diskon, bukan butuh", "tidak bedakan rekening tabungan dan rekening harian", "bayar kartu kredit cuma minimum",
      "investasi ikut-ikutan teman", "tidak punya catatan pengeluaran tapi merasa boros", "pakai paylater untuk kebutuhan harian", "nabung di celengan tanpa target",
    ],
  },
  pov: {
    label: "POV / relatable",
    guide: "Situasi relatable ('POV: ...') yang bikin penonton merasa 'ini gue banget', lalu 1–2 cara konkret keluar dari situasi itu.",
    topics: [
      "gajian tapi tanggal 20 sudah menipis", "lupa uang habis ke mana", "ditanya pasangan uangnya ke mana", "baru sadar langganan dobel",
      "tagihan kartu kredit bikin kaget", "diajak nongkrong pas lagi bokek", "teman pinjam uang tidak balik",
    ],
  },
  fitur: {
    label: "Pamer fitur",
    guide: "Satu masalah nyata → satu fitur Leosiqra menyelesaikannya di layar HP. Video PROMO — boleh menyebut penawaran.",
    topics: FEATURES.map((f) => `fitur ${f.name}`),
  },
};

// Video PROMO hanya format "fitur" + video yang diberi slot promo (lihat plan.mjs).
export const FORMAT_ORDER = ["hitung", "studikasus", "fitur", "tips", "salahkaprah", "kuis", "mitos", "pov"];

// Naskah cadangan kalau AI tidak tersedia (saldo habis/gangguan). Visual tetap
// diacak, jadi video tetap terasa beda walaupun naskahnya dari sini.
export const FALLBACK_SCRIPTS = [
  {
    format: "hitung", topic: "jajan kopi kekinian tiap hari",
    scenes: [
      { type: "hook", text: "Kopi 25 ribu, tiap hari kerja", emoji: "☕", say: "Kopi dua puluh lima ribu, tiap hari kerja. Ayo kita hitung beneran." },
      { type: "number", label: "Setahun (22 hari kerja/bulan)", prefix: "Rp", to: 6600000, suffix: "", say: "Dua puluh dua hari kerja sebulan, setahun jadi enam koma enam juta." },
      { type: "list", title: "Nggak harus berhenti", items: ["Seduh sendiri 3 hari", "Beli 2 hari aja", "Hemat ±Rp3,9 jt/tahun"], say: "Nggak usah berhenti. Seduh sendiri tiga hari, beli dua hari. Hematnya hampir empat juta setahun." },
      { type: "cta", text: "Kebiasaanmu yang mana?", button: "Simpan video ini", say: "Komen kebiasaan kecilmu, nanti aku hitungin. Simpan video ini ya!" },
    ],
    caption: "Kopi Rp25rb × 22 hari kerja × 12 bulan = Rp6,6 juta ☕ Nggak perlu berhenti total — beli 2x seminggu aja udah hemat ±Rp3,9 juta/tahun. Komen kebiasaanmu, aku hitungin!",
    hashtags: ["#keuangan", "#tipshemat", "#literasikeuangan", "#financialtips", "#hitunghitungan"],
  },
  {
    format: "tips", topic: "dana darurat dari nol dengan gaji pas-pasan",
    scenes: [
      { type: "hook", text: "Dana darurat dari Rp0", emoji: "🚨", say: "Gaji pas-pasan, dana darurat masih nol. Mulai dari sini." },
      { type: "list", title: "Mulai minggu ini", items: ["Target awal: 1x pengeluaran", "Auto-transfer 10% saat gajian", "Rekening terpisah, tanpa kartu"], say: "Target awal cukup satu kali pengeluaran. Sisihkan sepuluh persen pas gajian, taruh di rekening terpisah tanpa kartu." },
      { type: "number", label: "Gaji Rp4 jt × 10% × 12 bln", prefix: "Rp", to: 4800000, suffix: "", say: "Gaji empat juta, sepuluh persen, setahun sudah empat koma delapan juta." },
      { type: "cta", text: "Mulai gajian nanti", button: "Simpan video ini", say: "Simpan video ini, biar gajian nanti langsung jalan." },
    ],
    caption: "Dana darurat nggak harus langsung 6x gaji 🚨 Mulai target 1x pengeluaran dulu, sisihkan 10% di awal gajian, pisahkan rekeningnya. Simpan buat gajian nanti!",
    hashtags: ["#danadarurat", "#tipskeuangan", "#nabung", "#gajiumr", "#literasikeuangan"],
  },
  {
    format: "mitos", topic: "cicilan 0% pasti untung",
    scenes: [
      { type: "hook", text: "Cicilan 0% = gratis?", emoji: "🤔", say: "Cicilan nol persen itu pasti untung? Belum tentu." },
      { type: "mythfact", myth: "0% berarti tanpa biaya", fact: "Cek biaya admin & harga barang", say: "Sering ada biaya admin, dan harga barangnya kadang lebih mahal dari bayar tunai." },
      { type: "number", label: "Admin 2,5% dari HP Rp4 jt", prefix: "Rp", to: 100000, suffix: "", say: "Biaya admin dua koma lima persen dari empat juta, itu seratus ribu." },
      { type: "cta", text: "Bandingkan dulu", button: "Kirim ke temanmu", say: "Kirim ke teman yang lagi mau nyicil HP!" },
    ],
    caption: "Cicilan 0% belum tentu gratis 🤔 Cek biaya admin, biaya layanan, dan bandingkan dengan harga tunai sebelum checkout.",
    hashtags: ["#mitosfakta", "#cicilan", "#paylater", "#literasikeuangan", "#tipskeuangan"],
  },
  {
    format: "kuis", topic: "berapa idealnya dana darurat",
    scenes: [
      { type: "hook", text: "Kuis cepat!", emoji: "🧠", say: "Kuis cepat! Jawab di kolom komentar sebelum jawabannya muncul." },
      { type: "quiz", question: "Idealnya dana darurat lajang berapa?", options: ["1x pengeluaran", "3–6x pengeluaran", "Setahun gaji"], answer: 1, say: "Idealnya dana darurat untuk yang masih lajang berapa? Jawabannya, tiga sampai enam kali pengeluaran bulanan." },
      { type: "list", title: "Kalau sudah menikah", items: ["Tanpa anak: 6x", "Punya anak: 9–12x", "Freelancer: 12x"], say: "Menikah enam kali, punya anak sembilan sampai dua belas kali, freelancer dua belas kali." },
      { type: "cta", text: "Benar gak jawabanmu?", button: "Follow buat kuis besok", say: "Benar nggak jawabanmu? Follow buat kuis besok!" },
    ],
    caption: "Kamu jawab apa? 🧠 Dana darurat ideal: lajang 3–6x pengeluaran, menikah 6x, punya anak 9–12x, freelancer 12x.",
    hashtags: ["#kuiskeuangan", "#danadarurat", "#literasikeuangan", "#tipskeuangan", "#financialplanning"],
  },
  {
    format: "pov", topic: "gajian tapi tanggal 20 sudah menipis",
    scenes: [
      { type: "hook", text: "POV: baru tanggal 20…", emoji: "🫠", say: "P O V, baru tanggal dua puluh, saldo udah tipis." },
      { type: "list", title: "Pas gajian berikutnya", items: ["Bayar tagihan & tabung dulu", "Sisa dibagi 4 minggu", "Jatah mingguan di e-money terpisah"], say: "Gajian berikutnya, bayar tagihan dan tabung dulu. Sisanya bagi empat minggu, taruh jatah mingguan di dompet terpisah." },
      { type: "number", label: "Contoh: sisa Rp2 jt / 4 minggu", prefix: "Rp", to: 500000, suffix: "/minggu", say: "Sisa dua juta, berarti lima ratus ribu per minggu. Habis, ya berhenti." },
      { type: "cta", text: "Tag teman yang relate", button: "Simpan video ini", say: "Tag temen yang tanggal dua puluh udah begini!" },
    ],
    caption: "Tanggal tua datang lebih cepat? 🫠 Coba sistem jatah mingguan: tagihan & tabungan dulu, sisanya dibagi 4. Tag temen yang relate!",
    hashtags: ["#tanggaltua", "#relatable", "#keuangan", "#budgeting", "#tipshemat"],
  },
  {
    format: "fitur", topic: "fitur Level & Challenge",
    scenes: [
      { type: "hook", text: "Nyatet uang tapi berasa main game?", emoji: "🎮", say: "Nyatet keuangan tapi berasa main game?" },
      { type: "phone", screen: "level", text: "Naik level!", say: "Selesaikan challenge, kumpulkan XP, dan naik sampai level sepuluh." },
      { type: "list", title: "Challenge-nya", items: ["Streak catat 7 hari", "Setoran tabungan pertama", "Pasang budget pertama"], say: "Mulai dari catat tujuh hari berturut-turut, setoran tabungan pertama, sampai pasang budget." },
      { type: "cta", text: "Level berapa kamu?", button: "Coba gratis 14 hari", say: "Coba gratis, dan follow untuk update fitur!" },
    ],
    caption: "Siapa bilang ngatur uang ngebosenin? 🎮 Naik level sambil rapiin keuangan!",
    hashtags: ["#gamification", "#aplikasikeuangan", "#catatankeuangan", "#produktif", "#leosiqra"],
  },
];

export const FALLBACK_CAPTION_TAIL =
  "\n\n📲 Coba gratis 14 hari di leosiqra.com — tanpa kartu kredit.\nIG: @leosiqra_official · YouTube: Leosiqra";

// Video NILAI tidak beriklan di caption — cukup identitas akun.
export const VALUE_CAPTION_TAIL = "\n\nFollow @leosiqra_official buat hitung-hitungan uang tiap hari 💸";

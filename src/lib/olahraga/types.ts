// Olahragaku — tipe bersama (web, app HP, Worker). Lihat docs/rancangan/olahragaku.md.

export const METODE_KEYS = [
  'isi-piringku',
  'porsi-tangan',
  'makan-sadar',
  'kurangi-gula',
  'minim-olahan',
  'defisit-seimbang',
  'tinggi-protein',
  'volume-eating',
  'rendah-karbo',
  'jendela-12-12',
  'jendela-14-10',
  'jendela-16-8',
  'jendela-18-6',
  'jendela-20-4',
  'puasa-5-2',
  'omad',
  'mediterania',
  'dash',
  'nabati',
  'keto',
] as const;
export type MetodeKey = (typeof METODE_KEYS)[number];

export type Kelompok = 'tanpa-hitung' | 'hitung-kalori' | 'puasa' | 'pola-makan';
export type Tingkat = 'pemula' | 'menengah' | 'lanjut';

// Pertanyaan setelah membaca penjelasan. Dinilai dengan aturan (tanpa AI).
export type Pertanyaan =
  | {
      id: string;
      jenis: 'sanggup'; // jawaban: 'ya' | 'mungkin' | 'tidak' — tidak ada jawaban salah
      teks: string;
      inti: boolean; // true: jawaban "tidak" = belum cocok; false: "tidak" = cocok dengan catatan
      bilaTidak: string; // alasan yang ditampilkan kalau dijawab "tidak"
    }
  | {
      id: string;
      jenis: 'paham'; // ada jawaban benar; salah → tampilkan penjelasan (tidak menggagalkan)
      teks: string;
      pilihan: string[]; // 3 pilihan
      benar: number; // indeks pilihan yang benar
      penjelasan: string;
    };

export type Metode = {
  key: MetodeKey;
  nama: string;
  kelompok: Kelompok;
  tingkat: Tingkat;
  hitungKalori: boolean;
  jendela?: { puasa: number; makan: number }; // jam; hanya untuk metode jendela makan
  emoji: string;
  ringkas: string; // 1 kalimat untuk kartu daftar
  caraKerja: string[]; // 2–4 paragraf pendek bahasa awam
  contohHari: { jam: string; isi: string }[]; // contoh jadwal makan sehari (menu lokal Indonesia)
  kelebihan: string[]; // 3–4
  tantangan: string[]; // 3–4
  hasilRealistis: string; // perkiraan hasil jujur, tanpa janji
  bilaMungkin: string; // saran tahap kalau ada jawaban "mungkin" (cocok dengan catatan)
  catatan?: string; // fakta tambahan, mis. siapa yang mempopulerkan (tanpa kesan endorse)
  pertanyaan: Pertanyaan[]; // 4–6, minimal 1 'paham'
  alternatif: [MetodeKey, MetodeKey]; // 2 metode terdekat yang lebih ringan
};

export const KONDISI = [
  { key: 'jantung', label: 'Penyakit jantung / pernah nyeri dada' },
  { key: 'pingsan', label: 'Pernah pingsan atau pusing berat saat olahraga' },
  { key: 'tensi', label: 'Tekanan darah tinggi' },
  { key: 'diabetes_obat', label: 'Diabetes yang pakai obat atau insulin' },
  { key: 'diabetes', label: 'Gula darah tinggi / diabetes tanpa obat' },
  { key: 'ginjal', label: 'Penyakit ginjal' },
  { key: 'maag', label: 'Maag / GERD berat' },
  { key: 'gangguan_makan', label: 'Pernah punya gangguan makan (makan berlebihan, memuntahkan, dll.)' },
  { key: 'hamil', label: 'Sedang hamil atau menyusui' },
  { key: 'sendi', label: 'Nyeri lutut, pinggang, atau punggung' },
] as const;
export type KondisiKey = (typeof KONDISI)[number]['key'];

export const AKTIVITAS = [
  { key: 'duduk', label: 'Banyak duduk', sub: 'Kerja kantoran, jarang jalan', faktor: 1.2 },
  { key: 'ringan', label: 'Ringan', sub: 'Jalan kaki sesekali, olahraga 1–2×/minggu', faktor: 1.375 },
  { key: 'aktif', label: 'Aktif', sub: 'Olahraga 3–5×/minggu atau kerja banyak bergerak', faktor: 1.55 },
  { key: 'sangat', label: 'Sangat aktif', sub: 'Olahraga berat hampir tiap hari / kerja fisik', faktor: 1.725 },
] as const;
export type AktivitasKey = (typeof AKTIVITAS)[number]['key'];

export type Pengalaman = 'belum' | 'pernah' | 'rutin';
export type Alat = 'tanpa' | 'dumbbell' | 'gym';

export type FitProfile = {
  sex: 'l' | 'p'; // sama dengan healthProfile Sehatku › Cek
  birthYear: number;
  heightCm: number;
  weightKg: number; // berat terakhir (juga dicatat di fit_weights)
  waistCm: number | null;
  activity: AktivitasKey;
  goalKg: number | null;
  conditions: KondisiKey[];
  equipment: Alat;
  experience: Pengalaman;
};

// ── Gerakan (perpustakaan latihan, rilis 2) ───────────────────────────────────
export type GerakanKategori = 'kardio' | 'kekuatan' | 'kelenturan';
export type GerakanAlat = 'tanpa' | 'kursi' | 'dumbbell' | 'gym';
export type Gerakan = {
  key: string; // kebab-case, unik
  nama: string;
  emoji: string;
  kategori: GerakanKategori;
  otot: string; // bagian tubuh utama, bahasa awam ("paha & bokong")
  alat: GerakanAlat; // alat minimal yang dibutuhkan
  tingkat: Tingkat;
  lowImpact: boolean; // tanpa lompatan/benturan — aman untuk lutut & IMT tinggi
  duduk: boolean; // bisa dilakukan sambil duduk di kursi
  satuan: 'ulang' | 'detik' | 'menit';
  bawaan: { set: number; jumlah: number }; // dosis pemula (jumlah = ulangan/detik/menit per set)
  met: number; // perkiraan MET (kkal = MET × kg × jam)
  cara: string[]; // 3–5 langkah
  tips: string; // 1 kalimat kesalahan umum / cara lebih mudah
  hindariKalau: KondisiKey[]; // kondisi yang membuat gerakan ini sebaiknya dilewati
  gambar?: string; // /olahraga/gerakan/<key>.webp (ilustrasi sendiri, menyusul)
};

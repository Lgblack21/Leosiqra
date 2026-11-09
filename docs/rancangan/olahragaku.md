# Rancangan — Olahragaku (diet + olahraga + coach AI)

Status: **DI-ACC Bos 2026-11-09** (jawaban bagian 9). R1 + R2 live (3.26.0). **R3 (3.27.0) di branch, belum deploy**: shift kerja, menu harian, evaluasi, tanya coach, pengingat, ilustrasi (admin) + YouTube.
Keputusan Bos yang sudah ada (chat 2026-11-09):

1. Halaman baru **Olahragaku**; Makanku pindah ke sini. **Sehatku** tinggal Cek + Asuransi.
2. User **FREE boleh** masuk (bagian non-AI). Bagian AI khusus PRO + koin.
3. Harga: program AI **5.000 koin**, evaluasi mingguan **1.500 koin**, tanya coach **300 koin** (di luar jatah).
4. Banyak metode diet (20) — tiap metode ada **penjelasan → pertanyaan → hasil cocok/tidak**.
5. Wajib ada data **berat, tinggi, umur** supaya AI bisa mengevaluasi.

---

## 1. Struktur halaman

Rute: `/membership/olahraga` (web) dan `/app/olahraga` (HP). Fitur id baru `olahraga`
(`src/lib/features.ts`, `fiturCatalog.ts`, `/app/more`). Tab (hash seperti Sehatku):

| Tab | Isi | FREE | PRO |
|---|---|---|---|
| **Program** | Profil tubuh, angka (IMT, kalori), metode aktif, progres ke target, kartu coach | ✅ (tanpa AI) | ✅ + AI |
| **Makan** | Makanku yang sekarang (komponen dipindah, API & tabel `meals` TIDAK berubah) + tanda sesuai metode (di luar jendela makan, protein kurang) | ✅ jatah AI 1/hari | ✅ 10/hari |
| **Latihan** | Rencana latihan hari ini, perpustakaan gerakan bergambar, catat latihan | ✅ | ✅ |
| **Progres** | Timbangan & lingkar perut, grafik vs garis target, riwayat program | 7 hari terakhir | ✅ semua |

Sehatku: tab `makan` dihapus; `/membership/sehat#makan` → redirect ke `/membership/olahraga#makan`
(tautan lama & notifikasi tetap jalan). Alias fitur lama `makan` → `olahraga` (sekarang → `sehat`).
**Keputusan Bos:** user yang sekarang menyalakan Sehatku otomatis dapat Olahragaku juga? (usul: ya, supaya
Makanku tidak "hilang" dari menunya).

## 2. Profil tubuh & hitungan (tanpa AI, rumus tetap)

Diisi sekali saat masuk pertama (wizard 4 langkah), bisa diubah. Berat/tinggi/lingkar perut **diisi otomatis
dari cek "status gizi" terakhir di Sehatku** (`health_checks.results_json` bb/tb/lp) kalau ada.

Data: jenis kelamin, tahun lahir, tinggi (cm), berat (kg), lingkar perut (opsional), aktivitas
(duduk / ringan / aktif / sangat aktif), target berat, kondisi kesehatan (checklist), alat (tanpa alat /
dumbbell / gym), pengalaman puasa & olahraga (belum pernah / pernah / rutin).

`src/lib/olahraga/hitung.ts` (dipakai web, HP, dan Worker — pola sama dengan `src/lib/creditCycle.ts`):

- **IMT** = kg / m², kategori **Kemenkes (P2PTM)** memakai `bmiClass` yang sudah ada di
  `src/lib/healthChecks.ts` (sama dengan tab Cek): <18,5 kurus · 18,5–25,0 normal · >25,0–27,0 gemuk ·
  >27,0 obesitas. Untuk keamanan latihan dipakai batas tambahan IMT ≥ 30 (obesitas berat).
- **Lingkar perut berisiko**: pria ≥90 cm, wanita ≥80 cm.
- **BMR** Mifflin-St Jeor: 10·kg + 6,25·cm − 5·umur + 5 (pria) / −161 (wanita).
- **TDEE** = BMR × 1,2 / 1,375 / 1,55 / 1,725.
- **Target kalori** = TDEE − defisit; defisit default 500 kkal (pemula/obesitas II boleh 300–750).
  **Batas bawah keras**: 1.200 kkal (wanita) / 1.500 kkal (pria), dan tidak di bawah BMR × 1,0 untuk yang
  aktif. Laju turun maksimal **1% berat badan / minggu**.
- **Protein** target 1,2–1,6 g/kg berat target.
- **Perkiraan tanggal capai target** dari defisit (7.700 kkal ≈ 1 kg), ditampilkan sebagai rentang, bukan janji.

Semua angka ini dihitung di kode (konsisten & gratis). AI hanya **membaca** angka ini.

## 3. Keamanan (wajib, berlaku untuk FREE & PRO)

Checklist kondisi (gaya PAR-Q): penyakit jantung/nyeri dada, tekanan darah tinggi, diabetes (pakai obat/insulin
atau tidak), penyakit ginjal, maag/GERD berat, riwayat gangguan makan, hamil/menyusui, nyeri lutut/punggung,
pernah pingsan saat olahraga, umur < 18 atau ≥ 65.

| Kondisi | Akibat |
|---|---|
| Jantung / nyeri dada / pingsan saat olahraga | Banner "cek dokter dulu"; latihan hanya jalan santai & latihan kursi; program AI tetap boleh tapi dikunci intensitas rendah |
| Diabetes pakai obat/insulin | Semua puasa ≥16 jam, 5:2, OMAD, Keto **terkunci**; Rendah Karbo hanya dengan banner dokter |
| Ginjal | Tinggi Protein & Keto terkunci |
| Maag/GERD berat | 18:6, 20:4, OMAD, 5:2 terkunci |
| Riwayat gangguan makan | Semua puasa & hitung kalori ketat terkunci; hanya Isi Piringku, Makan Sadar, Porsi Tangan |
| Hamil/menyusui | Tidak ada defisit kalori: hanya Isi Piringku + Makan Sadar + aktivitas ringan |
| Umur < 18 | Sama seperti hamil (tidak ada program penurunan berat) |
| Nyeri lutut/punggung, IMT ≥ 30 | Latihan low-impact saja (tanpa lompat), ada versi kursi |

Aturan kunci ada di `src/lib/olahraga/rules.ts` dan **diperiksa ulang di Worker** saat memulai program
(klien bukan batas kepercayaan). AI diberi aturan yang sama + output divalidasi (kalori di bawah batas
bawah → ditolak/di-clamp). Disclaimer tetap di halaman: "bukan pengganti dokter atau ahli gizi".
Tidak ada klaim medis ("menyembuhkan diabetes", dll.) di teks maupun promosi.

## 4. Metode diet (20) — penjelasan → pertanyaan → hasil

Isi statis di `src/lib/olahraga/metode.ts` (bahasa awam). Per metode:
`ringkas`, `caraKerja`, `contohHari` (jadwal makan sehari), `kelebihan[]`, `tantangan[]`, `hasilRealistis`,
`tidakUntuk[]` (otomatis dari rules), `tingkat` (pemula/menengah/lanjut), `butuhHitungKalori`,
`pertanyaan[]` (4–6), `alternatif[]` (2 metode terdekat).

| # | Metode | Kelompok | Tingkat |
|---|---|---|---|
| 1 | Isi Piringku (Kemenkes) | Tanpa hitung | Pemula |
| 2 | Porsi Tangan | Tanpa hitung | Pemula |
| 3 | Makan Sadar (mindful eating) | Tanpa hitung | Pemula |
| 4 | Kurangi Gula | Tanpa hitung | Pemula |
| 5 | Minim Makanan Olahan | Tanpa hitung | Pemula |
| 6 | Defisit Kalori Seimbang | Hitung kalori | Pemula |
| 7 | Tinggi Protein | Hitung kalori | Menengah |
| 8 | Volume Eating | Hitung kalori | Pemula |
| 9 | Rendah Karbo (moderat) | Hitung kalori | Menengah |
| 10 | Jendela Makan 12:12 | Puasa | Pemula |
| 11 | Jendela Makan 14:10 | Puasa | Pemula |
| 12 | Jendela Makan 16:8 | Puasa | Menengah |
| 13 | Jendela Makan 18:6 | Puasa | Lanjut |
| 14 | Jendela Makan 20:4 ("dipopulerkan di Indonesia lewat OCD" — hanya di teks penjelasan) | Puasa | Lanjut |
| 15 | 5:2 | Puasa | Lanjut |
| 16 | OMAD 23:1 | Puasa | Lanjut |
| 17 | Mediterania | Pola makan | Pemula |
| 18 | DASH (tensi tinggi) | Pola makan | Pemula |
| 19 | Nabati / Vegetarian | Pola makan | Menengah |
| 20 | Keto | Pola makan | Lanjut |

Sengaja **tidak** dimasukkan: diet golongan darah, detoks jus, mono-diet, kalori sangat rendah (<800 kkal)
tanpa dokter.

**Nama & merek:** tidak memakai nama/foto Deddy Corbuzier atau "OCD" sebagai nama fitur, tombol, atau bahan
promosi (kesan endorse). Penyebutan faktual di teks penjelasan saja. Tim Konten/CEO juga mengikuti ini.

**Tingkat lanjut** terbuka kalau: (a) sudah ≥ 14 hari di metode pemula/menengah dengan ≥ 70% hari tercatat,
atau (b) profil "rutin puasa/olahraga" — tetap tunduk ke kunci kondisi (bagian 3).

### Pertanyaan setelah membaca
Dua jenis, dinilai dengan aturan (tanpa AI, gratis):
- **Kesanggupan** (jujur, tidak ada jawaban salah) — mis. 16:8: "Kamu sanggup tidak makan dari 20.00 sampai
  12.00?" (Sanggup / Mungkin bisa dicoba / Tidak) · "Jam kerjamu shift malam?" · "Sering lemas kalau telat makan?"
- **Pemahaman** (ada jawaban benar, penjelasan muncul kalau salah) — mis. "Saat jendela tutup, minuman apa yang
  boleh?" (Air putih, teh/kopi tanpa gula ✅ · Jus · Teh manis).

Hasil:
- ✅ **Cocok** — semua kesanggupan "Sanggup", pemahaman benar → "Mulai program ini".
- ⚠️ **Cocok dengan catatan** — ada "Mungkin" → saran tahap (mis. "mulai 14:10 dua minggu, lalu 16:8").
- ❌ **Belum cocok** — ada "Tidak" pada syarat inti atau terkena kunci kondisi → alasan + 2 alternatif.
Jawaban disimpan (`quiz_json`) supaya coach AI tahu kenapa metode itu dipilih.

## 5. Latihan & gambar

Program latihan (pola sama dengan metode: penjelasan → pertanyaan → cocok/tidak): Jalan Kaki Pemula,
Latihan Kursi, Bodyweight di Rumah, Kardio Ringan (sepeda statis/renang), Beban Pemula di Gym,
Peregangan & Mobilitas. Latihan hari ini = daftar gerakan + set/repetisi/durasi, tombol "Selesai" →
catat ke `fit_workouts` (perkiraan kkal dari MET × kg × jam).

**Sumber gerakan & gambar — hasil cek lisensi (2026-11-09):**
- `free-exercise-db` (yuhonas, 876 gerakan, JSON + foto): repo berlabel **Unlicense**, tapi datanya diambil dari
  `wrkout/exercises.json`, yang README-nya mengarahkan **proyek komersial** ke dataset berbayar wrkout.xyz dan
  tidak punya file LICENSE. Asal foto tidak jelas → **tidak aman untuk aplikasi berbayar** seperti Leosiqra.
- `wger`: lisensi gambar per gambar (umumnya CC-BY-SA, wajib kredit & share-alike) — bisa, tapi campur aduk.
- ExerciseDB (RapidAPI): GIF bagus, berbayar per bulan & ketentuan pemakaian ulang ketat.

**Usul:** buat **perpustakaan sendiri ±40 gerakan inti** (yang memang dipakai pemula/obesitas: jalan, march
di tempat, squat kursi, push-up dinding, bridge, plank lutut, dll.) dengan teks Indonesia buatan kita dan
**ilustrasi sendiri** satu gaya (dibuat sekali pakai model gambar yang sudah dipakai Cerita, ±Rp650/gambar,
2 gambar per gerakan ≈ Rp52 ribu sekali bayar; disimpan di R2/`public`). Aman lisensi, gaya senada Leosiqra,
tanpa biaya per panggilan. Bisa ditambah bertahap.

## 6. Coach AI (PRO + koin)

Semua lewat Worker, model `google/gemini-2.5-flash` (fallback flash-lite). Gerbang PRO pakai `isProUser`
(cek `expired_at` — pelajaran 2026-11-07: `users.plan` tidak turun saat PRO habis).

| Fitur | Harga | Input ke AI | Output |
|---|---|---|---|
| Program 4 minggu | 5.000 koin | profil + hitungan + metode + jawaban kuis + alat + kondisi | JSON: jadwal makan contoh per hari (menu lokal), target kalori/protein, latihan per hari, tips minggu 1–4 |
| Evaluasi mingguan | 1.500 koin | ringkasan 7 hari: makan (kkal/protein per hari dari `meals`), latihan, timbangan, kepatuhan jendela makan | JSON: skor, 3 hal bagus, 3 perbaikan, penyesuaian target (dibatasi aturan) |
| Tanya coach | jatah PRO 3/hari gratis, lalu 300 koin | pertanyaan + ringkasan profil & program aktif | teks pendek |

Perkiraan biaya model (harga OpenRouter Gemini 2.5 Flash $0,30/M input, $2,50/M output, kurs ±Rp16.500;
cek ulang saat implementasi): program ±5k in + 8k out ≈ Rp360 · evaluasi ±10k in + 2k out ≈ Rp130 ·
tanya ±4k in + 0,6k out ≈ Rp45. Margin sehat; harga koin bisa diubah tanpa migrasi (konstanta Worker).

Pemotongan koin pakai pola `withMealCharge`: debit atomik bersyarat saldo **sebelum** panggil model, `idem_key`
dari request id klien (klik ganda tidak potong dua kali), refund **hanya** kalau gagal sebelum model dipanggil
atau provider gangguan (pelajaran audit 07-11 & 08-11: respons 422 setelah model dipanggil = sudah ditagih).
`coin_ledger.kind` baru: `fit_program`, `fit_eval`, `fit_ask`.
Output AI divalidasi skema; angka kalori/defisit di-clamp ke aturan bagian 2–3; teks disaring (tanpa HTML).

## 7. Data (migrasi `0044_olahraga.sql`, additive)

```sql
CREATE TABLE IF NOT EXISTS fit_profiles (
  user_id TEXT PRIMARY KEY, sex TEXT, birth_year INTEGER, height_cm REAL, activity TEXT,
  goal_kg REAL, conditions_json TEXT, equipment TEXT, experience TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fit_weights (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, kg REAL NOT NULL, waist_cm REAL,
  created_at TEXT NOT NULL, UNIQUE(user_id, date)
);
CREATE TABLE IF NOT EXISTS fit_programs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, diet_key TEXT NOT NULL, workout_key TEXT,
  status TEXT NOT NULL DEFAULT 'aktif', quiz_json TEXT, plan_json TEXT, ai INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL, ended_at TEXT, end_reason TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_programs_active ON fit_programs(user_id) WHERE status = 'aktif';
CREATE TABLE IF NOT EXISTS fit_workouts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, program_id TEXT, kind TEXT NOT NULL,
  minutes INTEGER, kcal INTEGER, items_json TEXT, note TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fit_workouts_user_date ON fit_workouts(user_id, date);
CREATE TABLE IF NOT EXISTS fit_coach (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, week_start TEXT, program_id TEXT,
  input_json TEXT, result_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_coach_week ON fit_coach(user_id, kind, week_start) WHERE kind = 'eval';
```

- Data kesehatan = data sensitif: semua query `AND user_id = ?` sesi; tidak dikirim ke tempat lain selain
  model AI saat user menekan tombol berbayar; "Hapus data Olahragaku" menghapus semua `fit_*` milik user;
  hapus akun ikut menghapus. Kebijakan privasi ditambah poin ini.
- Program aktif maks 1 per user (index unik parsial) → ganti metode = tutup yang lama (`end_reason`) lalu buat
  baru dalam satu batch.
- Tanpa migrasi (sebelum Bos menjalankan 0044): GET → `ready:false`, simpan → 503, profil & hitungan tetap
  jalan di perangkat (localStorage) seperti Kanvas/Pajak.

Endpoint (semua `requireSession`, `/api/member/fit/*`): `GET/PUT profile`, `GET/POST/DELETE weights`,
`GET/POST programs` (+ `POST programs/:id/end`), `GET/POST/DELETE workouts`, `POST coach/program`,
`POST coach/eval`, `POST coach/ask`, `GET coach`, `DELETE all`.

## 8. Rilis bertahap

| Rilis | Isi | SQL |
|---|---|---|
| **R1** | Halaman Olahragaku (web + HP), pindah Makanku, Sehatku jadi Cek + Asuransi, profil & hitungan, 20 metode + pertanyaan + mulai program (template non-AI), catat berat & latihan, grafik | 0044 |
| **R2** | Perpustakaan ±40 gerakan + ilustrasi, program latihan + "latihan hari ini", tanda metode di tab Makan | — |
| **R3** | Coach AI: program 4 minggu, evaluasi mingguan, tanya coach (koin), pengingat jendela makan (push, ikut toggle notifikasi) | — |

Tiap rilis: tsc, build, uji lokal (wrangler dev + D1 lokal, Playwright web 1280 & HP 390), security-check untuk
endpoint baru, lalu minta "gas".

## 9. Keputusan Bos (2026-11-09)

1. Belum ada member yang memakai Makanku → cukup dipindah, tanpa migrasi fitur/alias khusus.
2. **FREE hanya sampai membaca penjelasan metode** (+ kuis kecocokan, tanpa AI, gratis — tafsiran dev, bisa
   diubah). **Mengikuti metode = PRO + koin**: memulai program = program 4 minggu dibuat AI (5.000 koin).
   Tidak ada "template non-AI" untuk FREE.
3. Gambar gerakan: ilustrasi sendiri ±40 gerakan.
4. Tanya coach: jatah PRO 3/hari gratis, lalu 300 koin.

Akibat ke rilis: **R1** = halaman + pindah Makanku + profil & hitungan + 20 metode (penjelasan & kuis) +
catat berat. **R2** = mulai program (PRO + 5.000 koin, AI) + latihan & gambar. **R3** = evaluasi mingguan,
tanya coach, pengingat jendela makan.

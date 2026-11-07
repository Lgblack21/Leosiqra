# Catatan Rilis Leosiqra

Satu nomor versi untuk seluruh produk (web `/membership`, app HP `/app`, Worker, APK).
Sumbernya cuma satu: `"version"` di `package.json`. Angka itu otomatis tampil di
Pengaturan (web) dan Profil (app HP) sebagai `v3.1.0 · build 147`.

## Arti angka `X.Y.Z`

| Bagian | Naik kalau… | Contoh |
|---|---|---|
| **X** (major) | Perubahan besar yang mengubah cara pakai: desain ulang menyeluruh, pindah fondasi teknis, data/akun perlu dipindah, fitur lama dihapus. Keputusan Bos. | 3.4.2 → 4.0.0 |
| **Y** (minor) | Ada fitur baru atau perubahan yang terasa user. | 3.1.0 → 3.2.0 |
| **Z** (patch) | Perbaikan bug, keamanan, kecepatan, perapian kode — tanpa fitur baru. | 3.1.0 → 3.1.1 |

**Build** (`· build 147`) = nomor run workflow *Deploy main*, naik sendiri tiap deploy.
Jadi deploy kecil berkali-kali tidak wajib menaikkan versi; build-nya yang membedakan.

## Alur rilis

1. Kerjakan di branch `claude/…` seperti biasa.
2. Sebelum minta "gas", naikkan versi di branch itu:
   `npm run versi -- patch|minor|major "ringkasan"` → `package.json`, `package-lock.json`,
   dan kerangka catatan di file ini ikut berubah. Lengkapi catatannya (bahasa user, bukan
   bahasa kode), commit. Beberapa branch yang di-deploy bersamaan cukup satu kenaikan versi.
3. Bos bilang "gas" → merge ke `main` → workflow *Deploy main*.
4. Setelah live, workflow otomatis membuat tag & GitHub Release `vX.Y.Z` (isi = catatan
   versi itu dari file ini) dan mengabari Telegram dengan versi + build. Kalau versinya
   sudah pernah dirilis (tidak dinaikkan), tag tidak dibuat ulang — Telegram menyebutnya.
5. Versi lama / catatan yang diubah: jalankan workflow *Sinkron Release* — membuat Release yang belum
   ada (commit versi lama di `.github/release-targets.txt`) dan memperbarui catatan Release yang sudah ada.
6. APK Android (*Rilis APK Android*) memakai versi yang sama dari `package.json`; APK
   ditempel ke Release `vX.Y.Z` yang sudah ada. APK hanya perlu dibuat ulang kalau bagian
   native berubah (isi app HP ikut web, update sendiri tanpa APK baru).

## Peta versi

| Versi | Tanggal | Tonggak |
|---|---|---|
| 1.0.0 | 16 Apr 2026 | Aplikasi pertama (Firebase) |
| 2.0.0 | 22 Apr 2026 | Pindah ke Cloudflare (Worker + D1), login sendiri |
| 2.1.0 | 14 Jul 2026 | Audit keamanan, login Google, dashboard/investasi/pajak dibenahi |
| 2.2.0 | 22 Jul 2026 | Input Cepat, PWA, logo baru, login username |
| 2.3.0 | 29 Jul 2026 | Transaksi berulang otomatis, tabungan otomatis, impor mutasi, insight AI |
| 2.4.0 | 9 Agu 2026 | Aplikasi HP (Android/iOS) dengan tampilan khusus HP |
| 3.0.0 | 27 Sep 2026 | Desain ulang total web, landing & login; Input Cepat pintar |
| 3.0.1 | 27 Okt 2026 | Menu Profil baru, nomor versi mulai tampil di aplikasi |
| 3.0.2 | 3 Nov 2026 | APK Android pertama di GitHub Releases |
| 3.1.0 | 7 Nov 2026 | Usahaku, Koin, Cerita Hari Ini, Fokus bareng Leo, dan lainnya |
| 3.1.1 | 7 Nov 2026 | Perapian kode menyeluruh, validasi kategori transaksi |
| 3.1.2 | 7 Nov 2026 | Pesan jelas saat rekening belum dipilih |
| 3.1.3 | 7 Nov 2026 | Catatan stok tim lebih aman |
| 3.2.0 | 7 Nov 2026 | Halaman Riwayat versi |
| 3.3.0 | 7 Nov 2026 | Makanku & Leo di tiap fitur |
| 3.3.1 | 7 Nov 2026 | Makanku jadi Sehatku, layar penuh |
| 3.4.0 | 7 Nov 2026 | Analisis makanan dari ketikan & bayar koin |
| 3.5.0 | 7 Nov 2026 | Sehatku › Asuransi |
| 3.5.1 | 7 Nov 2026 | Leo beda di tiap tab Sehatku |
| 3.6.0 | 7 Nov 2026 | Sehatku › Cek |
| 3.6.1 | 8 Nov 2026 | Nama Leosiqra beranimasi |
<!-- peta-baru -->

Versi 1.0.0–3.0.2 disusun ulang dari riwayat git pada 7 Nov 2026: dulu angka versi tidak
dinaikkan per fitur (package.json loncat dari 0.1.0 ke 3.0.1), jadi tiap versi lama
mewakili satu era, bukan satu deploy. Tag & GitHub Release versi lama menunjuk ke commit
terakhir di `main` pada tanggal versi itu (3.0.1 & 3.1.0: commit yang menaikkan versinya).

Catatan di bawah tampil juga di aplikasi (Pengaturan › Riwayat versi, app HP: Profil ›
versi), jadi tulis dengan bahasa user. Format tiap entri:
`## X.Y.Z — YYYY-MM-DD — Judul singkat`, lalu daftar poin (`- `); baris lanjutan
menjorok 2 spasi; **tebal** dan `kode` boleh.

<!-- rilis-baru -->

## 3.6.1 — 2026-11-08 — Nama Leosiqra beranimasi

- Nama **Leosiqra** di menu samping kini beranimasi: hurufnya muncul satu per satu, kilau warna lewat sesekali, dan
  bergelombang saat disorot. Mati otomatis kalau perangkatmu memakai pengaturan "kurangi gerakan".

## 3.6.0 — 2026-11-07 — Sehatku › Cek

- Tab **Cek** di Sehatku:
  - **Rapor cek tahunanmu** — berapa cek rutin yang masih berlaku, mana yang belum pernah atau sudah lewat setahun.
  - **Cek rutin** sesuai usia & jenis kelaminmu, mengikuti isi paket Cek Kesehatan Gratis (CKG) dari petunjuk teknis
    resmi Kemenkes 2026: tekanan darah, gula darah, status gizi, TBC, kanker (sesuai usia), mata, telinga, gigi, jiwa,
    hepatitis, dan lainnya. Catat tanggal, tempat, hasil, dan biayanya — biaya otomatis masuk ke biaya kesehatan.
  - **Pengingat** seminggu sebelum genap setahun dari cek terakhir.
  - **Cek Kesehatan Gratis**: cara daftar (SATUSEHAT Mobile / WA Chatbot Kemenkes), persiapan, dan yang perlu dibawa.
  - **Kartu vaksinku** — catat dosis vaksin dewasa yang sudah kamu terima.

## 3.5.1 — 2026-11-07 — Leo beda di tiap tab Sehatku

- Sehatku punya tiga Leo berbeda, masing-masing dengan materi & pertanyaan sendiri: **Leo si Koki** (Makan),
  **Leo si Pelindung** berperisai biru (Asuransi: polis, premi, klaim), dan **Leo si Dokter** dengan stetoskop (Cek:
  cek kesehatan rutin). Obrolan dengan Leo terpisah per tab.

## 3.5.0 — 2026-11-07 — Sehatku › Asuransi

- Tab **Asuransi** di Sehatku:
  - **Biaya kesehatan tahun ini** — total & grafik per bulan dari transaksi kategori Kesehatan, rincian obat/dokter/
    RS/lab/premi, dan tombol **Catat biaya kesehatan** langsung dari halaman ini.
  - **Polisku** — kartu asuransi bergaya kartu fisik (warna & logo perusahaan) yang bisa digeser. Simpan BPJS, asuransi swasta, atau dari kantor: premi, periode, jatuh tempo, uang pertanggungan,
    nomor polis (hanya kamu yang lihat), plus catatan pribadi (agen, cara klaim, RS langganan). Pengingat H-3 & H-1
    sebelum premi jatuh tempo. **Bayar premi** mencatat pengeluaran dan memajukan jatuh tempo otomatis.
  - **Klaim** — lacak reimburse Diajukan → Disetujui → Cair; saat cair, uangnya langsung tercatat sebagai pemasukan.
  - **Kenali asuransinya** — grid logo 23 perusahaan asuransi + BPJS (logo resmi dari situs masing-masing, inisial bila
    belum tersedia): call center, WhatsApp, email, jam layanan, tautan cara klaim
    & RS rekanan yang dibaca dari situs resminya (dengan tanggal baca), iuran BPJS Kesehatan, tombol **Ini asuransiku**.
- Leo si Perawat di tab Asuransi: materi singkat & tanya-jawab soal asuransi dan biaya berobat.

## 3.4.0 — 2026-11-07 — Analisis makanan dari ketikan & bayar koin

- Sehatku › Makan: Leo kini juga bisa menghitung kalori, protein, karbohidrat, dan lemak **dari ketikan** — tulis
  menunya (mis. "nasi goreng telur + es teh manis") lalu tekan **Hitung pakai Leo**. Catatan lama juga bisa dihitung
  ulang.
- Analisis makanan (foto atau ketikan) gratis 1× per hari (PRO 10×). Setelah itu 200 koin per analisis; kalau
  analisisnya gagal, jatah atau koinnya otomatis dikembalikan.

## 3.3.1 — 2026-11-07 — Makanku jadi Sehatku, layar penuh

- Makanku kini jadi tab **Makan** di fitur baru **Sehatku** — layar penuh seperti Ladangku, dengan menu
  melayang di bawah. Tab Asuransi dan Cek sudah terlihat dan segera hadir. Alamat lama otomatis dialihkan.

## 3.3.0 — 2026-11-07 — Makanku & Leo di tiap fitur

- Fitur baru **Makanku**: foto piringmu, Leo mengenali menunya lalu menaksir kalori, protein, karbohidrat, dan
  lemak, plus skor keseimbangan gizi dan satu tips kecil. Harga (perkiraan Leo, bisa diubah) bisa langsung dicatat
  sebagai pengeluaran Makanan & Minuman dari rekening pilihanmu. Ada lingkaran kalori vs target harian, grafik
  Minggu ini, total belanja makan, dan hari beruntun. Bisa juga catat manual tanpa foto. Analisis foto: FREE 3×,
  PRO 30× per hari.
- **Leo di tiap fitur:** tombol Leo di Makanku, Cerita Hari Ini, Fokus, Ladangku, dan Investasiku kini membuka
  popup — Leo dengan gaya berbeda per halaman, materi singkat, pertanyaan yang pas, dan obrolan langsung di
  halaman itu tanpa pindah ke AI Leo.

## 3.2.0 — 2026-11-07 — Halaman Riwayat versi

- Halaman baru **Riwayat versi**: semua versi Leosiqra dari 1.0.0 sampai sekarang dalam satu timeline,
  dikelompokkan per generasi, lengkap dengan apa yang baru di tiap versi. Buka dari Pengaturan › Riwayat versi
  (web) atau ketuk nomor versi di Profil (app HP).
- Catatan rilis semua versi lama dirapikan supaya enak dibaca.

## 3.1.3 — 2026-11-07 — Catatan stok tim lebih aman

- Usahaku › Stok: akun tim hanya bisa membatalkan catatan stok yang benar-benar dibuat akunnya sendiri.
  Dulu dicocokkan dari nama, jadi akun tim baru yang namanya sama bisa membatalkan catatan akun tim lama.

## 3.1.2 — 2026-11-07 — Pesan jelas saat rekening belum dipilih

- Mencatat transaksi tanpa memilih rekening kini ditolak dengan pesan jelas ("Rekening wajib dipilih."),
  bukan "Terjadi kesalahan pada server.".

## 3.1.1 — 2026-11-07 — Perapian kode & perbaikan kecil

- Nomor versi & build tampil di Pengaturan dan Profil app HP (`v3.1.1 · build N`).
- Mencatat transaksi tanpa kategori kini ditolak dengan pesan jelas ("Kategori wajib dipilih."),
  bukan "Terjadi kesalahan pada server.".
- Di balik layar: seluruh kode dirapikan (format seragam, komentar yang tidak perlu dibuang).
  Tampilan dan perilaku aplikasi tidak berubah — sudah dibandingkan halaman per halaman.

## 3.1.0 — 2026-11-07 — Usahaku, Koin, Cerita, Fokus & banyak lagi

- **Usahaku:** kasir untuk semua jenis usaha (katalog berkategori, struk, data pembeli), stok bahan & resep,
  akun tim kasir dengan login sendiri, sambungkan website (penjualan tercatat otomatis), update harga manual
  atau dari website, logo & gambar kategori, tampilan kasir bisa diatur — termasuk lewat AI milikmu.
- **Ladangku:** jual barang nganggur (taksir harga + tulis iklan), Tagih (ingatkan lewat WA, Patungan, Nyicil).
- **Koin Leo:** satu jenis koin yang bisa dibeli, ditukar PRO atau fitur AI; kuota AI harian FREE vs PRO;
  halaman pembayaran lebih rapi.
- **Fitur baru:** Cerita Hari Ini (jurnal dengan mood, foto, ilustrasi AI, dan kalender), Fokus bareng Leo
  (timer fokus, musik, latihan napas), Koleksiku (kartu Pokémon, inventaris Steam CS2), Barangku (barang milik
  + garansi), Langgananku (pantau langganan + Radar).
- **Keuangan:** Skor Kesehatan Finansial, jatuh tempo hutang/piutang + pengingat H-3 & H-1, pengingat anggaran
  & tagihan rutin, pengingat sebelum masa PRO/coba habis.
- **App HP:** tag transaksi, tabungan bergaya web, login tidak perlu diulang, beli/jual investasi & transfer
  tidak lagi dihitung pemasukan/pengeluaran.
- Mode gelap untuk lebih banyak halaman web; perbaikan keamanan pengingat & foto barang.

## 3.0.2 — 2026-11-03 — APK Android pertama

- APK Android resmi pertama, bisa diunduh dari GitHub Releases.

## 3.0.1 — 2026-10-27 — Menu Profil baru

- Menu Profil baru; nomor versi mulai tampil di aplikasi.
- Sudah hadir di era ini: Koin & Referral, Kotak Masuk dari Gmail (usulan transaksi otomatis), Impor dari
  PDF/Excel/CSV/tangkapan layar, coba tanpa akun (`/mulai`), kartu kredit tampil seperti kartu fisik,
  sambungkan ke Claude/ChatGPT (MCP), Dompet Bersama, Insight Mingguan AI, laporan bulanan lewat email.

## 3.0.0 — 2026-09-27 — Desain ulang total

- Tampilan web, navigasi, dan halaman transaksi didesain ulang; landing page, login, kontak, privasi & syarat
  ikut tampilan baru; animasi halus di seluruh aplikasi.
- Aplikasi terpasang (PWA) membuka tampilan HP; Transaksi, Transfer, Anggaran, Berulang, Investasi di app HP.
- Input Cepat pintar: ketik bebas, suara, scan struk, favorit, urungkan.
- Keamanan: 2FA wajib setelah login Google, pembayaran PRO tahan manipulasi.
- AI Leosiqra: bahasa santai, konteks lebih pintar, tampilan chat baru.
- APK Android bertanda tangan untuk Google Play.

## 2.4.0 — 2026-08-09 — Aplikasi HP

- Aplikasi Android/iOS dengan tampilan khusus HP: splash screen, sembunyikan saldo, keypad tambah transaksi,
  mode gelap, tombol kembali Android.

## 2.3.0 — 2026-07-29 — Otomatisasi & impor

- Transaksi berulang benar-benar dijalankan (bukan cuma pengingat); tabungan target otomatis.
- Impor mutasi bank/e-wallet dari CSV dan e-statement PDF BCA.
- AI Leosiqra memberi insight sendiri (pengeluaran tak biasa, laju anggaran, tren bulanan) dan bisa mencari
  info terkini.

## 2.2.0 — 2026-07-22 — Input Cepat & PWA

- Input Cepat dengan splash screen, juga untuk Android; Leosiqra bisa dipasang seperti aplikasi (PWA).
- Logo baru, login dengan username, AI lebih paham data kamu, tab di halaman profil.
- Pemilih mata uang dunia, logo otomatis untuk bank/investasi, sisa limit kartu kredit, Reset Semua Data.

## 2.1.0 — 2026-07-14 — Keamanan & login Google

- Audit keamanan menyeluruh; login & daftar dengan Google.
- Dashboard bulanan/tahunan, Investasi (Saham/Deposito/Lainnya), Pajak Center, dan Data Pasar dibenahi dan
  dipercantik; perbaikan transaksi dobel.

## 2.0.0 — 2026-04-22 — Pindah ke Cloudflare

- Seluruh aplikasi pindah dari Firebase ke Cloudflare dengan sistem login sendiri — lebih cepat dan lebih
  terkendali.

## 1.0.0 — 2026-04-16 — Aplikasi pertama

- Leosiqra lahir: pencatat keuangan pribadi pertama (berbasis Firebase).

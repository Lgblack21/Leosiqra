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
5. APK Android (*Rilis APK Android*) memakai versi yang sama dari `package.json`; APK
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
<!-- peta-baru -->

Versi 1.0.0–3.0.2 disusun ulang dari riwayat git pada 7 Nov 2026: dulu angka versi tidak
dinaikkan per fitur (package.json loncat dari 0.1.0 ke 3.0.1), jadi tiap versi lama
mewakili satu era, bukan satu deploy. Tag & GitHub Release versi lama menunjuk ke commit
terakhir di `main` pada tanggal versi itu (3.1.0: commit yang menaikkan versinya).

Catatan di bawah tampil juga di aplikasi (Pengaturan › Riwayat versi, app HP: Profil ›
versi), jadi tulis dengan bahasa user. Format tiap entri:
`## X.Y.Z — YYYY-MM-DD — Judul singkat`, lalu daftar poin (`- `); baris lanjutan
menjorok 2 spasi; **tebal** dan `kode` boleh.

<!-- rilis-baru -->

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

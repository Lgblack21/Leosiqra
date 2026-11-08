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
| 3.6.2 | 8 Nov 2026 | Tombol & form catat transaksi baru |
| 3.6.3 | 8 Nov 2026 | Form catat transaksi lebih ringkas |
| 3.6.4 | 8 Nov 2026 | Pilih rekening & kategori lebih rapi |
| 3.6.5 | 8 Nov 2026 | Hasil jual tidak tercatat dua kali, kebocoran biaya AI ditutup |
| 3.6.6 | 8 Nov 2026 | Pengingat Sehatku lebih andal |
| 3.7.0 | 8 Nov 2026 | Stiker cerita: bagikan angka keuanganmu |
| 3.8.0 | 8 Nov 2026 | Stikerku: fitur stiker sendiri, 1 layar + stiker Struk |
| 3.9.0 | 8 Nov 2026 | Sehatku makin lengkap |
| 3.10.0 | 8 Nov 2026 | Kanvas: rencanakan keuangan di papan bebas |
| 3.11.0 | 8 Nov 2026 | Kanvas versi 2 + Cek Keuangan |
| 3.11.1 | 8 Nov 2026 | Perbaikan Kanvas |
| 3.12.0 | 8 Nov 2026 | Semua Fitur yang hidup |
| 3.12.1 | 8 Nov 2026 | Atur fitur pakai tampilan baru |
| 3.12.2 | 8 Nov 2026 | Semua fitur lebih rapi |
| 3.12.3 | 8 Nov 2026 | Fitur lainnya + label PRO |
| 3.13.0 | 9 Nov 2026 | Rapor Keuangan |
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

## 3.13.0 — 2026-11-09 — Rapor Keuangan

- **Cek Keuangan kini menjadi Rapor Keuangan**:
  - **Nilai 0–100 dan huruf A–E** dari tujuh indikator: arus kas, menabung rutin, dana darurat, cicilan, utang
    dibanding aset, harta yang bertumbuh, dan kebiasaan mencatat — lengkap dengan naik/turun dari bulan lalu.
  - **Langsung bisa dinilai** tanpa menunggu sebulan penuh: kalau belum ada bulan penuh, nilai dihitung sebagai
    perkiraan dari bulan berjalan.
  - Setiap indikator bisa dibuka untuk melihat **rumus dengan angka aslimu**, kenapa penting, dan cara memperbaikinya.
  - **Grafik masuk vs keluar 6 bulan**.
  - **Simulasi "Bagaimana kalau…"**: geser pangkas pengeluaran / tambahan pemasukan, lihat nilai baru, sisa per bulan,
    dan berapa bulan lagi dana darurat 3× tercapai.
  - **Rencana perbaikan** berurutan dari yang paling berdampak, langsung ke fitur yang tepat (Kanvas, Transaksi
    rutin, Investasiku).
- Halaman Fitur & menu menampilkan nilai rapormu (mis. "Nilai 72 · B sehat").

## 3.12.3 — 2026-11-08 — Fitur lainnya + label PRO

- Menu samping kini memuat **6 fitur** (sampai Ladangku), lalu tombol **Fitur lainnya** untuk sisanya.
- Halaman **Fitur lainnya** hanya berisi fitur yang belum ada di menu samping, jadi tidak ada yang dobel; kolomnya
  menyesuaikan isi supaya tetap rapi.
- Label **PRO** untuk akun Gratis pada fitur yang jatahnya lebih besar di paket PRO: AI Leo (50 chat/hari), Sehatku
  (analisis makanan 10×/hari), Cerita Hari Ini (10 ilustrasi AI/bulan), Dompet Bersama (5 dompet, 10 anggota), dan
  Ladangku (5 akun tim). Fiturnya tetap bisa dipakai dengan akun Gratis.

## 3.12.2 — 2026-11-08 — Semua fitur lebih rapi

- **Menu samping lebih ringkas**: hanya 5 fitur teratas (plus fitur yang sedang dibuka); sisanya lewat tombol
  **Semua fitur** yang menunjukkan berapa fitur lainnya.
- Halaman **Semua fitur** dirapikan: hanya tombol fitur, dikelompokkan dalam kolom yang tertata dengan urutan tetap,
  lengkap dengan status singkat tiap fitur. Tanpa sakelar on/off dan tanpa animasi yang mengganggu.
- Cari fitur tetap bisa dari mana saja dengan **Ctrl + K**.

## 3.12.1 — 2026-11-08 — Atur fitur pakai tampilan baru

- **Atur fitur** di menu samping kini membuka halaman Semua fitur yang baru langsung dalam mode Atur: sakelar
  tampil/sembunyi per fitur, dikelompokkan per tujuan, lengkap dengan status tiap fitur.
- Pop-up Pengaturan → Fitur yang lama diberi tombol ke tampilan baru.

## 3.12.0 — 2026-11-08 — Semua Fitur yang hidup

- Halaman **Semua fitur** dirombak total:
  - **Status langsung di tiap fitur** dari datamu sendiri — Kekayaan "Bersih Rp…", Kanvas "3 kanvas · Beli Rumah",
    Cek Keuangan "4 dari 5 aman", Langganan per bulan, transaksi rutin berikutnya, catatan hari ini, rantai Fokus.
  - **Untukmu hari ini** bersama Leo: saran yang paling berguna sekarang (mis. dana darurat masih tipis, lanjutkan
    kanvas, catat hari ini).
  - **Fitur kamu** tampil sebagai kartu besar dengan grafik mini dan cincin progres.
  - Fitur dikelompokkan **per tujuan**: Catat & pantau, Tumbuhkan harta, Rencanakan, Sehat & tenang, Usaha, Leo,
    Bantuan — kini semua fitur tampil, termasuk yang belum dipasang di menu.
  - Lencana **Baru** untuk fitur terbaru dan ajakan **Coba** untuk fitur yang belum pernah kamu buka.
  - **Atur menu** langsung di halaman: sakelar tampil/sembunyi per fitur.
- **Cari fitur dari mana saja**: tekan **Ctrl + K** (⌘ + K di Mac) di web, ketik, lalu Enter.
- Aplikasi HP: halaman **Lainnya** kini punya "Untukmu hari ini", kolom cari, status singkat, dan lencana Baru.

## 3.11.1 — 2026-11-08 — Perbaikan Kanvas

- Diagram **Dari catatanmu** di Kanvas kembali tampil (sebelumnya kosong di 3.11.0).
- Tab kanvas dibuat lebih ringkas dan tidak terpotong lagi; tab yang aktif kini terlihat jelas.
- Tombol periode dan navigasi bab tidak lagi menutupi bagian atas diagram saat "pas layar".
- Di web, saat menjawab kartu Kanvas **sidebar meluncur keluar dan digantikan panel jawaban**; setelah panel ditutup
  (✕ atau tombol Esc) sidebar kembali. Isi panel lebih ringkas dan keyboard tidak langsung muncul.
- Bab yang hanya berisi hitungan (mis. Hitungan KPR) kini ikut dihitung selesai, sehingga kartu akhir bisa terbuka.

## 3.11.0 — 2026-11-08 — Kanvas versi 2 + Cek Keuangan

- **Kanvas dirombak**: semua kanvas kini ada di satu layar dengan tab (Dari catatanmu · kanvasmu · + Kanvas baru),
  langsung di dalam menu web. Tiap bab punya warna sendiri, kartu ringkas yang tinggal diketuk, dan panel jawab
  bersama Leo: pilih jawaban, "Lewati dulu", atau "Batalkan jawabanku". Setelah menjawab, otomatis lanjut ke kartu
  berikutnya.
- **Navigasi bab** di atas papan: ketuk nomor bab untuk meluncur ke sana, dan lihat bab mana yang sudah selesai.
- **Persiapan Nikah 7 bab**: Pendapatan, Keuangan bersama, Tanggungan & rumah, Pengeluaran, Aset, Pajak & pra-nikah,
  Utang & cicilan — diakhiri tabel **Arus Kas Keluarga** dan **Neraca Keluarga** yang terisi dari catatanmu, lalu
  kartu **Rencana keluarga** berisi langkah berikutnya yang muncul dari jawabanmu.
- Semua papan lain (Dana Darurat, KPR, Pensiun, Pendidikan, Lunas Utang, Usaha) ikut memakai tampilan baru.
- Fitur baru **Cek Keuangan**: periksa menabung rutin, dana darurat, utang dibanding aset, cicilan dibanding
  pemasukan, dan harta bersih — dengan status Aman/Waspada dan saran perbaikannya.
- Catatan: isian papan Persiapan Nikah dari versi 3.10.0 tidak terbawa karena pertanyaannya diganti.

## 3.10.0 — 2026-11-08 — Kanvas: rencanakan keuangan di papan bebas

- Fitur baru **Kanvas** (menu Fitur di web, grid Lainnya di aplikasi HP): papan bebas yang bisa digeser,
  di-zoom (cubit di HP, Ctrl+scroll di komputer), dan disusun ulang dengan tombol **Rapikan**.
- **Arus Uangku**: diagram dari catatanmu sendiri — uang masuk dari mana, lewat rekening mana, habis ke kategori
  apa. Pilih bulan ini, bulan lalu, atau 3 bulan. Transfer, beli investasi & utang-piutang tidak dihitung.
- **7 papan rencana siap pakai**: Persiapan Nikah, Dana Darurat, Beli Rumah (KPR), Pensiun, Dana Pendidikan Anak,
  Lunas Utang, dan Mulai Usaha — plus Kanvas kosong. Tiap papan berisi bab-bab dengan angka dari catatanmu,
  pertanyaan untuk dijawab, hitungan otomatis (cicilan KPR, target dana darurat, dana pensiun, titik impas, dll.),
  daftar cek (izin OJK, penjaminan LPS, legalitas rumah), tugas, serta tabel Neraca & Arus Kas Keluarga.
- Tambah **catatan tempel** berwarna di mana saja. Jawabanmu tersimpan di akun, jadi bisa dilanjutkan dari HP atau
  komputer.

## 3.9.0 — 2026-11-08 — Sehatku makin lengkap

- **Pajak Center** kini punya rekap **Kesehatan & Asuransi** setahun: total biaya kesehatan per jenis, premi,
  klaim yang cair, dan daftar polis — lengkap dengan penjelasan mana yang masuk SPT (polis bernilai tunai di daftar
  harta) dan bahwa biaya berobat tidak mengurangi pajak.
- **Pengingat klaim macet**: klaim asuransi yang sudah 14 hari "diajukan" tanpa kabar dikirimi notifikasi untuk
  menghubungi asuransi, dan diberi tanda "Belum ada kabar N hari" di layar Asuransi.
- **Cek kesehatan dengan angka**: catat tensi, gula darah, berat/tinggi/lingkar perut, dan kolesterol, lalu lihat
  grafik trennya dari waktu ke waktu. IMT dihitung otomatis dengan klasifikasi Kemenkes.
- **Stikerku bulan lalu**: pilihan baru "Bln lalu" untuk membagikan rekap bulan sebelumnya. Notifikasi rekap
  tanggal 1 kini langsung membuka stikernya (kalau Stikerku menyala).

## 3.8.0 — 2026-11-08 — Stikerku: fitur stiker sendiri, 1 layar + stiker Struk

- **Stikerku** kini fitur sendiri (menu Fitur di web, grid Lainnya di aplikasi HP), tidak lagi
  tab di Cerita Hari Ini. Dari Cerita tetap ada pintasan di menu bawah.
- Tampilan satu layar: halaman tidak menggulir — kanvas & pengaturan diam, hanya daftar stiker yang
  digeser (di HP satu baris ke samping, di layar lebar ke bawah). Tablet mendatar memakai tampilan
  kanvas kiri + panel kanan.
- Stiker baru **Struk**: struk kertas bergerigi berisi daftar belanja, total, jumlah transaksi,
  kategori terbanyak, barcode, dan cap "TERCATAT" bergambar Leo. Total 28 stiker.

## 3.7.0 — 2026-11-08 — Stiker cerita: bagikan angka keuanganmu

- Tab baru **Stiker** di Cerita Hari Ini (web & aplikasi HP): pilih foto hari ini dari kamera atau
  galeri (atau latar warna), tempel stiker angka keuanganmu, lalu bagikan ke Story atau simpan.
- 27 stiker dalam 5 kelompok — Angka (angka besar, neon, papan skor, tiket, kalender sobek,
  koran Harian Leo), Grafik (batang, donat kategori, podium, speedometer, hari tanpa belanja),
  Leo (Leo bilang, Leo pegang papan, cap Leosiqra, meteran mood, polaroid), Gaya (nota warung,
  chat dari Leo, boarding pass, HUD game, kartu member, sticky note) dan Label.
- Stiker bisa digeser, diputar & diperbesar; rentang Hari ini / Minggu ini / Bulan ini; ukuran
  Story 9:16 atau Post 4:5 (gambar 1080 px); "Sembunyikan nominal" untuk hanya menampilkan
  jumlah & persen.
- Angka sama dengan Ringkasan: beli investasi & transfer tidak dihitung sebagai pengeluaran.
- Gambar dibuat di perangkatmu; foto tidak diunggah ke server.

## 3.6.6 — 2026-11-08 — Pengingat Sehatku lebih andal

- Pengingat cek kesehatan tahunan dan premi asuransi tetap terkirim walau banyak pengguna jatuh
  tempo di hari yang sama; yang belum kebagian hari ini diingatkan besok.
- Beberapa premi yang jatuh tempo bersamaan digabung jadi satu notifikasi.
- Cek kesehatan bertanggal 29 Februari kini ikut diingatkan setahun kemudian.
- Klaim asuransi tidak bisa dicatat cair dengan nominal Rp0; bayar premi dari dua perangkat
  sekaligus tidak lagi membuat jadwal jatuh tempo meleset.

## 3.6.5 — 2026-11-08 — Perbaikan uang & biaya AI

- Hasil jual barang tidak lagi tercatat dua kali: menjual lewat Barangku otomatis menutup
  iklannya di Ladangku, dan tombol "Laku" menolak barang yang sudah terjual (sebelumnya saldo &
  pemasukan bisa bertambah dua kali lipat).
- Jatah AI harian (scan struk, Makanku) tetap terpakai kalau AI sudah membaca tapi hasilnya
  "bukan struk/makanan"; kalau layanan AI sedang gangguan, jatah tetap dikembalikan.
- Ilustrasi AI Cerita: jatah PRO hanya untuk PRO yang masih aktif.
- Pesan galat ilustrasi Cerita tidak lagi menampilkan detail teknis; periode polis asuransi
  divalidasi lebih ketat; foto Makanku yang terlalu besar ditolak lebih awal.

## 3.6.4 — 2026-11-08 — Pilih rekening & kategori lebih rapi

- **Pilih rekening** di form Catat transaksi kini berupa daftar dengan logo bank/e-wallet dan sisa saldonya
  (kartu kredit menampilkan sisa limit). Rekening pertama langsung terpilih, dan pilihan "Tanpa rekening" dihapus
  supaya saldo selalu ikut tercatat.
- **Pilih kategori** lebih rapi: ada ikon tiap kategori, sub kategori dipilih langsung dari daftar.
- Perbaikan: daftar kategori kadang kosong saat form dibuka tepat setelah halaman dimuat.

## 3.6.3 — 2026-11-08 — Form catat transaksi lebih ringkas

- Form **Catat transaksi** dibuat lebih ringkas dan rapi: ukurannya lebih kecil, tulisan & tombol tidak kebesaran,
  dan semua isian muat satu layar tanpa perlu scroll — di komputer maupun HP.

## 3.6.2 — 2026-11-08 — Tombol & form catat transaksi baru

- Tombol **Catat transaksi** di menu samping tampil baru: gelap dengan ikon oranye khas Leo (shortcut **N** tetap jalan).
- Form transaksi dirombak: nominal besar di atas, pilih Pemasukan/Pengeluaran sekali ketuk, tanggal cepat
  **Hari ini / Kemarin**, rekening tinggal pilih kartunya, dan tombol simpan langsung menampilkan jumlahnya.
  Detail cicilan dilipat supaya form lebih ringkas. Di HP, form muncul dari bawah.

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

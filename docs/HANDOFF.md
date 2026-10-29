# Serah terima antar-session

Catatan bersama untuk semua session Claude Code (dua akun memakai repo yang
sama, tidak ada ingatan yang terbagi selain file ini dan riwayat git).
**Baca di awal session, perbarui di akhir session, commit & push.**

Terakhir diperbarui: 2026-10-29 (akun B; semua live, main = run #81)

## Siapa sedang kerja

| Akun | Status | Branch | Area |
|---|---|---|---|
| akun B | aktif | claude/nifty-cannon-y181p6 | Hapus menu Transfer & Top Up |

Isi baris ini saat mulai (mis. "akun B · aktif · claude/xyz · Worker inbox"),
kosongkan lagi saat selesai. Kalau ada akun lain tercatat aktif di area yang
sama, jangan ubah file yang sama — tanya Bos dulu.

## Status produksi

- **Live (main = produksi)**: Koin & Referral (Kawananmu), lampiran struk (R2),
  Aplikasi terhubung `/membership/aplikasi` (tidak di menu) via Composio:
  Google Calendar, Gmail → Kotak Masuk, Google Sheets, Notion, Slack → Kotak
  Masuk; Claude & ChatGPT (MCP). Kotak Masuk web `/membership/kotak-masuk` dan
  HP `/app/inbox`. Aktivasi aplikasi pakai koin (`APP_ACTIVATION` di Worker:
  Calendar/Sheets/Notion/Slack 200, Gmail 500 koin per 30 hari; PRO gratis).
- Perbaikan security check 2026-10-27 juga sudah live: Kotak Masuk tidak
  menandai "bukan transaksi" saat AI gangguan (`ai_unavailable`), streak koin
  per user, cek NONAKTIF atomik di tukar PRO. Hasil audit:
  `.claude/skills/security-check/references/triaged.md`.
- Halaman **Impor** `/membership/impor` juga sudah live (2026-10-28): CSV/XLSX di
  browser, PDF BCA, PDF lain & tangkapan layar via AI (kuota 40/hari), tinjau per
  baris, cek dobel, riwayat + Batalkan, ekspor CSV; hapus transaksi impor tidak
  lagi membalik saldo/total. Pembacaan AI sungguhan belum diuji di produksi.
- Menu Profil baru + versi **v3.0.1** juga sudah live (2026-10-28). Versi ada di
  `src/lib/version.ts` & `package.json`; versi Android/iOS native belum diubah.
- Koin baru `LeoCoin` (warna Leosiqra + cetakan singa maskot) & avatar Profil
  simetris juga sudah live (2026-10-28).
- Pop-up **Fitur** di Pengaturan sudah live (2026-10-28): × matikan / + aktifkan
  fitur menu samping, disimpan di `$.prefs.features` (validasi `PREF_FEATURES` =
  `FeatureId` di `src/lib/features.ts`; null = 5 bawaan). Hanya visibilitas menu;
  belum berlaku di menu aplikasi HP (`/app/*`).
- **Template kategori v1** sudah live (2026-10-28): 15 grup (`CATEGORY_TEMPLATE` di
  `src/lib/defaultCategories.ts` = Worker), jenis kategori di `$.prefs.categoryKinds`,
  sinkron user lama lewat POST `/api/member/categories/template` (sekali per user,
  flag `$.prefs.categoryTemplate`, hanya menambah). Tampilan Kategori & Anggaran
  baru (kartu ringkasan, cincin %). Grup yang dihapus user tidak muncul lagi.
- View **Target** di Pengaturan → Uang sudah live (2026-10-28): target = recurring
  tipe Tabungan + targetAmount, memakai RecurringModal yang sama.
- Perbaikan **"pindah halaman lemot"** sudah live (2026-10-28, run #39): `cloudflareApi` kini
  menggabung GET yang sama & menyimpannya 20 detik (`clearApiCache` dibuang pada
  setiap request non-GET, `notifyCollectionChanged`/BroadcastChannel, dan saat
  tab aktif lagi); animasi `.page-enter` 0.2s tanpa blur, stagger dipersingkat.
  Lokal: muat awal 18→11 API, pindah halaman 0–1 API (dulu transaksi 2.000 baris
  + auth/me tiap klik). Kalau ada data terasa basi, curigai cache ini dulu.
- Panel Pengaturan selalu mulai dari atas saat dibuka/pindah tampilan (`scrollRef` di `SettingsPanel.tsx`) sudah live (run #40).
- Sudah live (run #41): form **Target baru** (`TargetFormModal`: ikon+warna, nama, nominal,
  tanggal tercapai, setoran otomatis opsional, dana awal dari rekening) dipakai halaman
  Tabungan & Pengaturan → Target; halaman **Tabungan** ditata ulang (kartu target + Setor
  langsung, pos lain, riwayat per tanggal). Worker: payload_json recurring kini juga
  `icon`/`color`/`targetDate` (digabung, bukan ditimpa); Tabungan boleh `amount = 0`
  (target tanpa setoran otomatis) — cron & kalender melewati `amount > 0`; nama target
  dobel ditolak 409. Kategori target = nama awal (ganti nama tidak memutus progres).
  Belum: kartu target di aplikasi HP (`/app/savings`) belum menampilkan ikon/warna.
- Sudah live (run #42): **Transaksi rutin** di Pengaturan (view `rutin`: ringkasan masuk/keluar
  per bulan, daftar, jeda/hapus) + form baru `RecurringFormModal` (uang keluar/masuk, nominal
  besar, chip kategori, rekening, 7 pilihan selang, pratinjau 3 tanggal). Worker: interval baru
  `Dua Mingguan`/`Dua Bulanan`/`Tiga Bulanan` (advanceNextDate, RRULE `INTERVAL=n` di .ics &
  Google Calendar). Diuji lokal: cron mencatat sekali walau dipicu 2×, next_date +2 bulan.
  Halaman lama `/membership/recurring` tetap ada (tautan notifikasi push).
- Sudah live (run #43): halaman `/membership/recurring` ditata ulang (ringkasan masuk/keluar/
  tabungan/sisa per bulan, "7 hari ke depan", filter, kartu jadwal, preset saat kosong) memakai
  `RecurringFormModal`; data lewat `recurringService.listMine()` (API langsung, tanpa filter uid).
- Sudah live (run #44): **Awal periode anggaran** (Pengaturan → Pengaturan, view `periode`: grid tgl
  1–28 + pratinjau periode berjalan). Pref `$.prefs.budgetStartDay` (1–28, default 1, validasi Worker).
  Dipakai: Kategori & Anggaran (web), `/app/budget`, konteks asisten AI (`budgetUsage`), MCP
  `get_budgets` (`budgetPeriodBounds`). TIDAK dipakai (tetap bulan kalender): laporan bulanan,
  insight proyeksi budget, dashboard "Ke mana uangmu" (pakai pemilih bulan).
- Sudah live (run #45): **Tag** transaksi. Pref `$.prefs.tags` = { enabled, list: [{name, color}] }
  (maks 40, warna = CATEGORY_COLORS). Tag per transaksi di `transactions.payload_json.tags` (maks 5;
  POST `tags`, PUT `tags` lewat json_set — key lain di payload_json tetap). Pengaturan → Pengaturan →
  Tag (`TagsView`), pemilih di `AddTransactionModal`, chip + filter `?tag=` + ubah tag per baris +
  kolom Tag di CSV di Riwayat (`/membership/transactions/daily`). Belum: aplikasi HP (`/app`),
  Tambah Cepat/AI/impor belum bisa memberi tag.
- Sudah live (run #46): tampilan HP (<768px) disederhanakan. Ringkasan: tanpa kartu "Hari ini",
  lencana/streak, Insight Mingguan, chip "biasanya jam segini"; Ke mana uangmu maks 4, Terbaru maks 5,
  "Fitur kamu" → "Saldo" (2 kartu). Riwayat: Ekspor/Tambah disembunyikan (ada FAB), periode & filter
  dilipat di tombol "Filter", aksi Tag/Hapus muncul saat baris diketuk. Tablet/desktop tidak berubah.
- Sudah live (run #47): Pengaturan → **Cara catat utama** (pref `inputMode` lama: ketik/suara/foto, kini
  dipakai: tombol + HP, tombol Tambah di menu samping & Riwayat → form / `/input-cepat?mulai=suara|foto`;
  pintasan N tetap form) dan **Keyboard nominal** (pref baru `amountKeypad` standar/kalkulator →
  tombol kalkulator mini `AmountCalculator` di AddTransactionModal & Input Cepat; parser sendiri,
  tanpa eval). User yang dulu memilih suara/foto di onboarding kini tombol + membuka cara itu.
- Sudah live (run #48): Pengaturan → **Shortcut iPhone** (`ShortcutsView`, view `shortcut`): 3 resep Pintasan
  tanpa token — suara (`/input-cepat?mulai=suara`), tangkapan layar (`?mulai=tempel` → tombol baca
  gambar dari clipboard), SMS bank (`?teks=<isi pesan>` → dibaca AI/parser lokal). Semua hanya mengisi
  form; user tetap menyimpan. Belum diuji di iPhone asli (Pintasan, clipboard Safari).
- Sudah live (run #49): Pengaturan → **Pembaca Notifikasi** (`NotificationReaderView`, view `notif-reader`,
  juga `?pengaturan=notif-reader`). Browser tidak bisa membaca notifikasi aplikasi lain, jadi isinya jalur nyata:
  SMS bank (→ Shortcut iPhone), email bank (→ Gmail/Kotak Masuk), dan "Tempel teks notifikasi" →
  `/input-cepat?teks=`. Tanpa perubahan Worker/D1. Notifikasi otomatis Android = butuh plugin native
  (NotificationListenerService) — belum dibuat.
- Sudah live (run #50): resep **Notifikasi aplikasi bank** — Bos
  konfirmasi iPhone-nya punya Pintasan › Automasi › Aplikasi › "Saat saya menerima notifikasi". Resep baru
  `notif` di `ShortcutsView` (Enkode URL → Buka URL `/input-cepat?teks=`), kartu pertama di Pembaca Notifikasi
  membuka Shortcut iPhone dengan resep itu terbuka (`initialOpen`). Nama tindakan "Enkode URL" & variabel
  "Input Pintasan" belum dicocokkan dengan iPhone asli.
  Juga live (run #50): **Impor mutasi jadi pop-up** di Pengaturan (view `impor`, `?pengaturan=impor`; grup
  baru "Impor & ekspor" + Ekspor CSV). Logika halaman Impor dipindah ke `src/components/impor/ImportMutasi.tsx`
  (`inPanel`), `/membership/impor` tetap ada. **PDF berkata sandi** (pdf.js di browser, sandi tidak dikirim).
  **Bug produksi diperbaiki**: semua impor PDF gagal di browser ('No "GlobalWorkerOptions.workerSrc"') sejak
  Impor live — `pdfText.ts` kini memuat `pdf.worker.mjs` ke `globalThis.pdfjsWorker`. Dibuktikan dengan build
  lama vs baru (static export lokal).
  Juga live di web (run #50): **Kartu e-money (NFC)** — bagian native BELUM dirilis (perlu build app) — Pengaturan view `emoney` + `/app/emoney` (menu Lainnya HP),
  komponen `src/components/emoney/EmoneyScanner.tsx`, jembatan `src/lib/emoney.ts`. Plugin native LOKAL
  "Emoney": iOS `ios/App/App/EmoneyPlugin.swift` (didaftarkan di `AppViewController`, dipakai SceneDelegate;
  entitlement NFC TAG + daftar AID di Info.plist), Android `EmoneyPlugin.java` (didaftarkan di MainActivity,
  izin NFC, reader mode). Baca saja: Mandiri e-money (AID A000000018300001 / 0000000000000001; 00B2010400
  BE @12..15, cadangan 00B500000A LE) & BNI TapCash (AID A000424E49100001 / A000424E49999999 / 112233445566;
  9032030000 → 3 byte BE @2..4). APDU dari repo open-source muhakmal/osp-kue-reader & agusibrahim/
  prepaidcard_reader — **belum diuji dengan kartu asli**. Simpan = PUT saldo absolut (idempoten), bukan
  transaksi. Swift belum pernah dikompilasi (tidak ada Xcode di container); Java dicek javac + stub & uji
  parsing. Butuh: kapabilitas "NFC Tag Reading" di App ID Apple, build & rilis ulang aplikasi iOS/Android.
  Aplikasi lama tanpa plugin → layar "Perbarui aplikasi".
  Juga live (run #50): **Impor / ekspor CSV** (Pengaturan view `csv`, `CsvView.tsx`): ekspor per rentang tanggal —
  **Worker berubah**: `export.csv?from=&to=` (YYYY-MM-DD, inklusif, `substr(date,1,10)`, divalidasi; tanpa
  parameter = perilaku lama). Impor CSV kini mengenali kolom **Jenis/Type** (`kind` di ColumnMapping): sebelumnya
  CSV ekspor Leosiqra yang diimpor balik membuat semua pengeluaran jadi pemasukan; baris transfer/hutang dilewati.
  BELUM: pindahan multi-dompet dari app lain (Money Manager, Money Lover, …) — tunggu keputusan Bos.
- Sudah live (run #51): **Pengingat & Notifikasi**.
  - Pengaturan → Pengingat (view `pengingat`, `RemindersView.tsx`, `reminderService.ts`): nama, waktu, nominal
    opsional, ulang sekali/mingguan/bulanan. **Butuh migrasi `0020_reminders.sql`** (tabel `reminders`) — tanpa
    itu API membalas 503 "belum aktif" & cron diam. Worker: `/api/member/reminders` (GET/POST/PUT/DELETE, maks 50),
    cron 10 menit `sendDueReminders` (klaim bersyarat `due_at` → tidak dobel; bulanan pakai `anchor_day` WIB,
    31 → 30/28 tanpa bergeser; tertinggal → lompat ke jadwal berikutnya, 1 notifikasi). Notifikasi dengan nominal
    membuka `/input-cepat?teks=`.
  - Notifikasi: pref baru `$.prefs.notify` {reminders, summary, weekly, monthly} (default true). Ringkasan harian
    00:01 kini bisa dimatikan. BARU: push wawasan mingguan (Senin 10:00 WIB, `computeWeeklyInsights`) & bulanan
    (tgl 1, `buildMonthlyReport`), penanda `$.prefs.weeklySent/monthlySent`. Diuji lokal dengan wrangler dev + D1
    lokal (API, cron dobel, bulanan tgl 31, query kandidat) dan UI lewat Playwright → Worker lokal.
  - Belum: menu Pengingat di aplikasi HP (`/app`). Push sungguhan belum dicoba Bos.
- Sudah live (run #52): **Tampilan**.
  - **Mode gelap web BERTAHAP** (keputusan Bos): Pengaturan → Mode gelap (`AppearanceView`, ThemeContext yang sama
    dengan /app, localStorage `leosiqra-theme`). Cara kerja: scope `.web-dark` di globals.css memetakan ulang
    variabel warna Tailwind v4 (slate dibalik, pastel → tint gelap, teks -700+ → terang; `--color-white` TIDAK
    diubah, bg-white dkk dioverride di `@layer utilities`). Kerangka (sidebar, header, tab bar, panel Pengaturan)
    selalu ikut tema; isi halaman hanya rute di `WEB_DARK_READY` (`src/lib/webTheme.ts`, sekarang hanya
    Ringkasan). Halaman berikutnya: cek tampilannya gelap → tambahkan prefix-nya. JANGAN pasang kelas `.dark` di
    scope web (varian dark: milik /app akan terbalik). Banner "Pasang Leosiqra" (root layout) belum ikut gelap.
  - **Tampilkan Leo** & **Tema musiman**: pref `$.prefs.showMascot` / `$.prefs.seasonal` (default true, Worker
    divalidasi). `useLeoPrefs`, `lib/season.ts` (Ramadan–Lebaran perkiraan 2027–2029, Agustus, Oktober,
    Desember) → aksesoris di `LeoMascot` (`season` prop) + hiasan emoji di kartu Ringkasan.
  - Bahasa English: DILEWATI (keputusan Bos) — belum ada sistem terjemahan.
- Sudah live (run #53): **Privasi & keamanan + Perangkat lain**.
  - Privasi: **Izin** (`PermissionsView`: status kamera/mikrofon/notifikasi via Permissions API, tombol Izinkan),
    **Ingatan asisten** (`AssistantMemoryView`, pref `$.prefs.aiMemory` {style, learned, about} maks 600 karakter,
    divalidasi Worker; disisipkan ke prompt Tanya Leo lewat `aiMemoryBlock` — dilabeli catatan user, bukan aturan
    sistem), **Statistik pemakaian** (localStorage `leosiqra:analytics-off`; `WebAnalytics` tidak memuat beacon
    Cloudflare kalau dimatikan). Keamanan akun & Atur ulang data tetap di bawahnya.
  - Pengaturan → Perangkat lain → Pasang di ponsel (`/install`).
- Sudah live (run #54): **Panel Pengaturan ramping** — kelas `.settings-compact` di dialog SettingsPanel
  (globals.css): `--spacing` 0.22rem (semua jarak Tailwind ±12% lebih rapat) + ukuran `text-[Npx]` turun satu
  tingkat; dialog `sm:max-w-lg`. **Posisi gulir per tampilan** (`scrollPos` di SettingsPanel): sub-menu mulai dari
  atas, Kembali memulihkan posisi menu sebelumnya.
- Sudah live (run #55): lapisan panel Pengaturan tanpa `backdrop-blur`. Bos melaporkan "kedipan hitam" saat buka
  panel di tablet (Chrome Android); dari video: 1 frame bagian atas panel tidak tergambar (latar buram gelap
  terlihat) — glitch compositing GPU dengan backdrop-filter. Video diambil sebelum run #55; BELUM dikonfirmasi
  hilang. Kalau masih: coba hapus animasi spring `y` dialog / tambah `transform-gpu`.
- **Live (run #56)** (akun B): **Lonceng notifikasi** di header (`NotificationBell`, portal ke body karena header
  memakai backdrop-filter). Tab Notifikasi (riwayat, tandai dibaca/semua) + tab Pengingat (`RemindersView`).
  Worker: tabel `notifications` (**migrasi 0021**), `recordNotification` dipanggil di `sendWebPushToUser` → semua
  push server tercatat (juga untuk user tanpa langganan push); `/api/member/notifications` (GET, POST read-all,
  POST :id/read); dibersihkan di cron harian (>60 hari, >100/user). Tanpa migrasi: lonceng kosong, bukan error.
- **Live (run #56)** (akun B): dropdown **Tambah Cepat** di header dihapus (permintaan Bos) — header kini hanya
  menu, judul, lonceng. Langkah tur + bagian Panduan soal Tambah Cepat ikut dihapus. Menu Input Cepat di Pengaturan tetap.
- **Live (run #56)** (akun B): kedipan hitam saat buka Pengaturan dari Ringkasan (masih ada setelah run #55) —
  semua blur di bawah overlay dibuang: blob `blur-2xl` + tombol `backdrop-blur` di kartu sapaan dashboard (blob jadi
  radial-gradient), `backdrop-blur` header (bg jadi /95) & tab bar HP. Belum dicek di HP asli — tunggu konfirmasi Bos.
- **Live (run #57)** (akun B): **Ringkasan v2** (dashboard web) — kartu sapaan dengan langit ikut jam + **Leo Buddy**
  (`src/components/dashboard/LeoBuddy.tsx`): Leo ngomong pakai data asli (lewat anggaran, pengingat ≤7 hari, jatah
  harian, ritme vs bulan lalu, kebiasaan jam segini, kategori teratas), ekspresi ikut isi pesan, ketuk Leo → kaget-ketawa
  + pesan berikutnya. Jatah harian = (total anggaran bulanan − belanja kategori beranggaran sebelum hari ini) / sisa
  hari. Baris saldo/keluar/masuk, grafik **Ritme pengeluaran** (`SpendPaceChart`, kumulatif vs bulan lalu + garis
  anggaran), **Catatan terbaru** per hari, **Segera** (pengingat aktif ≤30 hari + tagihan kartu). Tanpa migrasi baru.
  Diuji lokal (wrangler dev + data 2 bulan, HP/desktop, terang/gelap, anggaran sisa/habis).
  + **Pemandangan langit** (`SkyScene.tsx`, animasi `.sky-*` di globals.css): langit ikut jam (pagi/siang/sore/
  malam), matahari melintas busur (05–19), bulan + bintang berkelip + bintang jatuh (malam), awan & burung, siluet
  kota (jendela menyala malam) + hutan. Tanpa blur. Di HP matahari/bulan di pojok kanan atas; dekor musiman cuma desktop.
- **Live (run #58)** (akun B): **judul kecil di header dihapus** (semua halaman member). `Header.tsx` tidak lagi
  fixed/berjudul; lonceng (+ tombol menu ≡ di HP) dipindah lewat portal ke `<HeaderSlot />` di baris judul halaman
  (Ringkasan, Transaksi, Laporan, Rekening, Semua fitur, Kotak Masuk, Tabungan, Transaksi berulang; dua slot
  `sm:hidden`/`hidden sm:flex` → yang terlihat dipakai). Halaman tanpa slot: baris tipis lonceng (+ ≡). `main`
  tidak lagi `pt-16`. Tambah slot ke halaman lain kalau mau sebaris.
- **Live (run #59)** (akun B): dashboard web tidak lagi menghitung **beli/jual investasi** sebagai
  pengeluaran/pemasukan — `isInvestmentFlow` di `src/lib/utils.ts` (cermin `isInvestmentPurchaseRow` Worker,
  index.ts:940: relatedType "investasi" atau pengeluaran berkategori Investasi/Saham/Deposito). Berlaku ke
  Keluar/Masuk, hari ini, Ke mana uangmu, Ritme, jatah harian, kata-kata Leo; barisnya tampil netral di Catatan
  terbaru. Halaman lain (Laporan, Transaksi) belum dicek memakai aturan yang sama.
- **Live (run #60)** (akun B): **Kartu Saya dihapus, dilebur ke Rekening** + rapikan Transaksi/Laporan/Rekening.
  Rekening: ketuk rekening/kartu → `AccountDetail` (saldo atau limit/terpakai/sisa, siklus tagihan kartu, masuk/keluar
  bulan ini, 8 transaksi terakhir, Ubah/Hapus); "Atur urutan" ↑↓ (reorderAccounts, dicek tersimpan setelah reload).
  `/membership/cards` kini cuma redirect ke Rekening (notifikasi lama). Dihapus dari menu, Fitur (id 'kartu' tetap sah
  tapi disaring `isShownFeature`), DEFAULT_FEATURES, Panduan; push tagihan kartu Worker → `/membership/rekening`
  (perlu deploy Worker — ikut workflow). Transaksi: kartu Keluar/Masuk/Selisih, beli/jual investasi = pindah dana
  (`isInvestmentFlow`), PAGE 60. Laporan: 3 kartu ringkasan, kontrol satu baris, donat + daftar berdampingan,
  investasi dikecualikan. `Modal` bersama: tanpa backdrop-blur & tanpa `mt-16` sisa header lama.
- **Live (run #61)** (akun B): **Transaksi dipadatkan** — judul & nominal lebih kecil, Keluar/Masuk/Selisih jadi satu
  kartu tipis 3 kolom, Periode jadi dropdown, Jenis jadi segmented kecil sebaris dengan pencarian, chip filter
  ringkas (13px) + tombol Reset, baris transaksi lebih rapat (ikon 36px, teks 14px).
- **Live (run #62)** (akun B): **mode Pilih di Transaksi** (`components/transactions/BulkBar.tsx`). Tombol Pilih →
  ikon baris jadi centang, pilih sehari lewat lingkaran di judul tanggal, bar aksi melayang (z-60, di atas ajakan
  pasang PWA): Semua, Kategori, Hapus. Pindah kategori hanya kalau semua pengeluaran atau semua pemasukan (bukan
  transfer/investasi), kategori investasi disembunyikan; update kategori saja (saldo tak berubah). Hapus = loop
  `deleteTransaction` (endpoint biasa, saldo dibalik server), id pasangan transfer yang sudah ikut terhapus dilewati;
  berhenti & lapor kalau gagal di tengah. Pilihan disaring ke yang terlihat di filter. Diuji lokal: kategori di server
  berubah, saldo BCA/Tunai kembali persis sebesar 3 transaksi yang dihapus.
- **Live (run #63)** (akun B): **Laporan bulanan** (`components/laporan/ReportExtras.tsx`): mode Bulanan pakai
  **kalender gelembung** (ukuran ∝ √belanja, merah > 1,5× rata-rata, centang hijau = hari hemat, hari ini bingkai +
  titik berdenyut; ketuk hari → rincian + link `Transaksi?tanggal=YYYY-MM-DD`), menggantikan batang harian (batang
  tetap di Tahunan). **Pola mingguan** (rata-rata per hari Sen–Min) dan **Pengeluaran terbesar** (podium 🥇🥈🥉 + 3
  berikutnya) di kedua mode. Transaksi menerima `?tanggal=`.
- **Live (run #63)** (akun B): **Cek hari** (`components/laporan/DayReview.tsx`) — ketuk hari di kalender Laporan →
  modal semua transaksi hari itu: cincin progres + Leo, centang per transaksi (letup + riak hijau, baris pindah ke
  "Sudah dicek"), "Semua sudah benar" → konfeti + Leo senang + "Hari berikutnya", ketuk baris → ganti kategori
  (pengeluaran/pemasukan saja, kategori investasi disembunyikan; ganti = otomatis dicek), panah ←/→ hari. Kalender
  memberi lencana ✓ untuk hari yang semua pengeluarannya sudah dicek. Worker: PUT transaksi menerima
  `reviewed: boolean` → `payload_json.reviewed` (tanpa migrasi; bukan data uang). Perlu deploy Worker.
- **Live (run #64)** (akun B): **Laporan tahunan** — batang bertumpuk diganti **"Bulan demi bulan"** (`YearMonths` di
  ReportExtras): kartu per bulan mulai bulan pertama yang ada catatan, berisi keluar, batang vs rata-rata, cincin
  % ditabung ((masuk−keluar)/masuk), 👑 terhemat / 🔥 terboros, ketuk → Bulanan bulan itu; strip rekor (rata-rata,
  % ditabung, terhemat, terboros, kategori paling naik). "Kategori dari waktu ke waktu" jadi matriks gelembung
  berwarna kategori.
- **Live (run #65)** (akun B): **Laporan dirampingkan** (bulanan & tahunan): judul 30px + label periode, kontrol
  kecil, ringkasan jadi satu kartu tipis 3 kolom (HP format "jt", desktop lengkap — dicek tidak ada teks terpotong
  dengan angka ratusan juta), heading 17px, grafik/donat/podium/pola lebih kecil, gelembung kalender dibatasi px &
  % sel, 👑/🔥 kartu bulan pindah ke sebelah nama bulan, Anggaran ikon saja di HP.
- **Live (run #66)** (akun B): **halaman Anggaran** `/membership/budget` (dulu redirect ke Pengaturan; tidak di menu
  samping — dibuka dari tombol Anggaran di Laporan/Ringkasan & kata Leo). Kartu sisa/lewat + bar dengan penanda hari
  periode + status (Aman/Hampir habis/Terlalu cepat/Lewat) + perkiraan akhir periode; per kategori (bar + penanda,
  sisa/lewat, "terlalu cepat"); "Belum ada anggaran"; **mode Ubah** = semua nominal bulanan diedit di tempat, simpan
  sekaligus (kosong = hapus). Periode ikut budgetStartDay. Pengaturan → Kategori & Anggaran: catatan periode kini
  ikut awal periode (bukan selalu "bulan kalender"), tautan ke halaman Anggaran, tombol tanpa backdrop-blur.
- **Live (run #67)** (akun B): **ganti nama kategori** — Pengaturan → Kategori → detail, ketuk
  nama (ikon pensil). Endpoint baru `POST /api/member/categories/rename {from,to}`: satu `DB.batch` (atomik) mengganti
  `category` di transactions, categories, budgets, recurring + pindah kunci prefs categoryStyles/categoryKinds. Hanya
  baris user dari sesi. 409 kalau nama dipakai kategori lain (gabung kategori belum didukung), 400 untuk kategori
  sistem (hutang/piutang/transfer/top up/tabungan/investasi/saham/deposito) & nama baru berisi "investasi". Diuji
  lokal (wrangler): 29 transaksi + anggaran + ikon/jenis pindah, prefs lain utuh, 409/400/404 benar. Tanpa migrasi.
- **Live (run #68)** (akun B): **ganti nama dari halaman Anggaran** — mode "Ubah" kini juga
  mengedit nama kategori (kolom nama), disimpan bersama nominal (nominal dulu, lalu rename via endpoint yang sama).
  Nama ganda antar isian ditolak di klien; sisanya divalidasi server. Tombol Ubah dapat aria-label (di HP cuma ikon).
- **Live (run #69)** (akun B): **Rekening dirampingkan** — header ramping (h1 26/30 + jumlah rekening),
  kartu saldo gelap dengan bar komposisi kas (warna per rekening + legenda %, ketuk → detail) & chip tagihan kartu
  terdekat, banner keamanan satu baris, baris rekening ringkas (titik warna + % kas), kartu kredit jadi kartu mini
  (h-136, grid 2–3 kolom di desktop) dengan total tagihan di judul, Target pakai cincin progres 2 kolom.
- **Live (run #70)** (akun B): **pusat Kartu kredit** di Rekening
  (`CreditCardHub`, dibuka dari "Kelola"/kartu mini/chip tagihan): carousel kartu (•••• 4 digit + logo jaringan),
  tiket tagihan tercetak + jatuh tempo + min. bayar, "Sudah bayar", "Ubah kartu", belum ditagih/terpakai/sisa limit,
  belanja siklus ini, kartu paling longgar dipakai hari ini, timeline 30 hari (cetak/jatuh tempo).
  Worker: `POST /api/member/accounts/:id/pay {from_account_id, amount, date, ref}` = dua baris transfer
  (Keluar/Masuk, format sama dgn Transfer & Top Up, Masuk ikut punya target_account_id) + kedua saldo dalam satu
  batch; `ref` (payRef di payload_json) bikin kirim ulang/paralel no-op. Akun kartu: `card_last4` (tepat 4 angka)
  & `card_network` (visa/mastercard/jcb/amex/gpn) di payload_json, input salah → 400. AccountModal: field 4 digit &
  jaringan. Diuji lokal: bayar 3,322 jt (saldo BCA & kartu pas), ref sama → duplicate, 3 paralel → 1 masuk, hapus
  sisi Masuk/Keluar (reverse=1) → pasangan ikut terhapus & saldo pulih, validasi 400/404/401. Belum: pindai kartu (AI).
- **Live (run #71)** (akun B): **form kartu kredit khusus** (`CreditCardForm`)
  menggantikan form rekening umum utk kartu (pusat kartu Tambah/Ubah, detail rekening, AccountModal pilih "Credit Card"
  → pindah, modal global 'kartu'; `CardModal.tsx` lama yang tak terpakai dihapus). Pratinjau kartu live (`CardFace`,
  dipakai juga carousel), pilih bank (logo otomatis), nama, 4 digit, tanggal cetak/jatuh tempo via grid 1–28, tagihan,
  limit, minimum bayar, pengingat Mati/H-1/H-3/H-5/H-7, jaringan, warna, hapus kartu.
  Worker: `reminder_days` (0/1/3/5/7) di payload_json, cron pengingat kartu pakai `cardReminderDays` (bawaan tetap
  H-3/H-1/hari H). `POST /api/member/cards/scan {imageBase64}` → {bank, network, last4} via OpenRouter (model
  PARSE_TRANSACTION_MODELS), kuota 20/hari/user (dikembalikan kalau AI gagal), foto tidak disimpan, server hanya
  kembalikan 4 digit terakhir, respons AI tidak di-log. **Belum teruji dgn AI sungguhan** (lokal tanpa API key; UI diuji
  dgn respons tiruan) — cek pindai di production.
- **Live (run #72)** (akun B): **pusat Kartu kredit dirombak** — tampilan utama = tumpukan kartu
  (kartu belakang menyembul 58px, margin negatif berbasis `100cqw / 1.586`) + tips Leo + daftar tagihan 30 hari ke depan
  (tanggal, nominal, warna kartu). Ketuk kartu/tagihan → detail kartu itu: kartu terbang ke atas (framer `layoutId`),
  kartu lain mengintip di belakang, tiket tagihan + Sudah bayar/Ubah, belum ditagih/terpakai/limit, belanja siklus ini
  (animasi berurutan); "Semua kartu" kembali ke tumpukan. Logika angka tidak berubah.
- **Live (run #72)** (akun B): **Rekening & form kartu dirampingkan** — bagian Kartu kredit di
  Rekening jadi daftar ringkas (thumbnail kartu + 4 digit, status jatuh tempo, tagihan/terpakai, bar limit; ketuk →
  detail di pusat kartu), banner keamanan jadi catatan kecil di bawah halaman. CreditCardForm: pratinjau lebih kecil
  dengan tombol "Pindai" menempel, bagian digabung (kartu · tanggal+pengingat · tagihan · tampilan), input lebih padat.
- **Live (run #73)** (akun B): **form kartu: pilih bank** — kolom Bank membuka panel grid logo + cari
  (25 penerbit + "Bank lain"); nama kartu terisi otomatis "Kartu Kredit {bank}" dan tetap bisa diubah (nama yang
  diketik user tidak ditimpa saat ganti bank). Hasil pindai "PT Bank Negara Indonesia" dll. dicocokkan ke daftar.
  indonesianBanks: tambah BSI, Krom, blu.
- **Live (run #74)** (akun B): **logo bank tanpa globe** — build tidak punya NEXT_PUBLIC_LOGO_DEV_TOKEN,
  jadi logo pakai favicon Google (s2) yang mengirim ikon globe kalau situs bank tak punya favicon. LogoImage kini
  menulis ulang URL s2 (termasuk logo_url lama di DB) ke `t3.gstatic.com/faviconV2` TANPA fallback_opts (harusnya error
  kalau ikon tak ada → fallback tampil) + ikon ≤16px dianggap gagal. Picker bank: fallback monogram warna merek per bank.
  OCBC domain → ocbc.id. **Belum terverifikasi** (gstatic diblok di sandbox): cek di production apakah logo yang tadinya
  tampil tetap tampil & yang globe jadi monogram. Logo asli lebih lengkap kalau Bos isi token logo.dev ke build env.
- **Live (run #75)** (akun B): **Leo beraktivitas di Ringkasan** — LeoMascot dapat prop `activity`
  (eat: pegang paha ayam + mengunyah + remah; play: bola memantul, mata ikut, kaki menepuk; coins: lempar koin berputar +
  tumpukan koin; sleep: zzz + gelembung napas). LeoBuddy memilih aktivitas tiap 12 dtk ikut jam perangkat (22–05 tidur,
  11–14 & 18–20 makan, selain itu main bola/koin/makan/santai) + keterangan "Leo lagi …"; diketuk → berhenti 6,5 dtk untuk
  ngomong (mood pesan) lalu lanjut. prefers-reduced-motion: tanpa aktivitas.
- **Live (run #75)** (akun B): **tema musiman = hari raya/tanggal merah Indonesia** (`lib/season.ts`):
  Tahun Baru, Isra Mikraj/Tahun Baru Islam/Maulid (islami), Imlek, Nyepi, Ramadan & Idul Fitri, Jumat Agung & Paskah,
  Hari Buruh, Kenaikan, Waisak, Pancasila, Idul Adha, HUT RI (Agustus), Natal. Halloween dihapus. Aksesoris Leo per hari
  raya (LeoMascot SeasonAccessory) + hiasan kartu + ucapan Leo di hari H. Prioritas: hari H > hari raya terdekat dalam
  rentang > musim panjang (Ramadan, Agustus). Tanggal tetap & Paskah (rumus) pasti; **tabel LUNAR 2027–2029 perkiraan —
  perbarui dari SKB 3 Menteri tiap tahun.**
- **Live (run #76)** (akun B): **AI Leosiqra → "AI Leo"** — orb diganti wajah Leo (SVG ringan di AiOrb,
  dipakai web & /app/assistant/chat; saat mikir mata melirik + cincin berputar), layar sambutan pakai LeoMascot penuh +
  chip saran ringkas, judul halaman ramping (h1 26/30 + HeaderSlot), chat di kartu putih, panel kanan desktop: 2 fitur +
  daftar insight ringkas. AiChat dapat prop `layout` opsional; tidak lagi auto-scroll saat layar sambutan.
- **Live (run #77)** (akun B): **panel Fitur sinkron** — Bos lihat sidebar "12 aktif" tapi panel "5 aktif"
  (fitur aktif tetap di "Fitur lainnya"). Tidak bisa direproduksi lokal; dugaan data basi (useFeatures dulu ambil prefs
  SEKALI per sesi). Kini `refresh()` saat panel Fitur dibuka & saat tab aktif lagi (dilewati saat ada simpan berjalan);
  tile terbang naik/turun antar "Fitur kamu" ⇄ "Fitur lainnya" (framer layoutId). Cek di production.
- **Live (run #78)** (akun B): **Investasiku** = Investasi + Data Pasar jadi satu (`/membership/investment`):
  kartu nilai investasi + alokasi Saham/Deposito/Lainnya, simulasi "Mau taruh berapa?" (preset = deposito aktif user + contoh
  Deposito 4,5%/20%, SBN 6,5%/10%, RDPU 4,5%/0% — PERKIRAAN, bunga bisa diubah, bunga sederhana), daftar portofolio (tab +
  tombol tambah buka modal saham/deposito/investasi_lain, baris → halaman /membership/investasi/*), kolom kanan harga pasar
  (emas/gram, USD/IDR, kripto watchlist, kurs) via hook baru `useMarketData` (logika dari halaman Data Pasar lama).
  `/membership/market-data` → redirect `/membership/investment#pasar`; fitur 'pasar' disembunyikan (id tetap sah);
  menu & label "Investasiku". Rumus total sama dengan versi lama (non-Planned, IDR).
- **Live (run #79)** (akun B): **urutan menu fitur** — `featuresFromIds` kini mengurutkan sesuai FEATURES
  (bukan urutan saat dinyalakan); Investasiku nomor 2 di bawah AI Leo; label menu "AI Leosiqra" → "AI Leo".
- **Live (run #80)** (akun B, tanpa migrasi): **Investasiku layar penuh** — `/membership/investment`
  tanpa sidebar (`FULLSCREEN_PATHS` di `membership/layout.tsx`), tombol kembali ke Ringkasan, dock melayang gelap
  (`InvestShell`, tab di hash URL `#kabar/#sbn/#belajar`): Investasiku (`TabInvestasiku`, isi halaman lama + kartu Kabar),
  Kabar "Radar Leo" (`TabKabar`, saring topik), SBN (`TabSbn`: tangga bunga LPS/BI/SBN, "sebulan dapat berapa", daftar seri),
  Belajar (`TabBelajar`). Worker baru `GET /api/member/kabar`: RSS CNBC Indonesia (market/news/investment), skor relevansi
  ke dompet (kata kunci berbobot), buang video/hiburan/promosi, gabung judul mirip, maks 6 per topik, urut skor × kesegaran,
  cache edge 30 mnt (`kabar/v2`). **Belum terverifikasi**: fetch RSS CNBC sungguhan (sandbox diblok) — kalau kosong di prod,
  cek log `Kabar: gagal ambil`. Angka BI-Rate/LPS/SBN = **data manual** `src/lib/sbnData.ts` per 2026-10-29, WAJIB
  diperbarui saat berubah (halaman memperingatkan setelah 45 hari). Peta yield curve pasar belum dibuat (tak ada sumber data).
- **Live (run #81)** (akun B, frontend saja): **menu Transfer & Top Up dihapus** — fitur 'transfer'
  keluar dari FEATURES (id tetap sah di tipe & Worker) dan dari navGroups/halaman Fitur. `/membership/transactions/topup`
  → redirect `/membership/transactions/daily?jenis=transfer` (Riwayat dengan filter Transfer aktif). Datanya tidak
  berubah (memang baris transaksi type transfer/topup); mencatat tetap lewat Catat Transaksi → Transfer & Top Up.

## Migrasi D1

Dijalankan manual oleh Bos lewat Console D1 (token GitHub belum punya izin D1).
- `0017_coins.sql` — sudah (dikonfirmasi Bos).
- `0018_transaction_attachments.sql` — diasumsikan sudah; cek sebelum mengandalkan.
- `0019_inbox.sql` — sudah (Kotak Masuk Gmail jalan di produksi).
- `0020_reminders.sql` — sudah (Bos, 2026-10-28; Console D1 butuh SQL tanpa komentar `--` kalau ditempel satu baris).
- `0021_notifications.sql` — **belum dikonfirmasi** Bos (riwayat lonceng; tanpa tabel lonceng kosong, bukan error).

## Belum terverifikasi di produksi

- Slack: daftar channel & baca pesan (format balikan Composio tidak terdokumentasi rinci).
- Notion: tulis laporan bulanan.
- Gmail: teks "Terhubung sebagai email@…" di cek koneksi.
- Kotak Masuk di HP & panel per sumber (Gmail/Slack) — belum dicoba Bos.
- Shortcut iPhone (Pintasan, Automasi SMS, tempel clipboard Safari) & mode "Ucapkan" (mic otomatis).
- Asisten AI & MCP dengan awal periode anggaran ≠ 1.
- (sesi akun B 2026-10-28) Impor PDF asli (BCA & PDF bersandi) setelah perbaikan pdf.js worker; impor balik CSV ekspor.
- Pengingat: push sungguhan & ketuk → Input Cepat terisi; push wawasan mingguan pertama Senin 2 Nov 10:00 WIB.
- Resep Shortcut "Notifikasi aplikasi bank" (nama tindakan "Enkode URL"/variabel "Input Pintasan" di iPhone asli).
- Kartu e-money NFC: perlu kapabilitas "NFC Tag Reading" di App ID Apple, build & rilis ulang iOS/Android, tes kartu
  asli (Swift belum pernah dikompilasi).
- Tanya Leo dengan Ingatan asisten terisi (butuh OpenRouter produksi).
- Mode gelap: halaman selain Ringkasan belum dicek → tambahkan ke WEB_DARK_READY satu per satu.

## Catatan Impor
- Impor = riwayat: TIDAK mengubah saldo rekening (keputusan Bos 2026-10-28).
  Baris impor: `related_type='import'`, `related_id` = id batch, nama file di
  `payload_json.importName`. Impor lama (sebelum 2026-10-28) tidak punya batch
  → tidak muncul di Riwayat.
- Sebelum perbaikan, menghapus satu transaksi impor dari halaman Transaksi web
  ikut membalik saldo & total → saldo rekening user yang pernah melakukannya
  mungkin sudah bergeser (tidak bisa dideteksi otomatis).
- Impor belum ada di aplikasi HP (`/app/*`) — baru versi web.

## Langkah berikutnya / ide

Pola kerja dengan Bos (lanjutkan sama): Bos kirim screenshot Oyenza per menu Pengaturan →
bikin versi Leosiqra yang **fiturnya nyata tapi desainnya beda** (jangan sama) → uji lokal
(Playwright, ponsel/tablet/desktop) → commit+push branch → lapor ringkas → deploy hanya setelah
Bos bilang **"gas"**. Menu Pengaturan yang sudah dibuat: Fitur, Target, Transaksi rutin, Awal
periode anggaran, Tag, Cara catat utama, Keyboard nominal, Shortcut iPhone, Kategori & Anggaran, Pembaca Notifikasi, Impor mutasi (pop-up), Kartu e-money, Impor/ekspor CSV, Pengingat, Notifikasi.
Semua menu Pengaturan dari screenshot Oyenza sudah dibuat (2026-10-28). Sisa: pindahan multi-dompet dari app
lain (Money Manager dll — tunggu keputusan Bos soal saldo & pembuatan rekening), Bahasa English (dilewati),
mode gelap halaman lain (bertahap), menu Pengingat di aplikasi HP.
Mode HP: Bos minta tampilan HP **simpel** — jangan menambah kepadatan di <768px.

- Tunggu hasil tes Bos untuk poin di atas, perbaiki parser kalau perlu.
- Aplikasi terhubung versi HP (`/app/*`) belum ada — tombol Hubungkan membuka versi web.

## Cara deploy (ringkas)

Hanya setelah Bos bilang **"gas"**: `git push origin HEAD:main` (fast-forward
saja), lalu jalankan workflow `deploy-main.yml` dengan input `konfirmasi: gas`.
Workflow menjalankan tsc + build lalu deploy, dan memberi kabar ke Telegram.

## Routine / tugas terjadwal

Pasang di **satu akun saja**. Akun cadangan menyimpan salinan dalam keadaan
nonaktif dan hanya dinyalakan saat akun utama kena limit (lalu dimatikan lagi)
— kalau aktif di dua akun, notifikasi & aksi terjadi dua kali.

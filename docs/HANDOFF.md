# Serah terima antar-session

Catatan bersama untuk semua session Claude Code (dua akun memakai repo yang
sama, tidak ada ingatan yang terbagi selain file ini dan riwayat git).
**Baca di awal session, perbarui di akhir session, commit & push.**

Terakhir diperbarui: 2026-10-28 (akun B; Pembaca Notifikasi live, main = run #49)

## Siapa sedang kerja

| Akun | Status | Branch | Area |
|---|---|---|---|
| akun B | aktif | claude/nifty-cannon-y181p6 | Pengaturan (menu baru dari screenshot Oyenza) |

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
- **Belum di-deploy** (akun B, `claude/nifty-cannon-y181p6`): resep **Notifikasi aplikasi bank** — Bos
  konfirmasi iPhone-nya punya Pintasan › Automasi › Aplikasi › "Saat saya menerima notifikasi". Resep baru
  `notif` di `ShortcutsView` (Enkode URL → Buka URL `/input-cepat?teks=`), kartu pertama di Pembaca Notifikasi
  membuka Shortcut iPhone dengan resep itu terbuka (`initialOpen`). Nama tindakan "Enkode URL" & variabel
  "Input Pintasan" belum dicocokkan dengan iPhone asli.

## Migrasi D1

Dijalankan manual oleh Bos lewat Console D1 (token GitHub belum punya izin D1).
- `0017_coins.sql` — sudah (dikonfirmasi Bos).
- `0018_transaction_attachments.sql` — diasumsikan sudah; cek sebelum mengandalkan.
- `0019_inbox.sql` — sudah (Kotak Masuk Gmail jalan di produksi).

## Belum terverifikasi di produksi

- Slack: daftar channel & baca pesan (format balikan Composio tidak terdokumentasi rinci).
- Notion: tulis laporan bulanan.
- Gmail: teks "Terhubung sebagai email@…" di cek koneksi.
- Kotak Masuk di HP & panel per sumber (Gmail/Slack) — belum dicoba Bos.
- Shortcut iPhone (Pintasan, Automasi SMS, tempel clipboard Safari) & mode "Ucapkan" (mic otomatis).
- Asisten AI & MCP dengan awal periode anggaran ≠ 1.

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
periode anggaran, Tag, Cara catat utama, Keyboard nominal, Shortcut iPhone, Kategori & Anggaran, Pembaca Notifikasi.
Kemungkinan berikutnya dari screenshot Oyenza: "Impor dari e-money (NFC)", "Impor/ekspor CSV",
"Pembaca Notifikasi" (sudah, versi web).
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

# Serah terima antar-session

Catatan bersama untuk semua session Claude Code (dua akun memakai repo yang
sama, tidak ada ingatan yang terbagi selain file ini dan riwayat git).
**Baca di awal session, perbarui di akhir session, commit & push.**

Terakhir diperbarui: 2026-11-05 (live #127; claude/usahaku-web: Usahaku › Website siap deploy, tunggu "gas")

## Siapa sedang kerja

| Akun | Status | Branch | Area |
|---|---|---|---|
| Akun B | selesai, tunggu "gas" (2026-11-05) | claude/usahaku-web | Usahaku › website — siap deploy |

Isi baris ini saat mulai (mis. "akun B · aktif · claude/xyz · Worker inbox"),
kosongkan lagi saat selesai. Kalau ada akun lain tercatat aktif di area yang
sama, jangan ubah file yang sama — tanya Bos dulu.

## Menunggu

- **2026-11-05 (branch claude/usahaku-web) — Usahaku › Website SELESAI & dites lokal, BELUM deploy (tunggu "gas"). Tanpa SQL baru.**
  - Bagian "Website" di ShopDetail (`WebsiteSection`, `UsahaView.tsx`): belum ada link → kotak "Belum punya website?"
    (Salin brief markdown `websiteBrief()` di `shopService.ts` + Buka Pabrik.AI `https://app.vantis.sh` + Lihat isi brief),
    kolom tautan (DIPINDAH dari ContactForm), "Ambil daftar harga dari website" → pratinjau → Tambahkan (nama sama =
    harga ikut website, sisanya ditambah, maks 20) / Ganti semua / batal. Tahap "Promosi" → "Online" (`promotedAt` ATAU
    `linkUrl`).
  - Worker `POST /api/member/shops/:id/import-prices` (lihat kode: `fetchPublicPage`, `pageHtmlToText`, cadangan
    r.jina.ai, env `SHOP_IMPORT_READER=false` mematikan). Tambahan sesi ini: usaha bukan milik user → 404 sebelum fetch;
    `shopMoney` membuang sen ",00"/".00" dulu ("Rp1.500.000,00" → 1.500.000, dulu jadi 150 juta).
  - Dites lokal (wrangler + mock halaman/jina/AI): ditolak → http, localhost, 127.0.0.1, [::1], 2130706433,
    leosiqra.com, *.internal, redirect ke 127.0.0.1, `/studio?sessionId=`, 403, bukan HTML — kuota TIDAK terpotong;
    redirect ke halaman toko OK; halaman JS → `via: pembaca`; "Rp22.000" → 22000, harga 0 dibuang, `<script>` dinetralkan;
    tanpa sesi 401; kuota 5/hari menolak ke-6. UI Playwright web + HP (`/membership/ladang#usaha`, `/app/ladang#usaha`):
    salin brief, tautan editor ditolak, Tambahkan & Ganti semua tersimpan, tahap jadi Online, 0 error JS.
  - **Belum**: AI & situs ASLI (r.jina.ai dan Pabrik.AI tidak bisa dijangkau dari sandbox). Rate-limit AI (12/menit)
    ikut terpakai oleh permintaan yang ditolak validasi — sengaja dibiarkan (murah, mencegah spam).
  - **+ Kasir & katalog berkategori (permintaan Bos: katalog top up FF/MLBB/PUBG).** Produk punya `group` opsional
    (kategori, ≤40 karakter, di `products_json` — tanpa migrasi). `SHOP_PRODUCTS_MAX` 20 → **120** (frontend
    `PRODUCTS_MAX` sama). AI import mengisi `group`, teks halaman ≤30 rb karakter, `max_tokens` 9000. "Catat penjualan"
    jadi **"Buka kasir"** kalau ada kategori: pilih kategori (kotak + cari) → pilih nominal → **Nama / ID pembeli WAJIB**
    → jumlah/total/rekening → simpan. Sale menerima `buyer` (≤60, PIN/OTP ditolak) → catatan transaksi
    "[Usaha] Free Fire · 140 Diamond ×2 · 5550001 (2101) · Sari" + `payload_json.buyer`. Tambahkan saat import
    mencocokkan kategori+nama. Katalog WA & brief dikelompokkan per kategori. Dites lokal (mock): import 8 produk
    3 kategori, kasir web+HP, total 2×19.500 = 39.000, tanpa ID ditolak, saldo +10.000 sekali (kirim ulang 409),
    0 error JS. Gambar katalog PNG tetap 7 produk pertama.
- **2026-11-04 (branch claude/usahaku) — Usahaku + tab Ringkas + Jual pakai foto & Sedang dijual, live #127.**
  - Tabel `shops` & `listings` dibuat Bos di D1 Console pakai versi PENDEK (CREATE minimal + ALTER ADD COLUMN, tanpa
    FK/DEFAULT — baris panjang & tanda kutip rusak saat ditempel). Isinya setara file 0027/0028; hapus user/reset tetap
    menghapus manual. Kalau perlu cek: `PRAGMA table_info(shops)` / `(listings)`.
  - **Migrasi `cloudflare/migrations/0027_shops.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy** (tabel `shops`).
  - **+ Migrasi `cloudflare/migrations/0028_listings.sql` (tabel `listings`, "Sedang dijual") juga WAJIB sebelum deploy.**
  - **Jual pakai foto**: `SellFlow` punya Foto/Galeri → `itemService.scan` mengisi nama/varian, foto ikut ke
    `POST /items/appraise` (`image_base64`, ≤2 MB, magic bytes) → AI menilai kondisi (`appraisal.seen`). Setiap taksir
    sukses OTOMATIS membuat/memperbarui baris `listings` (per `listing_id`, atau iklan aktif untuk `item_id` yang sama;
    maks 50 aktif) + foto ke R2 `listings/<user>/…`. Ubah harga/judul/deskripsi → `PUT /api/member/listings/:id` (jeda
    800 ms). `POST /listings/:id/sold` = satu batch: pemasukan (Pemasukan › Jual Barang, related_type 'item') opsional +
    barang Barangku terjual + iklan terjual, bersyarat `status='dijual'` (diuji 3× paralel → 1×201 + 2×409). Tab Jual:
    "Sedang dijual" + badge di daftar Barangku; "Sudah terjual" gabungan iklan & barang (tanpa dobel).
  - Ladangku jadi 4 tab: `#ringkas` (default) / `#usaha` / `#jual` / `#tagih`.
  - **Ringkas** (`RingkasView.tsx`): "Cuan bulan ini" HANYA dari hasil Ladangku — pemasukan `related_type` 'shop' / 'item'
    atau sub 'Jual Barang' (gaji tidak ikut — alasan tab Target lama dihapus). Target opsional `prefs.cuanTarget`.
    Kartu ke Usahaku / Jual / Tagih + "Uang masuk bulan ini".
  - **Usahaku** (`UsahaView.tsx`, `shopService.ts`): `POST /api/member/shops/ideas` (AI, 3 rencana Rupiah, kuota 5/hari
    `$.shopIdeaAi`, dikembalikan kalau gagal, tanpa web search), CRUD `/api/member/shops` (maks 5/user), `POST /:id/sale`
    (pemasukan Usaha & Freelance › Penjualan + saldo, `request_id` → `payload_json.saleId` anti dobel). Tahap: Rencana →
    Katalog (WA + produk) → Promosi (`promoted_at`, saat salin/bagikan katalog) → Jualan (≥1 penjualan).
  - Katalog: teks WA, gambar PNG 1080×1350 (canvas di klien), tautan `wa.me/<62…>?text=`. TIDAK ada halaman publik.
    Tautan toko online opsional: https saja, tautan editor (`/studio`, `sessionId=` dll) ditolak. Catatan bayar yang
    memuat PIN/password/OTP/CVV ditolak. Nomor WA dinormalisasi ke 62….
  - Diuji lokal (D1 + mock AI): ide (sanitasi `<script>`, rentang dibalik → diurutkan, ide kosong dibuang), validasi tautan
    & PIN, penjualan 3× paralel → 1×201 + 2×409, saldo +44rb sekali, user lain → 404. **Belum**: respons AI asli.
- **2026-11-04 (branch claude/ladangku-3) — tab Target Ladangku DIHAPUS (permintaan Bos: ikut menghitung gaji yang
  kategorinya bukan "Gaji"), live #126.** `TargetView.tsx` dihapus; `#target` jatuh ke tab Jual. `prefs.cuanTarget`
  di Worker dibiarkan (tidak dipakai UI, tidak berbahaya).
- **2026-11-04 (branch claude/ladangku-2) — Ladangku tab Tagih & Target, live #125. Tanpa migrasi.**
  - Ladangku jadi 3 tab (hash `#jual` / `#tagih` / `#target`) di `src/components/ladang/LadangView.tsx`.
  - **Tagih** (`TagihView.tsx`): piutang belum lunas (`paidByDebt`/`debtRemaining`, hanya IDR), "Ingatkan" = `wa.me/?text=`
    (3 nada, kontak dipilih user — tanpa API WA), "Sudah bayar" = `debtService.pay` lunas penuh.
  - **Patungan** `POST /api/member/debts/split` (`handleSplitDebt`): bagi rata rupiah bulat (sisa ke orang pertama, jumlah =
    total persis), maks 20 nama (dobel beda huruf besar dibuang), rekening IDR WAJIB (kolom account_id NOT NULL + FK —
    'General' gagal FK). `apply_balance` (default true): saldo −(total−bagianku) untuk piutang (`balanceApplied`) +
    pengeluaran bagianku (kategori pilihan) lewat `quickTxBalanceStatements`. Anti dobel: `request_id` UUID klien →
    `payload_json.splitId`; baris berikutnya bersyarat EXISTS baris pertama. Diuji: 3× paralel → 1×201 + 2×409, saldo −350rb
    sekali; 100rb/3 = 33.334+33.333+33.333; tanpa potong saldo → saldo tetap.
  - **Target** (`TargetView.tsx`): cuan = pemasukan bulan ini selain Gaji/Hasil Investasi/kategori investasi, tanpa
    related_type debt/transfer/investasi. Target per bulan di `prefs.cuanTarget` (PUT /api/member/preferences, 0–1e11).
  - Buka toko (website publik) sengaja TIDAK dibuat (risiko hosting konten user/penipuan) — tunggu keputusan Bos.
- **2026-11-04 (branch claude/ladangku) — Ladangku (jual barang nganggur), live #124. Tanpa migrasi.**
  - Halaman `/membership/ladang` + `/app/ladang` (`src/components/ladang/*`), fitur `ladang` (menu Fitur, default nyala untuk
    user tanpa preferensi; `PREF_FEATURES` Worker ikut). Tombol "Jual di Ladangku" di editor Barangku (`?item=<id>`).
  - `POST /api/member/items/appraise`: AI (gemini-2.5-flash, fallback lite) + **plugin web OpenRouter (BERBAYAR per request,
    disetujui Bos)** → harga bawah/wajar/atas/cepat laku + judul & deskripsi iklan. Kuota **5×/user/hari** (`metadata_json
    $.appraiseAi`, atomik, dikembalikan kalau AI gagal) + `AI_PARSE_RATE_LIMITER`. Tautan iklan HANYA dari `annotations`
    url_citation (tautan karangan model dibuang — diuji). Kill switch: var `OPENROUTER_APPRAISE_WEB=false`.
  - `POST /api/member/items/:id/sell {price, account_id|null, date}`: satu batch — INSERT pemasukan (Pemasukan › Jual Barang,
    related_type 'item') bersyarat `status='aktif'` + saldo/total via `quickTxBalanceStatements` + item `terjual`
    (manual_value = harga laku). Diuji 3× paralel → 1×201 + 2×409, saldo naik sekali. Rekening wajib IDR.
  - Barang di luar Barangku: "Sudah laku" = `addTransaction` pemasukan biasa (applyBalance).
  - **Belum terverifikasi**: respons asli OpenRouter + plugin web (format `annotations`, kualitas harga) — lokal pakai mock.
    Cek setelah deploy dengan 1–2 taksiran sungguhan.
- **2026-11-04 (branch claude/koleksiku-2) — Koleksiku tahap 2, live #123:**
  - **Migrasi `cloudflare/migrations/0026_collectible_alerts.sql` (ALTER TABLE collectibles ADD COLUMN alert_price REAL)
    dijalankan Bos di D1 Console.** Tanpa kolom ini cron :45 diam (return), PUT cetakan tetap jalan (`.catch`).
  - **Steam (CS2)**: `POST /api/member/collectibles/steam/import {profile?}` (URL /id/, /profiles/, steamID64; kosong = profil
    tersimpan `users.metadata_json $.steam {id,syncedAt}`), jeda 2 menit/user. Inventaris publik
    `steamcommunity.com/inventory/<id64>/730/2` (maks 2 halaman × 2000), hanya `marketable = 1`, dikelompokkan per
    `market_hash_name` (= `ref_id`, kind `steam`). Sinkron ulang: jumlah diperbarui, yang hilang DIHAPUS (hanya kalau
    inventaris lengkap & tidak terpotong batas 2000). `DELETE /steam` = putuskan + hapus semua item Steam.
  - Harga Steam: Skinport `sales/history` (median 7 hari, 50 nama/panggilan). **Dari wrangler dev lokal Skinport selalu 406**
    (header `Accept-Encoding: br` jadi `identity` di proxy sandbox — terlihat di httpbin) → cadangan **Steam Market
    priceoverview** (USD, maks 15 nama/panggilan; harga Steam lebih tinggi dari Skinport). Di produksi BELUM terverifikasi
    apakah Skinport lolos (flag `brotli_content_encoding` aktif via compat date) — cek log setelah deploy.
  - **Progres set**: `GET /pokemon/sets` → kartu unik per set (`ref_id` sampai '-' terakhir) vs `cardCount.official` TCGdex
    (`/v2/en/sets/:id`, cache 24 jam), maks 20 set.
  - **Cron** (trigger tiap menit): menit :25 `refreshStaleCollectiblePrices` (8 kartu + 50 nama Steam paling basi lintas
    user), menit :45 `sendCollectiblePriceAlerts` (selisih ≥20% DAN ≥Rp50.000 × jumlah vs `alert_price` → 1 push/user,
    maks 12 user/jalan, klaim bersyarat `alert_price = old`; NULL = isi diam-diam). Toggle notifikasi `collectibles`.
  - Diuji lokal (D1 lokal + mock inventaris): import, privat → pesan jelas, sinkron ulang (hapus 4 tambah 1), POST
    kind steam ditolak, PUT nama/manual_value item steam diabaikan, sets, cron :25 update harga, cron :45 baseline lalu
    1 push (gabung nama sama), jalan ulang tidak dobel, +5% tidak dikirim. **Belum**: inventaris CS2 publik asli (yang
    dicoba semua privat/kosong), Skinport dari Cloudflare produksi.
- **2026-11-04 (branch claude/koleksiku) — Koleksiku tahap 1, live #122:**
  - **Migrasi `cloudflare/migrations/0025_collectibles.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy** (2 tabel:
    `collectibles`, `collectible_value_history`).
  - Tab Kekayaan `#koleksi` + `/app/koleksi` (`src/components/koleksi/*`). Jenis: `pokemon` (data & harga dari **TCGdex**
    api.tcgdex.net — publik, tanpa kunci; pokemontcg.io ditolak karena 5/8 percobaan 500/502) dan `lainnya` (nilai manual).
    Steam = tahap 2 (Skinport API butuh header `Accept-Encoding: br`; inventaris Steam publik bisa dibaca).
  - API `/api/member/collectibles` (+ `/pokemon/search`, `/pokemon/card/:id`, `/refresh`, `/:id`, `/:id/photo`), maks 2000/user.
    Harga diperbarui saat Koleksiku dibuka (`POST /refresh`, kartu > 20 jam, cache 12 jam) — BUKAN cron (cron gratis 50
    subrequest/jalan). Tiap refresh/perubahan → titik `collectible_value_history` hari itu (grafik).
  - Nilai IDR: `src/lib/collectibles.ts unitValueIdr` (cek kurs ada — `convert()` mengembalikan angka mentah kalau kurs
    kosong) = `snapshotCollectibleValue` Worker. Masuk Kekayaan bersih (`computeNetWorth.collectiblesValueIdr`).
- **2026-11-04 (branch claude/langgananku) — Langgananku + Radar, live #120:**
  - **Migrasi `cloudflare/migrations/0024_subscriptions.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy.**
  - Memantau langganan (BUKAN Transaksi Rutin; tidak mencatat transaksi). API `/api/member/subscriptions` (GET/POST,
    `/:id` PUT/DELETE), maks 200/user. Jadwal = `anchor_date` + kelipatan siklus (mingguan/bulanan/3bulan/tahunan,
    tgl 31 → hari terakhir bulan) — `src/lib/subscriptions.ts nextCharge` = SQL cron (diuji 0 beda).
  - Cron harian `sendSubscriptionReminders`: H-1 sebelum ditagih (aktif), H-2 sebelum masa coba habis (coba), maks 30/user,
    toggle notifikasi `subscriptions`. Push → `/membership/langganan` (app: `/app/langganan`).
  - Katalog 47 layanan `src/lib/subscriptionCatalog.ts` (harga = PERKIRAAN). Logo (live #121): ikon HD diunduh SAAT DEPLOY
    oleh `scripts/fetch-logos.mjs` ke `/logos/<domain>.png` (cek nama aplikasi `app:`), `SubLogo` tidak memakai /api/logo
    (Worker gagal ke API Apple → favicon pecah & lambat); tanpa file → huruf warna merek. Radar: `radarScan` lokal (tanpa AI) atas pengeluaran **30 hari** (keputusan Bos):
    cocok katalog = "pasti", nama sama ≥2× nominal ±15% jarak teratur = "mungkin". Animasi `RadarScan.tsx`.
  - Juga di branch ini: Kotak Masuk + lonceng hanya di halaman Keuangan (`Header.tsx`, prefix dari `keuanganNav`);
    Kekayaan dirapikan (judul+Tambah satu baris, tab baris sendiri & label pendek di HP, grup kosong → baris
    "Belum dicatat", urutan Kas→Tabungan→Investasi→Barangku→Piutang→Kewajiban, komposisi "<1%", grafik HP 110px).
  - Menu: fitur `langganan` (features.ts + PREF_FEATURES Worker, bawaan ON untuk user baru), navGroups Transaksi,
    app Lainnya → Langgananku. Tahap 2 (belum): deteksi harga naik, cek dobel, status sudah dibayar.
- **2026-11-04 security check (branch claude/security-cron-flood):** 🟠 cron pengingat bisa dibanjiri satu akun
  (LIMIT global) → diperbaiki dengan batas per user `ROW_NUMBER() OVER (PARTITION BY user_id)` di 4 cron + hutang
  disaring H-3/H-1 di SQL; foto barang ≤2 MB + 12/menit; tanggal 2026-02-31 ditolak. Rincian & bukti:
  `.claude/skills/security-check/references/triaged.md`.
- **2026-11-04 (branch claude/fitur-barang) — Barangku, live #117 (migrasi 0023 dijalankan Bos? cek "Fitur Barangku belum aktif"):**
  - **Migrasi `cloudflare/migrations/0023_items.sql` WAJIB dijalankan Bos di D1 Console sebelum deploy**
    (tanpa tabel: API balas 503 "belum aktif", Ringkasan Kekayaan tetap jalan, cron garansi dilewati).
  - API `/api/member/items` (GET/POST), `/:id` (PUT/DELETE), `/:id/photo` (GET/PUT/DELETE, R2 `items/<user>/<id>-<acak>`,
    JPG/PNG/WebP ≤5 MB, hanya pemilik). Maks 500 barang/user. Reset data & hapus user (admin) ikut hapus foto.
  - Cron harian `sendWarrantyReminders`: H-30 & H-7 sebelum `warranty_until`, klaim `warranty_reminded_for`, toggle `warranty`.
  - UI: tab Kekayaan `#barangku` + `/app/barangku` (komponen sama `src/components/barangku/*`), nilai sekarang
    `src/lib/itemValue.ts` (susut per kategori, mode auto/tetap/manual), masuk Kekayaan bersih (`computeNetWorth.itemsValueIdr`).
  - Teruji: wrangler dev lokal (CRUD, validasi, akses user lain 404, foto, cron 2× tanpa dobel, reset hapus foto) + Playwright mock.
  - Tahap 2 live #118: `POST /api/member/items/scan` (AI OpenRouter baca foto barang/struk → saran,
    tidak menyimpan; rate limit AI parse; harga/tanggal/garansi hanya kalau tercetak). Form: pilih foto barang baru → AI
    otomatis, isi kolom kosong saja, foto struk tidak dipakai sebagai foto barang. "Jadikan barang": daftar transaksi web
    (ikon 📦 saat hover / tombol di HP web) & detail transaksi app → `?dari=<id>` → form terisi nama, harga IDR, tanggal.
    Fitur Koleksi terpisah (nanti).
- **2026-11-04 (branch claude/app-skor-sisa):**
  - Live #115: Skor Kesehatan di Beranda app HP (`AppHealthScore`), "Masa aktif sisa N hari" di /app/profile.
  - Live #116: **jatuh tempo hutang/piutang** di `payload_json.due` (`{date}` sekali / `{day}` tiap bulan,
    tanpa migrasi). POST/PUT `/api/member/transactions` terima `due` (hanya type debt; PUT `due:null` = hapus,
    ganti due menghapus `dueRemindedFor`). `sendDebtDueReminders` (cron harian): H-3 & H-1, sisa = pokok − bayaran
    tertaut, klaim `payload_json.dueRemindedFor`, ikut toggle `bills`. UI: DebtModal & HutangPanel web
    (`DueDateInput`), AddDebtSheet/DebtDetailSheet/daftar app (`DueDateField`), helper `src/lib/debtDue.ts`.
    appUrl: `/membership/kekayaan#hutang` → `/app/debts`, `?pengaturan=paket` → `/app/profile`.
    Teruji: wrangler dev lokal (cron 2× tanpa dobel, validasi API) + Playwright mock. Belum: push sungguhan.
- **2026-11-03 malam, deploy #114 (3 ide Tower di-ACC Bos):**
  - Mode gelap web sisa: Investasiku, Kekayaan/Tabungan, Kotak Masuk (`.web-keep` di kartu yang selalu gelap).
  - `sendPlanExpiryReminders` (cron harian): push H-3 & H-1 sebelum `expired_at` (trial/PRO), klaim
    `$.prefs.planRemind`. Belum: email & "sisa N hari" di /app/profile.
  - `sendBudgetAlerts` (cron menit, tiap jam menit ke-5): anggaran kategori 80% lalu 100%, state
    `$.prefs.budgetAlert`, CAS. `sendBillReminders` (harian): transaksi rutin Pengeluaran/Tabungan H-3,
    klaim `payload_json.remindedFor`. NOTIFY_KEYS + `budget`, `bills` (toggle di Pengaturan → Notifikasi).
    Hutang/cicilan H-3 tidak bisa: tabel hutang tak punya tanggal jatuh tempo.
  - Skor Kesehatan Finansial (`src/lib/healthScore.ts`, `HealthScoreCard`) di dashboard web saja, dihitung
    di browser. Belum: versi HP, kartu bagikan.
  - Belum terverifikasi di produksi: ketiga push baru (butuh kondisi data nyata).
- **2026-11-03 malam (live setelah deploy ini):**
  - Sesi app native permanen seperti PWA: /masuk & /auth/login kirim `isPwa: true` juga untuk Capacitor
    (`isNativeApp`). Dulu 30 hari & dihitung sesi web (bisa ditendang MAX_CONCURRENT_WEB_SESSIONS).
  - Tag HP lengkap: `src/components/app/AppTagChips.tsx` (pilih + "Tag baru" → prefs.tags), dipakai form & detail
    transaksi (detail: tiap ketuk PUT {tags}, juga untuk transfer/tertaut).
  - Mode gelap web +6 halaman (lihat komentar `src/lib/webTheme.ts`); kelas `.web-keep` untuk kartu yang selalu
    gelap. Belum: Investasiku (pakai .web-keep di kartu nilai + tombol kembali + bar bawah), Kekayaan, Kotak Masuk.
  - Tower: ide Import mutasi → diterapkan; ide Pengingat pintar diberi `catatanDev` (yang sudah/belum ada).
    (Ketiga ide itu sudah dikerjakan — lihat entri deploy #114 di atas.)
- **Cron pengingat per menit** (c15533c, live deploy #111): akun Cloudflare = **Workers Free, maks 5 cron per AKUN**
  (deploy 273a32e gagal saat menambah trigger ke-4 di worker ini). Trigger `*/10` diganti `* * * * *`: tiap menit
  `sendDueReminders`; menit kelipatan 10 (`event.scheduledTime`) tugas lama 10 menit (promo, pengingat harian, Gmail,
  Slack). JANGAN menambah trigger baru — gabungkan ke cabang yang ada. Belum dipantau di produksi (cek pengingat ±1
  menit & video promo/Gmail tetap jalan).
- **Angka app HP = web** (6a54e55): beli/jual investasi netral (`txKind`), Beranda Pemasukan tanpa transfer masuk,
  Statistik tanpa investasi, ringkasan /app/transactions via txKind.
- **Tag di app HP** (`claude/app-tag`, 2026-11-03): sheet Tambah Transaksi menampilkan chip tag (prefs.tags, hanya
  kalau Tag nyala & ada daftar; bukan transfer), maks 5; quickTxService kirim tag lewat PUT /transactions/:id setelah
  quick-transaction (tanpa ubah Worker; gagal tag ≠ gagal transaksi). /app/transactions: chip tag per baris, filter
  per tag, pencarian ikut nama tag. Belum: membuat tag baru dari HP (tetap lewat Pengaturan web), ubah tag transaksi
  lama di HP.
- **App HP Tabungan** (`claude/app-target-tabungan`, 2026-11-03): kartu target di `/app/savings` kini ikon + warna
  (`targetIcon`/`targetColor` dari lib/targets, sama dengan web), nama target, progres berwarna, "🎉 Tercapai",
  "N bln lagi · Rp X/bln" (`neededPerMonth`). Target tanpa setoran tetap tampil; target di depan. Daftar
  "Setoran otomatis" hanya target dengan nominal > 0 (dulu "Rp 0 tiap bulan").
- **Rilis APK ke GitHub Releases** (c10aa1e, 2026-11-03): workflow manual `release-android.yml` (isi versi 1.2.3 →
  APK bertanda tangan kunci tetap → Release `v<versi>` + `leosiqra-<versi>.apk`). versionCode = 100 + nomor run.
  BELUM bisa jalan sampai Bos mengisi secret `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (keystore dibuat Bos di Termux — bukan kunci Play Store). Pertama kali
  pasang rilis: hapus APK debug dulu (beda kunci). Deploy #106 (tablet, /masuk, notifikasi) live; APK debug dengan
  presentationOptions = run Build APK Android #3.
- **App native: tablet, login app, notifikasi saat app dibuka** (`claude/app-tablet-login`, 2026-11-03):
  - Tablet (Capacitor, sisi layar terpendek ≥ 600dp, `src/lib/device.ts` `isNativeTablet`) → AppShell mengalihkan ke
    `/membership/dashboard` (tampilan web). Layout /membership di native: initNativePush + tombol back Android
    (Ringkasan → minimize), belum login → `/masuk`. HP tetap /app.
  - Halaman masuk app `/masuk` (email, sandi, Lupa sandi, "Belum punya akun? Daftar" → /auth/register): dipakai saat
    belum login di native (AppShell, logout Profil /app, /membership). Web tetap /auth/login & /mulai. Tanpa Google
    (OAuth Google diblokir di WebView).
  - Push saat app di depan: Android tidak menampilkan notifikasi FCM; `capacitor.config.ts`
    `PushNotifications.presentationOptions` ["badge","sound","alert"] → plugin menampilkan notifikasi sistem
    (BUTUH APK BARU). Event `leosiqra:push` memuat ulang lonceng. Belum diuji di HP.
- **Input suara app Android** (ea3f686, live 2026-11-03): perekam WebView selalu "Izin mikrofon ditolak" karena
  manifest tidak punya `MODIFY_AUDIO_SETTINGS` (BridgeWebChromeClient Capacitor meminta itu + RECORD_AUDIO).
  Sementara: di native, NotAllowedError → pengenal suara bawaan HP (plugin speech-recognition). Permanen: izin
  sudah ditambah di manifest → perlu build APK baru (`build-android.yml`) & pasang ulang. Belum dicoba Bos di HP.
- **Push native Android (FCM) AKTIF** (2026-11-03): migrasi 0022 dijalankan via API D1 (sesi Termux, atas
  perintah Bos), secret `FCM_SERVICE_ACCOUNT` terpasang, APK debug (`leosiqra-debug-1`) dipasang di HP Bos →
  token terdaftar → pengingat tes MUNCUL sebagai notifikasi HP. Sisa: rilis Play Store (keystore lama belum
  ketemu, `versionCode` masih 1), iOS belum (perlu Firebase Messaging di app iOS).
  Live juga (d28645a): di app HP, ketuk pengingat bernominal (push native & daftar Notifikasi /app) membuka
  sheet **Tambah Transaksi** terisi nominal+catatan, kategori dikosongkan (wajib pilih) — `src/lib/txPrefill.ts`
  (`openAppNotificationUrl`, antrean `pending` sampai layout tab terpasang). Web tetap ke Input Cepat. Belum dicoba
  Bos di HP setelah deploy.
- Live (2026-11-03 sore, `claude/input-hp-v2`): **form Tambah Transaksi app HP v2** (permintaan Bos, contoh disetujui):
  panel warna atas (merah Keluar / hijau Masuk / ungu Transfer) berisi kapsul jenis, tombol kalkulator & ✨, nominal
  besar, pil kategori + pil "rekening · tanggal"; kategori satu baris ikon bulat (`CategoryGrid layout="row"`,
  "Lainnya" = semua petak); pil kedua membuka Detail (rekening/Dari-Ke, tanggal, catatan; keypad disembunyikan);
  transfer = kotak Dari ⇄ Ke; keypad datar `AmountKeypad variant="flat"` (000 untuk IDR/KHR, "." untuk USD dll.,
  kalkulator lewat tombol panel); satu tombol Simpan bergradasi. `BottomSheet bare`. Logika simpan TIDAK berubah
  (diuji Playwright + API tiruan: payload quick-transaction benar, Batalkan muncul). Sheet lain yang memakai
  AmountKeypad/BottomSheet tidak berubah (prop baru opsional).
  v3 (masukan Bos dari HP): "Lainnya"/pil kategori membuka semua kategori TANPA keypad (keypad kembali setelah
  kategori dipilih atau nominal diketuk — "Ketuk nominal untuk mengetik"); baris ringkas otomatis bergeser ke
  kategori terpilih; pilihan rekening = kartu 2 kolom dengan logo (logoUrl → matchIndonesianInstitutionLogo →
  emoji jenis) + saldo (ikut sembunyikan-saldo `useBalanceVisibility`; tanpa sen untuk IDR/KHR).
  v4: lembar Detail + tombol Selesai DIHAPUS — semua satu halaman. Panel atas: pil kategori, pil rekening (logo
  kecil), pil tanggal. Rekening & tanggal = pop-up di dalam sheet (`picker` "acc"/"to"/"date"), satu ketukan
  memilih & menutup. Catatan = kolom tipis di bawah kategori. Transfer: Dari/Ke dengan logo, masing-masing pop-up.
  v5: tombol ✨ = mode AI — keypad, kategori & catatan disembunyikan, tampil 3 tombol besar Suara / Foto struk / Ketik
  (`SmartBar layout="tiles"`; layout bawaan "bar" di /input-cepat tidak berubah). Setelah AI mengisi, mode AI
  tertutup otomatis → form biasa + catatan "Terisi dari …". Suara & foto memakai AI sungguhan (belum dicoba di HP
  setelah perubahan ini; di headless hanya jalur Ketik yang diuji).
- Live (0b277e8, 2026-11-03): **form Tambah Transaksi app HP satu layar** (pilihan Bos) — `AddTransactionSheet` +
  `src/components/app/CategoryGrid.tsx` (petak ikon, urut paling sering dipakai, "Lainnya", pil sub-kategori),
  rekening jadi pil (`AccountPills`), tanggal+Catatan satu baris, SmartBar dilipat ke tombol ✨, keypad tombol `000`
  (AmountKeypad dipakai sheet lain juga). Diuji Playwright + API tiruan (tanpa font emoji); simpan sungguhan & data
  asli belum dicoba Bos. Usulan terbuka: tampilan nominal "IDR 25,000" → "Rp 25.000".
- Token D1 lokal (cek/migrasi dari HP) hanya ada di HP Termux: `/data/data/com.termux/files/home/.config/leosiqra/cloudflare.env`.

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
  - (2026-11-03, AKTIF & teruji di HP Bos — migrasi 0022 + secret sudah) **Push native Android via FCM**: plugin
    `@capacitor/push-notifications` (src/lib/nativePush.ts, dipanggil AppShell setelah login: izin → token →
    POST /api/member/native-push-token). Worker `sendNativePushToUser` dipanggil dari `sendWebPushToUser` (semua
    notifikasi lonceng ikut ke HP); OAuth service account RS256 via WebCrypto (diuji dengan kunci RSA nyata).
    Token diikat ke SESI (JOIN sessions saat kirim; logout = berhenti; cron harian hapus token tanpa sesi).
    Butuh: migrasi 0022, secret Worker `FCM_SERVICE_ACCOUNT` (JSON service account), `android/app/google-services.json`,
    build ulang APK. iOS BELUM: APNs wajib HTTP/2, subrequest Worker HTTP/1.1 → perlu Firebase Messaging di app iOS.
    Android: izin POST_NOTIFICATIONS, ikon status `ic_stat_leosiqra` (vector), warna `notification_accent`.
    Status 2026-11-03 sore: `android/app/google-services.json` SUDAH di branch (248b402, project
    `leosiqra-a02fe`). Review keamanan (sesi cloud): 🟠 token per user tidak dibatasi + token palsu (FCM 400
    INVALID_ARGUMENT) tidak pernah dihapus → satu user bisa daftar ribuan token, tiap notifikasinya ribuan fetch →
    cron pengingat/ringkasan habis jatah subrequest untuk user lain. **Wajib tambal sebelum deploy**: maks 5 token
    per user (hapus tertua setelah INSERT) + hapus token saat FCM 400 INVALID_ARGUMENT. 🟡: flag `started` di
    nativePush.ts → login akun lain tanpa tutup app tidak daftar ulang token; URL notif `/membership/*` membuka
    UI web di app. Belum ada workflow build APK (Bos hanya punya Termux, tanpa PC) → usul `build-android.yml`
    (assembleDebug, APK diunduh dari Actions); rilis Play Store butuh keystore lama (lokasi belum diketahui) +
    naikkan `versionCode` (masih 1). Masih menunggu Bos: secret `FCM_SERVICE_ACCOUNT`, migrasi 0022, "gas".
    **Ditambal (2026-11-03 malam, Termux)**: 🟠 maks 5 token/user (`NATIVE_PUSH_MAX_TOKENS`, batch upsert+prune;
    kirim juga LIMIT 5) + hapus token saat FCM 400 soal "registration token" (400 lain, mis. payload salah, TIDAK
    menghapus) — diuji SQLite (1000 token palsu → 5) & klasifikasi error. 🟡 `initNativePush(userId, openUrl, force)`
    daftar ulang saat user berganti / AppShell dipasang ulang (logout→login sesi baru); `toAppUrl`
    (src/lib/appUrl.ts) memetakan URL /membership/* ke /app/* untuk ketuk push & daftar lonceng app.
    Workflow **`build-android.yml`**: APK debug (Actions → Artifacts), manual atau otomatis saat push branch
    `claude/**` yang mengubah android/, package*.json, capacitor.config.ts. Keystore upload Play Store TIDAK ada
    di HP Termux (cek ~/.config/leosiqra-android) — APK debug harus menggantikan versi Play Store (hapus dulu).
  - Live (2026-11-03, deploy eb9effde) Aplikasi HP: `/app/notifikasi` (tab Notifikasi + Pengingat, `?tab=pengingat`),
    lonceng + angka belum dibaca di Beranda `/app`, menu "Pengingat" di Lainnya. Daftar notifikasi dipakai bersama
    (`src/components/notifications/NotificationList.tsx`) oleh lonceng web & HP. `RemindersView` punya varian dark:
    (hanya aktif di /app). Native Capacitor TIDAK punya web push → banner "muncul di tab Notifikasi"; push native
    (FCM/APNs, @capacitor/push-notifications) belum dibuat. Push sungguhan belum dicoba Bos.
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
- **Live (run #82)** (akun B, frontend saja): **halaman Kekayaan** `/membership/kekayaan` —
  Tabungan + Hutang & Piutang + ringkasan kekayaan bersih jadi satu, tab di hash (`#tabungan`, `#hutang`). Halaman lama
  dipindah utuh jadi `components/kekayaan/TabunganPanel.tsx` & `HutangPanel.tsx` (logika uang tidak berubah);
  `/membership/tabungan` & `/membership/transactions/debt` → redirect. Rumus di `lib/netWorth.ts`: kas (rekening
  non-kartu, kurs) + tabungan (setor − tarik) + investasi (non-Planned, nilai kini) + piutang sisa − kartu kredit terpakai
  − hutang sisa (hutang "Kartu Kredit" yg menempel ke rekening kartu tidak dobel). Grafik jejak = mundur dari angka hari ini
  pakai pemasukan/pengeluaran (tanpa investasi/transfer/cicilan hutang) — PERKIRAAN, tertulis di halaman. Fitur menu:
  id 'tabungan' = "Kekayaan"; 'hutang' dinormalisasi ke 'tabungan' (`normalizeFeatures`), Worker tidak diubah.
- **Live (run #83)** (akun B, frontend saja): **rapikan menu** — Laporan Tahunan DIHAPUS (`/membership/annual` →
  redirect `/membership/laporan`, dobel dengan mode Tahunan). Cetak/PDF pindah ke Laporan: tombol "Cetak / PDF"
  (window.print) + kop khusus cetak + CSS @media print di halaman itu (bulanan & tahunan). Dompet Bersama, Impor &
  Kotak Masuk keluar dari menu Fitur (halaman tetap; Dompet Bersama & Impor ada di Pengaturan / Catat Transaksi).
  Kotak Masuk jadi ikon `InboxButton` di samping lonceng (Header), dengan angka usulan menunggu.
- **Live (run #84)** (akun B, frontend saja): **tampilan Hutang & Piutang** (`HutangPanel`) — tabel 15 kolom diganti
  kartu per catatan (sisa, progres pelunasan, sejak/rekening/cicilan/bunga), neraca hutang vs piutang + selisih, saring
  Semua/Hutang/Piutang, modal cicilan dengan tombol 25%/50%/semua sisa + pratinjau sisa. Fungsi uang (cicilan, lunas,
  hapus) TIDAK diubah — catatan: masih multi-request dari klien (bukan batch atomik), sama seperti sebelumnya.
- **Live (run #85)** (akun B, frontend saja): **form Tambah/Ubah Rekening** (`AccountModal`) — pratinjau kartu langsung,
  jenis jadi tombol ikon (tanpa "Investasi" — rekening lama berjenis itu tetap bisa diedit), pilihan cepat bank/e-wallet
  berlogo, input saldo besar + mata uang ringkas. Logika simpan sama.
  `CurrencySelect` dapat prop `compact` & selalu memuat IDR + nilai terpilih (dulu daftar kosong → "-- Pilih --" walau IDR).
  Rencana: form lain menyusul bertahap (Bos minta "semua form").
- **Live (run #86)** (akun B, frontend saja): **Kekayaan → tombol Tambah** (tahap 1). Menu "Tambah ke kekayaan":
  Akun, Kartu kredit, Investasi, Target tabungan, Piutang/utang, Transfer (pakai modal yang sudah ada); Properti/kendaraan
  & Barang/koleksi bertanda "Segera" (butuh tempat simpan baru = migrasi). "Akun" → `AddAccountPicker` (cari + saring,
  26 bank + 9 e-wallet/pembayaran berlogo, Tunai, Kartu kredit, Isi manual) → `AccountModal` dengan prop `preset`
  (nama/jenis/logo terisi; dikirim lewat modalData 'rekening'). Investasi/kripto sengaja tidak jadi rekening.
  `indonesianBanks.ts`: + PayPal, Wise, Revolut.
- **Live (run #87)** (akun B, Worker ikut, tanpa migrasi): **Kekayaan → Tambah → Investasi**
  (`AddInvestmentModal`). Jenis: Saham Indonesia, Kripto, Saham AS & ETF (Harga otomatis: cari ticker →
  `/api/member/stock-search` / CoinGecko search, harga dari `/api/member/stock-price` / CoinGecko simple/price IDR),
  Emas, Reksa dana, Obligasi/SBN, Lainnya (manual), Deposito → modal deposito lama. Saham IDX bisa input lot/lembar.
  Sumber dana WAJIB (keputusan Bos) — simpan lewat `investmentService.entry` (batch atomik, saldo terpotong, transaksi
  tertaut). Worker: pencarian saham kini ikut ETF (quoteType ETF), cache `stock-search-v3`.
  **Bug lama (belum diperbaiki)**: Worker tidak mengonversi mata uang posisi ↔ rekening — posisi USD dari rekening
  IDR memotong angka USD mentah. Form baru MENCEGAH (saham USD wajib rekening USD); form saham/investasi lama masih
  bisa memicunya.
- **Live (run #88)** (akun B, Worker ikut, tanpa migrasi): **Jejak Uang** `/membership/jejak-uang`
  (`components/jejak/JejakUang.tsx`) — versi kita dari "Ikuti uangmu" Oyenza: diagram aliran (Sankey SVG buatan sendiri)
  sumber pemasukan → total → kategori (top 6 + Lainnya) → tempat (judul transaksi, top 3 + "N tempat lain"); di HP 3 kolom
  + rincian tempat saat kategori diketuk. Bulanan/Tahunan. Data = pemasukan/pengeluaran tanpa isInvestmentFlow (sama
  Laporan). Pengeluaran > pemasukan → node "Dari simpanan" (penyeimbang, bukan data). Animasi: pita terbuka kiri→kanan
  (clipPath), partikel mengalir (stroke-dash), node tumbuh; reduced-motion dihormati. Node punya tinggi minimum (MINH)
  → pita beda tebal di kedua ujung. Fitur baru id `jejak` (FEATURES, DEFAULT_FEATURES, navGroups, Worker PREF_FEATURES)
  — user yang sudah punya preferensi Fitur harus menyalakannya sendiri di Atur fitur.
- **Live (run #89)** (akun B, Worker ikut, tanpa migrasi): **logo bank resolusi tinggi + tautkan akun**.
  Bug: logo bank kosong (huruf) di pemilih akun — favicon Google cuma 16px untuk banyak situs bank & LogoImage
  menganggap ≤16px gagal. Kini Worker `GET /api/logo?d=<domain>` (sesi wajib, whitelist LOGO_DOMAINS = daftar di
  `src/lib/indonesianBanks.ts`, SVG ditolak, cache edge 7 hari / 404 1 hari): coba apple-touch-icon → `<link rel=icon>`
  terbesar di beranda → faviconV2. `LogoImage` mengarahkan URL favicon Google untuk domain itu ke /api/logo (berlaku
  juga ke logo lama di DB). **Belum terverifikasi di prod** (sandbox tanpa internet) — kalau masih huruf, cek
  `curl https://www.leosiqra.com/api/logo?d=bca.co.id` dengan cookie sesi.
  Tautkan: rekening punya `purpose` 'belanja'|'nabung' di payload_json (Worker validasi). Pemilih akun menandai bank
  yang sudah dimiliki ("✓ Sudah ada") → layar "Tautkan <bank>": atur belanja/nabung per rekening (+ pasang logo kalau
  belum ada) atau "Tambah rekening <bank> lain". AccountModal punya pilihan "Dipakai untuk". Kekayaan menampilkan label.
  Catatan: purpose saat ini HANYA label/pengelompokan — tidak mengubah cara saldo dihitung.
- **Live (run #90)** (akun B, frontend saja): Tambah investasi → Deposito kini membuka form deposito DI ATAS popup
  (popup Tambah investasi tidak ditutup).
- **Live (run #91)** (akun B, Worker ikut, tanpa migrasi): **logo bank HD dari ikon aplikasi App Store**.
  Bos lapor logo masih ada yang kosong & tidak HD setelah run #89. `/api/logo` kini PERTAMA mengambil ikon aplikasi
  resmi 512px lewat API iTunes (`APP_ICONS` di Worker: App Store ID terverifikasi untuk Livin'/BRImo/wondr/BSI/OCTO/bale,
  sisanya cari nama aplikasi + cocokkan nama penerbit), baru apple-touch-icon / favicon. Cache dinaikkan ke `logo/v2`.
  Belum terverifikasi di prod (sandbox tidak bisa akses Apple/Play Store). Kalau masih ada yang kosong: perbaiki
  `term`/`seller` atau isi `id` (App Store ID) untuk domain itu di APP_ICONS.
- **Live (run #91)** — **Banner "Leosiqra sedang dalam pengembangan"** (akun B, 2026-10-30, permintaan Bos sebelum jeda limit mingguan):
  `src/components/DevNoticeBanner.tsx` — web (di bawah Header membership) & app HP (pil di atas tab bar `/app`), link ke
  Saran. Bisa ditutup; muncul lagi setelah 3 hari. **Matikan** dengan `ENABLED = false` di file itu setelah fase
  pengembangan selesai.
- **Live (run #92)** (akun B, frontend + workflow): **logo bank HD diunduh saat deploy** — log: 36/37 OK (BCA mobile, Livin', OCTO, BRImo, wondr, dll via App Store; blu & Jago via Play). UOB gagal, Citibank salah ambil ikon "Citilink" (seller regex /citi/ terlalu longgar). Run #91 terbukti: ikon App
  Store dari Worker TIDAK muncul (BCA/Mandiri/CIMB masih favicon pecah, BRI dll huruf) — panggilan API Apple dari
  Worker gagal. Kini `scripts/fetch-logos.mjs` dijalankan GitHub Actions (step "Logo bank (HD)", continue-on-error)
  sebelum build: App Store (iTunes lookup/search) → cadangan Google Play og:image, cek nama penerbit, simpan
  `public/logos/<domain>.png` (256px, di-.gitignore). LogoImage: `/logos/<domain>.png` → kalau 404 `/api/logo` → huruf.
  **Cek laporan "Logo bank: N/37 berhasil" di log job deploy**; domain GAGAL → perbaiki term/id/play/seller di skrip.

## Migrasi D1

Dijalankan manual oleh Bos lewat Console D1 (token GitHub belum punya izin D1).
Cek/eksekusi dari HP (akun ini): token D1 lokal di `/data/data/com.termux/files/home/.config/leosiqra/cloudflare.env`
(chmod 600, di luar repo, jangan dicetak). Pakai: `set -a; . <file>; set +a; cd cloudflare; npx wrangler d1 execute
membersite_leosiqra_db --remote --command "..."`. SELECT boleh langsung; tulis/ubah skema → tanya Bos dulu.
- `0017_coins.sql` — sudah (dikonfirmasi Bos).
- `0018_transaction_attachments.sql` — sudah (dicek langsung ke D1 2026-11-03).
- `0019_inbox.sql` — sudah (Kotak Masuk Gmail jalan di produksi).
- `0020_reminders.sql` — sudah (Bos, 2026-10-28; Console D1 butuh SQL tanpa komentar `--` kalau ditempel satu baris).
- `0021_notifications.sql` — sudah (dicek langsung ke D1 2026-11-03).
- `0022_native_push_tokens.sql` — **BELUM** (token push Android/FCM; tanpa tabel: endpoint 503, kirim dilewati — aman).

## Belum terverifikasi di produksi

- Slack: daftar channel & baca pesan (format balikan Composio tidak terdokumentasi rinci).
- Notion: tulis laporan bulanan.
- Gmail: teks "Terhubung sebagai email@…" di cek koneksi.
- Kotak Masuk di HP & panel per sumber (Gmail/Slack) — belum dicoba Bos.
- Shortcut iPhone (Pintasan, Automasi SMS, tempel clipboard Safari) & mode "Ucapkan" (mic otomatis).
- Asisten AI & MCP dengan awal periode anggaran ≠ 1.
- (sesi akun B 2026-10-28) Impor PDF asli (BCA & PDF bersandi) setelah perbaikan pdf.js worker; impor balik CSV ekspor.
- Pengingat: push sungguhan & ketuk → Input Cepat terisi.
- Wawasan mingguan: Senin 2 Nov jalan tapi 0 terkirim (2 pelanggan push tanpa transaksi; Bos tak punya langganan
  push). Live 2026-11-03 (deploy 8996fe8c): kandidat = semua user aktif yg punya transaksi (8 hari / sejak awal
  bulan), selalu masuk lonceng, push hanya pelanggan. **Cek lonceng Senin 9 Nov 10:00 WIB** (3 user: 7b434d,
  dd335d, 0e02e0) & rekap November 1 Des. Catatan: penanda dipasang sebelum hitung → kalau hitung error, user
  itu terlewat minggu itu (console.error saja).
- User dd335d = akun demo `leowendry+demo@gmail.com` (routine Tim Konten): login harian 08.46 WIB (curl,
  promo/demo-seed.mjs) & ±14.45 WIB (Chrome Linux, promo/record.mjs) itu NORMAL, bukan penyusup.
- Resep Shortcut "Notifikasi aplikasi bank" (nama tindakan "Enkode URL"/variabel "Input Pintasan" di iPhone asli).
- Kartu e-money NFC: perlu kapabilitas "NFC Tag Reading" di App ID Apple, build & rilis ulang iOS/Android, tes kartu
  asli (Swift belum pernah dikompilasi).
- Tanya Leo dengan Ingatan asisten terisi (butuh OpenRouter produksi).
- Uji UI di HP Termux ini: `workerd` (wrangler dev lokal) TIDAK bisa jalan (tcmalloc 48-bit VA). Pola yang jalan:
  `npm run build` → `npx serve out -l 4173` → Playwright dengan API di-mock (`page.route`). Chromium dipasang manual
  (unzip chromium-linux-arm64 build 1194 ke ~/.cache/ms-playwright/chromium-1194, executablePath eksplisit; lib via apt).
- Mode gelap: halaman selain Ringkasan belum dicek → tambahkan ke WEB_DARK_READY satu per satu.

## Catatan Impor
- Impor = riwayat: TIDAK mengubah saldo rekening (keputusan Bos 2026-10-28).
  Baris impor: `related_type='import'`, `related_id` = id batch, nama file di
  `payload_json.importName`. Impor lama (sebelum 2026-10-28) tidak punya batch
  → tidak muncul di Riwayat.
- Sebelum perbaikan, menghapus satu transaksi impor dari halaman Transaksi web
  ikut membalik saldo & total → saldo rekening user yang pernah melakukannya
  mungkin sudah bergeser (tidak bisa dideteksi otomatis).
  Dicek ke D1 2026-11-03: 0 baris impor, 0 user pernah pakai kuota AI impor, 0 payload importName
  → tidak ada bukti user terdampak (23 user). Rekonsiliasi saldo: 26/33 rekening cocok
  (initial_balance + transaksi = balance); 7 selisih bukan dari impor. Ditelusuri: BCA Platinum user 7b434d
  = pengeluaran "Investasi" 280 jt bertanggal mundur (tak menggerakkan saldo) − piutang 5 jt; sisa ~14,8 jt
  tak terlacak (dugaan: hapus transfer/piutang sebelum 27 Sep tidak membalik saldo). User 7b434d = akun Bos
  (leo.wendry@gmail.com); Bos konfirmasi 2026-11-03 saldo BCA Platinum = saldo bank asli → tidak perlu tindakan. Cash KHR = baris Transfer Masuk lama tersimpan 32,50 USD
  (tak dikonversi) + Top Up tanpa baris Masuk; saldo kemungkinan benar. Data TIDAK diubah.
- Live (2026-11-03, deploy 353a2725): streak bulan surplus & konteks kategori AI kini juga mengecualikan
  catatan investasi lama tanpa tautan (kategori Investasi/Saham/Deposito, sama dengan isInvestmentPurchaseRow).
- Impor belum ada di aplikasi HP (`/app/*`) — baru versi web.

## Langkah berikutnya / ide

Pola kerja dengan Bos (lanjutkan sama): Bos kirim screenshot Oyenza per menu Pengaturan →
bikin versi Leosiqra yang **fiturnya nyata tapi desainnya beda** (jangan sama) → uji lokal
(Playwright, ponsel/tablet/desktop) → commit+push branch → lapor ringkas → deploy hanya setelah
Bos bilang **"gas"**. Menu Pengaturan yang sudah dibuat: Fitur, Target, Transaksi rutin, Awal
periode anggaran, Tag, Cara catat utama, Keyboard nominal, Shortcut iPhone, Kategori & Anggaran, Pembaca Notifikasi, Impor mutasi (pop-up), Kartu e-money, Impor/ekspor CSV, Pengingat, Notifikasi.
Semua menu Pengaturan dari screenshot Oyenza sudah dibuat (2026-10-28). Sisa: pindahan multi-dompet dari app
lain (Money Manager dll — tunggu keputusan Bos soal saldo & pembuatan rekening), Bahasa English (dilewati),
mode gelap halaman lain (bertahap), push native di aplikasi HP (FCM/APNs).
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
- (2026-11-03) Perbaikan UOB/Citibank di `fetch-logos.mjs` sudah ter-deploy 30 Okt. Tapi workflow `publish-article.yml`
  (deploy artikel 31 Okt) build TANPA `fetch-logos.mjs` → `public/logos` kosong di produksi (logo HD 404, jatuh ke
  /api/logo/huruf). Diperbaiki: step "Logo bank (HD)" ditambahkan ke `publish-article.yml`, lalu deploy-main ulang.
  Setiap workflow yang deploy WAJIB menjalankan `fetch-logos.mjs` sebelum build.

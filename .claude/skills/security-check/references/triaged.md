# Kandidat pemindai yang sudah ditriase

Catatan hasil audit sebelumnya supaya audit berikutnya tidak mengulang kerja.
Nomor baris bisa bergeser — cocokkan lewat nama fungsi. Kalau kode fungsi yang
tercatat di sini berubah, triase ulang (status "aman" tidak otomatis berlaku lagi).
Perbarui file ini di akhir setiap audit.

## Aman (dicek 2026-09-27)

| Kandidat | Lokasi (fungsi) | Alasan aman |
|---|---|---|
| admin route tanpa handler terpisah | route `/api/admin/debug/enforce-username-unique` | `requireSession(env, request, "admin")` dipanggil langsung di blok route |
| `sql-tanpa-user_id` UPDATE ai_chats `WHERE id = ?` | `handlePutAiChatHistory`, `handleAiChat` | `id` berasal dari SELECT yang sudah `WHERE user_id = ?` sesi |
| `sql-tanpa-user_id` sessions | `readSession`, `handleLogout`, `enforceSessionCap` | lookup berdasarkan id sesi dari cookie ber-HMAC / id sesi milik user sendiri |
| `sql-tanpa-user_id` password_reset_tokens | `handleResetPassword` | lookup berdasarkan hash token acak 32 byte; batch dijaga nonce |
| `sql-interpolasi` `${claimed}` / `${stillExists}` | `handleResetPassword`, `findTransferPair`/`buildReversalStatements` | isinya konstanta string SQL di kode, bukan input |
| `sql-interpolasi` `${isEmailIdentifier ? ... }` | `handleLogin` | hanya memilih antara dua nama kolom literal |
| `dangerouslySetInnerHTML` → `SandboxedHtml` | `MaintenanceGuard`, preview di `admin/pengaturan` | tidak lagi pakai `dangerouslySetInnerHTML`; iframe sandbox tanpa script |
| `dangerouslySetInnerHTML` JSON-LD | `src/app/layout.tsx` | `JSON.stringify` objek konstanta |
| `dangerouslySetInnerHTML` jawaban AI | `ai-leosiqra/page.tsx`, `app/assistant/chat/page.tsx` (`formatText`) | `escapeHtml` (& < > " ') dijalankan dulu, baru ditambah `<strong>/<em>/<br/>` |
| `sql-interpolasi` `${assignments}` | `handleUpdateTransaction`, `handleUpdateAccount`, `handleUpdateBudget`, `handleUpdateInvestment`, `handleUpdateCategory`, `handleUpdateRecurring` | nama kolom dari whitelist di kode (`allowed.has` / `updates.set` literal); `WHERE id = ? AND user_id = ?` sesi (dicek 2026-09-28) |
| `sql-interpolasi` profil | `handleUpdateMemberProfile` | whitelist `Map` tanpa `role`/`plan`/`status`/`expired_at` (tidak bisa naik ke PRO/admin); `WHERE id = ?` = user sesi. Kolom `total_*` bisa diubah user tapi cuma angka ringkasan miliknya sendiri (⚪) |
| `sql-interpolasi` `${table}` | `handleResetMemberData` | `table` dari konstanta `RESET_DATA_TABLES`; tiap DELETE `WHERE user_id = ?` |
| `sql-interpolasi` admin | `handleAdminSettings`, `handleAdminUserById` | `requireSession(..., "admin")`; kolom dari whitelist/literal (`plan`, `status`, `expired_at`) |
| `sql-interpolasi` buku besar investasi | `handleInvestmentEntry` (`cols`), `handleInvestmentSell` (`qtyCol` + kolom literal), `handleDepositCairkan`, `handleInvestmentRebook` (`assignments`), `handleDeleteInvestment`, `processMaturedDeposit` (`guard.sql`/`claimed.sql`) | `cols`/`assignments` dari konstanta `POSITION_COLUMNS`; `qtyCol` hanya `shares_count`/`quantity`; `guard.sql`/`claimed.sql` string konstanta di kode; nilai via bind. Semua `WHERE user_id = ?` sesi (dicek 2026-09-28) |
| `sql-tanpa-user_id` `UPDATE ai_chats ... WHERE id = ?` | `handleAiChat`, `handlePutAiChatHistory` | `id` berasal dari `SELECT ... FROM ai_chats WHERE user_id = ?` (sesi) tepat sebelumnya, bukan dari request (dicek 2026-09-28) |
| `sql-tanpa-user_id` cron | `processDueRecurringTransactions`, `processMaturedDeposit` | id baris dari SELECT cron sendiri; SEMUA update saldo `WHERE id = ? AND user_id = ?` pemilik baris — `account_id` milik orang lain → 0 baris berubah |
| `sql-tanpa-user_id` admin | `backfillIndonesianBankLogos` (route `/api/admin/debug/backfill-bank-logos`), `handleAdminPayments`, `handleAdminPaymentById` | hanya bisa dipanggil lewat route ber-`requireSession(..., "admin")` |
| `sql-tanpa-user_id` push | `sendWebPushToSubscription` | DELETE by id dari query internal, hanya saat layanan push membalas 404/410 |
| GET yang mengubah data (CSRF) | semua route `request.method === "GET"` | semua GET yang terdaftar hanya membaca data |
| endpoint promo (non-user) | `handlePromoTelegramHook`, `handlePromoDraft`, `handlePromoTelegram` | hook: header `X-Telegram-Bot-Api-Secret-Token` = sha256(`tg-hook:`+PROMO_SECRET) dibandingkan `constantTimeEqual` (PROMO_SECRET kosong/pendek → 401); hanya chat `TELEGRAM_CHAT_ID` yang bisa menilai/mencatat; `callback_data` di-regex; hanya menulis R2 `promo/history.json`. Draft: `isPromoAuthorized`, `key` whitelist regex (`draft-YYYY-MM-DD`/`playbook`) → tidak bisa keluar prefix `promo/`, maks 200 KB. Tidak menyentuh D1/data user (dicek 2026-10-06). ⚪ Kalau TELEGRAM_CHAT_ID grup, anggota grup ikut bisa menilai — disengaja |
| posting otomatis promo | `handlePromoStats`, `handlePromoUpload`, `handlePromoQueue`, `handlePromoMedia`, `processPromoQueue` | stats: `isPromoAuthorized`, hanya COUNT agregat (tanpa id/email/keuangan; admin & akun demo dikecualikan). Upload/queue: `isPromoAuthorized`, `id` regex `PROMO_ID_RE` (tanpa traversal), ≤49 MB. Media: URL bertanda tangan HMAC (`promo-media:`+PROMO_SECRET) + kedaluwarsa 2 hari, `constantTimeEqual`, 404 seragam. Token IG disimpan di R2 `promo/ig-token.json` — bucket `leosiqra-assets` privat (r2.dev mati, tanpa custom domain; dicek `wrangler r2 bucket dev-url get` / `domain list` 2026-10-06). Cron `*/10` punya cabang sendiri di `scheduled()` sehingga TIDAK memicu deposito/recurring (dicek 2026-10-06) |
| push_subscriptions dicari per endpoint | `handleCreatePushSubscription` | pindah akun di browser yang sama memang disengaja; URL endpoint push tidak bisa ditebak (⚪ info) |

## Temuan terbuka

- 🟡 Upload gambar ke Cloudinary memakai *unsigned preset* dari browser (nama cloud & preset terlihat publik) — siapa pun bisa mengunggah gambar ke akun Cloudinary. Mitigasi di dashboard Cloudinary (batasi format/ukuran/folder) atau pindah ke *signed upload* lewat Worker (butuh secret API Cloudinary).
- ⚪ `POST /api/member/uploads/sign` (R2) tidak dipakai frontend — kode mati, aman (sesi + key di folder user).
- ⚪ `npm audit`: 9 paket (1 critical di Next.js = middleware bypass) — semua build-time/native, tidak dipakai runtime (static export, Worker tidak memakainya). Update Next.js terpisah.

## Sudah diperbaiki

- 🟡 (2026-10-06) PUT `/api/promo/history` menimpa rating/catatan yang masuk lewat webhook selama render → sekarang digabung per `id` (`handlePromoHistory`).

| Tanggal | Temuan | Perbaikan |
|---|---|---|
| 2026-09-28 | 🔴 Pengajuan pembayaran PRO memakai `durationMonths`, `status`, nama/email dari request — bisa bayar 1 bulan minta 1200 bulan; nama mentah masuk Telegram HTML admin | Paket dicari by id di `admin_settings` (nama/durasi/harga resmi), status selalu MENUNGGU, identitas dari akun, bukti hanya URL Cloudinary, maks 5 pending, Telegram di-escape; panel admin menampilkan durasi & peringatan selisih harga. Produksi: 2 pembayaran, durasi maks 1 → tidak dieksploitasi |
| 2026-09-28 | 🟠 Login Google melewati 2FA untuk akun yang mengaktifkan Authenticator | Callback tidak membuat sesi untuk akun ber-2FA; cookie titipan bertanda tangan 5 menit + `POST /api/auth/google/2fa` (rate limit) memverifikasi TOTP. `email_verified` wajib `true`. Diverifikasi lokal: tanpa cookie/palsu/kedaluwarsa/kode salah → tanpa sesi |
| 2026-09-28 | 🟠 Pendaftaran menerima password berapa pun panjangnya (aturan hanya di klien) | Server wajib 8–200 karakter & format email wajar, sama dengan reset/ganti password |
| 2026-09-28 | 🟡 Chat AI tanpa rate limit & tanpa batas panjang; AI parse tanpa batas teks/foto; riwayat chat tumbuh tanpa batas | Rate limit `ai-chat:user:*`, prompt ≤ 2.000, simpan ≤ 200 pesan; parse teks ≤ 1.000 & foto ≤ ~5 MB; PUT riwayat dibatasi 200 pesan / 20rb karakter |
| 2026-09-28 | 🟡 Kepemilikan `account_id`/`target_account_id` tidak divalidasi (transaksi, recurring, investasi) — bisa menautkan baris ke rekening orang lain & memblokir penghapusan rekening korban lewat FK | `assertOwnAccounts` di create/update transaksi, recurring, investasi (nilai `General`/`Wallet`/kosong dilewati). Diverifikasi di Worker lokal: 5 serangan → 400, alur normal tetap 200/201 |
| 2026-09-28 | 🐛 `INSERT INTO recurring` 14 kolom tapi 15 `?` → bikin recurring selalu 500 (sejak d80157e) | placeholder dikoreksi; pemindai sekarang punya cek `sql-jumlah-kolom` |
| 2026-09-27 | 🟠 Sanitasi HTML maintenance bisa ditembus (`on*` tanpa kutip, `<svg/onload>`, `javascript:` tanpa kutip) — HTML tampil ke semua user | HTML maintenance sekarang dirender di `SandboxedHtml` (iframe `sandbox` tanpa `allow-scripts`/`allow-same-origin`) di `MaintenanceGuard` & preview admin; `sanitizeMaintenanceHtml` ditambah pola tanpa kutip sebagai cadangan. Diverifikasi di browser: script & fetch dari HTML jahat yang tidak disanitasi tidak jalan |

## Belum ditriase

(semua kandidat pemindai per 2026-09-28 sudah ditriase)

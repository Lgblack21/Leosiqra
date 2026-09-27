# Checklist review manual — Leosiqra

Daftar isi:
1. Pola celah yang pernah terjadi (cek ini dulu)
2. Auth & sesi
3. Isolasi data antar user (IDOR)
4. Alur akun: register, login, reset password, OAuth, 2FA
5. Uang & integritas data
6. Input, output, dan error
7. Frontend
8. Upload, AI, cron, admin
9. Konfigurasi & secret
10. Verifikasi lokal

---

## 1. Pola celah yang pernah terjadi (cek ini dulu)

Pola ini sudah pernah lolos ke produksi. Kalau kode baru mirip, curigai duluan.

- **Account takeover lewat register (Sep 2026).** `handleRegister` dulu mengizinkan
  "klaim" akun Google-only (`password_hash = 'oauth$google'`): siapa pun yang tahu
  email bisa set password + 2FA baru dan langsung dapat sesi. Aturannya sekarang:
  email yang sudah terdaftar SELALU ditolak. Waspadai jalur apa pun yang mengubah
  kredensial/identitas akun tanpa bukti kepemilikan (sesi aktif, password lama,
  atau token dari email).
- **Klaim keamanan palsu di UI.** Halaman Rekening dulu menulis saldo "dienkripsi
  end-to-end" padahal kolom `balance` REAL biasa di D1. Teks keamanan di UI harus
  bisa dibuktikan di kode.
- **Mutasi saldo tidak atomik.** Hapus transaksi dulu membalik saldo dari client
  lalu memanggil DELETE — kalau salah satu gagal saldo rusak, dan transfer tidak
  pernah dibalik. Sekarang di Worker dalam satu `DB.batch` dengan guard
  "baris masih ada" (lihat bagian 5).
- **Ringkasan dari data yang terpotong.** Beberapa halaman menghitung total hanya
  dari data bulan terpilih (tabungan minus, hutang lama tak terlihat). Bukan celah
  keamanan, tapi sering ketemu saat audit — catat sebagai temuan integritas.

## 2. Auth & sesi

- Setiap route `/api/member/*` dan `/api/admin/*` memanggil `requireSession`
  (pemindai mengecek ini). Route admin harus pakai `requireSession(env, request, "admin")`
  atau cek `role` eksplisit.
- User ID hanya dari `authResult.session.user.id`. Cari pola `payload.user_id`,
  `payload.userId`, `url.searchParams.get("user")` di handler member — itu tanda bahaya.
- Endpoint publik (tanpa sesi) harus memang publik: `/api/auth/*`, `/api/vapid-public-key`.
  Endpoint publik baru → tanyakan kenapa tidak butuh sesi.
- Cookie sesi: `HttpOnly; Secure; SameSite=Lax` (`sessionCookie`). Worker TIDAK
  memvalidasi header `Origin` untuk request yang mengubah data — satu-satunya
  perlindungan CSRF adalah `SameSite=Lax`, yang tetap mengirim cookie pada
  navigasi GET lintas situs. Karena itu: **tidak boleh ada endpoint GET yang
  mengubah data** (hapus, bayar, logout, ubah status). Endpoint baru yang
  mengubah data wajib POST/PUT/DELETE. Melonggarkan cookie ke `SameSite=None`
  = celah CSRF langsung.
- Ganti password / reset password harus mencabut sesi lain (`DELETE FROM sessions WHERE user_id = ?`).
- Sesi "permanen" PWA (TTL 100 tahun) — perubahan di sini perlu alasan kuat.

## 3. Isolasi data antar user (IDOR)

Untuk setiap query ke tabel milik user (transactions, accounts, savings,
investments, budgets, recurring, categories, currencies, ai_chats, uploads,
payments, push_subscriptions, sessions, password_reset_tokens):

- `SELECT/UPDATE/DELETE ... WHERE id = ?` dengan id dari URL/body **wajib** juga
  `AND user_id = ?` (sesi). Tanpa itu user A bisa mengubah data user B cukup
  dengan menebak/mengganti id.
- Subquery & JOIN juga: `EXISTS (SELECT 1 FROM x WHERE id = ?)` tanpa `user_id`
  bisa membocorkan keberadaan data user lain.
- Relasi silang: kalau handler menerima `account_id`, `related_id`,
  `target_account_id` dari request, pastikan akun/record itu milik user yang sama
  sebelum dipakai untuk mengubah saldo.
- Cron/admin memang boleh tanpa filter user — tapi pastikan fungsinya tidak bisa
  dipanggil dari route member.

## 4. Alur akun

- **Register**: email yang sudah ada → selalu 409, tanpa sesi. Normalisasi
  `toLowerCase().trim()` konsisten dengan login.
- **Login**: rate limit per IP + per identifier (`checkRateLimit`). Pesan error
  sama untuk "user tidak ada" dan "password salah".
- **Lupa password** (`handleForgotPassword`):
  - respons identik untuk email terdaftar, tidak terdaftar, dan gagal kirim email
    (cegah enumerasi);
  - token acak ≥ 32 byte, disimpan hanya sebagai hash, TTL pendek, sekali pakai,
    token lama dimatikan saat minta baru;
  - cooldown per user + rate limit per IP & email (cegah bom email);
  - link hanya ke origin di `ALLOWED_ORIGINS` (https) — jangan pakai Host request
    mentah (host header injection).
- **Reset password** (`handleResetPassword`): klaim token + ganti password + cabut
  sesi + matikan token lain dalam satu batch yang dijaga nonce (race: token sama
  dipakai paralel harus sukses tepat sekali). Minimal 8 karakter.
- **OAuth Google**: `state` diverifikasi, redirect `next` hanya ke path internal
  (lihat `sanitizeNext`), akun Google-only tidak bisa diambil alih lewat jalur lain.
- **2FA**: reset password tidak boleh melewati 2FA; login tetap minta kode.

## 5. Uang & integritas data

- Mutasi saldo (`accounts.balance`) dan total (`users.total_*`) sebaiknya di
  Worker, dalam `DB.batch` (atomik). Tiap `UPDATE` saldo diberi guard yang
  membuat eksekusi kedua no-op (mis. `AND EXISTS (SELECT 1 FROM transactions WHERE id = ? AND user_id = ?)`
  sebelum baris dihapus di batch yang sama).
- Endpoint yang membuat transaksi: nominal harus angka positif & finite; jangan
  percaya `amount_idr` dari client tanpa batas wajar.
- Perubahan perilaku endpoint yang dipakai client lama (PWA/Capacitor yang belum
  reload) harus backward-compatible — contoh: flag `?reverse=1` di DELETE transaksi.
- Kartu kredit: `balance = −terpakai` (lihat `src/lib/creditCard.ts`); jangan ada
  jalur yang menulis balance kartu dengan tanda terbalik.
- Foreign key produksi: `transactions.account_id → accounts ON DELETE RESTRICT`
  dan penegakan FK aktif — `account_id = 'General'` akan ditolak.

## 6. Input, output, dan error

- Validasi server-side untuk semua input (tipe, panjang, rentang) walau client
  sudah memvalidasi.
- SQL dinamis (`${assignments}`) hanya dari whitelist nama kolom di kode
  (lihat pola `allowed = new Set([...])`).
- Error ke client berupa pesan manusiawi; detail (`D1_ERROR`, stack) hanya di
  `console.error`. Field `debug` di response tidak boleh sampai ke produksi.
- Response jangan mengembalikan kolom sensitif: `password_hash`, `two_factor_secret`,
  token, `ip_hash`.

## 7. Frontend

- `dangerouslySetInnerHTML`: isi dari AI, input user, atau pengaturan admin yang
  tampil ke user lain harus disanitasi (atau di-render sebagai teks/markdown aman).
- Redirect dari query string (`?next=`) hanya ke path internal yang di-whitelist.
- Token/secret tidak disimpan di `localStorage`; sesi hanya lewat cookie HttpOnly.
- Teks yang mengklaim keamanan ("terenkripsi", "tidak disimpan") harus benar.

## 8. Upload, AI, cron, admin

- **Upload (R2)**: batas ukuran & tipe di server, nama objek tidak dari input
  mentah, URL publik tidak bisa ditebak untuk file privat (bukti bayar dll).
- **AI** (`handleAiChat`, AI parse): prompt injection dari data user tidak boleh
  memicu aksi yang mengubah data tanpa konfirmasi user; rate limit per user
  (`AI_PARSE_RATE_LIMITER`); secret API tidak pernah masuk prompt/response.
- **Cron** (`scheduled`): idempoten kalau terpicu dua kali; error satu user
  tidak menghentikan user lain (try/catch per item); tidak mengirim data user A ke user B.
- **Admin**: semua route `/api/admin/*` cek role; aksi massal/destruktif butuh
  konfirmasi; `SUPERADMIN_EMAIL` hanya untuk hal yang memang khusus.

## 9. Konfigurasi & secret

- Secret hanya via `wrangler secret put` — bukan di `wrangler.toml [vars]`, bukan
  di kode, bukan di log. Cek juga file `.env*` tidak ter-commit.
- `ALLOWED_ORIGINS` tidak berisi origin dev yang tidak perlu di produksi (catat
  sebagai hardening kalau ada `localhost`).
- `APP_ENV`/`APP_URL` di `[vars]` — kalau dipakai untuk keputusan keamanan
  (mis. link email), pastikan nilainya benar untuk produksi.
- Dependensi: `npm audit --omit=dev` untuk paket runtime; laporkan yang high/critical
  beserta apakah jalurnya benar-benar dipakai.

## 10. Verifikasi lokal

Buktikan temuan tanpa menyentuh produksi:

```bash
export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH
SP=<folder scratchpad>
# D1 lokal berisi skema produksi
npx wrangler d1 execute membersite_leosiqra_db --local --persist-to $SP/d1 --file cloudflare/schema-production.sql
npx wrangler d1 execute membersite_leosiqra_db --local --persist-to $SP/d1 --command "ALTER TABLE savings ADD COLUMN transaction_type TEXT; ALTER TABLE categories ADD COLUMN sort_order INTEGER; ALTER TABLE investments ADD COLUMN maturity_action TEXT; ALTER TABLE investments ADD COLUMN related_investment_id TEXT;"
# seed: users, sessions (expires_at 2099), data uji dua user (A korban, B penyerang)

# Worker lokal dengan secret uji (bukan secret produksi); simpan PID untuk dimatikan
node node_modules/wrangler/bin/wrangler.js dev cloudflare/src/index.ts --local --persist-to $SP/d1 \
  --port 8799 --var SESSION_SECRET:local-test-secret --show-interactive-dev-session=false > $SP/wdev.log 2>&1 &
WPID=$!

# Cookie sesi uji = "<session_id>.<base64url(HMAC-SHA256(secret, session_id))>"
COOKIE=$(node -e "const c=require('crypto');console.log('leosiqra_session=s1.'+c.createHmac('sha256','local-test-secret').update('s1').digest('base64url'))")

# ... curl -X POST/PUT/DELETE -H "Cookie: $COOKIE" http://127.0.0.1:8799/api/...
kill $WPID
```

Skenario IDOR standar: login sebagai user B, lalu PUT/DELETE id milik user A →
harus 404/403 dan data A tidak berubah (cek langsung di D1 lokal).

Cron bisa dipicu manual: `curl "http://127.0.0.1:8799/cdn-cgi/handler/scheduled?cron=0+3+*+*+*"`.
Push notification bisa ditangkap dengan server HTTP lokal sebagai endpoint
subscription + kunci VAPID uji yang dibuat dengan `crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'})`.

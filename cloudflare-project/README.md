# Leosiqra Cloudflare Migration

Migrasi penuh project lama ke stack Cloudflare:

- Legacy hosting -> Cloudflare Workers Static Assets
- Firestore -> Cloudflare D1
- Realtime listener client -> Worker API + polling ringan
- Legacy file/upload flow -> Cloudflare R2
- Legacy backend logic -> Worker routes
- Legacy auth flow -> custom session auth + optional TOTP + optional Turnstile

## Struktur Project

```text
cloudflare-project/
│── src/
│   ├── api/
│   ├── pages/
│   ├── components/
│   ├── utils/
│   └── middleware/
│── public/
│── database/
│   ├── schema.sql
│   └── migration.sql
│── scripts/
│── wrangler.toml
│── package.json
│── README.md
│── .env.example
```

## Audit Hasil Migrasi

Sistem legacy yang terdeteksi di project lama:

- Hosting config: `firebase.json`, `.firebaserc.example`
- Rules: `firestore.rules`
- Indexes: `firestore.indexes.json`
- Auth client SDK: `src/app/auth/login/page.tsx`, `src/app/auth/register/page.tsx`, banyak `onAuthStateChanged`
- Firestore CRUD/query: hampir seluruh `src/lib/services/*` dan banyak page member/admin
- Realtime snapshots: `onSnapshot` di dashboard, admin, currencies, maintenance guard, modal select
- 2FA secret disimpan di dokumen user Firebase
- Upload file sebelumnya sebenarnya memakai Cloudinary di frontend, bukan storage internal yang aktif

Konversi yang dilakukan di project baru:

- Semua data koleksi utama dipetakan ke tabel SQL eksplisit di D1.
- Semua operasi CRUD dipindahkan ke `/api/*` di Worker.
- Auth pindah ke cookie session HMAC + tabel `sessions`.
- 2FA dipertahankan via TOTP secret per user.
- Upload file masuk ke R2 via Worker endpoint `/api/uploads`.
- Admin settings, payment approval, admin logs, dan summary dashboard dijalankan di server.

## Fitur Yang Sudah Siap

- Register/login/logout dengan session cookie
- Optional TOTP setup untuk 2FA
- CRUD generic untuk:
  - accounts
  - budgets
  - categories
  - currencies
  - transactions
  - investments
  - recurring
  - savings
- Dashboard summary query
- Profile update
- Upload ke R2 + file serving lewat Worker
- Payment request user
- Admin settings
- Admin users list
- Payment approval admin
- Admin logs

## Local Dev

1. Install dependency:

```bash
npm install
```

2. Copy env template:

```bash
copy .env.example .env
```

3. Buat D1 database dan R2 bucket:

```bash
wrangler d1 create leosiqra-db
wrangler r2 bucket create leosiqra-assets
```

4. Isi `database_id` di `wrangler.toml`, lalu jalankan schema:

```bash
npm run db:migrate
```

5. Jalankan dev server:

```bash
npm run dev
```

6. Buka:

```text
http://127.0.0.1:8787
```

## Deploy ke Cloudflare

1. Login Wrangler:

```bash
wrangler login
```

2. Pastikan binding D1/R2 di `wrangler.toml` sudah benar.

3. Set secret:

```bash
wrangler secret put SESSION_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
```

4. Deploy:

```bash
npm run deploy
```

## Migrasi Data Lama

### 1. Migrasi Data Legacy -> D1

Export koleksi lama Anda ke JSON arrays, misalnya:

```text
legacy-export/
  users.json
  accounts.json
  transactions.json
  budgets.json
  investments.json
  recurring.json
  savings.json
  payments.json
```

Lalu generate SQL:

```bash
npm run data:import
```

Jalankan hasil SQL ke D1:

```bash
wrangler d1 execute leosiqra-db --remote --file=./database/generated-import.sql
```

### 2. Migrasi Asset Lama -> R2

Taruh file migrasi di folder lokal, lalu:

```bash
npm run r2:upload
```

Script `scripts/upload-to-r2.mjs` akan upload recursive ke bucket R2 via API S3-compatible.

## Auth Baru

Arsitektur auth baru:

- Password hash: PBKDF2 SHA-256
- Session: signed cookie + tabel `sessions`
- 2FA: TOTP secret per user
- Optional anti-bot: Cloudflare Turnstile

Catatan:

- Saya sengaja tidak memakai Cloudflare Access sebagai auth user utama aplikasi ini.
- Berdasarkan docs Cloudflare Access, produk itu difokuskan untuk melindungi aplikasi self-hosted/internal di depan origin, bukan sebagai replacement langsung untuk sistem member auth multi-user dalam aplikasi produk.
- Karena itu project ini memakai session auth kustom yang lebih cocok untuk aplikasi SaaS/member area.

Sumber:

- Cloudflare Access self-hosted apps: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/
- Validasi JWT Access: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

## Optimasi Speed

- Static assets dilayani langsung dari edge Cloudflare.
- API dan halaman berada di Worker yang sama untuk mengurangi round-trip.
- Query summary dashboard dibuat di server, bukan banyak fetch Firestore dari client.
- Struktur SQL eksplisit mengurangi biaya scan liar dibanding query NoSQL tanpa kontrol.
- Upload file tidak keluar ke vendor ketiga.

## Optimasi Security

- Cookie `HttpOnly`, `SameSite=Lax`, `Secure`
- Session disimpan dan bisa direvoke di database
- 2FA TOTP tetap tersedia
- Role admin divalidasi di Worker, bukan hanya di UI
- File R2 dilayani dengan kontrol akses berbasis session
- Turnstile bisa diaktifkan untuk login/register

## Kenapa Ini Umumnya Lebih Murah dari Firebase

Per April 19, 2026, dokumen resmi yang saya cek menunjukkan:

- Cloudflare Workers static asset requests gratis dan tidak terbatas: https://developers.cloudflare.com/workers/platform/pricing/
- D1 free tier: 5 juta rows read/hari, 100 ribu rows write/hari, 5 GB storage total; paid: 25 miliar rows read/bulan included + biaya row yang sangat rendah: https://developers.cloudflare.com/d1/platform/pricing/
- R2 free tier: 10 GB-month storage, 1 juta Class A ops, 10 juta Class B ops, dan egress internet gratis: https://developers.cloudflare.com/r2/pricing/

Sebagai pembanding, dokumen resmi Firebase Firestore menyatakan free tier satu database per project dengan 1 GiB storage, 50 ribu document reads/hari, 20 ribu writes/hari, 20 ribu deletes/hari, dan biaya tambahan juga melibatkan storage/index/bandwidth: https://firebase.google.com/docs/firestore/pricing

Inferensi saya:

- Untuk app dashboard finansial seperti repo lama ini, kombinasi Workers + D1 + R2 biasanya lebih hemat daripada Firebase + Cloudinary karena egress asset dan hosting jadi lebih murah, query lebih bisa dikontrol, dan Anda tidak membayar layanan terpisah untuk file hosting.

## Tradeoff Penting

- Realtime `onSnapshot` Firebase tidak dipindah 1:1. Project baru memakai API Worker dan polling ringan. Ini lebih murah dan lebih mudah diprediksi di Cloudflare.
- Script `import-legacy-json.mjs` memerlukan export JSON nyata dari data lama Anda. Repo ini tidak punya akses ke database production Anda, jadi data live tidak bisa saya tarik otomatis dari sini.
- `migration.sql` menyertakan seed minimal; data utama dipindahkan lewat generated SQL dari export.

## Langkah Produksi Yang Disarankan

1. Buat database production dan bucket R2 production terpisah.
2. Set `SESSION_SECRET` minimal 32 byte acak.
3. Aktifkan Turnstile di form login/register.
4. Hubungkan custom domain ke Worker.
5. Tambahkan backup/import job rutin untuk D1.
6. Tambahkan cron untuk recurring automation jika ingin transaksi recurring diproses otomatis.

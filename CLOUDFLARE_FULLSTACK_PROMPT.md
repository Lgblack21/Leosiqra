# Audit Proyek dan Prompt Rebuild Full-Stack Cloudflare

## 1. Ringkasan Audit Cepat

Proyek ini adalah aplikasi finansial pribadi premium berbasis `Next.js App Router + React + Tailwind v4` dengan dua area utama:

- Landing page marketing premium
- Member workspace finansial pribadi
- Admin operations console

Fitur backend saat ini dominan memakai:

- Firebase Auth
- Firestore dengan listener real-time
- Cloudinary untuk upload gambar
- Gemini langsung dari client untuk AI chat

Karakter visual utama:

- Nuansa premium, terang, bersih, editorial
- Dominasi warna `slate / white / off-white / indigo / navy`
- Headline serif besar, body sans modern
- Card besar rounded `20px-56px`
- Banyak panel dashboard, badge kecil uppercase, shadow halus
- Motion ringan via `framer-motion`

## 2. Struktur Fitur yang Ditemukan

### Public / Landing

- `/` landing page marketing
- CTA register/login
- section hero, feature, testimoni, pricing, trust, footer

### Auth

- `/auth/login`
- `/auth/register`
- 2FA TOTP via authenticator app
- role redirect ke `admin` atau `membership`

### Membership

- `/membership/dashboard` dashboard bulanan
- `/membership/annual` dashboard tahunan + print report
- `/membership/pajak-center` draft ringkasan SPT
- `/membership/investment` ringkasan investasi
- `/membership/investasi/saham`
- `/membership/investasi/deposito`
- `/membership/investasi/lainnya`
- `/membership/market-data`
- `/membership/transactions/input`
- `/membership/transactions/daily`
- `/membership/transactions/topup`
- `/membership/transactions/debt`
- `/membership/recurring`
- `/membership/tabungan`
- `/membership/budget`
- `/membership/rekening`
- `/membership/nama-akun`
- `/membership/cards`
- `/membership/profile`
- `/membership/ai-leosiqra`
- `/membership/contact` konfirmasi pembayaran pro

### Admin

- `/admin/dashboard`
- `/admin/user`
- `/admin/pembayaran`
- `/admin/laporan`
- `/admin/pengaturan`

## 3. Data Model Saat Ini

Koleksi Firestore yang dipakai:

- `users`
- `payments`
- `admin_settings`
- `admin_logs`
- `transactions`
- `accounts`
- `budgets`
- `investments`
- `categories`
- `recurring`
- `savings`
- `currencies`
- `ai_chats`

Status dan role penting:

- role: `admin`, `user`
- plan: `FREE`, `PRO`
- status user: `AKTIF`, `NONAKTIF`, `GUEST`, `PENDING`
- status payment: `MENUNGGU`, `DISETUJUI` dan sejenisnya
- status transaksi: `PENDING`, `VERIFIED`, `FAILED`

Entitas bisnis penting:

- transaksi pemasukan/pengeluaran/transfer/topup/debt
- rekening bank/e-wallet/cash/investment account/credit card
- budget bulanan dan tahunan
- investasi saham/deposito/lainnya
- recurring transaction
- savings goals
- kategori ledger dan mata uang custom
- AI chat history per user
- app settings global untuk billing, paket pro, maintenance, market summary

## 4. ENV yang Dipakai Saat Ini

Source project sekarang memakai env berikut:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
NEXT_PUBLIC_GEMINI_API_KEY=
```

## 5. Temuan Audit Penting

### Arsitektur

- UI dan domain bisnis sudah kaya, tapi backend masih sangat client-heavy.
- Banyak operasi CRUD, upload, dan AI call dilakukan langsung dari browser.
- Realtime masih bergantung pada listener Firestore.

### Risiko utama

- `NEXT_PUBLIC_GEMINI_API_KEY` dipakai langsung di client pada halaman AI.
- upload gambar dilakukan dari client ke Cloudinary unsigned preset.
- maintenance code dirender dengan `dangerouslySetInnerHTML`.
- banyak page penting masih berupa client component besar dan padat.
- ada beberapa artefak encoding karakter rusak seperti `â€”`, `ðŸ...`.

### Implikasi migrasi Cloudflare

- AI harus dipindah ke Worker server-side, jangan expose secret ke browser.
- Upload sebaiknya pindah ke `R2` atau `Cloudflare Images` dengan signed upload.
- Realtime Firestore perlu diganti dengan `Durable Objects + WebSocket/SSE` atau fallback polling cerdas.
- `admin_settings`, `admin_logs`, `payments`, `users`, `transactions` paling cocok dimigrasikan ke `D1`.

## 6. Mapping ke Stack Cloudflare

Padanan yang paling masuk akal:

- Next.js frontend premium -> React + Vite atau Next on Cloudflare
- Firestore -> Cloudflare D1
- Firestore realtime -> Durable Objects + WebSocket/SSE
- Firebase Auth -> session auth custom di Worker + D1 + secure cookie
- Cloudinary -> Cloudflare R2 atau Cloudflare Images
- client Gemini -> AI proxy via Worker server route
- global caching -> KV untuk cache market/config ringan
- file assets -> R2

## 7. Prompt Siap Pakai

Salin prompt di bawah ini ke AI builder/agent yang akan membuat versi Cloudflare:

```text
Bangun ulang aplikasi full-stack Cloudflare yang MENIRU semaksimal mungkin proyek finansial premium berikut, baik dari tampilan, UI, UX, struktur fitur, role, data model, flow bisnis, maupun konfigurasi environment.

Tujuan:
Saya ingin clone fungsional dan visual dari aplikasi dashboard finansial premium bergaya Leosiqra, tetapi seluruh stack backend harus native Cloudflare, production-ready, dan lebih aman daripada versi sumber.

Tech stack yang WAJIB:
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Cloudflare Workers
- Database utama: Cloudflare D1
- Realtime: Durable Objects + WebSocket atau SSE
- Object/file storage: Cloudflare R2 atau Cloudflare Images
- Cache ringan/config/global state cache: KV jika perlu
- Auth: session-based auth di Worker, cookie httpOnly secure, role-based access
- Deployment target: Cloudflare Pages/Workers

Prioritas utama:
1. Tampilan visual harus sangat mirip proyek sumber.
2. Struktur halaman, menu, panel, badge, tabel, kartu, modal, dan flow harus setara.
3. Domain bisnis finansial pribadi harus dipertahankan.
4. Versi Cloudflare harus memperbaiki kelemahan keamanan dari proyek sumber.
5. Hasil akhir harus modular, rapi, typed, dan siap di-deploy.

Desain visual yang harus diikuti:
- Look premium, bersih, terang, editorial, modern, terasa seperti dashboard finansial private banking.
- Background utama off-white / krem terang.
- Dominan warna slate, white, indigo, navy, sedikit emerald/orange untuk status.
- Headline serif besar untuk hero dan section heading.
- Body text sans modern.
- Banyak kartu besar rounded sekitar 20px sampai 56px.
- Shadow lembut, border tipis, spacing luas, tidak ramai.
- Badge kecil uppercase tracking lebar.
- Sidebar membership warna terang, sidebar admin warna gelap navy/slate.
- Motion halus dan minim, bukan berlebihan.
- Mobile dan desktop harus sama-sama kuat.

Struktur aplikasi yang harus dibuat:

Public:
- Landing page `/`
- Navbar, hero, feature blocks, steps, testimonials, pricing, trust/security section, final CTA, footer

Auth:
- `/auth/login`
- `/auth/register`
- setup dan verify 2FA TOTP
- redirect berdasarkan role

Membership area:
- `/membership/dashboard`
- `/membership/annual`
- `/membership/pajak-center`
- `/membership/investment`
- `/membership/investasi/saham`
- `/membership/investasi/deposito`
- `/membership/investasi/lainnya`
- `/membership/market-data`
- `/membership/transactions/input`
- `/membership/transactions/daily`
- `/membership/transactions/topup`
- `/membership/transactions/debt`
- `/membership/recurring`
- `/membership/tabungan`
- `/membership/budget`
- `/membership/rekening`
- `/membership/nama-akun`
- `/membership/cards`
- `/membership/profile`
- `/membership/ai-leosiqra`
- `/membership/contact`

Admin area:
- `/admin/dashboard`
- `/admin/user`
- `/admin/pembayaran`
- `/admin/laporan`
- `/admin/pengaturan`

Sidebar membership wajib punya grup menu:
- Utama
- Investasi
- Transaksi
- Perencanaan
- Akun & Profil
- Lainnya

Sidebar admin wajib punya grup:
- Manajemen
- Sistem

Role dan akses:
- role: `admin`, `user`
- plan: `FREE`, `PRO`
- status user: `AKTIF`, `NONAKTIF`, `GUEST`, `PENDING`
- user biasa tidak boleh akses admin
- admin bisa bypass maintenance mode
- halaman membership harus protected

Flow bisnis wajib:
- user daftar
- user setup 2FA
- user login
- user dengan status `GUEST` hanya dapat akses terbatas dan bisa request aktivasi
- admin verifikasi user/pembayaran
- user bisa kelola transaksi, akun, budget, tabungan, recurring, investasi, kategori, mata uang
- user bisa kirim konfirmasi pembayaran paket PRO beserta upload bukti
- admin bisa mengatur paket PRO, billing info, QRIS, maintenance mode, market summary, dan profil admin

Data model yang wajib dibuat di D1:

1. users
- id
- name
- email
- password_hash
- whatsapp
- photo_url
- role
- plan
- status
- expired_at
- created_at
- total_wealth
- total_income
- total_expenses
- total_savings
- total_investment
- credit_card_bills
- other_debts
- two_factor_secret
- currency_initialized

2. payments
- id
- user_id
- user_email
- user_name
- user_photo_url
- method
- ref
- package_id
- package_name
- package_duration_months
- amount
- note
- proof_image_url
- status
- approved_at
- created_at

3. admin_settings
- id
- billing_email
- whatsapp
- pro_price
- bank_name
- bank_account_name
- bank_number
- qris_text
- qris_url
- free_plan_days
- maintenance_is_active
- maintenance_type
- maintenance_code
- maintenance_image_url
- market_user_covered
- market_fx_update
- market_crypto_update
- market_stock_update
- market_last_update

4. admin_logs
- id
- admin_email
- action
- target
- note
- color
- created_at

5. transactions
- id
- user_id
- type
- amount
- amount_idr
- category
- sub_category
- currency
- account_id
- target_account_id
- lender_name
- total_debt
- installment_tenor
- monthly_interest
- total_interest
- date
- display_date
- note
- status
- payment_status
- related_id
- related_type
- created_at

6. accounts
- id
- user_id
- name
- type
- currency
- balance
- initial_balance
- base_value
- logo_url
- logo_label
- created_at

7. budgets
- id
- user_id
- type
- category
- amount
- period
- created_at

8. investments
- id
- user_id
- name
- type
- platform
- amount_invested
- amount_idr
- current_value
- current_value_idr
- return_percentage
- tax_percentage
- currency
- duration_months
- transaction_type
- category
- account_id
- logo_url
- quantity
- unit
- price_per_unit
- stock_code
- exchange_code
- shares_count
- price_per_share
- date_invested
- target_date
- duration_days
- status
- created_at

9. categories
- id
- user_id
- category
- sub_category
- status
- created_at

10. recurring
- id
- user_id
- name
- type
- category
- account_id
- amount
- interval
- next_date
- note
- status
- created_at

11. savings
- id
- user_id
- description
- amount
- amount_idr
- currency
- category
- sub_category
- from_account
- to_goal
- date
- display_date
- created_at

12. currencies
- id
- user_id
- code
- name
- symbol
- is_default
- created_at

13. ai_chats
- id
- user_id
- messages_json
- updated_at

Realtime requirements:
- dashboard membership dan admin harus update live untuk data penting
- payments queue, admin logs, dan user status harus bisa realtime
- transaksi bulanan user sebaiknya realtime
- implementasikan dengan Durable Objects plus WebSocket/SSE, bukan polling bodoh terus-menerus

AI requirements:
- buat halaman AI assistant seperti proyek sumber
- tapi JANGAN panggil model langsung dari browser
- semua panggilan AI harus lewat Worker server endpoint
- secret AI disimpan di Cloudflare secrets
- chat history disimpan di D1
- assistant memakai konteks finansial user: rekening, transaksi, investasi, savings, budgets
- jawaban default Bahasa Indonesia
- jangan memberi janji keuntungan investasi

Security requirements:
- jangan expose secret di frontend
- gunakan cookie session httpOnly, secure, sameSite
- role guard di server
- validasi input di server
- sanitasi HTML maintenance mode jika fitur code preview tetap dipertahankan
- upload file harus signed dan tervalidasi
- audit log untuk aksi admin penting

Market data requirements:
- tampilkan FX, crypto, dan market snippets
- sediakan admin market control center
- cache respons market agar efisien
- jika perlu gunakan KV untuk cache singkat

Functional requirements detail:
- modal global untuk tambah transaksi/investasi/tabungan/budget/rekening/kartu/mata uang
- top up dan transfer antar rekening
- debt / piutang dengan penandaan lunas
- investasi saham, deposito, investasi lainnya
- hard delete investasi harus mengembalikan dampak ke saldo akun dan total user
- profile page punya security center
- payment confirmation page punya upload bukti bayar, pilih paket, pilih metode bayar
- admin settings punya tab billing, account, member, maintenance, market

UI requirements detail:
- pertahankan gaya visual premium dari source
- gunakan typography serif untuk judul section besar
- jangan pakai desain SaaS generik
- jangan pakai warna ungu dominan
- buat admin panel versi gelap yang tetap satu keluarga dengan member panel
- gunakan card hierarchy, whitespace luas, dan badge uppercase kecil

Deliverables yang saya mau:
1. Struktur folder lengkap
2. Schema D1 + migration SQL
3. Worker API routes
4. Middleware/auth guard
5. Frontend pages dan komponen
6. Modal system global
7. Realtime channel design
8. Env example file
9. Wrangler config
10. Seed data minimum
11. Petunjuk deploy ke Cloudflare

Buat hasil akhir yang rapi, modular, typed, dan dekat mungkin dengan proyek sumber ini dari sisi:
- tampilan
- menu
- fitur
- data model
- role system
- alur membership
- alur admin
- payment confirmation
- market widgets
- AI assistant
- maintenance mode

Kalau ada bagian yang di proyek sumber kurang aman atau kurang cocok untuk Cloudflare, pertahankan behavior-nya tetapi perbaiki implementasinya dengan pendekatan Cloudflare yang lebih aman.
```

## 8. ENV versi Cloudflare yang Disarankan

Contoh env/secret untuk versi baru:

```env
APP_NAME=Leosiqra
APP_ENV=production
APP_URL=
SESSION_COOKIE_NAME=leosiqra_session
SESSION_SECRET=

AI_PROVIDER=gemini
GEMINI_API_KEY=

R2_BUCKET=leosiqra-assets
R2_PUBLIC_BASE_URL=

D1_DATABASE_ID=

MAINTENANCE_BYPASS_ADMIN=true
DEFAULT_FREE_PLAN_DAYS=0
```

Untuk `wrangler secret`:

- `SESSION_SECRET`
- `GEMINI_API_KEY`
- secret upload signing jika pakai Cloudflare Images/R2 signed upload

## 9. Rekomendasi Migrasi

Urutan migrasi paling aman:

1. bangun schema D1 dulu
2. bangun auth + session + role guard
3. pindahkan CRUD utama: users, accounts, transactions, investments
4. pindahkan admin settings + payments
5. pindahkan upload file ke R2/Images
6. pindahkan AI ke Worker server-side
7. tambahkan realtime DO/SSE
8. poles ulang UI agar setara dengan proyek sumber

## 10. Catatan Penutup

Kalau target Anda adalah hasil yang "sama banget" dengan proyek ini, maka yang harus disalin bukan cuma UI, tapi juga:

- route map
- naming bisnis
- role/status flow
- modal inventory
- schema data
- summary cards dan kalkulasi dashboard
- admin billing + maintenance control

Dokumen ini sengaja dibuat supaya agent lain bisa langsung mulai membangun versi Cloudflare tanpa harus membongkar ulang seluruh repo.

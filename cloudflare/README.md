# Cloudflare Scaffold

Fondasi ini menyiapkan migrasi backend dari Firebase/Firestore ke Cloudflare-native tanpa membuang frontend Next.js yang sudah ada.

## Isi yang sudah dibuat

- `wrangler.toml` untuk Worker, D1, KV, R2, dan Durable Object
- `cloudflare/migrations/0001_initial.sql` untuk schema D1 lengkap
- `cloudflare/seeds/seed.sql` untuk seed minimum admin settings dan admin user
- `cloudflare/src/index.ts` untuk Worker API:
  - auth register/login/me/logout
  - transaksi member list/create
  - AI chat server-side
  - admin settings get/update
  - upload signing placeholder
  - realtime SSE lewat Durable Object
- `middleware.ts` untuk role guard Next secara opt-in
- `src/lib/cloudflare-api.ts` untuk frontend fetch helper
- `src/lib/server/cloudflare-session.ts` untuk snapshot session di server component

## Cara pakai lokal

1. Install dependency baru:
   `npm install`
2. Salin `.dev.vars.example` menjadi `.dev.vars`
3. Isi `SESSION_SECRET` dan binding ID yang benar di `wrangler.toml`
4. Jalankan migration:
   `npm run cf:d1:migrate`
5. Jalankan seed:
   `npm run cf:d1:seed`
6. Jalankan Worker:
   `npm run cf:dev`

## Catatan integrasi Next

- Default project masih aman karena `NEXT_PUBLIC_USE_CLOUDFLARE_AUTH=false`
- Saat backend Cloudflare siap dipakai penuh, aktifkan:
  `NEXT_PUBLIC_USE_CLOUDFLARE_AUTH=true`
- Setelah itu, page login/register bisa diarahkan bertahap dari Firebase ke endpoint Worker:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`

## Langkah migrasi berikutnya yang paling masuk akal

1. Ganti auth UI `login/register` ke `cloudflareApi()`
2. Pindahkan `MaintenanceGuard` ke source settings dari Worker
3. Ganti service Firestore satu per satu:
   - users
   - accounts
   - transactions
   - investments
   - payments
4. Sambungkan page dashboard ke realtime SSE Durable Object

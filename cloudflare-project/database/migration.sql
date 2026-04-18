-- Jalankan file ini setelah export data legacy Anda menjadi JSON arrays per koleksi.
-- 1. `npm install`
-- 2. Atur `.env` sesuai `.env.example`
-- 3. `npm run data:import`
-- 4. `wrangler d1 execute membersite_leosiqra_db --local --file=./database/generated-import.sql`
-- 5. `wrangler d1 execute membersite_leosiqra_db --remote --file=./database/generated-import.sql`

INSERT OR IGNORE INTO users (
  id,
  email,
  password_hash,
  name,
  role,
  plan,
  status,
  created_at,
  updated_at
) VALUES (
  'admin-seed',
  'admin@example.com',
  'replace-after-first-real-register',
  'Admin Leosiqra',
  'admin',
  'PRO',
  'AKTIF',
  datetime('now'),
  datetime('now')
);

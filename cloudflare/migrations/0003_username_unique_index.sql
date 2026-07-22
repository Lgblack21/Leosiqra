-- Cegah dua user punya username yang sama (case-insensitive), dipakai sebagai
-- identitas login alternatif selain email (lihat handleLogin). Partial index
-- (bukan UNIQUE biasa) karena banyak user lama punya username '' — kalau
-- di-UNIQUE-kan mentah-mentah, semua baris '' itu sendiri sudah saling
-- bentrok. Diterapkan di produksi lewat endpoint admin
-- /api/admin/debug/enforce-username-unique (mengecek dulu ada bentrokan lama
-- atau tidak sebelum index dipasang), bukan lewat `wrangler d1 migrations
-- apply` — lihat catatan drift schema production di tempat lain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users(LOWER(username))
  WHERE username IS NOT NULL AND username != '';

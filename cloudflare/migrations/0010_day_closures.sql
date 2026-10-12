-- Tutup hari + streak (fase 1 rombak gaya baru, 2026-10-12).
-- Additive saja: hanya tabel baru berawalan dc_, tidak ada ALTER ke tabel lama.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, endpoint /api/member/streak menjawab
-- 503 "belum aktif" dan kartu Tutup hari disembunyikan, fitur lain aman).

-- Satu baris per hari (tanggal WIB) yang sudah "ditutup" user.
--   closed = ditutup di hari itu juga
--   late   = diisi belakangan (maksimal 7 hari ke belakang)
--   shield = ditutup otomatis oleh perisai karena terlewat
CREATE TABLE IF NOT EXISTS dc_days (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('closed', 'late', 'shield')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Status perisai per user. checked_through = hari terakhir yang sudah dinilai
-- (perisai dipakai / diberikan), supaya penilaian idempoten dan tidak dobel.
CREATE TABLE IF NOT EXISTS dc_state (
  user_id TEXT PRIMARY KEY,
  shields INTEGER NOT NULL DEFAULT 2,
  checked_through TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

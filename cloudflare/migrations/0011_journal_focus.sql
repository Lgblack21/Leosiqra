-- Jurnal harian + sesi Fokus (fase 3 rombak gaya baru, 2026-10-12).
-- Additive saja: hanya tabel baru berawalan jr_/fk_, tidak ada ALTER ke tabel lama.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, endpoint jurnal/fokus menjawab 503 dan
-- halamannya menampilkan "belum aktif"; fitur lain aman).

-- Satu entri per hari (tanggal WIB). mood 1..5 (Berat, Lesu, Biasa, Baik, Mantap).
CREATE TABLE IF NOT EXISTS jr_entries (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  note TEXT,
  highlight TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Satu baris per sesi fokus yang selesai.
CREATE TABLE IF NOT EXISTS fk_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('belajar', 'kerja', 'baca')),
  label TEXT,
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 180),
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fk_sessions_user_day ON fk_sessions(user_id, day);

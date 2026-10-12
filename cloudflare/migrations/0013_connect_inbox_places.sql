-- Aplikasi terhubung (link rahasia), Kotak masuk, dan Peta (fase 5 rombak
-- gaya baru, 2026-10-13). Additive saja: hanya tabel baru berawalan ap_/ib_/pt_,
-- tidak ada ALTER ke tabel lama. Diterapkan ke produksi lewat
-- `wrangler d1 execute --remote --file` oleh Bos SEBELUM Worker dideploy
-- (kalau belum, endpoint terkait menjawab 503; fitur lain aman).

-- Token link rahasia per user per kegunaan. Yang disimpan hanya SHA-256-nya;
-- token asli cuma ditampilkan sekali ke user saat dibuat/dibuat ulang.
--   inbox    = kirim draf transaksi dari Shortcuts/HTTP Shortcuts
--   calendar = langganan kalender (iCal) berisi transaksi rutin
--   sheets   = CSV transaksi untuk IMPORTDATA Google Sheets
CREATE TABLE IF NOT EXISTS ap_tokens (
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('inbox', 'calendar', 'sheets')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  PRIMARY KEY (user_id, purpose),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Draf transaksi yang menunggu ditinjau (belum jadi transaksi apa pun).
CREATE TABLE IF NOT EXISTS ib_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('shortcut', 'paste')),
  raw_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ib_drafts_user ON ib_drafts(user_id, created_at);

-- Lokasi tempat belanja per transaksi (diisi user). Transaksi yang dihapus
-- otomatis tidak tampil (selalu di-JOIN ke transactions milik user).
CREATE TABLE IF NOT EXISTS pt_places (
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  name TEXT,
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, transaction_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

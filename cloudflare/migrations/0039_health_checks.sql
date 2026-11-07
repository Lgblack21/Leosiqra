-- Sehatku › Cek: catatan cek kesehatan rutin & vaksin dewasa milik user.
-- Boleh sebelum/sesudah deploy: tanpa tabel, GET → ready:false dan simpan → 503.
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  date TEXT NOT NULL,
  place TEXT,
  free INTEGER NOT NULL DEFAULT 0,
  cost INTEGER,
  dose INTEGER,
  tx_id TEXT,
  note TEXT,
  reminded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_checks_user ON health_checks(user_id, item_key, date);
CREATE INDEX IF NOT EXISTS idx_health_checks_date ON health_checks(date);

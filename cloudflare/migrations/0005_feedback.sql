-- Saran & kritik dari member (menu "Saran & Kritik" di web & aplikasi HP),
-- plus balasan admin. Additive saja (tabel baru), tidak menyentuh tabel lain.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file`, bukan
-- `migrations apply` — lihat catatan drift di schema-production.sql.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,          -- saran | kritik | masalah | pujian
  rating INTEGER,                  -- 1..5 (opsional)
  message TEXT NOT NULL,
  page TEXT,                       -- halaman asal (opsional, untuk konteks)
  platform TEXT,                   -- web | app
  status TEXT NOT NULL DEFAULT 'baru', -- baru | dibaca | selesai
  admin_reply TEXT,
  replied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback (status, created_at);

-- Riwayat notifikasi (lonceng di header). Setiap push dari server ikut dicatat
-- di sini lewat sendWebPushToUser. Dibersihkan otomatis (>60 hari / >100 per user).
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);

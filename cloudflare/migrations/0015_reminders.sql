-- Pengingat (notifikasi push di jam pilihan member). Additive: tabel baru saja.
-- Jalankan `wrangler d1 execute --remote --file` SEBELUM Worker dideploy
-- (kalau belum, /api/member/reminders menjawab 503).
-- days = bitmask hari WIB (bit 0 = Minggu … bit 6 = Sabtu); 127 = tiap hari.
CREATE TABLE IF NOT EXISTS rm_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  time_wib TEXT NOT NULL,
  days INTEGER NOT NULL DEFAULT 127,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rm_reminders_time ON rm_reminders(enabled, time_wib);
CREATE INDEX IF NOT EXISTS idx_rm_reminders_user ON rm_reminders(user_id);

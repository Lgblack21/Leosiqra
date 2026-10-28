-- Pengingat buatan user (Pengaturan → Pengingat): nama, waktu (UTC ISO),
-- nominal opsional (mengisi Input Cepat saat notifikasi diketuk), ulang
-- mingguan/bulanan. Dikirim cron 10 menit; klaim bersyarat pada due_at
-- mencegah kirim dobel.
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL,
  due_at TEXT NOT NULL,
  repeat TEXT NOT NULL DEFAULT 'none',
  anchor_day INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (active, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders (user_id, due_at);

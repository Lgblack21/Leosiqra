-- Token push aplikasi native (Android via FCM). Diikat ke SESI login: logout /
-- sesi kedaluwarsa = baris sesi hilang = token tidak dikirimi lagi (JOIN
-- sessions saat kirim) dan dibersihkan cron harian. Satu token = satu perangkat;
-- login akun lain di HP yang sama memindahkan token ke user baru.
CREATE TABLE IF NOT EXISTS native_push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user ON native_push_tokens (user_id);

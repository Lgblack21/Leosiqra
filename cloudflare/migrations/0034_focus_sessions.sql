-- Fokus bareng Leo: riwayat sesi fokus (Rekap) per user, sinkron antar perangkat.
-- id = UUID dari klien (kirim ulang = tidak dobel). date = tanggal WIB sesi dimulai.
-- Tanpa FK/DEFAULT (cocok dengan cara menjalankan di D1 Console).
CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT,
  planned_min INTEGER NOT NULL,
  focus_sec INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, date);

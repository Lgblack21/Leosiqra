-- Kanvas (3.10.0): papan rencana keuangan per user. state_json = jawaban, centang, posisi kartu, catatan.
-- rev naik setiap simpan → simpan dari perangkat lain yang sudah basi ditolak (409), bukan menimpa.
CREATE TABLE IF NOT EXISTS canvases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template TEXT NOT NULL,
  title TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  rev INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canvases_user ON canvases(user_id, updated_at);

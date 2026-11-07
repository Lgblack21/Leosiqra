-- Cerita Hari Ini: satu halaman per hari per user (mood, tulisan, foto / ilustrasi AI).
-- date = tanggal WIB (YYYY-MM-DD). Gambar disimpan di R2 (stories/<user>/...).
-- Tanpa FK/DEFAULT (cocok dengan cara menjalankan di D1 Console).
CREATE TABLE IF NOT EXISTS stories (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  mood INTEGER,
  text TEXT,
  photo_key TEXT,
  ai_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

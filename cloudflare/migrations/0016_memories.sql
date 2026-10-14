-- Ingatan Leo (asisten): fakta jangka panjang yang Leo pakai di obrolan
-- berikutnya, mis. "gajian tiap tanggal 25", "lagi nabung buat nikah 2027".
-- Bisa dilihat & dihapus member. Additive: tabel baru saja. Jalankan SEBELUM
-- deploy Worker (kalau belum, /api/member/memories menjawab 503; chat tetap jalan).
CREATE TABLE IF NOT EXISTS am_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_am_memories_user ON am_memories(user_id, created_at);

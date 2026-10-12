-- Barang & Koleksi (fase 4 rombak gaya baru, 2026-10-12).
-- Additive saja: hanya tabel baru berawalan br_, tidak ada ALTER ke tabel lama.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, endpoint /api/member/items menjawab 503).

-- kind: 'barang' (HP, laptop, motor…) atau 'koleksi' (kartu, sneakers, figur…).
-- Nilai dalam rupiah utuh. current_value = taksiran nilai sekarang (diisi user).
CREATE TABLE IF NOT EXISTS br_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('barang', 'koleksi')),
  name TEXT NOT NULL,
  category TEXT,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  current_value INTEGER NOT NULL DEFAULT 0,
  purchase_date TEXT,
  warranty_until TEXT,
  for_sale INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_br_items_user ON br_items(user_id, kind);

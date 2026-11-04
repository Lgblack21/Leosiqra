-- Ladangku › Jual: daftar barang yang SEDANG DIJUAL. Dibuat/diperbarui otomatis
-- setiap kali AI selesai menaksir (POST /api/member/items/appraise). item_id =
-- barang Barangku (boleh NULL untuk barang yang belum dicatat). photo_key = foto
-- yang dipakai AI (R2 FILES_BUCKET, listings/<user>/…). appraisal_json = hasil
-- taksiran (harga bawah/wajar/atas/cepat laku, dasar, pembanding, tips).
-- status: dijual | terjual | batal. Laku → pemasukan (related_type 'item').
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT,
  name TEXT NOT NULL,
  variant TEXT,
  condition TEXT,
  completeness TEXT,
  minus TEXT,
  area TEXT,
  photo_key TEXT,
  appraisal_json TEXT,
  price REAL,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL, -- dijual | terjual | batal (selalu diisi Worker)
  sold_price REAL,
  sold_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings (user_id, status, updated_at);

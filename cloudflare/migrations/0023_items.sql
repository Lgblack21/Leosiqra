-- Barangku: barang milik user (HP, laptop, motor, jam, perabot, …) — harga beli,
-- tanggal beli, garansi, foto (R2 FILES_BUCKET, key items/<user>/<id>).
-- Nilai sekarang dihitung di klien dari kategori + umur (lib/itemValue) kecuali
-- value_mode 'manual' (manual_value) atau 'tetap' (= harga beli).
-- Pengingat garansi H-30 & H-7: klaim warranty_reminded_for = "<tanggal>|<tahap>".
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  variant TEXT,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  purchase_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  purchase_date TEXT,
  warranty_until TEXT,
  value_mode TEXT NOT NULL DEFAULT 'auto',
  manual_value REAL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  photo_key TEXT,
  warranty_reminded_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_items_warranty ON items (status, warranty_until);

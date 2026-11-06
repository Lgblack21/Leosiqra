-- Usahaku › Stok: bahan baku per usaha, riwayat keluar-masuk (buku stok), resep produk.
-- shop_materials.stock = stok sekarang (dijaga bersama riwayat dalam satu batch D1).
-- shop_stock_moves.qty bertanda: + masuk (beli/awal/opname naik), − keluar (jual/pakai).
-- ref_tx_id = transaksi penjualan/biaya pemicunya (dihapus → stok dikembalikan, reverted_at diisi).
-- ref_key unik per pemilik = anti dobel (request_id). Tanpa FK/DEFAULT (cocok D1 Console).
CREATE TABLE IF NOT EXISTS shop_materials (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock REAL NOT NULL,
  min_stock REAL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_materials_shop ON shop_materials(owner_id, shop_id);
CREATE TABLE IF NOT EXISTS shop_stock_moves (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  qty REAL NOT NULL,
  cost REAL,
  note TEXT,
  ref_tx_id TEXT,
  ref_key TEXT,
  by_name TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reverted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shop_stock_moves_material ON shop_stock_moves(material_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shop_stock_moves_tx ON shop_stock_moves(ref_tx_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_stock_moves_key ON shop_stock_moves(owner_id, ref_key);
CREATE TABLE IF NOT EXISTS shop_recipes (
  shop_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  items_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (shop_id, product_key)
);

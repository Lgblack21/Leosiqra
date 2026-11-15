-- Usahaku R2 (HPP): harga modal manual per produk. HANYA dibaca pemilik — sengaja tidak di
-- shops.products_json karena katalog itu dikirim ke akun tim & bisa ditimpa sinkron website/MCP.
-- product_key = "kategori|nama" (sama dengan kasir & shop_recipes). Aman dijalankan ulang.
CREATE TABLE IF NOT EXISTS shop_costs (
  shop_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  cost REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (shop_id, product_key)
);
CREATE INDEX IF NOT EXISTS idx_shop_costs_owner ON shop_costs(owner_id, shop_id);

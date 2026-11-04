-- Usahaku (Ladangku › Usaha): rencana usaha sampingan milik user (dibuat AI dari
-- "aku bisa …", lalu bisa diedit) + katalog produk + kontak. TIDAK ada halaman
-- publik — katalog disebar user sendiri (teks/gambar/tautan wa.me). Penjualan
-- dicatat sebagai transaksi pemasukan biasa (related_type 'shop', related_id = id).
-- products_json: [{ "name", "price" (IDR), "unit" }] maks 20.
-- plan_json: { modal, waktu, perBulan: [min,max], alasan[], langkah[], pembeli, cariDi }.
-- promoted_at: pertama kali katalog disalin/dibagikan (tahap "Promosi").
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  emoji TEXT,
  products_json TEXT NOT NULL DEFAULT '[]',
  plan_json TEXT,
  contact_wa TEXT,
  payment_note TEXT,
  area TEXT,
  link_url TEXT,
  promoted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shops_user ON shops (user_id, created_at);

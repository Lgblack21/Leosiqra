-- Usahaku R1 — buku usaha terpisah dari keuangan pribadi (rancangan docs/rancangan/usahaku-pembukuan.md).
-- Jalankan di D1 Console (leosiqra-db). Aman dijalankan sekali; tabel baru tidak mengubah data lama.

-- Jenis toko (kuliner, online, topup, …) & jalur jualan yang dipakai toko.
ALTER TABLE shops ADD COLUMN kind TEXT;
ALTER TABLE shops ADD COLUMN channels_json TEXT;

-- Kas usaha: kas toko, bank usaha, e-wallet, saldo marketplace, deposit supplier. Saldo dalam Rupiah bulat.
CREATE TABLE IF NOT EXISTS shop_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'kas',
  balance INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_accounts_shop ON shop_accounts(owner_id, shop_id);

-- Buku usaha: jual / biaya / setor (pribadi → usaha) / ambil (usaha → pribadi) / pindah (antar kas) / saldo_awal.
-- amount = nilai kotor (jual: harga ke pembeli = omzet), fee = total potongan marketplace,
-- net = uang yang masuk/keluar kas. status 'menunggu' = penjualan marketplace belum cair (belum masuk kas).
CREATE TABLE IF NOT EXISTS shop_entries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,
  net INTEGER NOT NULL,
  account_id TEXT,
  to_account_id TEXT,
  personal_account_id TEXT,
  personal_tx_id TEXT,
  channel TEXT,
  channel_type TEXT,
  pay_method TEXT,
  status TEXT NOT NULL DEFAULT 'selesai',
  settled_at TEXT,
  category TEXT,
  buyer TEXT,
  reseller INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  payload_json TEXT,
  by_staff_id TEXT,
  by_name TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_entries_key ON shop_entries(owner_id, entry_key);
CREATE INDEX IF NOT EXISTS idx_shop_entries_shop_date ON shop_entries(owner_id, shop_id, date);
CREATE INDEX IF NOT EXISTS idx_shop_entries_status ON shop_entries(owner_id, shop_id, status);

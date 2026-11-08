-- Peta Belanja (3.14.0): lokasi per transaksi, hanya diisi kalau user menandainya (GPS sekali, cari tempat,
-- atau geser pin). Satu lokasi per transaksi; transaksi dihapus → lokasinya ikut dihapus (Worker).
CREATE TABLE IF NOT EXISTS tx_places (
  tx_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  name TEXT,
  address TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_places_user ON tx_places(user_id);

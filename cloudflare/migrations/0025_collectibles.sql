-- Koleksiku: barang koleksi yang nilainya mengikuti pasar (bisa naik).
-- kind: pokemon (kartu, data & harga dari TCGdex — ref_id = id kartu TCGdex,
--       mis. base1-4) | lainnya (sneakers, figur, koin… nilai diisi user).
--       (steam = tahap 2.)
-- purchase_price & manual_value per item dalam IDR; market_price per item dalam
-- market_currency (USD TCGplayer / EUR Cardmarket), diperbarui saat Koleksiku
-- dibuka (POST /refresh, maks sekali per ~20 jam per kartu).
CREATE TABLE IF NOT EXISTS collectibles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'lainnya',
  ref_id TEXT,
  name TEXT NOT NULL,
  set_name TEXT,
  number TEXT,
  rarity TEXT,
  variant TEXT,
  image_url TEXT,
  photo_key TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price REAL NOT NULL DEFAULT 0,
  manual_value REAL,
  market_price REAL,
  market_currency TEXT,
  market_updated_at TEXT,
  condition TEXT,
  grade TEXT,
  acquired_date TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collectibles_user ON collectibles (user_id, created_at);

-- Jejak nilai koleksi per user per hari (titik grafik). Ditulis saat Koleksiku
-- dibuka; satu baris per hari (UPSERT).
CREATE TABLE IF NOT EXISTS collectible_value_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  value_idr REAL NOT NULL,
  cost_idr REAL NOT NULL,
  PRIMARY KEY (user_id, day)
);

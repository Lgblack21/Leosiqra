-- Makanku: catatan makan harian (foto → AI kalori & gizi, bisa langsung jadi pengeluaran).
-- Boleh sebelum/sesudah deploy: tanpa tabel, GET → ready:false dan simpan → 503.
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  slot TEXT NOT NULL,
  name TEXT NOT NULL,
  items_json TEXT,
  kcal INTEGER,
  protein REAL,
  carbs REAL,
  fat REAL,
  score INTEGER,
  tip TEXT,
  price INTEGER,
  tx_id TEXT,
  photo_key TEXT,
  note TEXT,
  ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);

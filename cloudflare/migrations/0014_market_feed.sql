-- Pasar & belajar: data pasar yang diambil otomatis oleh Worker (BI-Rate dari
-- bi.go.id, bunga penjaminan dari lps.go.id, emas, penawaran SBN dari berita)
-- dan ringkasan berita ekonomi dari RSS media. Tabel baru saja — tidak
-- menyentuh tabel lain. Jalankan via `wrangler d1 execute --remote --file`
-- oleh Bos SEBELUM Worker dideploy (kalau belum, /api/member/pasar menjawab 503).

CREATE TABLE IF NOT EXISTS market_feed (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_news (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_news_published ON market_news (published_at DESC);

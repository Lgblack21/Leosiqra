-- Secret aplikasi yang bisa diganti admin dari panel (saat ini: API key
-- OpenRouter untuk AI Leosiqra). value_enc = AES-GCM terenkripsi, kunci
-- diturunkan dari SESSION_SECRET — tidak pernah disimpan/ditampilkan polos.
-- Additive saja (tabel baru). Diterapkan ke produksi lewat
-- `wrangler d1 execute --remote --file`.
CREATE TABLE IF NOT EXISTS app_secrets (
  id TEXT PRIMARY KEY,
  value_enc TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

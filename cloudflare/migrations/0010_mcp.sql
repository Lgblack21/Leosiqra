-- Leosiqra MCP tahap 1+2 (token manual, tool baca, tool tulis) — ACC Bos
-- 2026-10-12, keputusan Bos 2026-10-23, rancangan: docs/rancangan/mcp.md.
-- Additive saja: hanya tabel baru berawalan mcp_, tidak ada ALTER ke tabel lama.
-- Tabel OAuth (mcp_refresh_tokens, mcp_oauth_codes, mcp_oauth_clients) menyusul
-- di migrasi tahap 3.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, /mcp & /api/member/mcp/* menjawab 503
-- "belum aktif", fitur lain tidak terpengaruh).

-- Token akses MCP. Token mentah (prefix "lsq_mcp_") hanya ditampilkan sekali
-- saat dibuat; yang tersimpan cuma SHA-256-nya.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,            -- 4 karakter terakhir, untuk dikenali di UI
  scopes TEXT NOT NULL,                -- 'read' atau 'read write'
  source TEXT NOT NULL CHECK (source IN ('manual', 'oauth')),
  client_id TEXT,                      -- klien OAuth (tahap 3); null untuk manual
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);

-- Log aktivitas per token (tanpa argumen mentah; cukup tool + ringkasan).
CREATE TABLE IF NOT EXISTS mcp_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  ok INTEGER NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_activity_user ON mcp_activity(user_id, created_at);

-- Anti-dobel tool tulis: AI agent sering mengulang panggilan tool yang sama.
CREATE TABLE IF NOT EXISTS mcp_idempotency (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  result_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

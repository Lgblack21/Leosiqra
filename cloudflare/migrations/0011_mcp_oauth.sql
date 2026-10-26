-- Leosiqra MCP tahap 3: OAuth 2.1 (authorization code + PKCE S256, refresh
-- token berotasi, Dynamic Client Registration terbuka) — keputusan Bos
-- 2026-10-23 #1 & #2, rancangan: docs/rancangan/mcp.md.
-- Additive saja: hanya tabel baru berawalan mcp_oauth_/mcp_refresh_, tidak ada
-- ALTER ke tabel lama. Butuh 0010_mcp.sql sudah diterapkan.
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, /oauth/* menjawab 503 "belum aktif";
-- token manual & fitur lain tidak terpengaruh).
--
-- Satu "koneksi" OAuth = satu baris mcp_tokens (source='oauth'). Access token
-- (1 jam) dirotasi DI BARIS ITU (token_hash/expires_at diganti) setiap refresh,
-- jadi log mcp_activity tetap menunjuk ke koneksi yang sama dan mencabut baris
-- itu (Profil → Keamanan) memutus koneksi + semua refresh token-nya.

-- Klien hasil Dynamic Client Registration (RFC 7591). Data dari klien = tidak
-- tepercaya: layar izin selalu menampilkan DOMAIN redirect, bukan cuma nama.
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,         -- JSON array; https, atau http loopback untuk klien lokal
  auth_method TEXT NOT NULL CHECK (auth_method IN ('none', 'client_secret_post', 'client_secret_basic')),
  secret_hash TEXT,                    -- sha256 hex; null untuk klien publik (auth_method 'none')
  created_at TEXT NOT NULL
);

-- Kode otorisasi: 10 menit, sekali pakai, terikat client + redirect_uri + PKCE.
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,        -- S256 saja
  scopes TEXT NOT NULL,                -- 'read' atau 'read write'
  expires_at TEXT NOT NULL,
  used_at TEXT,
  family_id TEXT,                      -- mcp_tokens.id yang diterbitkan; kode dipakai ulang → koneksi dicabut
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_user ON mcp_oauth_codes(user_id, expires_at);

-- Refresh token: rotasi sekali pakai. Refresh lama dipakai lagi (kemungkinan
-- dicuri) → seluruh koneksi (family_id = mcp_tokens.id) dicabut.
CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_refresh_family ON mcp_refresh_tokens(family_id);

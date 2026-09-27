-- Token reset password (fitur "Lupa password" lewat email). Yang disimpan
-- cuma HASH SHA-256 dari token — token mentahnya hanya ada di link email,
-- jadi bocornya isi tabel ini tidak bisa dipakai untuk reset password orang.
-- consume_nonce dipakai handleResetPassword supaya pemakaian token + ganti
-- password + cabut sesi terjadi dalam satu batch yang aman dari race
-- (dua request reset bersamaan dengan token yang sama cuma satu yang lolos).
-- Additive saja (tabel baru), tidak menyentuh tabel lain. Diterapkan ke
-- produksi lewat `wrangler d1 execute --remote --file`, bukan
-- `migrations apply` — lihat catatan drift di schema-production.sql.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  consume_nonce TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens(user_id, created_at DESC);

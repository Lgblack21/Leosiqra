-- Dompet Bersama (Mode Keluarga/Patungan) fase 1 — ACC Bos 2026-10-12,
-- rancangan: docs/rancangan/shared-wallet.md (nomor 0008 di rancangan sudah
-- terpakai signup_sources, jadi file ini 0009).
-- Additive saja: hanya tabel baru berawalan sw_, tidak ada ALTER ke tabel lama.
-- Buku kas terpisah dari transactions/accounts/budgets pribadi — saldo dompet
-- = SUM transaksi aktif (tidak ada mutasi balance), uang INTEGER (rupiah utuh).
-- Diterapkan ke produksi lewat `wrangler d1 execute --remote --file` oleh Bos
-- SEBELUM Worker dideploy (kalau belum, endpoint dompet bersama menjawab 503
-- "belum aktif", fitur lain tidak terpengaruh).

CREATE TABLE IF NOT EXISTS sw_wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  owner_id TEXT NOT NULL,             -- salinan cepat dari sw_members role='owner'
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- Owner tidak bisa dihapus sebelum kepemilikan diserahkan (keputusan Bos #2).
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_sw_wallets_owner ON sw_wallets(owner_id);

CREATE TABLE IF NOT EXISTS sw_members (
  wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  display_name TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (wallet_id, user_id),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sw_members_user ON sw_members(user_id);

-- Token undangan acak 32 byte; yang disimpan hanya SHA-256-nya.
CREATE TABLE IF NOT EXISTS sw_invites (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sw_invites_wallet ON sw_invites(wallet_id);

CREATE TABLE IF NOT EXISTS sw_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pemasukan', 'pengeluaran')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,                 -- YYYY-MM-DD (WIB)
  paid_by TEXT,                       -- disiapkan untuk settle-up fase 2
  created_by TEXT,
  client_request_id TEXT NOT NULL,    -- anti-dobel dari klien
  deleted_at TEXT,                    -- hapus lunak
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (wallet_id, client_request_id),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sw_tx_wallet_date ON sw_transactions(wallet_id, date DESC);

CREATE TABLE IF NOT EXISTS sw_budgets (
  wallet_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (wallet_id, category),
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);

-- Jejak aktivitas tanpa nominal/teks bebas.
CREATE TABLE IF NOT EXISTS sw_activity (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES sw_wallets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sw_activity_wallet ON sw_activity(wallet_id, created_at DESC);

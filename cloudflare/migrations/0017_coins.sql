-- Koin Leosiqra & referral — ACC Bos 2026-10-27 (angka: daftar 100, teman
-- aktif 300/100, teman beli PRO 1.000, streak 30 hari 50; tukar PRO 1 bulan
-- 2.000 koin; tarik tunai 1 koin = Rp1, minimal 50.000 koin, manual via admin).
-- Additive saja: tabel baru berawalan coin_/referral_, tidak ada ALTER ke
-- tabel lama. Diterapkan ke produksi lewat Console D1 / `wrangler d1 execute
-- --remote --file` SEBELUM Worker dideploy (kalau belum, /api/member/coins*
-- menjawab 503 "belum aktif"; fitur lain tidak terpengaruh).

-- Buku besar koin. Saldo = SUM(amount), tidak pernah disimpan sebagai angka
-- yang bisa ditimpa. idem_key UNIQUE = satu hadiah/penukaran hanya tercatat
-- sekali walau request terkirim dua kali. cashable=1 hanya untuk koin yang
-- boleh ditarik tunai (hadiah teman beli PRO) dan pergerakan tarik tunai.
CREATE TABLE IF NOT EXISTS coin_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  cashable INTEGER NOT NULL DEFAULT 0,
  idem_key TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON coin_ledger (user_id, created_at);

-- Kode referral per user (dibuat saat pertama dibutuhkan) + siapa yang
-- mengajak user ini (sekali, dalam 30 hari pertama akun).
CREATE TABLE IF NOT EXISTS referral_codes (
  user_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  referred_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_referred_by ON referral_codes (referred_by);

-- Pengajuan tarik tunai. Koin langsung dipotong saat diajukan (dikunci);
-- ditolak = dikembalikan lewat baris ledger refund. Transfer dilakukan admin
-- manual, lalu status DIBAYAR.
CREATE TABLE IF NOT EXISTS coin_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coins INTEGER NOT NULL,
  amount_idr INTEGER NOT NULL,
  method TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DIBAYAR', 'DITOLAK')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_coin_withdrawals_status ON coin_withdrawals (status, created_at);

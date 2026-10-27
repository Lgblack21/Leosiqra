-- Kotak Masuk: usulan transaksi dari email pembayaran (Gmail via Composio) —
-- ACC Bos 2026-10-28 ("ikuti saran": masuk Kotak Masuk dulu, user yang
-- menyimpan/mengabaikan; tidak pernah langsung jadi transaksi).
-- Additive saja: tabel baru, tidak ada ALTER ke tabel lama. Diterapkan lewat
-- Console D1 / `wrangler d1 execute --remote --file` SEBELUM Worker dideploy
-- (kalau belum: fitur Kotak Masuk menjawab 503 "belum aktif", lainnya aman).
--
-- Isi email TIDAK disimpan — hanya subjek & pengirim (dipotong) dan usulan
-- AI. status: BARU (menunggu), DISIMPAN, DIABAIKAN (oleh user), BUKAN (AI:
-- bukan transaksi; disimpan hanya supaya email yang sama tidak dibaca ulang).
CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'BARU' CHECK (status IN ('BARU', 'DISIMPAN', 'DIABAIKAN', 'BUKAN')),
  title TEXT,
  sender TEXT,
  suggestion_json TEXT,
  received_at TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (user_id, source, source_ref),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status ON inbox_items (user_id, status, created_at);

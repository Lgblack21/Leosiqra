-- Lampiran foto struk per transaksi — ACC Bos 2026-10-27 (toggle "Simpan file
-- lampiran" di Profil, default aktif). Additive saja: tabel baru, tidak ada
-- ALTER ke tabel lama. File-nya di R2 (FILES_BUCKET) dengan key
-- attachments/<user_id>/<id>. Diterapkan lewat Console D1 / `wrangler d1
-- execute --remote --file` SEBELUM Worker dideploy (kalau belum: scan struk
-- tetap jalan tanpa menyimpan foto, /api/member/attachments* menjawab 503).
--
-- transaction_id NULL = foto sudah dibaca AI tapi transaksinya belum disimpan;
-- dibersihkan cron harian setelah 24 jam.
CREATE TABLE IF NOT EXISTS transaction_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tx_attachments_user ON transaction_attachments (user_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_attachments_pending ON transaction_attachments (transaction_id, created_at);

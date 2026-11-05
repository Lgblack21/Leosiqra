-- Usahaku: sambung otomatis penjualan dari website toko (webhook per usaha).
-- hook_hash = SHA-256 kunci rahasia (kunci asli hanya ditampilkan sekali);
-- hook_account_id = rekening tujuan; hook_last_at = penjualan terakhir yang masuk.
ALTER TABLE shops ADD COLUMN hook_hash TEXT;
ALTER TABLE shops ADD COLUMN hook_account_id TEXT;
ALTER TABLE shops ADD COLUMN hook_last_at TEXT;

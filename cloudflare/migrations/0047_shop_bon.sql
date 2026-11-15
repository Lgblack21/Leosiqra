-- Usahaku R3 (bon pelanggan, nanti juga pesanan & utang supplier).
-- ref_id   = entri asal (pembayaran bon → penjualan bon).
-- due_date = jatuh tempo (YYYY-MM-DD, opsional).
-- party    = nama pelanggan/supplier. Kontak WA di payload_json.
-- Jalankan SEKALI di D1 Console. ALTER TABLE tidak punya IF NOT EXISTS: kalau muncul
-- "duplicate column name", kolom itu sudah ada — lanjutkan baris berikutnya.
ALTER TABLE shop_entries ADD COLUMN ref_id TEXT;
ALTER TABLE shop_entries ADD COLUMN due_date TEXT;
ALTER TABLE shop_entries ADD COLUMN party TEXT;
CREATE INDEX IF NOT EXISTS idx_shop_entries_ref ON shop_entries(owner_id, ref_id);

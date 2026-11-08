-- LANGKAH 2 (MENGUBAH DATA): kembalikan saldo rekening & total member, lalu hapus transaksi dobel.
-- Jalankan HANYA setelah langkah 1 dicek. Aman dijalankan ulang: setelah sukses, langkah 1 kosong
-- sehingga langkah 2 tidak mengubah apa pun lagi.
UPDATE accounts
SET balance = balance - (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL) AND t.account_id = accounts.id AND t.user_id = accounts.user_id),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT t.account_id FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL));

UPDATE users
SET total_income = COALESCE(total_income, 0) - (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL) AND t.user_id = users.id),
    total_wealth = COALESCE(total_wealth, 0) - (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL) AND t.user_id = users.id)
WHERE id IN (SELECT t.user_id FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL));

DELETE FROM transactions
WHERE id IN (SELECT t.id FROM transactions t WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL));

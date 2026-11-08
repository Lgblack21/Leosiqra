-- LANGKAH 1 (hanya membaca): transaksi jual DOBEL yang akan dihapus.
-- Tiap baris = pemasukan kedua dari tombol "Laku" Ladangku untuk barang yang sudah dicatat laku di Barangku.
SELECT t.id AS transaksi_dobel, t.user_id, t.related_id AS barang_id, t.account_id AS rekening,
       t.amount AS nominal, t.date AS tanggal, t.note AS catatan
FROM transactions t
WHERE t.related_type = 'item' AND t.type = 'pemasukan' AND json_extract(t.payload_json, '$.listingId') IS NOT NULL AND EXISTS (SELECT 1 FROM transactions o WHERE o.user_id = t.user_id AND o.related_type = 'item' AND o.type = 'pemasukan' AND o.related_id = t.related_id AND o.id <> t.id AND json_extract(o.payload_json, '$.listingId') IS NULL)
ORDER BY t.user_id, t.date;

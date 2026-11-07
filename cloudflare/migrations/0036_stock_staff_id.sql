-- Riwayat stok mencatat id akun tim (bukan hanya nama) supaya "Batalkan" oleh akun tim
-- dicocokkan by id: tim baru bernama sama di hari yang sama tidak bisa membatalkan catatan tim lama.
-- Boleh sebelum/sesudah deploy: Worker hanya menulis kolom ini kalau sudah ada.
ALTER TABLE shop_stock_moves ADD COLUMN by_staff_id TEXT;

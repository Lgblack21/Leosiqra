-- Pinjaman: anggota (daftar + kartu), jaminan, tim (kas usaha per staf + kartu staf).
-- Rancangan: docs/rancangan/usahaku-anggota-jaminan-tim.md. Semua kolom dipakai bertahap (3.38–3.40), dijalankan sekali.
-- Jalankan SEKALI di D1 Console. ALTER TABLE tidak punya IF NOT EXISTS: kalau muncul "duplicate column name",
-- kolom itu sudah ada — lanjutkan baris berikutnya.
-- Foto (photo_key/ktp_key) = kunci file di R2 PRIVAT, bukan URL publik.
ALTER TABLE shop_borrowers ADD COLUMN member_no TEXT;
ALTER TABLE shop_borrowers ADD COLUMN address TEXT;
ALTER TABLE shop_borrowers ADD COLUMN job TEXT;
ALTER TABLE shop_borrowers ADD COLUMN photo_key TEXT;
ALTER TABLE shop_borrowers ADD COLUMN ktp_key TEXT;
ALTER TABLE shop_borrowers ADD COLUMN consent_at TEXT;
ALTER TABLE shop_borrowers ADD COLUMN registered_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_borrowers_member_no ON shop_borrowers(owner_id, shop_id, member_no) WHERE member_no IS NOT NULL;
ALTER TABLE shop_loans ADD COLUMN collateral_json TEXT;
ALTER TABLE shop_staff ADD COLUMN photo_key TEXT;
ALTER TABLE shop_staff ADD COLUMN staff_no TEXT;
ALTER TABLE shop_staff ADD COLUMN title TEXT;
ALTER TABLE shop_staff ADD COLUMN kas_json TEXT;

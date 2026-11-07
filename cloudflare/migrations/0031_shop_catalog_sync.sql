-- Usahaku: kapan daftar harga terakhir diperbarui otomatis dari website (webhook
-- POST /api/hooks/shop/<id>/products). Tanpa DEFAULT (cocok D1 Console).
ALTER TABLE shops ADD COLUMN catalog_synced_at TEXT;

-- Usahaku jenis Pinjaman (harian/mingguan). Rancangan: docs/rancangan/usahaku-pinjaman.md.
-- Uang tetap lewat shop_entries (tipe pinjam_cair, pinjam_admin, angsuran; ref_id → shop_loans.id).
-- Jalankan SEKALI di D1 Console (semua IF NOT EXISTS, aman diulang).
CREATE TABLE IF NOT EXISTS shop_borrowers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  wa TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shop_borrowers_shop ON shop_borrowers(owner_id, shop_id);

-- total = installment × count (yang harus kembali). due_dates_json = jadwal yang dikunci saat dibuat
-- (tanggal merah/Minggu sudah dilompati di perangkat). status: aktif | lunas.
CREATE TABLE IF NOT EXISTS shop_loans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  principal INTEGER NOT NULL,
  admin_fee INTEGER NOT NULL DEFAULT 0,
  admin_mode TEXT NOT NULL DEFAULT 'potong',
  installment INTEGER NOT NULL,
  count INTEGER NOT NULL,
  total INTEGER NOT NULL,
  frequency TEXT NOT NULL,
  disbursed_on TEXT NOT NULL,
  due_dates_json TEXT NOT NULL,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  note TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shop_loans_shop ON shop_loans(owner_id, shop_id, status);
-- 1 peminjam = 1 pinjaman aktif (dijaga database).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_loans_active ON shop_loans(owner_id, shop_id, borrower_id) WHERE status = 'aktif';

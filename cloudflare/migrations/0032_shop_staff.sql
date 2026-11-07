-- Usahaku › Tim: akun kasir yang dibuat pemilik usaha (username "toko-nama", sandi sendiri).
-- Login & sesi TERPISAH dari users/sessions (cookie <nama>_tim) — requireSession pemilik
-- tidak pernah menerima akun tim; akun tim hanya bisa memakai /api/staff/*.
-- Tanpa FK/DEFAULT (cocok dengan cara Bos menjalankan di D1 Console).
CREATE TABLE IF NOT EXISTS shop_staff (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  shop_ids TEXT NOT NULL,
  account_id TEXT,
  disabled_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_staff_username ON shop_staff(username);
CREATE INDEX IF NOT EXISTS idx_shop_staff_owner ON shop_staff(owner_id);
CREATE TABLE IF NOT EXISTS staff_sessions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff ON staff_sessions(staff_id);

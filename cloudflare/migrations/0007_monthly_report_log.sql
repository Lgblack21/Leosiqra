-- Laporan keuangan bulanan via email (opt-in di Profil). Satu baris per
-- (user, bulan) = klaim anti-dobel: cron yang jalan dua kali tidak bisa
-- mengirim dua email untuk bulan yang sama (INSERT OR IGNORE di PRIMARY KEY).
-- Additive saja (tabel baru). Diterapkan ke produksi lewat
-- `wrangler d1 execute --remote --file` oleh Bos — lihat catatan drift di
-- schema-production.sql. Sebelum tabel ini ada, job laporan cuma mencatat
-- error di log dan tidak mengirim apa pun.
CREATE TABLE IF NOT EXISTS monthly_report_log (
  user_id TEXT NOT NULL,
  period TEXT NOT NULL,            -- YYYY-MM (bulan yang dilaporkan, WIB)
  status TEXT NOT NULL,            -- mengirim | terkirim | kosong
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, period),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

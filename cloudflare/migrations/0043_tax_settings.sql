-- Pajak Center (3.25.0): setelan pajak per user per tahun pajak (status PTKP, PPh21 dipotong, mode usaha
-- PPh final UMKM, tanda setor bulanan, checklist SPT). data_json disaring server (sanitizeTaxSettings).
-- Tanpa tabel ini aplikasi tetap jalan: GET → ready:false dan klien menyimpan di perangkat.
CREATE TABLE IF NOT EXISTS tax_settings (
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, year)
);

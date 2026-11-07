-- Usahaku: tampilan halaman kasir per usaha (tema, tata letak, kartu, teks) —
-- JSON berpilihan terbatas (sanitizeKasirStyle di Worker), diubah manual atau
-- lewat AI milik pengguna (MCP set_kasir_style). Tanpa DEFAULT (cocok D1 Console).
ALTER TABLE shops ADD COLUMN style_json TEXT;

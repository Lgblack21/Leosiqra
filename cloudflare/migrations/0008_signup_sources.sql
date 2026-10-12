-- Sumber pendaftaran member (first-touch UTM/referrer) — ACC Bos 2026-10-12.
-- Satu baris per user, ditulis sekali saat register (email maupun Google).
-- Additive saja (tabel baru, users tidak diubah). Nilai sudah disaring di
-- Worker (huruf kecil, [a-z0-9._-], maks 64 karakter); TIDAK menyimpan IP,
-- user agent, atau URL lengkap. Sebelum tabel ini ada di produksi, register
-- tetap jalan normal (INSERT dibungkus try/catch) — sumbernya saja yang tidak
-- tercatat. Diterapkan ke produksi lewat `wrangler d1 execute --remote --file`
-- oleh Bos.
CREATE TABLE IF NOT EXISTS signup_sources (
  user_id TEXT PRIMARY KEY,
  method TEXT NOT NULL,            -- email | google
  source TEXT,                     -- utm_source atau host referrer (mis. instagram, google.com)
  medium TEXT,                     -- utm_medium, atau 'referral' untuk referrer luar
  campaign TEXT,                   -- utm_campaign
  landing_path TEXT,               -- path halaman pertama (tanpa query)
  first_seen_at TEXT,              -- kapan sumber pertama kali tercatat di browser
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signup_sources_created ON signup_sources(created_at);

-- Koleksiku tahap 2: harga dasar peringatan harga (dalam market_currency).
-- Cron menit :45 tiap jam membandingkan market_price dengan alert_price; selisih
-- ≥ 20% (dan ≥ Rp50.000) → push, lalu alert_price = harga sekarang.
-- NULL = belum ada harga dasar (diisi diam-diam tanpa push).
-- Item Steam (kind = 'steam', ref_id = market_hash_name) tidak butuh kolom baru.
ALTER TABLE collectibles ADD COLUMN alert_price REAL;

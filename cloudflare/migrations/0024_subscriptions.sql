-- Langgananku: langganan yang dipantau user (Netflix, Spotify, IndiHome, …).
-- BUKAN Transaksi Rutin: tidak mencatat transaksi otomatis — hanya memantau
-- harga, siklus, tagihan berikutnya, dan mengingatkan.
-- anchor_date = salah satu tanggal tagih (mis. tagihan pertama/terakhir);
-- tagihan berikutnya dihitung dari anchor + kelipatan siklus (lib/subscriptions).
-- status: aktif | coba (masa coba gratis, trial_end) | batal.
-- Pengingat: H-1 sebelum ditagih (charge_reminded_for), H-2 sebelum masa coba
-- habis (trial_reminded_for) — klaim "<tanggal>" supaya sekali per tagihan.
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_key TEXT,
  domain TEXT,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  cycle TEXT NOT NULL DEFAULT 'bulanan',
  anchor_date TEXT NOT NULL,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  trial_end TEXT,
  note TEXT,
  charge_reminded_for TEXT,
  trial_reminded_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status, cycle);

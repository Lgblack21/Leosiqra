-- Sehatku › Asuransi: polis milik user + pelacak klaim (reimburse).
-- Boleh sebelum/sesudah deploy: tanpa tabel, GET → ready:false dan simpan → 503.
CREATE TABLE IF NOT EXISTS health_policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insurer_key TEXT,
  insurer_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  product TEXT,
  policy_no TEXT,
  premium INTEGER,
  period TEXT NOT NULL,
  next_due TEXT,
  due_day INTEGER,
  coverage INTEGER,
  account_id TEXT,
  call_center TEXT,
  claim_note TEXT,
  hospitals_note TEXT,
  note TEXT,
  reminded_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_policies_user ON health_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_health_policies_due ON health_policies(next_due);
CREATE TABLE IF NOT EXISTS health_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  policy_id TEXT,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  approved_amount INTEGER,
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  paid_at TEXT,
  tx_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_health_claims_user ON health_claims(user_id);

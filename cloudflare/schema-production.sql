-- ACTUAL production schema of Cloudflare D1 `membersite_leosiqra_db`.
-- Dumped 2026-07-14. This is the source of truth the worker targets;
-- it differs from the legacy migrations/0001_initial.sql. Keep in sync with
-- cloudflare/src/index.ts. See notes: recurring uses `interval`, payments uses
-- `package_json`, and timestamp columns are NOT NULL without DEFAULT.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  balance REAL NOT NULL DEFAULT 0,
  initial_balance REAL NOT NULL DEFAULT 0,
  base_value REAL NOT NULL DEFAULT 0,
  logo_url TEXT,
  logo_label TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  note TEXT NOT NULL,
  color TEXT,
  payload_json TEXT,
  timestamp TEXT NOT NULL, created_at TEXT,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_settings (
  settings_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
, id TEXT, billing_email TEXT, whatsapp TEXT, pro_price REAL NOT NULL DEFAULT 0, bank_name TEXT, bank_account_name TEXT, bank_number TEXT, qris_text TEXT, qris_url TEXT, free_plan_days INTEGER NOT NULL DEFAULT 0, maintenance_is_active INTEGER NOT NULL DEFAULT 0, maintenance_type TEXT DEFAULT 'none', maintenance_code TEXT, maintenance_image_url TEXT, market_user_covered TEXT, market_fx_update TEXT, market_crypto_update TEXT, market_stock_update TEXT, market_last_update TEXT);

CREATE TABLE IF NOT EXISTS ai_chat_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      response_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      intent TEXT NOT NULL,
      confidence_score REAL NOT NULL DEFAULT 0,
      confidence_label TEXT NOT NULL DEFAULT 'Perlu Verifikasi',
      sources_json TEXT,
      verification_json TEXT,
      feedback_label TEXT,
      feedback_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS ai_chats (
  user_id TEXT PRIMARY KEY,
  messages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
      key_hash TEXT PRIMARY KEY,
      bucket TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      window_started_at INTEGER NOT NULL,
      blocked_until INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'monthly',
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VERIFIED',
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, scope TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS currencies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS funnel_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        page_path TEXT,
        referrer TEXT,
        metadata_json TEXT,
        source TEXT,
        user_id TEXT,
        ip_hash TEXT,
        session_key TEXT,
        occurred_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  platform TEXT NOT NULL,
  amount_invested REAL NOT NULL DEFAULT 0,
  amount_idr REAL NOT NULL DEFAULT 0,
  current_value REAL NOT NULL DEFAULT 0,
  current_value_idr REAL NOT NULL DEFAULT 0,
  return_percentage REAL NOT NULL DEFAULT 0,
  tax_percentage REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  duration_months INTEGER,
  transaction_type TEXT,
  category TEXT,
  account_id TEXT,
  logo_url TEXT,
  quantity REAL,
  unit TEXT,
  price_per_unit REAL,
  stock_code TEXT,
  exchange_code TEXT,
  shares_count REAL,
  price_per_share REAL,
  date_invested TEXT NOT NULL,
  target_date TEXT,
  duration_days INTEGER,
  status TEXT NOT NULL DEFAULT 'Active',
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  user_whatsapp TEXT,
  user_photo_url TEXT,
  amount REAL NOT NULL DEFAULT 0,
  package_json TEXT,
  proof_image_url TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  approved_at TEXT,
  rejected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  account_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  interval TEXT NOT NULL,
  next_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amount_idr REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  category TEXT NOT NULL,
  sub_category TEXT,
  from_account TEXT NOT NULL,
  to_goal TEXT NOT NULL,
  date TEXT NOT NULL,
  display_date TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amount_idr REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  sub_category TEXT,
  currency TEXT,
  account_id TEXT NOT NULL,
  target_account_id TEXT,
  lender_name TEXT,
  total_debt REAL,
  installment_tenor INTEGER,
  monthly_interest REAL,
  total_interest REAL,
  date TEXT NOT NULL,
  display_date TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'VERIFIED',
  payment_status TEXT,
  related_id TEXT,
  related_type TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  bucket_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT,
  whatsapp TEXT,
  address TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'FREE',
  status TEXT NOT NULL DEFAULT 'GUEST',
  expired_at TEXT,
  two_factor_secret TEXT,
  total_wealth REAL NOT NULL DEFAULT 0,
  total_income REAL NOT NULL DEFAULT 0,
  total_expenses REAL NOT NULL DEFAULT 0,
  total_savings REAL NOT NULL DEFAULT 0,
  total_investment REAL NOT NULL DEFAULT 0,
  credit_card_bills REAL NOT NULL DEFAULT 0,
  other_debts REAL NOT NULL DEFAULT 0,
  currency_initialized INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_events_response ON ai_chat_events(response_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_events_user_created ON ai_chat_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id ON ai_chats(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked_until ON auth_rate_limits(blocked_until);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_bucket ON auth_rate_limits(bucket);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id, category, sub_category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_currencies_user_code ON currencies(user_id, code);

CREATE INDEX IF NOT EXISTS idx_currencies_user_id ON currencies(user_id);

CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name ON funnel_events(event_name);

CREATE INDEX IF NOT EXISTS idx_funnel_events_source ON funnel_events(source);

CREATE INDEX IF NOT EXISTS idx_funnel_events_user_id ON funnel_events(user_id);

CREATE INDEX IF NOT EXISTS idx_investments_user_date ON investments(user_id, date_invested DESC);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

CREATE INDEX IF NOT EXISTS idx_investments_user_type ON investments(user_id, type, date_invested DESC);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring(user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_user_next_date ON recurring(user_id, next_date ASC);

CREATE INDEX IF NOT EXISTS idx_savings_user_date ON savings(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_savings_user_id ON savings(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_related ON transactions(user_id, related_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);

CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

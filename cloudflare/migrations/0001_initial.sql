CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  whatsapp TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO')),
  status TEXT NOT NULL DEFAULT 'GUEST' CHECK (status IN ('AKTIF', 'NONAKTIF', 'GUEST', 'PENDING')),
  expired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_wealth REAL NOT NULL DEFAULT 0,
  total_income REAL NOT NULL DEFAULT 0,
  total_expenses REAL NOT NULL DEFAULT 0,
  total_savings REAL NOT NULL DEFAULT 0,
  total_investment REAL NOT NULL DEFAULT 0,
  credit_card_bills REAL NOT NULL DEFAULT 0,
  other_debts REAL NOT NULL DEFAULT 0,
  two_factor_secret TEXT,
  currency_initialized INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_photo_url TEXT,
  method TEXT,
  ref TEXT,
  package_id TEXT,
  package_name TEXT,
  package_duration_months INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  proof_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id TEXT PRIMARY KEY,
  billing_email TEXT,
  whatsapp TEXT,
  pro_price REAL NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_number TEXT,
  qris_text TEXT,
  qris_url TEXT,
  free_plan_days INTEGER NOT NULL DEFAULT 0,
  maintenance_is_active INTEGER NOT NULL DEFAULT 0,
  maintenance_type TEXT DEFAULT 'none',
  maintenance_code TEXT,
  maintenance_image_url TEXT,
  market_user_covered TEXT,
  market_fx_update TEXT,
  market_crypto_update TEXT,
  market_stock_update TEXT,
  market_last_update TEXT
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  note TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amount_idr REAL NOT NULL DEFAULT 0,
  category TEXT,
  sub_category TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  account_id TEXT,
  target_account_id TEXT,
  lender_name TEXT,
  total_debt REAL,
  installment_tenor INTEGER,
  monthly_interest REAL,
  total_interest REAL,
  date TEXT NOT NULL,
  display_date TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT,
  related_id TEXT,
  related_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  platform TEXT,
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
  date_invested TEXT,
  target_date TEXT,
  duration_days INTEGER,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  account_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  interval_value TEXT NOT NULL,
  next_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amount_idr REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  category TEXT,
  sub_category TEXT,
  from_account TEXT,
  to_goal TEXT,
  date TEXT NOT NULL,
  display_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS currencies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_user_id ON savings(user_id);
CREATE INDEX IF NOT EXISTS idx_currencies_user_id ON currencies(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id ON ai_chats(user_id);

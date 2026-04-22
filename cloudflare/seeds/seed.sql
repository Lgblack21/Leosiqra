INSERT OR IGNORE INTO admin_settings (
  id,
  billing_email,
  whatsapp,
  pro_price,
  bank_name,
  bank_account_name,
  bank_number,
  qris_text,
  qris_url,
  free_plan_days,
  maintenance_is_active,
  maintenance_type,
  market_user_covered,
  market_fx_update,
  market_crypto_update,
  market_stock_update,
  market_last_update
) VALUES (
  'global',
  'billing@leosiqra.local',
  '6281234567890',
  299000,
  'Bank Central Asia',
  'PT Leosiqra Finansial',
  '1234567890',
  'QRIS Leosiqra',
  'https://example.com/qris.png',
  0,
  0,
  'none',
  'Macro note terakhir sinkron',
  'USD/IDR stabil di kisaran harian',
  'BTC dan ETH bergerak mixed',
  'IHSG ditutup menguat tipis',
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO users (
  id,
  name,
  email,
  password_hash,
  whatsapp,
  role,
  plan,
  status,
  total_wealth,
  total_income,
  total_expenses,
  total_savings,
  total_investment,
  credit_card_bills,
  other_debts,
  currency_initialized
) VALUES (
  'seed-admin',
  'Admin Leosiqra',
  'admin@leosiqra.local',
  'replace-with-real-password-hash',
  '628111111111',
  'admin',
  'PRO',
  'AKTIF',
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1
);

INSERT OR IGNORE INTO admin_logs (id, admin_email, action, target, note, color)
VALUES (
  'seed-log-1',
  'admin@leosiqra.local',
  'bootstrap',
  'system',
  'Initial Cloudflare seed applied',
  'indigo'
);

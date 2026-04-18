import { DEFAULT_CURRENCIES, RESOURCE_CONFIG, SETTINGS_KEY } from "./constants.js";

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function all(env, sql, ...bindings) {
  const result = await env.DB.prepare(sql).bind(...bindings).all();
  return result.results || [];
}

export async function first(env, sql, ...bindings) {
  const row = await env.DB.prepare(sql).bind(...bindings).first();
  return row || null;
}

export async function run(env, sql, ...bindings) {
  return env.DB.prepare(sql).bind(...bindings).run();
}

function snakeToCamel(input) {
  return input.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelToSnake(input) {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function fromRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = snakeToCamel(key);
    if (key.endsWith("_json") && typeof value === "string" && value.length > 0) {
      output[normalizedKey.replace(/Json$/, "")] = JSON.parse(value);
      continue;
    }
    output[normalizedKey] = value;
  }
  return output;
}

export function toColumns(config, input) {
  const columns = [];
  const values = [];
  for (const field of config.fields) {
    if (input[field] === undefined) continue;
    const dbColumn = config.map?.[field] || camelToSnake(field);
    let value = input[field];
    if (config.numeric?.includes(field)) value = Number(value || 0);
    if (config.boolean?.includes(field)) value = value ? 1 : 0;
    if (config.json?.includes(field)) value = JSON.stringify(value ?? null);
    columns.push(dbColumn);
    values.push(value);
  }
  return { columns, values };
}

export async function ensureDefaultCurrencies(env, userId) {
  const existing = await first(env, "SELECT id FROM currencies WHERE user_id = ? LIMIT 1", userId);
  if (existing) return;

  const createdAt = nowIso();
  const statements = DEFAULT_CURRENCIES.map((currency) =>
    env.DB.prepare(
      "INSERT INTO currencies (id, user_id, code, name, symbol, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      createId("cur"),
      userId,
      currency.code,
      currency.name,
      currency.symbol,
      currency.isDefault ? 1 : 0,
      createdAt,
      createdAt
    )
  );
  await env.DB.batch(statements);
  await run(env, "UPDATE users SET currency_initialized = 1, updated_at = ? WHERE id = ?", createdAt, userId);
}

export async function getSettings(env) {
  const row = await first(env, "SELECT value_json FROM admin_settings WHERE settings_key = ?", SETTINGS_KEY);
  return row ? JSON.parse(row.value_json) : null;
}

export async function saveSettings(env, value) {
  const timestamp = nowIso();
  await run(
    env,
    "INSERT INTO admin_settings (settings_key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(settings_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    SETTINGS_KEY,
    JSON.stringify(value),
    timestamp
  );
}

export async function listResource(env, resourceName, userId, filters = {}) {
  const config = RESOURCE_CONFIG[resourceName];
  const clauses = ["user_id = ?"];
  const values = [userId];

  if (resourceName === "transactions" && filters.month) {
    clauses.push("substr(date, 1, 7) = ?");
    values.push(filters.month);
  }
  if (resourceName === "transactions" && filters.type) {
    clauses.push("type = ?");
    values.push(filters.type);
  }
  if (resourceName === "investments" && filters.type) {
    clauses.push("type = ?");
    values.push(filters.type);
  }
  if (resourceName === "recurring" && filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }

  const rows = await all(env, `SELECT * FROM ${config.table} WHERE ${clauses.join(" AND ")} ORDER BY ${config.orderBy}`, ...values);
  return rows.map(fromRow);
}

export async function getResourceById(env, resourceName, userId, id) {
  const config = RESOURCE_CONFIG[resourceName];
  const row = await first(env, `SELECT * FROM ${config.table} WHERE id = ? AND user_id = ? LIMIT 1`, id, userId);
  return row ? fromRow(row) : null;
}

export async function createResource(env, resourceName, userId, payload) {
  const config = RESOURCE_CONFIG[resourceName];
  const id = createId(resourceName.slice(0, 3));
  const timestamp = nowIso();
  const { columns, values } = toColumns(config, payload);
  const sql = `INSERT INTO ${config.table} (id, user_id, ${columns.join(", ")}, created_at, updated_at) VALUES (?, ?, ${columns.map(() => "?").join(", ")}, ?, ?)`;
  await run(env, sql, id, userId, ...values, timestamp, timestamp);
  return getResourceById(env, resourceName, userId, id);
}

export async function updateResource(env, resourceName, userId, id, payload) {
  const config = RESOURCE_CONFIG[resourceName];
  const { columns, values } = toColumns(config, payload);
  if (columns.length === 0) return getResourceById(env, resourceName, userId, id);
  const setters = columns.map((column) => `${column} = ?`);
  setters.push("updated_at = ?");
  values.push(nowIso());
  await run(env, `UPDATE ${config.table} SET ${setters.join(", ")} WHERE id = ? AND user_id = ?`, ...values, id, userId);
  return getResourceById(env, resourceName, userId, id);
}

export async function deleteResource(env, resourceName, userId, id) {
  const config = RESOURCE_CONFIG[resourceName];
  await run(env, `DELETE FROM ${config.table} WHERE id = ? AND user_id = ?`, id, userId);
}

export async function computeDashboardSummary(env, userId, month) {
  const monthPrefix = month || new Date().toISOString().slice(0, 7);
  const [accounts, transactions, investments, budgets, savings] = await Promise.all([
    all(env, "SELECT balance FROM accounts WHERE user_id = ?", userId),
    all(env, "SELECT type, amount_idr FROM transactions WHERE user_id = ? AND substr(date, 1, 7) = ?", userId, monthPrefix),
    all(env, "SELECT current_value_idr, status FROM investments WHERE user_id = ?", userId),
    all(env, "SELECT amount FROM budgets WHERE user_id = ?", userId),
    all(env, "SELECT amount_idr FROM savings WHERE user_id = ? AND substr(date, 1, 7) = ?", userId, monthPrefix)
  ]);

  const totalBalance = accounts.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const totalIncome = transactions.filter((row) => row.type === "pemasukan").reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const totalExpense = transactions.filter((row) => ["pengeluaran", "debt", "topup"].includes(row.type)).reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const totalInvestment = investments.filter((row) => row.status !== "Closed").reduce((sum, row) => sum + Number(row.current_value_idr || 0), 0);
  const totalBudget = budgets.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalSaving = savings.reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);

  return {
    month: monthPrefix,
    totalBalance,
    totalIncome,
    totalExpense,
    totalInvestment,
    totalBudget,
    totalSaving,
    netCashflow: totalIncome - totalExpense
  };
}

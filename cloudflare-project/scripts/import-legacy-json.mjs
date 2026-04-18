import fs from "node:fs/promises";
import path from "node:path";

const exportDir = process.env.LEGACY_EXPORT_DIR || "./legacy-export";
const outputFile = process.env.GENERATED_SQL_FILE || "./database/generated-import.sql";

const collections = {
  users: { table: "users" },
  accounts: { table: "accounts" },
  budgets: { table: "budgets" },
  categories: { table: "categories" },
  currencies: { table: "currencies" },
  transactions: { table: "transactions" },
  investments: { table: "investments" },
  recurring: { table: "recurring" },
  savings: { table: "savings" },
  payments: { table: "payments" },
  admin_logs: { table: "admin_logs" }
};

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function mapRecord(collection, id, doc) {
  const createdAt = doc.createdAt || new Date().toISOString();
  const updatedAt = doc.updatedAt || createdAt;
  if (collection === "users") {
    return {
      id,
      email: doc.email || "",
      password_hash: "replace-with-reset-password",
      name: doc.name || "Unknown",
      whatsapp: doc.whatsapp || null,
      photo_url: doc.photoURL || null,
      role: doc.role || "user",
      plan: doc.plan || "FREE",
      status: doc.status || "GUEST",
      expired_at: doc.expiredAt || null,
      two_factor_secret: doc.twoFactorSecret || null,
      total_wealth: doc.totalWealth || 0,
      total_income: doc.totalIncome || 0,
      total_expenses: doc.totalExpenses || 0,
      total_savings: doc.totalSavings || 0,
      total_investment: doc.totalInvestment || 0,
      credit_card_bills: doc.creditCardBills || 0,
      other_debts: doc.otherDebts || 0,
      currency_initialized: doc.currencyInitialized ? 1 : 0,
      metadata_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "accounts") {
    return {
      id,
      user_id: doc.userId || "",
      name: doc.name || "",
      type: doc.type || "Bank Account",
      currency: doc.currency || "IDR",
      balance: doc.balance || 0,
      initial_balance: doc.initialBalance || 0,
      base_value: doc.baseValue || 0,
      logo_url: doc.logoUrl || null,
      logo_label: doc.logoLabel || null,
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "budgets") {
    return {
      id,
      user_id: doc.userId || "",
      type: doc.type || "pengeluaran",
      category: doc.category || "",
      amount: doc.amount || 0,
      period: doc.period || "monthly",
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "categories") {
    return {
      id,
      user_id: doc.userId || "",
      category: doc.category || "",
      sub_category: doc.subCategory || "",
      status: doc.status || "VERIFIED",
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "currencies") {
    return {
      id,
      user_id: doc.userId || "",
      code: doc.code || "IDR",
      name: doc.name || "Indonesian Rupiah",
      symbol: doc.symbol || "Rp",
      is_default: doc.isDefault ? 1 : 0,
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "transactions") {
    return {
      id,
      user_id: doc.userId || "",
      type: doc.type || "pengeluaran",
      amount: doc.amount || 0,
      amount_idr: doc.amountIDR || doc.amount || 0,
      category: doc.category || "",
      sub_category: doc.subCategory || null,
      currency: doc.currency || "IDR",
      account_id: doc.accountId || "",
      target_account_id: doc.targetAccountId || null,
      lender_name: doc.lenderName || null,
      total_debt: doc.totalDebt || null,
      installment_tenor: doc.installmentTenor || null,
      monthly_interest: doc.monthlyInterest || null,
      total_interest: doc.totalInterest || null,
      date: doc.date || createdAt,
      display_date: doc.displayDate || null,
      note: doc.note || null,
      status: doc.status || "VERIFIED",
      payment_status: doc.paymentStatus || null,
      related_id: doc.relatedId || null,
      related_type: doc.relatedType || null,
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "investments") {
    return {
      id,
      user_id: doc.userId || "",
      name: doc.name || "",
      type: doc.type || "Lainnya",
      platform: doc.platform || "-",
      amount_invested: doc.amountInvested || 0,
      amount_idr: doc.amountIDR || doc.amountInvested || 0,
      current_value: doc.currentValue || 0,
      current_value_idr: doc.currentValueIDR || doc.currentValue || 0,
      return_percentage: doc.returnPercentage || 0,
      tax_percentage: doc.taxPercentage || 0,
      currency: doc.currency || "IDR",
      duration_months: doc.durationMonths || null,
      transaction_type: doc.transactionType || null,
      category: doc.category || null,
      account_id: doc.accountId || null,
      logo_url: doc.logoUrl || null,
      quantity: doc.quantity || null,
      unit: doc.unit || null,
      price_per_unit: doc.pricePerUnit || null,
      stock_code: doc.stockCode || null,
      exchange_code: doc.exchangeCode || null,
      shares_count: doc.sharesCount || null,
      price_per_share: doc.pricePerShare || null,
      date_invested: doc.dateInvested || createdAt,
      target_date: doc.targetDate || null,
      duration_days: doc.durationDays || null,
      status: doc.status || "Active",
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "recurring") {
    return {
      id,
      user_id: doc.userId || "",
      name: doc.name || "",
      type: doc.type || "Pengeluaran",
      category: doc.category || "",
      account_id: doc.accountId || "",
      amount: doc.amount || 0,
      interval: doc.interval || "Bulanan",
      next_date: doc.nextDate || createdAt,
      note: doc.note || null,
      status: doc.status || "ACTIVE",
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "savings") {
    return {
      id,
      user_id: doc.userId || "",
      description: doc.description || "",
      amount: doc.amount || 0,
      amount_idr: doc.amountIDR || doc.amount || 0,
      currency: doc.currency || "IDR",
      category: doc.category || "",
      sub_category: doc.subCategory || null,
      from_account: doc.fromAccount || "",
      to_goal: doc.toGoal || doc.category || "",
      date: doc.date || createdAt,
      display_date: doc.displayDate || null,
      payload_json: JSON.stringify(doc),
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "payments") {
    return {
      id,
      user_id: doc.userId || "",
      user_name: doc.userName || null,
      user_email: doc.userEmail || null,
      user_whatsapp: doc.userWhatsapp || null,
      user_photo_url: doc.userPhotoURL || null,
      amount: doc.amount || 0,
      package_json: JSON.stringify(doc.package || null),
      proof_image_url: doc.proofImageUrl || null,
      note: doc.note || null,
      status: doc.status || "MENUNGGU",
      approved_at: doc.approvedAt || null,
      rejected_at: doc.rejectedAt || null,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (collection === "admin_logs") {
    return {
      id,
      admin_user_id: doc.adminUserId || null,
      admin_email: doc.adminEmail || "system@example.com",
      action: doc.action || "IMPORT",
      target: doc.target || "legacy-import",
      note: doc.note || "Imported from legacy export",
      color: doc.color || "indigo",
      payload_json: JSON.stringify(doc),
      timestamp: doc.timestamp || createdAt
    };
  }

  return { id, payload_json: JSON.stringify(doc), created_at: createdAt, updated_at: updatedAt };
}

const statements = ["PRAGMA foreign_keys = OFF;"];
for (const [collection, config] of Object.entries(collections)) {
  const filePath = path.join(exportDir, `${collection}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    const entries = Array.isArray(data) ? data.map((doc, index) => [doc.id || `${collection}-${index}`, doc]) : Object.entries(data);
    for (const [id, doc] of entries) {
      const row = mapRecord(collection, id, doc);
      const columns = Object.keys(row);
      const values = Object.values(row).map(sqlValue);
      statements.push(`INSERT OR REPLACE INTO ${config.table} (${columns.join(", ")}) VALUES (${values.join(", ")});`);
    }
  } catch {
    console.warn(`Skip ${collection}: file tidak ditemukan di ${filePath}`);
  }
}
statements.push("PRAGMA foreign_keys = ON;");
await fs.writeFile(outputFile, `${statements.join("\n")}\n`, "utf8");
console.log(`Generated SQL import file: ${outputFile}`);

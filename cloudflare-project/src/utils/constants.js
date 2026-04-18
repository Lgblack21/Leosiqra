export const APP_NAME = "Leosiqra Cloudflare";
export const SETTINGS_KEY = "global_config";
export const DEFAULT_CURRENCIES = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", isDefault: true },
  { code: "USD", name: "US Dollar", symbol: "$", isDefault: false },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", isDefault: false },
  { code: "EUR", name: "Euro", symbol: "EUR", isDefault: false }
];

export const RESOURCE_CONFIG = {
  accounts: {
    table: "accounts",
    orderBy: "updated_at DESC",
    fields: ["name", "type", "currency", "balance", "initialBalance", "baseValue", "logoUrl", "logoLabel", "payload"],
    numeric: ["balance", "initialBalance", "baseValue"],
    json: ["payload"],
    map: {
      initialBalance: "initial_balance",
      baseValue: "base_value",
      logoUrl: "logo_url",
      logoLabel: "logo_label",
      payload: "payload_json"
    }
  },
  budgets: {
    table: "budgets",
    orderBy: "updated_at DESC",
    fields: ["type", "category", "amount", "period", "payload"],
    numeric: ["amount"],
    json: ["payload"],
    map: { payload: "payload_json" }
  },
  categories: {
    table: "categories",
    orderBy: "updated_at DESC",
    fields: ["category", "subCategory", "status", "payload"],
    json: ["payload"],
    map: { subCategory: "sub_category", payload: "payload_json" }
  },
  currencies: {
    table: "currencies",
    orderBy: "is_default DESC, code ASC",
    fields: ["code", "name", "symbol", "isDefault", "payload"],
    boolean: ["isDefault"],
    json: ["payload"],
    map: { isDefault: "is_default", payload: "payload_json" }
  },
  transactions: {
    table: "transactions",
    orderBy: "date DESC",
    fields: [
      "type", "amount", "amountIdr", "category", "subCategory", "currency",
      "accountId", "targetAccountId", "lenderName", "totalDebt", "installmentTenor",
      "monthlyInterest", "totalInterest", "date", "displayDate", "note", "status",
      "paymentStatus", "relatedId", "relatedType", "payload"
    ],
    numeric: ["amount", "amountIdr", "totalDebt", "installmentTenor", "monthlyInterest", "totalInterest"],
    json: ["payload"],
    map: {
      amountIdr: "amount_idr",
      subCategory: "sub_category",
      accountId: "account_id",
      targetAccountId: "target_account_id",
      lenderName: "lender_name",
      totalDebt: "total_debt",
      installmentTenor: "installment_tenor",
      monthlyInterest: "monthly_interest",
      totalInterest: "total_interest",
      displayDate: "display_date",
      paymentStatus: "payment_status",
      relatedId: "related_id",
      relatedType: "related_type",
      payload: "payload_json"
    }
  },
  investments: {
    table: "investments",
    orderBy: "date_invested DESC",
    fields: [
      "name", "type", "platform", "amountInvested", "amountIdr", "currentValue",
      "currentValueIdr", "returnPercentage", "taxPercentage", "currency",
      "durationMonths", "transactionType", "category", "accountId", "logoUrl",
      "quantity", "unit", "pricePerUnit", "stockCode", "exchangeCode", "sharesCount",
      "pricePerShare", "dateInvested", "targetDate", "durationDays", "status", "payload"
    ],
    numeric: [
      "amountInvested", "amountIdr", "currentValue", "currentValueIdr", "returnPercentage",
      "taxPercentage", "durationMonths", "quantity", "pricePerUnit", "sharesCount",
      "pricePerShare", "durationDays"
    ],
    json: ["payload"],
    map: {
      amountInvested: "amount_invested",
      amountIdr: "amount_idr",
      currentValue: "current_value",
      currentValueIdr: "current_value_idr",
      returnPercentage: "return_percentage",
      taxPercentage: "tax_percentage",
      durationMonths: "duration_months",
      transactionType: "transaction_type",
      accountId: "account_id",
      logoUrl: "logo_url",
      pricePerUnit: "price_per_unit",
      stockCode: "stock_code",
      exchangeCode: "exchange_code",
      sharesCount: "shares_count",
      pricePerShare: "price_per_share",
      dateInvested: "date_invested",
      targetDate: "target_date",
      durationDays: "duration_days",
      payload: "payload_json"
    }
  },
  recurring: {
    table: "recurring",
    orderBy: "next_date ASC",
    fields: ["name", "type", "category", "accountId", "amount", "interval", "nextDate", "note", "status", "payload"],
    numeric: ["amount"],
    json: ["payload"],
    map: { accountId: "account_id", nextDate: "next_date", payload: "payload_json" }
  },
  savings: {
    table: "savings",
    orderBy: "date DESC",
    fields: ["description", "amount", "amountIdr", "currency", "category", "subCategory", "fromAccount", "toGoal", "date", "displayDate", "payload"],
    numeric: ["amount", "amountIdr"],
    json: ["payload"],
    map: {
      amountIdr: "amount_idr",
      subCategory: "sub_category",
      fromAccount: "from_account",
      toGoal: "to_goal",
      displayDate: "display_date",
      payload: "payload_json"
    }
  }
};

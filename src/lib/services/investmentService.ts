import { cloudflareApi } from '../cloudflare-api';

export interface Investment {
  id?: string;
  userId: string;
  name: string;
  type: 'Saham' | 'Deposito' | 'Lainnya';
  platform: string;
  amountInvested: number;
  amountIDR?: number;
  currentValue: number;
  currentValueIDR?: number;
  returnPercentage: number;
  taxPercentage?: number;
  currency: string;
  durationMonths?: number;
  transactionType?: string;
  category?: string;
  accountId?: string;
  logoUrl?: string;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  stockCode?: string;
  exchangeCode?: string;
  sharesCount?: number;
  pricePerShare?: number;
  dateInvested: Date;
  targetDate?: Date;
  durationDays?: number;
  status: 'Active' | 'Closed' | 'Planned';
  createdAt: Date;
}

const COLLECTION_NAME = 'investments';

export const investmentService = {
  async createInvestment(data: Omit<Investment, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/investments', {
      method: 'POST',
      json: {
        name: data.name,
        type: data.type,
        platform: data.platform,
        amount_invested: Number(data.amountInvested) || 0,
        amount_idr: data.amountIDR || data.amountInvested || 0,
        current_value: Number(data.currentValue) || 0,
        current_value_idr: data.currentValueIDR || data.currentValue || 0,
        return_percentage: Number(data.returnPercentage) || 0,
        tax_percentage: Number(data.taxPercentage) || 0,
        currency: data.currency,
        duration_months: Number(data.durationMonths) || 0,
        transaction_type: data.transactionType || null,
        category: data.category || null,
        account_id: data.accountId || null,
        logo_url: data.logoUrl || null,
        quantity: Number(data.quantity) || 0,
        unit: data.unit || null,
        price_per_unit: Number(data.pricePerUnit) || 0,
        stock_code: data.stockCode || null,
        exchange_code: data.exchangeCode || null,
        shares_count: Number(data.sharesCount) || 0,
        price_per_share: Number(data.pricePerShare) || 0,
        date_invested: data.dateInvested.toISOString(),
        target_date: data.targetDate ? data.targetDate.toISOString() : null,
        duration_days: Number(data.durationDays) || null,
        status: data.status,
      },
    });
    return result.id;
  },

  async getUserInvestments(_userId: string) {
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/investments');
    return result.items.map((data) => {
      return {
        ...data,
        id: String(data.id ?? ''),
        userId: String(data.user_id ?? ''),
        amountInvested: Number(data.amount_invested) || 0,
        amountIDR: Number(data.amount_idr) || 0,
        currentValue: Number(data.current_value) || 0,
        currentValueIDR: Number(data.current_value_idr) || 0,
        returnPercentage: Number(data.return_percentage) || 0,
        taxPercentage: Number(data.tax_percentage) || 0,
        durationMonths: Number(data.duration_months) || 0,
        transactionType: (data.transaction_type as string | undefined) ?? undefined,
        accountId: (data.account_id as string | undefined) ?? undefined,
        logoUrl: (data.logo_url as string | undefined) ?? undefined,
        pricePerUnit: Number(data.price_per_unit) || 0,
        stockCode: (data.stock_code as string | undefined) ?? undefined,
        exchangeCode: (data.exchange_code as string | undefined) ?? undefined,
        sharesCount: Number(data.shares_count) || 0,
        pricePerShare: Number(data.price_per_share) || 0,
        dateInvested: data.date_invested ? new Date(String(data.date_invested)) : new Date(),
        targetDate: data.target_date ? new Date(String(data.target_date)) : undefined,
        durationDays: Number(data.duration_days) || 0,
        createdAt: data.created_at ? new Date(String(data.created_at)) : new Date()
      } as Investment;
    });
  },

  async getInvestmentsByType(userId: string, type: string) {
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>(`/api/member/investments?type=${encodeURIComponent(type)}`);
    return result.items.map((data) => ({
      ...(data as unknown as Investment),
      id: String(data.id ?? ''),
      userId: String(data.user_id ?? ''),
      amountInvested: Number(data.amount_invested) || 0,
      dateInvested: data.date_invested ? new Date(String(data.date_invested)) : new Date(),
      createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
    }));
  },

  async updateInvestment(id: string, data: Partial<Omit<Investment, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/investments/${id}`, {
      method: 'PUT',
      json: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.platform ? { platform: data.platform } : {}),
        ...(typeof data.amountInvested === 'number' ? { amount_invested: data.amountInvested } : {}),
        ...(typeof data.amountIDR === 'number' ? { amount_idr: data.amountIDR } : {}),
        ...(typeof data.currentValue === 'number' ? { current_value: data.currentValue } : {}),
        ...(typeof data.currentValueIDR === 'number' ? { current_value_idr: data.currentValueIDR } : {}),
        ...(typeof data.returnPercentage === 'number' ? { return_percentage: data.returnPercentage } : {}),
        ...(typeof data.taxPercentage === 'number' ? { tax_percentage: data.taxPercentage } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(typeof data.durationMonths === 'number' ? { duration_months: data.durationMonths } : {}),
        ...(data.transactionType !== undefined ? { transaction_type: data.transactionType } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.accountId !== undefined ? { account_id: data.accountId } : {}),
        ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
        ...(typeof data.quantity === 'number' ? { quantity: data.quantity } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(typeof data.pricePerUnit === 'number' ? { price_per_unit: data.pricePerUnit } : {}),
        ...(data.stockCode !== undefined ? { stock_code: data.stockCode } : {}),
        ...(data.exchangeCode !== undefined ? { exchange_code: data.exchangeCode } : {}),
        ...(typeof data.sharesCount === 'number' ? { shares_count: data.sharesCount } : {}),
        ...(typeof data.pricePerShare === 'number' ? { price_per_share: data.pricePerShare } : {}),
        ...(data.dateInvested ? { date_invested: data.dateInvested.toISOString() } : {}),
        ...(data.targetDate !== undefined ? { target_date: data.targetDate ? data.targetDate.toISOString() : null } : {}),
        ...(typeof data.durationDays === 'number' ? { duration_days: data.durationDays } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  },

  async hardDeleteInvestment(id: string, userId: string) {
    void userId;
    await cloudflareApi(`/api/member/investments/${id}`, { method: 'DELETE' });
  }
};

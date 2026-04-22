import { cloudflareApi } from '../cloudflare-api';

export interface Budget {
  id?: string;
  userId: string;
  type: 'pemasukan' | 'pengeluaran';
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  createdAt: Date;
}

const COLLECTION_NAME = 'budgets';

export const budgetService = {
  async createBudget(data: Omit<Budget, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/budgets', {
      method: 'POST',
      json: {
        type: data.type,
        category: data.category,
        amount: Number(data.amount) || 0,
        period: data.period,
      },
    });
    return result.id;
  },

  async getUserBudgets(_userId: string) {
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/budgets');
    return result.items.map((data) => {
      return {
        ...data,
        id: String(data.id ?? ''),
        userId: String(data.user_id ?? ''),
        createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
      } as Budget;
    });
  },

  async updateBudget(id: string, data: Partial<Omit<Budget, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/budgets/${id}`, {
      method: 'PUT',
      json: {
        ...(data.type ? { type: data.type } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(typeof data.amount === 'number' ? { amount: data.amount } : {}),
        ...(data.period ? { period: data.period } : {}),
      },
    });
  },

  async deleteBudget(id: string) {
    await cloudflareApi(`/api/member/budgets/${id}`, { method: 'DELETE' });
  }
};

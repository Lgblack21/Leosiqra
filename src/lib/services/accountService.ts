import { cloudflareApi } from '../cloudflare-api';

export interface Account {
  id?: string;
  userId: string;
  name: string;
  type: 'Bank Account' | 'E-Wallet' | 'Cash' | 'Investment Account' | 'Credit Card' | string;
  currency: string;
  balance: number;
  initialBalance: number;
  baseValue?: number;
  logoUrl?: string;
  logoLabel?: string;
  createdAt: Date;
}

const COLLECTION_NAME = 'accounts';

export const accountService = {
  async createAccount(data: Omit<Account, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/accounts', {
      method: 'POST',
      json: {
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: Number(data.balance) || 0,
        initial_balance: Number(data.initialBalance) || 0,
        base_value: Number(data.baseValue) || 0,
        logo_url: data.logoUrl || null,
        logo_label: data.logoLabel || null,
      },
    });
    return result.id;
  },

  async getUserAccounts(_userId: string) {
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/accounts');
    return result.items.map((data) => {
      return {
        ...data,
        id: String(data.id ?? ''),
        userId: String(data.user_id ?? ''),
        initialBalance: Number(data.initial_balance) || 0,
        baseValue: Number(data.base_value) || 0,
        logoUrl: (data.logo_url as string | undefined) ?? undefined,
        logoLabel: (data.logo_label as string | undefined) ?? undefined,
        createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
      } as Account;
    });
  },

  async updateAccount(id: string, data: Partial<Omit<Account, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/accounts/${id}`, {
      method: 'PUT',
      json: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(typeof data.balance === 'number' ? { balance: data.balance } : {}),
        ...(typeof data.initialBalance === 'number' ? { initial_balance: data.initialBalance } : {}),
        ...(typeof data.baseValue === 'number' ? { base_value: data.baseValue } : {}),
        ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
        ...(data.logoLabel !== undefined ? { logo_label: data.logoLabel } : {}),
      },
    });
  },

  async deleteAccount(id: string) {
    await cloudflareApi(`/api/member/accounts/${id}`, { method: 'DELETE' });
  },

  async updateAccountBalance(id: string, amountChange: number) {
    await cloudflareApi(`/api/member/accounts/${id}/balance`, {
      method: 'POST',
      json: {
        delta: amountChange,
      },
    });
  }
};

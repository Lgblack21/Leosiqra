import { cloudflareApi } from '../cloudflare-api';

export type TransactionType = 'pemasukan' | 'pengeluaran' | 'transfer' | 'topup' | 'debt' | 'investasi' | 'tabungan';

export interface Transaction {
  id?: string;
  userId: string;
  type: 'pemasukan' | 'pengeluaran' | 'transfer' | 'topup' | 'debt';
  amount: number;
  amountIDR?: number;
  category: string;
  subCategory?: string;
  currency?: string;
  accountId: string;
  targetAccountId?: string; // Untuk transfer/topup
  lenderName?: string;
  totalDebt?: number;
  installmentTenor?: number;
  monthlyInterest?: number;
  totalInterest?: number;
  date: Date;
  displayDate?: string;
  note?: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  paymentStatus?: 'lunas' | 'belum';
  relatedId?: string; // ID of the related entity (e.g., investmentId)
  relatedType?: 'investasi' | 'tabungan' | 'debt';
  createdAt: Date;
}

export const transactionService = {
  // Create
  async createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/transactions', {
      method: 'POST',
      json: {
        type: data.type,
        amount: Number(data.amount) || 0,
        amount_idr: Number(data.amountIDR) || Number(data.amount) || 0,
        category: data.category,
        sub_category: data.subCategory,
        currency: data.currency || 'IDR',
        account_id: data.accountId,
        target_account_id: data.targetAccountId,
        date: data.date.toISOString(),
        display_date: data.displayDate || data.date.toISOString(),
        note: data.note || null,
      },
    });
    return result.id;
  },

  // Read all for user
  async getUserTransactions(_userId: string) {
    void _userId;
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/transactions');
    return result.items.map((data) => {
      return {
        ...data,
        id: String(data.id ?? ''),
        userId: String(data.user_id ?? ''),
        amount: Number(data.amount) || 0,
        amountIDR: Number(data.amount_idr) || Number(data.amount) || 0,
        category: String(data.category ?? ''),
        subCategory: (data.sub_category as string | undefined) ?? undefined,
        accountId: (data.account_id as string | undefined) ?? '',
        targetAccountId: (data.target_account_id as string | undefined) ?? undefined,
        displayDate: (data.display_date as string | undefined) ?? undefined,
        relatedId: (data.related_id as string | undefined) ?? undefined,
        relatedType: (data.related_type as 'investasi' | 'tabungan' | 'debt' | undefined) ?? undefined,
        date: data.date ? new Date(String(data.date)) : new Date(),
        createdAt: data.created_at ? new Date(String(data.created_at)) : new Date()
      } as Transaction;
    });
  },

  // Read by type
  async getTransactionsByType(userId: string, type: string) {
    const items = await this.getUserTransactions(userId);
    return items.filter((item) => item.type === type);
  },

  // Update
  async updateTransaction(id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/transactions/${id}`, {
      method: 'PUT',
      json: {
        ...(data.type ? { type: data.type } : {}),
        ...(typeof data.amount === 'number' ? { amount: data.amount } : {}),
        ...(typeof data.amountIDR === 'number' ? { amount_idr: data.amountIDR } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.subCategory ? { sub_category: data.subCategory } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.accountId ? { account_id: data.accountId } : {}),
        ...(data.targetAccountId ? { target_account_id: data.targetAccountId } : {}),
        ...(data.date ? { date: data.date.toISOString() } : {}),
        ...(data.displayDate ? { display_date: data.displayDate } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    });
  },

  async deleteTransaction(id: string) {
    await cloudflareApi(`/api/member/transactions/${id}`, { method: 'DELETE' });
  }
};

type AddTransactionInput = {
  type?: string;
  amount?: number;
  actual?: number;
  amountIDR?: number;
  userId?: string;
  category?: string;
  accountId?: string;
  date?: Date;
  currency?: string;
  subCategory?: string;
  targetAccountId?: string;
  displayDate?: string;
  note?: string;
  item?: string;
  status?: string;
  [key: string]: unknown;
};

export const addTransaction = (data: AddTransactionInput) => {
  const normalizedType = data.type === 'pemasukkan' ? 'pemasukan' : data.type;
  const normalizedStatus: Transaction['status'] =
    data.status === 'PENDING' || data.status === 'FAILED' || data.status === 'VERIFIED'
      ? data.status
      : 'VERIFIED';
  const mappedData: Omit<Transaction, 'id' | 'createdAt'> = {
    ...data,
    userId: data.userId || '',
    type: (normalizedType as Transaction['type']) || 'pengeluaran',
    amount: data.amount || data.actual || 0,
    amountIDR: data.amountIDR || data.amount || data.actual || 0,
    category: data.category || 'Umum',
    accountId: data.accountId || 'General',
    date: data.date || new Date(),
    currency: data.currency || 'IDR',
    subCategory: data.subCategory,
    targetAccountId: data.targetAccountId,
    displayDate: data.displayDate,
    note: data.note || data.item || '',
    status: normalizedStatus
  };
  return transactionService.createTransaction(mappedData);
};

import { cloudflareApi } from '../cloudflare-api';

export type TransactionType = 'pemasukan' | 'pengeluaran' | 'transfer' | 'topup' | 'debt' | 'investasi' | 'tabungan';

export interface Transaction {
  id?: string;
  userId: string;
  type: TransactionType;
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
        lender_name: data.lenderName,
        total_debt: typeof data.totalDebt === 'number' ? data.totalDebt : undefined,
        installment_tenor: typeof data.installmentTenor === 'number' ? data.installmentTenor : undefined,
        monthly_interest: typeof data.monthlyInterest === 'number' ? data.monthlyInterest : undefined,
        total_interest: typeof data.totalInterest === 'number' ? data.totalInterest : undefined,
        payment_status: data.paymentStatus,
        date: data.date.toISOString(),
        display_date: data.displayDate || data.date.toISOString(),
        note: data.note || null,
        status: data.status,
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
        type: String(data.type ?? 'pengeluaran') as Transaction['type'],
        amount: Number(data.amount) || 0,
        amountIDR: Number(data.amount_idr) || Number(data.amount) || 0,
        category: String(data.category ?? ''),
        subCategory: (data.sub_category as string | undefined) ?? undefined,
        accountId: (data.account_id as string | undefined) ?? '',
        targetAccountId: (data.target_account_id as string | undefined) ?? undefined,
        lenderName: (data.lender_name as string | undefined) ?? undefined,
        totalDebt: typeof data.total_debt === 'number' ? data.total_debt : (Number(data.total_debt) || 0),
        installmentTenor: typeof data.installment_tenor === 'number' ? data.installment_tenor : (Number(data.installment_tenor) || 0),
        monthlyInterest: typeof data.monthly_interest === 'number' ? data.monthly_interest : (Number(data.monthly_interest) || 0),
        totalInterest: typeof data.total_interest === 'number' ? data.total_interest : (Number(data.total_interest) || 0),
        status: (data.status as Transaction['status']) ?? 'VERIFIED',
        paymentStatus: (data.payment_status as 'lunas' | 'belum' | undefined) ?? undefined,
        displayDate: (data.display_date as string | undefined) ?? undefined,
        relatedId: (data.related_id as string | undefined) ?? undefined,
        relatedType: (data.related_type as 'investasi' | 'tabungan' | 'debt' | undefined) ?? undefined,
        note: (data.note as string | undefined) ?? undefined,
        currency: (data.currency as string | undefined) ?? 'IDR',
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
        ...(data.lenderName !== undefined ? { lender_name: data.lenderName } : {}),
        ...(typeof data.totalDebt === 'number' ? { total_debt: data.totalDebt } : {}),
        ...(typeof data.installmentTenor === 'number' ? { installment_tenor: data.installmentTenor } : {}),
        ...(typeof data.monthlyInterest === 'number' ? { monthly_interest: data.monthlyInterest } : {}),
        ...(typeof data.totalInterest === 'number' ? { total_interest: data.totalInterest } : {}),
        ...(data.paymentStatus ? { payment_status: data.paymentStatus } : {}),
        ...(data.status ? { status: data.status } : {}),
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

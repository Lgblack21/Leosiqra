import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Simpan pemasukan/pengeluaran lewat /api/member/quick-transaction (transaksi +
// saldo + total dalam satu batch atomik), dan "Batalkan" lewat DELETE
// ?reverse=1 yang membalikkan semuanya secara atomik juga.
export const quickTxService = {
  async create(input: {
    type: 'pengeluaran' | 'pemasukan';
    amount: number;
    accountId: string;
    category: string;
    subCategory?: string;
    note?: string;
    date?: string; // YYYY-MM-DD, kosong = hari ini
  }) {
    const res = await cloudflareApi<{ ok: boolean; id: string; matchedAccount: string; currency: string }>(
      '/api/member/quick-transaction',
      {
        method: 'POST',
        json: {
          type: input.type,
          amount: input.amount,
          account_id: input.accountId,
          category: input.category.trim(),
          sub_category: input.subCategory?.trim() ?? '',
          note: input.note?.trim() ?? '',
          ...(input.date ? { date: input.date } : {}),
        },
      }
    );
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
    return res;
  },

  async undo(id: string) {
    await cloudflareApi(`/api/member/transactions/${id}?reverse=1`, { method: 'DELETE' });
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
  },
};

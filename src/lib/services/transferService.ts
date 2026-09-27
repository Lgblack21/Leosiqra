import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Transfer / top up lewat endpoint server (POST /api/member/transfer): dua sisi
// transaksi + saldo kedua rekening disimpan dalam satu batch atomik, konversi
// kurs dikerjakan server. toAccountId "Wallet" = e-wallet luar yang tidak dilacak.
export const EXTERNAL_WALLET_ID = 'Wallet';

export const transferService = {
  async createTransfer(input: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    note?: string;
    date?: string; // YYYY-MM-DD, default hari ini (WIB) di server
  }) {
    const result = await cloudflareApi<{ ok: boolean; ids: string[]; amountTo: number; label: string }>(
      '/api/member/transfer',
      {
        method: 'POST',
        json: {
          from_account_id: input.fromAccountId,
          to_account_id: input.toAccountId,
          amount: input.amount,
          note: input.note ?? '',
          ...(input.date ? { date: input.date } : {}),
        },
      }
    );
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
    return result;
  },
};

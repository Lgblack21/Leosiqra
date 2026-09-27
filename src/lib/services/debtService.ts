import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';
import type { Transaction } from './transactionService';

// Jenis hutang disimpan di sub_category — Dashboard memakai "Kartu Kredit"
// untuk memisahkan tagihan kartu dari hutang lainnya (sama dengan DebtModal web).
export const DEBT_KINDS = ['Kartu Kredit', 'Pinjol', 'Paylater', 'Bank / KTA', 'Perorangan', 'Lainnya'] as const;

// Sisa tagihan = pokok − total pembayaran yang ditautkan (related_type 'debt').
// Rumus yang sama dengan halaman web Hutang & Piutang.
export const paidByDebt = (transactions: Transaction[]) => {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.relatedType !== 'debt' || !t.relatedId) continue;
    map.set(t.relatedId, (map.get(t.relatedId) || 0) + (Number(t.amount) || 0));
  }
  return map;
};

export const debtRemaining = (debt: Transaction, paid: Map<string, number>) => {
  if (debt.paymentStatus === 'lunas' || !debt.id) return 0;
  return Math.max(0, (Number(debt.amount) || 0) - (paid.get(debt.id) || 0));
};

export const debtService = {
  // Bayar cicilan / lunasi lewat endpoint server (atomik; server menghitung
  // sisa & memotong nominal yang melebihi sisa). accountId hanya wajib untuk
  // catatan lama yang tidak punya rekening valid (server membalas needAccount).
  async pay(debtId: string, input: { amount: number; accountId?: string; date?: string }) {
    const result = await cloudflareApi<{ ok: boolean; paid: number; remaining: number; settled: boolean }>(
      `/api/member/debts/${debtId}/pay`,
      {
        method: 'POST',
        json: {
          amount: input.amount,
          ...(input.accountId ? { account_id: input.accountId } : {}),
          ...(input.date ? { date: input.date } : {}),
        },
      }
    );
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
    return result;
  },

  // Catat hutang/piutang baru (belum lunas) — tidak mengubah saldo, sama
  // seperti DebtModal web saat status "belum".
  async create(input: {
    isHutang: boolean;
    kind: string;
    lenderName: string;
    amount: number;
    accountId: string;
    date: string; // YYYY-MM-DD
    note?: string;
    currency?: string;
  }) {
    const category = input.isHutang ? 'Hutang' : 'Piutang';
    const result = await cloudflareApi<{ id: string }>('/api/member/transactions', {
      method: 'POST',
      json: {
        type: 'debt',
        amount: input.amount,
        category,
        sub_category: input.isHutang ? input.kind : 'Piutang',
        currency: input.currency || 'IDR',
        account_id: input.accountId,
        lender_name: input.lenderName,
        total_debt: input.amount,
        installment_tenor: 0,
        monthly_interest: 0,
        total_interest: 0,
        date: input.date,
        display_date: input.date,
        note: input.note ?? '',
        status: 'PENDING',
        payment_status: 'belum',
      },
    });
    notifyCollectionChanged('transactions');
    return result.id;
  },
};

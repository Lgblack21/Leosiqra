import { cloudflareApi } from '../cloudflare-api';

export interface ImportRow {
  date: string; // "YYYY-MM-DD"
  note: string;
  amount: number;
  type: 'pemasukan' | 'pengeluaran';
  category?: string | null;
  sub_category?: string | null;
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  total: number;
  batchId: string | null;
}

export interface ImportBatch {
  id: string;
  name: string | null;
  account_id: string | null;
  account_name: string | null;
  currency: string | null;
  rows_count: number;
  first_date: string;
  last_date: string;
  income: number;
  expense: number;
  created_at: string;
}

// Impor mutasi = riwayat: tidak mengubah saldo rekening. Mata uang selalu
// mengikuti rekening tujuan (ditentukan server).
export const transactionImportService = {
  importTransactions(accountId: string, rows: ImportRow[], fileName?: string) {
    return cloudflareApi<ImportResult>('/api/member/transactions/import', {
      method: 'POST',
      json: { accountId, rows, fileName },
    });
  },
  async findDuplicates(accountId: string, rows: Pick<ImportRow, 'date' | 'note' | 'amount'>[]) {
    const r = await cloudflareApi<{ duplicates: number[] }>('/api/member/imports/check', { method: 'POST', json: { accountId, rows } });
    return new Set(r.duplicates);
  },
  async readWithAi(input: { imageBase64: string } | { text: string }) {
    const r = await cloudflareApi<{ rows: ImportRow[] }>('/api/member/imports/read', { method: 'POST', json: input });
    return r.rows;
  },
  async history() {
    const r = await cloudflareApi<{ items: ImportBatch[] }>('/api/member/imports');
    return r.items;
  },
  undo(batchId: string) {
    return cloudflareApi<{ ok: boolean; deleted: number }>(`/api/member/imports/${batchId}`, { method: 'DELETE' });
  },
};

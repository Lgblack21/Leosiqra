import { cloudflareApi } from '../cloudflare-api';

export interface ImportRow {
  date: string; // "YYYY-MM-DD"
  note: string;
  amount: number;
  type: 'pemasukan' | 'pengeluaran';
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  total: number;
}

export const transactionImportService = {
  async importTransactions(accountId: string, currency: string, rows: ImportRow[]) {
    return cloudflareApi<ImportResult>('/api/member/transactions/import', {
      method: 'POST',
      json: { accountId, currency, rows },
    });
  }
};

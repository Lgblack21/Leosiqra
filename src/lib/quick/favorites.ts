import type { Transaction } from '@/lib/services/transactionService';
import type { QuickType } from './parse';

export interface QuickFavorite {
  key: string;
  type: QuickType;
  amount: number;
  accountId: string;
  category: string;
  subCategory: string;
  note: string;
  count: number;
}

// Transaksi yang paling sering dicatat ulang (jenis + kategori + sub + rekening
// + nominal sama) dalam 90 hari terakhir — jadi chip 1-tap di Input Cepat.
// Minimal muncul 2x supaya bukan kebetulan.
export const computeFavorites = (transactions: Transaction[], limit = 6): QuickFavorite[] => {
  const since = Date.now() - 90 * 86400000;
  const groups = new Map<string, QuickFavorite & { last: number }>();
  for (const t of transactions) {
    if (t.type !== 'pengeluaran' && t.type !== 'pemasukan') continue;
    if (t.relatedType || !t.accountId || !t.category) continue; // cicilan/otomatis bukan input manual
    const time = new Date(t.date).getTime();
    if (!Number.isFinite(time) || time < since) continue;
    const amount = Number(t.amount) || 0;
    if (amount <= 0) continue;
    const key = [t.type, t.category, t.subCategory ?? '', t.accountId, amount].join('|');
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      if (time > g.last) { g.last = time; g.note = t.note ?? g.note; }
    } else {
      groups.set(key, {
        key, type: t.type, amount, accountId: t.accountId, category: t.category,
        subCategory: t.subCategory ?? '', note: t.note ?? '', count: 1, last: time,
      });
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map((g) => ({ key: g.key, type: g.type, amount: g.amount, accountId: g.accountId, category: g.category, subCategory: g.subCategory, note: g.note, count: g.count }));
};

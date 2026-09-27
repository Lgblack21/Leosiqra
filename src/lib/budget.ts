import type { Budget } from '@/lib/services/budgetService';
import type { Transaction } from '@/lib/services/transactionService';

// Realisasi budget = jumlah transaksi BERTIPE SAMA (pemasukan/pengeluaran) dan
// berkategori sama di periode yang dioper pemanggil, dalam IDR (amountIDR) —
// target budget selalu IDR. Dulu tipe tidak dicek, jadi mis. pemasukan refund
// berkategori "Makanan" ikut menambah realisasi budget pengeluaran Makanan.
// Dipakai bersama halaman web Budget & versi mobile.
export const budgetRealization = (budget: Budget, periodTransactions: Transaction[]) => {
  const category = budget.category.toLowerCase();
  const total = periodTransactions
    .filter((t) => t.type === budget.type && (t.category || '').toLowerCase() === category)
    .reduce((sum, t) => sum + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
  const percentage = budget.amount > 0 ? (total / budget.amount) * 100 : 0;
  return { total, percentage, isOver: percentage > 100 };
};

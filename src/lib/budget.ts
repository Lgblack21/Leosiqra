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

// ---- Periode anggaran bulanan ------------------------------------------------
// Bisa mulai selain tanggal 1 (prefs.budgetStartDay, 1–28 — mis. tanggal
// gajian). Periode dinamai menurut bulan MULAINYA: mulai 25 → "periode
// Oktober" = 25 Okt s/d 24 Nov. Sama dengan budgetPeriodBounds di Worker.
export type BudgetPeriod = { start: Date; end: Date }; // end eksklusif

export const budgetPeriodStartingIn = (y: number, m: number, startDay: number): BudgetPeriod => ({
  start: new Date(y, m, startDay),
  end: new Date(y, m + 1, startDay),
});

// Bulan (y, m) tempat periode yang memuat `ref` dimulai.
export const budgetPeriodMonthOf = (startDay: number, ref = new Date()) => {
  const d = new Date(ref.getFullYear(), ref.getMonth() - (ref.getDate() < startDay ? 1 : 0), 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

export const currentBudgetPeriod = (startDay: number, ref = new Date()): BudgetPeriod => {
  const { y, m } = budgetPeriodMonthOf(startDay, ref);
  return budgetPeriodStartingIn(y, m, startDay);
};

// Tanggal transaksi disimpan "YYYY-MM-DD…" — bandingkan per hari lokal.
export const inBudgetPeriod = (date: string | Date, p: BudgetPeriod) => {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d >= p.start && d < p.end;
};

export const formatBudgetPeriod = (p: BudgetPeriod) => {
  const last = new Date(p.end.getFullYear(), p.end.getMonth(), p.end.getDate() - 1);
  const f = (d: Date, year: boolean) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).format(d);
  return `${f(p.start, p.start.getFullYear() !== last.getFullYear())} – ${f(last, true)}`;
};

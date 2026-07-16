import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';

// Kartu kredit & paylater (Akulaku, ShopeePayLater, Paylater BCA, KK, dst.)
// dimodelkan sebagai limit, bukan saldo kas. Fungsi di file ini adalah
// SATU-SATUNYA sumber perhitungan terpakai/sisa limit — dipakai bersama oleh
// halaman Kartu Saya & Rekening supaya angkanya tidak pernah berbeda.
export const isCreditAccountType = (type: string | undefined) =>
  type === 'Credit Card' || type === 'kartu';

export interface CreditUsage {
  limit: number;
  used: number;
  remaining: number;
}

// Terpakai dihitung ULANG dari seluruh transaksi (bukan dari kolom `balance`,
// yang riwayat konvensi tandanya beda-beda tergantung modal mana yang
// menulisnya) supaya selalu akurat & konsisten di semua halaman:
//   terpakai = "Tagihan Terpakai Saat Ini" (initialBalance) + pengeluaran dari
//              kartu ini - pembayaran/top-up ke kartu ini
export const computeCreditUsage = (account: Account, transactions: Transaction[]): CreditUsage => {
  const accTx = transactions.filter((t) => t.accountId === account.id);
  const inSum = accTx
    .filter((t) => t.type === 'pemasukan' || (t.type === 'debt' && t.category === 'Hutang'))
    .reduce((s, t) => s + t.amount, 0);
  const outSum = accTx
    .filter((t) => t.type === 'pengeluaran' || (t.type === 'debt' && t.category === 'Piutang'))
    .reduce((s, t) => s + t.amount, 0);
  const limit = account.creditLimit || 0;
  const used = Math.max(0, (account.initialBalance || 0) + outSum - inSum);
  return { limit, used, remaining: limit - used };
};

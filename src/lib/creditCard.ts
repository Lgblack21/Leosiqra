import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { computeCardCycle, type CardCycle, type CardFlow } from '@/lib/creditCycle';
import { toLocalDateString } from '@/lib/utils';

// Kartu kredit & paylater (Akulaku, ShopeePayLater, Paylater BCA, KK, dst.)
// dimodelkan sebagai limit, bukan saldo kas. Fungsi di file ini adalah
// SATU-SATUNYA sumber perhitungan terpakai/sisa limit — dipakai bersama oleh
// Dashboard, Rekening, Kartu Saya, Profil, dan Input Cepat.
export const isCreditAccountType = (type: string | undefined) =>
  type === 'Credit Card' || type === 'kartu';

export interface CreditUsage {
  limit: number;
  used: number;
  remaining: number;
}

// Konvensi: saldo (`balance`) kartu kredit = −tagihan terpakai. Semua alur
// yang menggerakkan uang sudah memperbarui `balance` (belanja −, pembayaran +,
// transfer/top up masuk +/keluar −, setoran tabungan & penempatan investasi −,
// pelunasan hutang ±), jadi terpakai diturunkan langsung dari saldo.
//
// Dulu terpakai direkonstruksi dari daftar transaksi (initialBalance +
// pengeluaran − pemasukan). Itu melewatkan pembayaran lewat Transfer & Top Up
// (tipe `transfer`), pemakaian lewat top up dari kartu, setoran tabungan &
// investasi dari kartu, dan menghitung catatan Hutang di kartu dengan arah
// terbalik — sehingga sisa limit makin lama makin salah.
//
// Parameter `transactions` dipertahankan supaya pemanggil lama tidak perlu
// diubah; tidak dipakai lagi.
export const computeCreditUsage = (account: Account, transactions?: Transaction[]): CreditUsage => {
  void transactions;
  const limit = account.creditLimit || 0;
  const used = Math.max(0, -(Number(account.balance) || 0));
  return { limit, used, remaining: limit - used };
};

// Kebalikan konvensi di atas: tagihan terpakai (angka positif yang user isi di
// form) → nilai `balance` yang disimpan.
export const creditBalanceFromUsed = (used: number) => -Math.max(0, used || 0);

// ---- Siklus tagihan (Tahap 3) ----------------------------------------------

// Arus uang rekening kartu dari daftar transaksi: belanja/top up keluar
// menambah terpakai (+), pembayaran/transfer masuk mengurangi (−). Catatan
// Hutang/Piutang (type "debt") bukan arus uang — dilewati.
export const cardFlowsFromTransactions = (accountId: string, transactions: Transaction[]): CardFlow[] =>
  transactions
    .filter((t) => t.accountId === accountId && t.type !== 'debt')
    .map((t) => {
      const amount = Number(t.amount) || 0;
      const date = t.date instanceof Date ? toLocalDateString(t.date) : String(t.date).slice(0, 10);
      const isIncoming =
        t.type === 'pemasukan' || ((t.type === 'transfer' || t.type === 'topup') && Boolean(t.subCategory?.includes('Masuk')));
      return { date, delta: isIncoming ? -amount : amount };
    });

export const getCardCycle = (account: Account, transactions: Transaction[], today: string = toLocalDateString()): CardCycle | null =>
  account.id
    ? computeCardCycle(computeCreditUsage(account).used, cardFlowsFromTransactions(account.id, transactions), account, today)
    : null;

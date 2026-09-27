import type { Transaction } from "@/lib/services/transactionService";

export type TxKind = "in" | "out" | "transfer";

// Transfer antar rekening sendiri tersimpan sebagai dua baris bertipe
// "transfer"/"topup" (sisi Keluar & Masuk) — dianggap netral, tidak dihitung
// sebagai pemasukan/pengeluaran. Top up ke e-wallet luar bertipe
// "pengeluaran" dan memang dihitung keluar.
export const txKind = (tx: Transaction): TxKind => {
  if (tx.type === "transfer" || tx.type === "topup") return "transfer";
  if (tx.type === "pemasukan") return "in";
  return "out";
};

// Judul yang enak dibaca: catatan tanpa awalan teknis "[Top Up Keluar] ",
// lalu sub-kategori, lalu kategori.
export const txTitle = (tx: Transaction) => {
  const note = (tx.note || "").replace(/^\[[^\]]+\]\s*/, "").trim();
  return note || tx.subCategory || tx.category || "Transaksi";
};

export const toIdr = (tx: Transaction) => Number(tx.amountIDR) || Number(tx.amount) || 0;

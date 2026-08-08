"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Account } from "@/lib/services/accountService";
import { Transaction } from "@/lib/services/transactionService";
import { exchangeRateService, ExchangeRates } from "@/lib/services/exchangeRateService";
import { isIncomingTransaction } from "@/lib/utils";

interface BalanceCardProps {
  accounts: Account[];
  transactions: Transaction[];
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function BalanceCard({ accounts, transactions }: BalanceCardProps) {
  const [fxRates, setFxRates] = useState<ExchangeRates>({});

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(() => {});
  }, []);

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + exchangeRateService.convert(acc.balance, acc.currency || "IDR", "IDR", fxRates),
    0
  );

  // Bulan berjalan — sama seperti kartu ringkasan di dashboard web.
  const now = new Date();
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const income = monthTx
    .filter((t) => isIncomingTransaction(t))
    .reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
  const expense = monthTx
    .filter((t) => t.type === "pengeluaran")
    .reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);

  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white p-6 shadow-lg shadow-indigo-200">
      <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Total Saldo</p>
      <p className="text-3xl font-black mt-1 tabular-nums">{formatIDR(totalBalance)}</p>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="bg-white/15 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-1.5 text-white/70 text-[11px] font-bold">
            <ArrowDownCircle size={13} /> Pemasukan
          </div>
          <p className="text-sm font-black mt-1 tabular-nums">{formatIDR(income)}</p>
        </div>
        <div className="bg-white/15 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-1.5 text-white/70 text-[11px] font-bold">
            <ArrowUpCircle size={13} /> Pengeluaran
          </div>
          <p className="text-sm font-black mt-1 tabular-nums">{formatIDR(expense)}</p>
        </div>
      </div>
    </div>
  );
}

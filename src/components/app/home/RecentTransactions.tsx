"use client";

import { ArrowDownCircle, ArrowUpCircle, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIncomingTransaction } from "@/lib/utils";
import { Transaction } from "@/lib/services/transactionService";
import { StaggerList, StaggerItem } from "@/components/app/FadeIn";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div>
      <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Transaksi Terbaru</h2>
      {recent.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 text-center">
          <Receipt size={24} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">Belum ada transaksi.</p>
        </div>
      ) : (
        <StaggerList className="space-y-2">
          {recent.map((tx) => {
            const incoming = isIncomingTransaction(tx);
            return (
              <StaggerItem key={tx.id}>
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      incoming ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400"
                    )}
                  >
                    {incoming ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tx.category || "Umum"}</p>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{formatDate(new Date(tx.date))}</p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-black tabular-nums shrink-0",
                      incoming ? "text-emerald-600" : "text-rose-500"
                    )}
                  >
                    {incoming ? "+" : "-"}
                    {formatAmount(tx.amount, tx.currency || "IDR")}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}

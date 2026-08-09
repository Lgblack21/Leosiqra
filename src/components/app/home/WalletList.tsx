"use client";

import { Wallet as WalletIcon } from "lucide-react";
import { Account } from "@/lib/services/accountService";
import { StaggerList, StaggerItem } from "@/components/app/FadeIn";
import { useBalanceVisibility } from "@/lib/hooks/useBalanceVisibility";

interface WalletListProps {
  accounts: Account[];
}

const formatBalance = (amount: number, currency: string) => {
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

// Kartu wallet statis (belum bisa di-tap ke detail) — konsisten dengan
// keputusan bottom-nav: fitur Wallet-detail baru masuk di fase berikutnya.
export function WalletList({ accounts }: WalletListProps) {
  const [hidden] = useBalanceVisibility();
  return (
    <div>
      <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Rekening Saya</h2>
      <StaggerList className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar">
        {accounts.map((acc) => (
          <StaggerItem key={acc.id} className="shrink-0">
            <div className="w-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <WalletIcon size={16} />
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 truncate">{acc.name}</p>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5 tabular-nums truncate">
                {hidden ? `${acc.currency} ••••` : formatBalance(acc.balance, acc.currency)}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerList>
    </div>
  );
}

"use client";

import { Wallet as WalletIcon } from "lucide-react";
import { Account } from "@/lib/services/accountService";
import { StaggerList, StaggerItem } from "@/components/app/FadeIn";

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
  return (
    <div>
      <h2 className="text-sm font-black text-slate-900 mb-3">Rekening Saya</h2>
      <StaggerList className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar">
        {accounts.map((acc) => (
          <StaggerItem key={acc.id} className="shrink-0">
            <div className="w-40 rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <WalletIcon size={16} />
              </div>
              <p className="text-xs font-bold text-slate-500 mt-3 truncate">{acc.name}</p>
              <p className="text-sm font-black text-slate-900 mt-0.5 tabular-nums truncate">
                {formatBalance(acc.balance, acc.currency)}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerList>
    </div>
  );
}

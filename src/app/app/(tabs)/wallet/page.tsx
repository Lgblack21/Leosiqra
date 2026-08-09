"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet as WalletIcon, Eye, EyeOff } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { exchangeRateService, ExchangeRates } from "@/lib/services/exchangeRateService";
import { AddWalletSheet } from "@/components/app/wallet/AddWalletSheet";
import { FadeIn, StaggerList, StaggerItem } from "@/components/app/FadeIn";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { useBalanceVisibility } from "@/lib/hooks/useBalanceVisibility";
import { lightTap } from "@/lib/haptics";

const GROUPS = [
  { key: "Cash", label: "Cash" },
  { key: "Bank Account", label: "Bank Accounts" },
  { key: "E-Wallet", label: "E-Wallets" },
  { key: "Lainnya", label: "Lainnya" },
] as const;

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

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function WalletPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [hidden, toggleHidden] = useBalanceVisibility();

  useEffect(() => {
    const load = () =>
      accountService.getUserAccounts(auth.currentUser?.uid ?? "").then(setAccounts).catch(() => setAccounts([]));
    load();
    return subscribeToCollectionChanges("accounts", load);
  }, []);

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(() => {});
  }, []);

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + exchangeRateService.convert(acc.balance, acc.currency || "IDR", "IDR", fxRates),
    0
  );

  const knownTypes = new Set<string>(["Cash", "Bank Account", "E-Wallet"]);
  const grouped = GROUPS.map((g) => ({
    ...g,
    accounts:
      g.key === "Lainnya"
        ? accounts.filter((a) => !knownTypes.has(a.type))
        : accounts.filter((a) => a.type === g.key),
  })).filter((g) => g.accounts.length > 0);

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-8 space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-900 dark:text-white">Rekening Saya</h1>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={18} />
        </button>
      </FadeIn>

      <FadeIn delay={0.05} className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white p-6 shadow-lg shadow-indigo-200">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Total Saldo</p>
          <button
            type="button"
            onClick={() => {
              lightTap();
              toggleHidden();
            }}
            className="text-white/70 p-0.5"
            aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
          >
            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <p className="text-3xl font-black mt-1 tabular-nums">
          {hidden ? "Rp ••••••••" : <AnimatedNumber value={totalBalance} format={formatIDR} />}
        </p>
      </FadeIn>

      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 text-center">
          <WalletIcon size={24} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">Belum ada rekening.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.key}>
            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">
              {group.label}
            </h2>
            <StaggerList className="space-y-2">
              {group.accounts.map((acc) => (
                <StaggerItem key={acc.id}>
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <WalletIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{acc.name}</p>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{acc.type} &middot; {acc.currency}</p>
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums shrink-0">
                      {hidden ? `${acc.currency} ••••` : formatAmount(acc.balance, acc.currency)}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        ))
      )}

      <AddWalletSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}

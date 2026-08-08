"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { BalanceCard } from "@/components/app/home/BalanceCard";
import { WalletList } from "@/components/app/home/WalletList";
import { RecentTransactions } from "@/components/app/home/RecentTransactions";
import { AssistantMenu } from "@/components/app/home/AssistantMenu";

export default function AppHomePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";

    const loadAccounts = () =>
      accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    const loadTransactions = () =>
      transactionService.getUserTransactions(uid).then(setTransactions).catch(() => setTransactions([]));

    loadAccounts();
    loadTransactions();

    const unsubAcc = subscribeToCollectionChanges("accounts", loadAccounts);
    const unsubTrx = subscribeToCollectionChanges("transactions", loadTransactions);
    return () => {
      unsubAcc();
      unsubTrx();
    };
  }, []);

  useEffect(() => {
    if (accounts !== null && accounts.length === 0) {
      router.replace("/app/onboarding");
    }
  }, [accounts, router]);

  // Skeleton ringan selagi accounts dimuat — layout.tsx auth-guard di atas
  // sudah render `null` selama cek sesi, jadi di sini butuh sesuatu yang
  // kelihatan (bukan blank lagi) supaya tidak terasa dobel-kosong di HP.
  if (accounts === null) {
    return (
      <div className="max-w-md mx-auto px-5 pt-8 space-y-4 animate-pulse">
        <div className="h-40 rounded-3xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (accounts.length === 0) {
    // Sedang redirect ke /app/onboarding — hindari kedipan konten kosong.
    return null;
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400">Hai,</p>
          <h1 className="text-lg font-black text-slate-900">{auth.currentUser?.displayName || "Pengguna"}</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 rounded-full px-3 py-1.5 text-[11px] font-black">
          <Star size={12} fill="currentColor" /> Lvl 1
        </div>
      </div>

      <BalanceCard accounts={accounts} transactions={transactions} />
      <WalletList accounts={accounts} />
      <AssistantMenu />
      <RecentTransactions transactions={transactions} />
    </div>
  );
}

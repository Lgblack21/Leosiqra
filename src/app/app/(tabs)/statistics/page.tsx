"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PieChart } from "lucide-react";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { TxTypeToggle, TxType } from "@/components/app/TxTypeToggle";
import { CategoryBreakdownChart, CategorySlice } from "@/components/app/statistics/CategoryBreakdownChart";
import { FadeIn } from "@/components/app/FadeIn";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";

const MAX_SLICES = 6;

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d);

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function StatisticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [type, setType] = useState<TxType>("pengeluaran");

  useEffect(() => {
    const load = () =>
      transactionService.getUserTransactions(auth.currentUser?.uid ?? "").then(setTransactions).catch(() => setTransactions([]));
    load();
    return subscribeToCollectionChanges("transactions", load);
  }, []);

  const monthTx = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        t.type === type &&
        d.getFullYear() === selectedMonth.getFullYear() &&
        d.getMonth() === selectedMonth.getMonth()
      );
    });
  }, [transactions, selectedMonth, type]);

  const { slices, total } = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const t of monthTx) {
      const amt = Number(t.amountIDR) || Number(t.amount) || 0;
      const key = t.category?.trim() || "Umum";
      byCategory.set(key, (byCategory.get(key) ?? 0) + amt);
    }
    const sorted = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    let result: CategorySlice[] = sorted;
    if (sorted.length > MAX_SLICES) {
      const head = sorted.slice(0, MAX_SLICES - 1);
      const tailSum = sorted.slice(MAX_SLICES - 1).reduce((s, x) => s + x.amount, 0);
      result = [...head, { category: "Lainnya", amount: tailSum }];
    }
    const total = sorted.reduce((s, x) => s + x.amount, 0);
    return { slices: result, total };
  }, [monthTx]);

  const shiftMonth = (delta: number) => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-8 space-y-6">
      <FadeIn>
        <h1 className="text-lg font-black text-slate-900">Statistik</h1>
      </FadeIn>

      <FadeIn delay={0.03} className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 px-4 py-3">
        <button type="button" onClick={() => shiftMonth(-1)} className="p-1 text-slate-400">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-black text-slate-900 capitalize">{monthLabel(selectedMonth)}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="p-1 text-slate-400">
          <ChevronRight size={18} />
        </button>
      </FadeIn>

      <TxTypeToggle value={type} onChange={setType} />

      <FadeIn delay={0.06} className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white p-6 shadow-lg shadow-indigo-200">
        <p className="text-xs font-bold text-white/70 uppercase tracking-widest">
          Total {type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}
        </p>
        <p className="text-3xl font-black mt-1 tabular-nums">
          <AnimatedNumber value={total} format={formatIDR} />
        </p>
      </FadeIn>

      <FadeIn delay={0.1}>
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
          Berdasarkan Kategori
        </h2>
        {slices.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
            <PieChart size={24} className="mx-auto text-slate-300" />
            <p className="text-xs font-medium text-slate-400 mt-2">Belum ada transaksi bulan ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <CategoryBreakdownChart data={slices} />
          </div>
        )}
      </FadeIn>
    </div>
  );
}

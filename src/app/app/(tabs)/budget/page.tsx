"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Target, Trash2 } from "lucide-react";
import { budgetService, Budget } from "@/lib/services/budgetService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { categoryService } from "@/lib/services/categoryService";
import { budgetRealization } from "@/lib/budget";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { AddBudgetSheet } from "@/components/app/budget/AddBudgetSheet";

const monthLabel = (y: number, m: number) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(y, m, 1));

export default function AppBudgetPage() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const loadBudgets = () => budgetService.getUserBudgets(uid).then(setBudgets).catch(() => setBudgets([]));
    const loadTx = () => transactionService.getUserTransactions(uid).then(setTransactions).catch(() => setTransactions([]));
    loadBudgets();
    loadTx();
    categoryService
      .getUserCategories(uid)
      .then((cats) => setCategoryNames([...new Set(cats.map((c) => c.category).filter(Boolean))]))
      .catch(() => {});
    const u1 = subscribeToCollectionChanges("budgets", loadBudgets);
    const u2 = subscribeToCollectionChanges("transactions", loadTx);
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(() => budgets ?? [], [budgets]);
  const inMonth = useMemo(
    () => transactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === cursor.y && d.getMonth() === cursor.m; }),
    [transactions, cursor]
  );
  const inYear = useMemo(() => transactions.filter((t) => new Date(t.date).getFullYear() === cursor.y), [transactions, cursor.y]);

  // Pilihan kategori per tipe: kategori milik user + kategori yang pernah dipakai transaksi bertipe itu.
  const categories = useMemo(() => {
    const byType = (type: Budget["type"]) =>
      [...new Set([...transactions.filter((t) => t.type === type).map((t) => t.category), ...categoryNames])]
        .filter((c): c is string => Boolean(c) && c !== "Hutang" && c !== "Piutang")
        .slice(0, 24);
    return { pengeluaran: byType("pengeluaran"), pemasukan: byType("pemasukan") };
  }, [transactions, categoryNames]);

  const rows = all.map((b) => ({ budget: b, ...budgetRealization(b, b.period === "yearly" ? inYear : inMonth) }));
  const spending = rows.filter((r) => r.budget.type === "pengeluaran").sort((a, b) => b.percentage - a.percentage);
  const income = rows.filter((r) => r.budget.type === "pemasukan");
  const monthlySpend = spending.filter((r) => r.budget.period !== "yearly");
  const limitTotal = monthlySpend.reduce((s, r) => s + r.budget.amount, 0);
  const usedTotal = monthlySpend.reduce((s, r) => s + r.total, 0);
  const overCount = spending.filter((r) => r.isOver).length;

  const shift = (delta: number) => {
    lightTap();
    setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };

  const remove = async (id: string) => {
    if (confirmId !== id) { lightTap(); setConfirmId(id); return; }
    setError("");
    try {
      await budgetService.deleteBudget(id);
      lightTap();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menghapus budget.");
    } finally {
      setConfirmId(null);
    }
  };

  const renderRow = ({ budget, total, percentage, isOver }: typeof rows[number]) => {
    const isSpend = budget.type === "pengeluaran";
    const bar = isSpend ? (isOver ? "bg-rose-500" : percentage >= 80 ? "bg-amber-500" : "bg-emerald-500") : "bg-indigo-500";
    const left = budget.amount - total;
    return (
      <li key={budget.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{budget.category}</p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              {formatIDR(total)} dari {formatIDR(budget.amount)}{budget.period === "yearly" ? " / tahun" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => budget.id && remove(budget.id)}
            aria-label={confirmId === budget.id ? "Yakin hapus budget" : "Hapus budget"}
            className={cn(
              "shrink-0 rounded-full text-[11px] font-black transition-colors",
              confirmId === budget.id ? "bg-rose-500 text-white px-3 py-1.5" : "text-slate-300 dark:text-slate-600 p-1.5"
            )}
          >
            {confirmId === budget.id ? "Hapus?" : <Trash2 size={15} />}
          </button>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${Math.min(100, percentage)}%` }} />
        </div>
        <p className={cn("mt-1.5 text-[11px] font-bold tabular-nums", isSpend && isOver ? "text-rose-500" : "text-slate-500")}>
          {isSpend
            ? isOver ? `Lewat ${formatIDR(-left)} (${percentage.toFixed(0)}%)` : `Sisa ${formatIDR(left)} · ${percentage.toFixed(0)}%`
            : left > 0 ? `Kurang ${formatIDR(left)} · ${percentage.toFixed(0)}%` : `Tercapai 🎉 ${percentage.toFixed(0)}%`}
        </p>
      </li>
    );
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Budget</h1>
        </div>
        <button type="button" onClick={() => { lightTap(); setAdding(true); }} className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-xs font-black px-3.5 py-2">
          <Plus size={14} /> Tambah
        </button>
      </FadeIn>

      <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2 py-1.5">
        <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="p-2 text-slate-400"><ChevronLeft size={18} /></button>
        <span className="text-sm font-black text-slate-900 dark:text-white capitalize">{monthLabel(cursor.y, cursor.m)}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya" className="p-2 text-slate-400"><ChevronRight size={18} /></button>
      </div>

      {limitTotal > 0 && (
        <FadeIn className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white p-5 shadow-lg shadow-teal-200/50 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Terpakai bulan ini</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{formatIDR(usedTotal)}</p>
          <p className="text-[11px] text-white/80 tabular-nums">dari total batas {formatIDR(limitTotal)}</p>
          <div className="mt-3 h-2 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${Math.min(100, (usedTotal / limitTotal) * 100)}%` }} />
          </div>
          {overCount > 0 && <p className="mt-2 text-[11px] font-bold">⚠️ {overCount} kategori melewati batas</p>}
        </FadeIn>
      )}

      {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

      {budgets === null ? (
        <div className="space-y-3 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
      ) : all.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <Target size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">Belum ada budget</p>
          <p className="text-xs text-slate-400 mt-1">Set batas pengeluaran per kategori, mis. Makanan.</p>
        </div>
      ) : (
        <>
          {spending.length > 0 && (
            <section>
              <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Batas pengeluaran</h2>
              <ul className="space-y-3">{spending.map(renderRow)}</ul>
            </section>
          )}
          {income.length > 0 && (
            <section>
              <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Target pemasukan</h2>
              <ul className="space-y-3">{income.map(renderRow)}</ul>
            </section>
          )}
        </>
      )}

      <AddBudgetSheet isOpen={adding} onClose={() => setAdding(false)} categories={categories} existing={all} />
    </div>
  );
}

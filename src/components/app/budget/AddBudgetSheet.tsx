"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { budgetService, Budget } from "@/lib/services/budgetService";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Nama kategori yang tersedia per tipe (dari daftar kategori + transaksi). */
  categories: Record<Budget["type"], string[]>;
  existing: Budget[];
}

export function AddBudgetSheet({ isOpen, onClose, categories, existing }: Props) {
  const [type, setType] = useState<Budget["type"]>("pengeluaran");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState<Budget["period"]>("monthly");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCategory("");
    setAmount("");
    setError("");
  }, [isOpen]);

  const options = categories[type];
  const amountNumber = Number(amount || "0");
  const duplicate = existing.some((b) => b.type === type && b.category.toLowerCase() === category.toLowerCase());
  const canSubmit = amountNumber > 0 && category.trim().length > 0 && !duplicate && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await budgetService.createBudget({ userId: "", type, category: category.trim(), amount: amountNumber, period });
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan budget.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={type === "pengeluaran" ? "Batas Pengeluaran" : "Target Pemasukan"}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol="IDR" />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {busy ? "Menyimpan..." : `Simpan ${amountNumber > 0 ? groupDigits(amount) : ""}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {([["pengeluaran", "Pengeluaran"], ["pemasukan", "Pemasukan"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { lightTap(); setType(value); setCategory(""); }}
              className={cn("py-2.5 rounded-xl text-xs font-black transition-colors", type === value ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Kategori</p>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {options.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { lightTap(); setCategory(c); }}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-xs font-bold border",
                    category === c ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="atau ketik nama kategori"
            aria-label="Kategori"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {duplicate && <p className="mt-2 px-1 text-[11px] font-bold text-rose-500">Budget untuk kategori ini sudah ada.</p>}
        </div>

        <div className="flex gap-2">
          {([["monthly", "Per bulan"], ["yearly", "Per tahun"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { lightTap(); setPeriod(value); }}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-black border",
                period === value ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}

"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TxType = "pengeluaran" | "pemasukan";

interface TxTypeToggleProps {
  value: TxType;
  onChange: (value: TxType) => void;
}

export function TxTypeToggle({ value, onChange }: TxTypeToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange("pengeluaran")}
        className={cn(
          "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all border-2",
          value === "pengeluaran"
            ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-none"
            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
        )}
      >
        <ArrowDownCircle size={16} /> Pengeluaran
      </button>
      <button
        type="button"
        onClick={() => onChange("pemasukan")}
        className={cn(
          "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all border-2",
          value === "pemasukan"
            ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-none"
            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
        )}
      >
        <ArrowUpCircle size={16} /> Pemasukan
      </button>
    </div>
  );
}

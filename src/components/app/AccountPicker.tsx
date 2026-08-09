"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Account } from "@/lib/services/accountService";

interface AccountPickerProps {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
}

export function AccountPicker({ accounts, value, onChange }: AccountPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = accounts.find((a) => a.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 relative" ref={ref}>
      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
        <Wallet size={12} /> Akun / Rekening
      </label>
      {accounts.length === 0 ? (
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Belum ada rekening.</p>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-sm font-bold text-slate-900 dark:text-white">{selected?.name ?? "Pilih akun"}</span>
          <ChevronDown size={16} className={cn("text-slate-400 dark:text-slate-500 transition-transform", isOpen && "rotate-180")} />
        </button>
      )}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-10 max-h-56 overflow-y-auto custom-scrollbar">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => {
                onChange(acc.id ?? "");
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left",
                acc.id === value
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              )}
            >
              {acc.name}
              {acc.id === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

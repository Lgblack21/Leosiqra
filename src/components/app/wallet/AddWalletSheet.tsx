"use client";

import { useState } from "react";
import { Wallet, Landmark, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { accountService } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { NumberInput } from "@/components/ui/NumberInput";
import { CurrencySelect } from "@/components/CurrencySelect";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface AddWalletSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPES = [
  { value: "Cash", label: "Cash", icon: Wallet },
  { value: "Bank Account", label: "Bank", icon: Landmark },
  { value: "E-Wallet", label: "E-Wallet", icon: Smartphone },
] as const;

export function AddWalletSheet({ isOpen, onClose }: AddWalletSheetProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("Cash");
  const [currency, setCurrency] = useState("IDR");
  const [balance, setBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && currency.trim().length > 0 && !submitting;

  const reset = () => {
    setName("");
    setType("Cash");
    setBalance("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await accountService.createAccount({
        userId: auth.currentUser?.uid ?? "",
        name: name.trim(),
        type,
        currency,
        balance: Number(balance || "0"),
        initialBalance: Number(balance || "0"),
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat rekening.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tambah Rekening">
      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
            Nama Rekening
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Dompet, BCA, GoPay"
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/5"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Jenis</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-xs font-bold border-2 transition-all",
                    type === t.value
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  )}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <CurrencySelect label="Mata Uang" value={currency} onChange={setCurrency} />

        <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saldo Awal</label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-300 dark:text-slate-600">{currency || "Rp"}</span>
            <NumberInput
              value={balance}
              onChange={setBalance}
              placeholder="0"
              className="flex-1 min-w-0 text-3xl font-black text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-200 dark:placeholder:text-slate-700 tabular-nums"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {submitting ? "Menyimpan..." : "Simpan Rekening"}
        </button>
      </div>
    </BottomSheet>
  );
}

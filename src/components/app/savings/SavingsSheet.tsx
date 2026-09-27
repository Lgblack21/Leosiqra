"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { savingsService } from "@/lib/services/savingsService";
import { SAVING_GOALS } from "@/lib/savingsGoals";
import { cn, formatIDR, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

export type SavingsMode = "Setoran" | "Penarikan";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  /** Saldo per pos tabungan (IDR), untuk batas penarikan. */
  goalBalances: Map<string, number>;
  initialMode: SavingsMode;
  initialCategory?: string;
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500";

export function SavingsSheet({ isOpen, onClose, accounts, goalBalances, initialMode, initialCategory }: Props) {
  const [mode, setMode] = useState<SavingsMode>(initialMode);
  const [category, setCategory] = useState(initialCategory || SAVING_GOALS[0]);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(toLocalDateString());
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setCategory(initialCategory || SAVING_GOALS[0]);
    setAmount("");
    setDescription("");
    setDate(toLocalDateString());
    setError("");
  }, [isOpen, initialMode, initialCategory]);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const isTarik = mode === "Penarikan";
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency || "IDR";
  const amountNumber = Number(amount || "0");
  const available = goalBalances.get(category) ?? 0;
  // Batas penarikan hanya bisa dicek pasti untuk rekening IDR (saldo pos dalam IDR).
  const overdraw = isTarik && currency === "IDR" && amountNumber > Math.max(0, available);
  const canSubmit = amountNumber > 0 && Boolean(account) && !overdraw && !busy;

  const goals = [...new Set([...SAVING_GOALS, ...goalBalances.keys()])];

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const selectedDate = new Date(date);
      await savingsService.createSaving({
        description: description.trim() || `${isTarik ? "Tarik" : "Setor"} ${category}`,
        amount: amountNumber,
        amountIDR: currency === "IDR" ? amountNumber : undefined,
        currency,
        category,
        fromAccount: accountId,
        toGoal: category,
        transactionType: mode,
        date: selectedDate,
        displayDate: selectedDate.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
      });
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isTarik ? "Tarik Tabungan" : "Setor Tabungan"}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol={currency} />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={cn(
                "w-full py-4 rounded-2xl text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all",
                isTarik ? "bg-rose-500" : "bg-indigo-600"
              )}
            >
              {busy ? "Menyimpan..." : `${isTarik ? "Tarik" : "Setor"} ${amountNumber > 0 ? groupDigits(amount) : ""}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {(["Setoran", "Penarikan"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { lightTap(); setMode(m); }}
              className={cn(
                "py-2.5 rounded-xl text-xs font-black transition-colors",
                mode === m ? (m === "Setoran" ? "bg-indigo-600 text-white" : "bg-rose-500 text-white") : "text-slate-500"
              )}
            >
              {m === "Setoran" ? "Setor" : "Tarik"}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Pos tabungan</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {goals.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => { lightTap(); setCategory(g); }}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border",
                  category === g ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <p className={cn("mt-2 px-1 text-[11px] tabular-nums", overdraw ? "text-rose-500 font-bold" : "text-slate-400")}>
            Saldo {category}: {formatIDR(available)}
            {overdraw ? " — penarikan melebihi saldo pos ini" : ""}
          </p>
        </div>

        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={isTarik ? "Masuk ke rekening" : "Diambil dari rekening"} />
        <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Tanggal" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Keterangan (opsional) — "${isTarik ? "Tarik" : "Setor"} ${category}"`} className={inputClass} aria-label="Keterangan" />
      </div>
    </BottomSheet>
  );
}

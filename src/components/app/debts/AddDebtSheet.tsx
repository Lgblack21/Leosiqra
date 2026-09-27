"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { debtService, DEBT_KINDS } from "@/lib/services/debtService";
import { cn, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500";

export function AddDebtSheet({ isOpen, onClose, accounts }: Props) {
  const [isHutang, setIsHutang] = useState(true);
  const [kind, setKind] = useState<string>("Perorangan");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(toLocalDateString());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const amountNumber = Number(amount || "0");
  const canSubmit = amountNumber > 0 && name.trim().length > 0 && Boolean(account) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await debtService.create({
        isHutang,
        kind,
        lenderName: name.trim(),
        amount: amountNumber,
        accountId,
        date,
        note: note.trim(),
        currency: account?.currency || "IDR",
      });
      lightTap();
      setName("");
      setAmount("");
      setNote("");
      setDate(toLocalDateString());
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
      title={isHutang ? "Catat Hutang" : "Catat Piutang"}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol={account?.currency ?? "Rp"} />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {busy ? "Menyimpan..." : `Simpan ${isHutang ? "Hutang" : "Piutang"} ${amountNumber > 0 ? groupDigits(amount) : ""}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="grid grid-cols-2 gap-2">
          {[
            [true, "Saya berhutang", "bg-rose-500 border-rose-500"],
            [false, "Orang berhutang ke saya", "bg-emerald-500 border-emerald-500"],
          ].map(([value, label, active]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => { lightTap(); setIsHutang(value as boolean); }}
              className={cn(
                "py-3.5 px-2 rounded-2xl text-xs font-black border-2 transition-all",
                isHutang === value ? `${active} text-white` : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400"
              )}
            >
              {label as string}
            </button>
          ))}
        </div>

        {isHutang && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {DEBT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { lightTap(); setKind(k); }}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border",
                  kind === k ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
                )}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isHutang ? "Hutang ke siapa? (mis. Kredivo, Budi)" : "Siapa yang berhutang?"} className={inputClass} aria-label="Nama" />
        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={isHutang ? "Nanti dibayar dari" : "Nanti masuk ke"} />
        <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Tanggal" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className={inputClass} aria-label="Catatan" />
        <p className="text-[11px] text-slate-400 px-1">Mencatat hutang/piutang tidak mengubah saldo. Saldo berubah saat cicilan dibayar.</p>
      </div>
    </BottomSheet>
  );
}

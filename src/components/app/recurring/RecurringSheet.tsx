"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { recurringService, RecurringTransaction } from "@/lib/services/recurringService";
import { SAVING_GOALS } from "@/lib/savingsGoals";
import { cn, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

type RType = RecurringTransaction["type"];
type Interval = RecurringTransaction["interval"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  /** Kategori yang pernah dipakai, per tipe transaksi. */
  categories: { Pengeluaran: string[]; Pemasukan: string[] };
  editing: RecurringTransaction | null;
}

const TYPES: Array<[RType, string]> = [["Pengeluaran", "Keluar"], ["Pemasukan", "Masuk"], ["Tabungan", "Tabungan"]];
const INTERVALS: Interval[] = ["Harian", "Mingguan", "Bulanan", "Tahunan"];

const inputClass =
  "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500";

const chip = (active: boolean) =>
  cn(
    "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border",
    active ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
  );

export function RecurringSheet({ isOpen, onClose, accounts, categories, editing }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RType>("Pengeluaran");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setRepeat] = useState<Interval>("Bulanan");
  const [nextDate, setNextDate] = useState(toLocalDateString());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setName(editing?.name ?? "");
    setType(editing?.type ?? "Pengeluaran");
    setCategory(editing?.category ?? "");
    setAccountId(editing?.accountId && editing.accountId !== "General" ? editing.accountId : accounts[0]?.id ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setRepeat(editing?.interval ?? "Bulanan");
    setNextDate(editing ? toLocalDateString(new Date(editing.nextDate)) : toLocalDateString());
    setNote(editing?.note ?? "");
    // accounts sengaja tidak jadi dependency: form jangan ter-reset saat daftar rekening di-refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing]);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const amountNumber = Number(amount || "0");
  const today = toLocalDateString();
  // Cron jalan jam 10:00 WIB dan hanya mengeksekusi jadwal bertanggal hari itu —
  // jadwal "hari ini" yang dibuat setelah jam 10 tidak akan pernah jalan.
  const missedToday = nextDate === today && new Date().getHours() >= 10;
  const dateInvalid = nextDate < today || missedToday;
  const unchangedDate = Boolean(editing) && editing !== null && toLocalDateString(new Date(editing.nextDate)) === nextDate;
  const canSubmit = amountNumber > 0 && name.trim() && category.trim() && account && (!dateInvalid || unchangedDate) && !busy;
  const options = type === "Tabungan" ? SAVING_GOALS : categories[type];

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    const data = {
      name: name.trim(),
      type,
      category: category.trim(),
      accountId,
      amount: amountNumber,
      interval,
      nextDate: new Date(nextDate),
      note: note.trim(),
    };
    try {
      if (editing?.id) await recurringService.updateRecurring(editing.id, data);
      else await recurringService.createRecurring({ ...data, userId: "", status: "ACTIVE" });
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan jadwal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit Jadwal" : "Jadwal Baru"}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol={account?.currency ?? "IDR"} />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {busy ? "Menyimpan..." : `Simpan ${amountNumber > 0 ? groupDigits(amount) : ""} / ${interval.toLowerCase()}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {TYPES.map(([value, label]) => (
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

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama, mis. Netflix / Gaji / Nabung DD" className={inputClass} aria-label="Nama" />

        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{type === "Tabungan" ? "Pos tabungan" : "Kategori"}</p>
          {options.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-2">
              {options.map((c) => (
                <button key={c} type="button" onClick={() => { lightTap(); setCategory(c); }} className={chip(category === c)}>{c}</button>
              ))}
            </div>
          )}
          {type !== "Tabungan" && (
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="atau ketik kategori" className={inputClass} aria-label="Kategori" />
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {INTERVALS.map((i) => (
            <button key={i} type="button" onClick={() => { lightTap(); setRepeat(i); }} className={chip(interval === i)}>{i}</button>
          ))}
        </div>

        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={type === "Pemasukan" ? "Masuk ke rekening" : "Dari rekening"} />
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 block">Tanggal berikutnya</label>
          <input type="date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} className={inputClass} aria-label="Tanggal berikutnya" />
          {dateInvalid && !unchangedDate && (
            <p className="mt-2 px-1 text-[11px] font-bold text-rose-500">
              {missedToday ? "Pencatatan hari ini sudah lewat (jam 10:00). Pilih besok atau setelahnya." : "Tanggal lampau tidak akan dijalankan — pilih tanggal mendatang."}
            </p>
          )}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className={inputClass} aria-label="Catatan" />
        <p className="text-[11px] text-slate-400 px-1">Dicatat otomatis tiap jam 10:00 WIB pada tanggalnya, dan saldo rekening ikut berubah.</p>
      </div>
    </BottomSheet>
  );
}

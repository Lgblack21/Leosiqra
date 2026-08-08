"use client";

import { useEffect, useMemo, useState } from "react";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { accountService, Account } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { notifyCollectionChanged, subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { CategorySelect } from "@/components/CategorySelect";
import { NumberInput } from "@/components/ui/NumberInput";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TxTypeToggle, TxType } from "@/components/app/TxTypeToggle";
import { AccountPicker } from "@/components/app/AccountPicker";

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Sama seperti src/app/input-cepat/page.tsx — "50000.5" -> "50,000.5".
const groupDigits = (raw: string) => {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = intPart.replace("-", "");
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

export function AddTransactionSheet({ isOpen, onClose }: AddTransactionSheetProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [type, setType] = useState<TxType>("pengeluaran");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const loadAccounts = () =>
      accountService
        .getUserAccounts(auth.currentUser?.uid ?? "")
        .then((accs) => {
          setAccounts(accs);
          setAccountId((prev) => prev || accs[0]?.id || "");
        })
        .catch(() => setAccounts([]));
    loadAccounts();
    return subscribeToCollectionChanges("accounts", loadAccounts);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback.ok ? 1500 : 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const amountNumber = Number(amount || "0");
  const canSubmit = amountNumber > 0 && Boolean(selectedAccount) && !submitting;

  const resetForm = () => {
    setAmount("");
    setNote("");
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      await cloudflareApi("/api/member/quick-transaction", {
        method: "POST",
        json: {
          type,
          amount: amountNumber,
          category: category.trim(),
          sub_category: subCategory.trim(),
          account: selectedAccount.name,
          note: note.trim(),
        },
      });
      // quick-transaction dipanggil langsung lewat cloudflareApi (bukan lewat
      // transactionService), jadi notify manual — sama seperti input-cepat —
      // supaya Home dashboard & halaman web (Transaksi, Rekening) langsung
      // lihat data baru tanpa reload.
      notifyCollectionChanged("transactions");
      notifyCollectionChanged("accounts");
      resetForm();
      onClose();
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Gagal menyimpan transaksi." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Tambah Transaksi">
      <div className="space-y-4">
        {feedback && !feedback.ok && (
          <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600">
            {feedback.msg}
          </div>
        )}

        <TxTypeToggle value={type} onChange={setType} />

        <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Nominal {selectedAccount ? `(${selectedAccount.currency})` : ""}
          </label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-300">{selectedAccount?.currency ?? "Rp"}</span>
            <NumberInput
              autoFocus
              value={amount}
              onChange={setAmount}
              placeholder="0"
              className="flex-1 min-w-0 text-4xl font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-200 tabular-nums"
            />
          </div>
        </div>

        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} />

        <CategorySelect
          label="Kategori"
          value={category}
          type={type === "pengeluaran" ? "expense" : "income"}
          onChange={setCategory}
          onSubCategoryChange={setSubCategory}
          showBadge={false}
        />

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {submitting ? "Menyimpan..." : `Simpan ${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} ${amountNumber > 0 ? groupDigits(amount) : ""}`}
        </button>
      </div>
    </BottomSheet>
  );
}

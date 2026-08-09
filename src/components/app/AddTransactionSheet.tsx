"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CalendarDays } from "lucide-react";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { accountService, Account } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { notifyCollectionChanged, subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { CategorySelect } from "@/components/CategorySelect";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TxTypeToggle, TxType } from "@/components/app/TxTypeToggle";
import { AccountPicker } from "@/components/app/AccountPicker";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { lightTap } from "@/lib/haptics";

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const toISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
};

export function AddTransactionSheet({ isOpen, onClose }: AddTransactionSheetProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [type, setType] = useState<TxType>("pengeluaran");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [note, setNote] = useState("");
  // null = "hari ini" (default server-side, sengaja gak dikirim ke payload
  // supaya perilaku default gak berubah dari sebelumnya).
  const [date, setDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  // category wajib — kolom transactions.category di D1 punya constraint
  // NOT NULL, submit tanpa kategori gagal di server dengan error generik.
  const canSubmit =
    amountNumber > 0 && Boolean(selectedAccount) && category.trim().length > 0 && !submitting;

  const resetForm = () => {
    setAmount("");
    setNote("");
    setDate(null);
    setShowDatePicker(false);
  };

  const goToScan = () => {
    lightTap();
    onClose();
    router.push("/app/assistant/scan");
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
          ...(date ? { date } : {}),
        },
      });
      // quick-transaction dipanggil langsung lewat cloudflareApi (bukan lewat
      // transactionService), jadi notify manual — sama seperti input-cepat —
      // supaya Home dashboard & halaman web (Transaksi, Rekening) langsung
      // lihat data baru tanpa reload.
      notifyCollectionChanged("transactions");
      notifyCollectionChanged("accounts");
      lightTap();
      resetForm();
      onClose();
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Gagal menyimpan transaksi." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Transaksi"
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol={selectedAccount?.currency ?? "Rp"} />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {submitting
                ? "Menyimpan..."
                : `Simpan ${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} ${
                    amountNumber > 0 ? groupDigits(amount) : ""
                  }`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {feedback && !feedback.ok && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">
            {feedback.msg}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TxTypeToggle value={type} onChange={setType} />
          </div>
          <button
            type="button"
            onClick={goToScan}
            className="shrink-0 w-[52px] h-[52px] rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center"
            aria-label="Foto struk"
          >
            <Camera size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              lightTap();
              setDate(null);
              setShowDatePicker(false);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold border ${
              date === null
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => {
              lightTap();
              setDate(yesterdayISO());
              setShowDatePicker(false);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold border ${
              date === yesterdayISO()
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            Kemarin
          </button>
          <button
            type="button"
            onClick={() => {
              lightTap();
              setShowDatePicker((v) => !v);
            }}
            className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center ${
              showDatePicker || (date !== null && date !== yesterdayISO())
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            }`}
            aria-label="Pilih tanggal lain"
          >
            <CalendarDays size={15} />
          </button>
        </div>
        {showDatePicker && (
          <input
            type="date"
            value={date ?? toISODate(new Date())}
            max={toISODate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
          />
        )}

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
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/5"
        />
      </div>
    </BottomSheet>
  );
}

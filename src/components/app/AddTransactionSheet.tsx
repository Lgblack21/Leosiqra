"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Sparkles } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { CategorySelect } from "@/components/CategorySelect";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { TxType } from "@/components/app/TxTypeToggle";
import { transferService, EXTERNAL_WALLET_ID } from "@/lib/services/transferService";
import { cn } from "@/lib/utils";
import { AccountPicker } from "@/components/app/AccountPicker";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { lightTap } from "@/lib/haptics";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { quickTxService } from "@/lib/services/quickTxService";
import { useQuickContext } from "@/lib/quick/useQuickContext";
import type { QuickDraft } from "@/lib/quick/parse";
import { SmartBar, type DraftSource } from "@/components/quick/SmartBar";
import { UndoToast, type UndoItem } from "@/components/quick/UndoToast";

type SheetMode = TxType | "transfer";

// Tiga mode dalam satu baris: Keluar / Masuk / Transfer. Transfer menukar isian
// kategori dengan rekening "Dari" & "Ke" dan disimpan lewat endpoint transfer.
function ModeToggle({ value, onChange }: { value: SheetMode; onChange: (m: SheetMode) => void }) {
  const items: { mode: SheetMode; label: string; icon: React.ElementType; active: string }[] = [
    { mode: "pengeluaran", label: "Keluar", icon: ArrowDownCircle, active: "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-none" },
    { mode: "pemasukan", label: "Masuk", icon: ArrowUpCircle, active: "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-none" },
    { mode: "transfer", label: "Transfer", icon: ArrowLeftRight, active: "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ mode, label, icon: Icon, active }) => (
        <button
          key={mode}
          type="button"
          onClick={() => { lightTap(); onChange(mode); }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-[13px] font-black transition-all border-2",
            value === mode ? active : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
          )}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hint, setHint] = useState<{ source: DraftSource; text?: string } | null>(null);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [type, setType] = useState<TxType>("pengeluaran");
  const [isTransfer, setIsTransfer] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const mode: SheetMode = isTransfer ? "transfer" : type;
  const setMode = (m: SheetMode) => {
    if (m === "transfer") setIsTransfer(true);
    else { setIsTransfer(false); setType(m); }
  };
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

  // Riwayat transaksi untuk ketik pintar — dimuat saat sheet
  // pertama kali dibuka (bukan saat app start), lalu ikut ter-update.
  const [historyWanted, setHistoryWanted] = useState(false);
  useEffect(() => { if (isOpen) setHistoryWanted(true); }, [isOpen]);
  useEffect(() => {
    if (!historyWanted) return;
    const load = () => transactionService.getUserTransactions(auth.currentUser?.uid ?? "").then(setTransactions).catch(() => {});
    load();
    return subscribeToCollectionChanges("transactions", load);
  }, [historyWanted]);
  const { ctx } = useQuickContext(auth.currentUser?.uid ?? "", accounts, transactions);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback.ok ? 1500 : 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  // Tujuan transfer: rekening sendiri selain asal + e-wallet luar (tidak dilacak).
  const transferTargets = useMemo<Account[]>(() => [
    ...accounts.filter((a) => a.id !== accountId),
    { id: EXTERNAL_WALLET_ID, userId: "", name: "E-Wallet luar (OVO/GoPay/DANA)", type: "E-Wallet", currency: selectedAccount?.currency || "IDR", balance: 0, initialBalance: 0, createdAt: new Date() } as Account,
  ], [accounts, accountId, selectedAccount]);
  useEffect(() => {
    if (!isTransfer) return;
    if (!toAccountId || toAccountId === accountId || !transferTargets.some((a) => a.id === toAccountId)) {
      setToAccountId(transferTargets[0]?.id ?? EXTERNAL_WALLET_ID);
    }
  }, [isTransfer, accountId, toAccountId, transferTargets]);

  const amountNumber = Number(amount || "0");
  // category wajib — kolom transactions.category di D1 punya constraint
  // NOT NULL, submit tanpa kategori gagal di server dengan error generik.
  const canSubmit = isTransfer
    ? amountNumber > 0 && Boolean(selectedAccount) && Boolean(toAccountId) && toAccountId !== accountId && !submitting
    : amountNumber > 0 && Boolean(selectedAccount) && category.trim().length > 0 && !submitting;

  const resetForm = () => {
    setAmount("");
    setNote("");
    setDate(null);
    setShowDatePicker(false);
    setHint(null);
  };

  // Isi form dari ketik pintar / suara / scan — hanya field yang terbaca,
  // sisanya tetap seperti yang sudah dipilih user. Tidak langsung disimpan.
  const applyDraft = (draft: QuickDraft, source: DraftSource, info?: string) => {
    if (draft.type) { setIsTransfer(false); setType(draft.type); }
    if (draft.amount) setAmount(String(draft.amount));
    if (draft.accountId && accounts.some((a) => a.id === draft.accountId)) setAccountId(draft.accountId);
    if (draft.category) { setCategory(draft.category); setSubCategory(draft.subCategory ?? ""); }
    if (draft.note) setNote(draft.note);
    if (draft.date) { setDate(draft.date === toISODate(new Date()) ? null : draft.date); setShowDatePicker(false); }
    setHint({ source, text: info });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      if (isTransfer) {
        await transferService.createTransfer({
          fromAccountId: selectedAccount.id ?? "",
          toAccountId,
          amount: amountNumber,
          note: note.trim(),
          ...(date ? { date } : {}),
        });
        lightTap();
        resetForm();
        onClose();
        return;
      }
      // quickTxService memanggil /api/member/quick-transaction (atomik) dan
      // memberi tahu halaman lain supaya langsung ter-update tanpa reload.
      const res = await quickTxService.create({
        type,
        amount: amountNumber,
        accountId: selectedAccount.id ?? "",
        category,
        subCategory,
        note,
        ...(date ? { date } : {}),
      });
      setUndoItem({ id: res.id, label: `${subCategory || category} · ${res.currency} ${groupDigits(amount)} · ${res.matchedAccount}` });
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
    <>
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
                : `Simpan ${isTransfer ? "Transfer" : type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} ${
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

        <SmartBar ctx={ctx} onDraft={applyDraft} />
        {hint && (
          <div className="flex items-start gap-2 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 px-3.5 py-2.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            <span>
              Terisi dari {hint.source === "voice" ? "suara" : hint.source === "scan" ? "foto struk" : "teks"} — cek lalu simpan.
              {hint.text ? <span className="block font-medium text-amber-600 dark:text-amber-400">{hint.text}</span> : null}
            </span>
          </div>
        )}
        <ModeToggle value={mode} onChange={setMode} />

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

        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={isTransfer ? "Dari rekening" : "Akun / Rekening"} />

        {isTransfer ? (
          <>
            <AccountPicker accounts={transferTargets} value={toAccountId} onChange={setToAccountId} label="Ke" />
            {selectedAccount && transferTargets.find((a) => a.id === toAccountId)?.currency !== selectedAccount.currency && toAccountId !== EXTERNAL_WALLET_ID && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-1">
                Nominal dalam {selectedAccount.currency}. Jumlah yang masuk dikonversi otomatis pakai kurs hari ini.
              </p>
            )}
          </>
        ) : (
          <CategorySelect
            label="Kategori"
            value={category}
            type={type === "pengeluaran" ? "expense" : "income"}
            onChange={setCategory}
            onSubCategoryChange={setSubCategory}
            subValue={subCategory}
            showBadge={false}
          />
        )}

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/5"
        />
      </div>
    </BottomSheet>
    <UndoToast item={undoItem} onUndo={(item) => quickTxService.undo(item.id)} onDone={() => setUndoItem(null)} />
    </>
  );
}

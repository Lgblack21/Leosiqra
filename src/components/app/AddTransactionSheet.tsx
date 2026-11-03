"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ArrowLeftRight, Sparkles, Calculator, ChevronDown, Check, PencilLine } from "lucide-react";
import { LogoImage } from "@/components/ui/LogoImage";
import { matchIndonesianInstitutionLogo } from "@/lib/indonesianBanks";
import { useBalanceVisibility } from "@/lib/hooks/useBalanceVisibility";
import { useTags } from "@/lib/useTags";
import { AppTagChips } from "@/components/app/AppTagChips";
import { categoryVisual } from "@/lib/categoryEmoji";
import { accountService, Account } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { CategoryGrid } from "@/components/app/CategoryGrid";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { TxType } from "@/components/app/TxTypeToggle";
import { transferService, EXTERNAL_WALLET_ID } from "@/lib/services/transferService";
import { cn } from "@/lib/utils";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { lightTap } from "@/lib/haptics";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { quickTxService } from "@/lib/services/quickTxService";
import { useQuickContext } from "@/lib/quick/useQuickContext";
import type { QuickDraft } from "@/lib/quick/parse";
import { SmartBar, type DraftSource } from "@/components/quick/SmartBar";
import { UndoToast, type UndoItem } from "@/components/quick/UndoToast";
import type { TxPrefill } from "@/lib/txPrefill";

type SheetMode = TxType | "transfer";

// Warna panel atas per jenis — identitas utama form: merah keluar, hijau masuk, ungu transfer.
const MODE_STYLE: Record<SheetMode, { hero: string; ring: string; text: string; save: string }> = {
  pengeluaran: { hero: "from-[#ff5f6d] to-[#e5305a]", ring: "ring-rose-500", text: "text-rose-600", save: "from-[#ff5f6d] to-[#e5305a] shadow-rose-300/60" },
  pemasukan: { hero: "from-[#22c488] to-[#0e9a6a]", ring: "ring-emerald-500", text: "text-emerald-600", save: "from-[#22c488] to-[#0e9a6a] shadow-emerald-300/60" },
  transfer: { hero: "from-[#7c6cff] to-[#4f46e5]", ring: "ring-indigo-500", text: "text-indigo-600", save: "from-[#7c6cff] to-[#4f46e5] shadow-indigo-300/60" },
};

// Keluar / Masuk / Transfer — kapsul di atas panel berwarna; pil putih meluncur ke yang terpilih.
function ModeToggle({ value, onChange }: { value: SheetMode; onChange: (m: SheetMode) => void }) {
  const items: { mode: SheetMode; label: string }[] = [
    { mode: "pengeluaran", label: "Keluar" },
    { mode: "pemasukan", label: "Masuk" },
    { mode: "transfer", label: "Transfer" },
  ];
  return (
    <div className="flex rounded-full bg-black/15 p-[3px]">
      {items.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => { lightTap(); onChange(mode); }}
          aria-pressed={value === mode}
          className={cn("relative rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors duration-300", value === mode ? MODE_STYLE[mode].text : "text-white/80")}
        >
          {value === mode && (
            <motion.span layoutId="add-mode-pill" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 480, damping: 36 }} />
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

// Pilihan rekening di lembar Detail: kartu dengan logo bank + saldo (ikut
// sembunyikan-saldo di Beranda). Dua kolom supaya semua rekening terlihat sekaligus.
const ACCOUNT_EMOJI: Record<string, string> = { "E-Wallet": "📱", Cash: "💵", "Credit Card": "💳", Investment: "📈" };
const balanceText = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: currency || "IDR", minimumFractionDigits: !currency || NO_CENTS.has(currency) ? 0 : 2, maximumFractionDigits: !currency || NO_CENTS.has(currency) ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
function AccountLogo({ account, className }: { account: Account; className?: string }) {
  const external = account.id === EXTERNAL_WALLET_ID;
  const emoji = external ? "👛" : ACCOUNT_EMOJI[account.type] ?? "🏦";
  const logo = external ? undefined : account.logoUrl || matchIndonesianInstitutionLogo(account.name, account.type) || undefined;
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-white text-[16px] dark:bg-slate-700", className)}>
      {logo ? (
        <LogoImage
          src={logo}
          alt={account.name}
          fallbackText={account.name.slice(0, 3).toUpperCase()}
          fallbackIcon={<span aria-hidden className="flex h-full w-full items-center justify-center bg-white dark:bg-slate-700">{emoji}</span>}
          className="h-full w-full object-contain p-[12%]"
        />
      ) : (
        <span aria-hidden>{emoji}</span>
      )}
    </span>
  );
}

function AccountRow({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  const [hidden] = useBalanceVisibility();
  if (accounts.length === 0) return <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Belum ada rekening.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {accounts.map((a) => {
        const active = a.id === value;
        const external = a.id === EXTERNAL_WALLET_ID;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => { lightTap(); onChange(a.id ?? ""); }}
            aria-pressed={active}
            className={cn(
              "relative flex min-w-0 items-center gap-2.5 rounded-2xl p-2.5 text-left transition-all active:scale-[0.98]",
              active
                ? "bg-white ring-2 ring-slate-900 shadow-md dark:bg-slate-800 dark:ring-white"
                : "bg-slate-100 ring-1 ring-transparent dark:bg-slate-800/70"
            )}
          >
            <AccountLogo account={a} className="h-10 w-10 rounded-xl shadow-sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">{external ? "E-Wallet luar" : a.name}</span>
              <span className="block truncate text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {external ? "OVO/GoPay/DANA" : hidden ? `${a.currency} ••••` : balanceText(a.balance || 0, a.currency)}
              </span>
            </span>
            {active && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Simbol di depan nominal; mata uang tanpa sen (IDR/KHR/JPY…) memakai tombol 000.
const currencyLabel = (code?: string) => (!code || code === "IDR" ? "Rp" : code);
const NO_CENTS = new Set(["IDR", "KHR", "JPY", "KRW", "VND"]);

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Dari notifikasi pengingat bernominal: isi nominal & catatan, kategori dipilih user.
  prefill?: TxPrefill | null;
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

export function AddTransactionSheet({ isOpen, onClose, prefill }: AddTransactionSheetProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hint, setHint] = useState<{ source: DraftSource; text?: string } | null>(null);
  // Foto struk dari scan AI (disimpan server) — ditautkan setelah transaksi tersimpan.
  const [attachmentId, setAttachmentId] = useState<string | undefined>();
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
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fromReminder, setFromReminder] = useState<string | null>(null);
  // Bagian yang jarang dipakai disembunyikan sampai diminta.
  const [showSmart, setShowSmart] = useState(false);
  const [picker, setPicker] = useState<null | "acc" | "to" | "date">(null);
  const { tags: tagPref } = useTags();
  const [txTags, setTxTags] = useState<string[]>([]);
  const [catsOpen, setCatsOpen] = useState(false);
  const [calcOn, setCalcOn] = useState(false);

  // Tiap ketukan notifikasi (key baru) mengisi ulang form; kategori sengaja
  // dikosongkan supaya user memilih sendiri sebelum menyimpan.
  useEffect(() => {
    if (!prefill) return;
    setIsTransfer(false);
    setType("pengeluaran");
    setAmount(String(prefill.amount));
    setNote(prefill.note);
    setCategory("");
    setSubCategory("");
    setDate(null);
    setHint(null);
    setAttachmentId(undefined);
    setFeedback(null);
    setFromReminder(prefill.note);
  }, [prefill]);
  useEffect(() => { if (!isOpen) setFromReminder(null); }, [isOpen]);

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
    setHint(null);
    setAttachmentId(undefined);
    setFromReminder(null);
    setShowSmart(false);
    setPicker(null);
    setTxTags([]);
    setCatsOpen(false);
    setCalcOn(false);
  };

  // Isi form dari ketik pintar / suara / scan — hanya field yang terbaca,
  // sisanya tetap seperti yang sudah dipilih user. Tidak langsung disimpan.
  const applyDraft = (draft: QuickDraft, source: DraftSource, info?: string) => {
    if (draft.type) { setIsTransfer(false); setType(draft.type); }
    if (draft.amount) setAmount(String(draft.amount));
    if (draft.accountId && accounts.some((a) => a.id === draft.accountId)) setAccountId(draft.accountId);
    if (draft.category) { setCategory(draft.category); setSubCategory(draft.subCategory ?? ""); }
    if (draft.note) setNote(draft.note);
    if (draft.date) { setDate(draft.date === toISODate(new Date()) ? null : draft.date); }
    if (source === "scan") setAttachmentId(draft.attachmentId);
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
        attachmentId,
        tags: txTags,
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

  const st = MODE_STYLE[mode];
  const currencyCode = selectedAccount?.currency;
  const cur = currencyLabel(currencyCode);
  const shown = amountNumber > 0 ? groupDigits(amount) : "0";
  const dateLabel = date === null ? "Hari ini" : date === yesterdayISO() ? "Kemarin" : date.split("-").reverse().slice(0, 2).join("/");
  const catEmoji = category ? categoryVisual(category, type).emoji : "";
  const toAccount = transferTargets.find((a) => a.id === toAccountId);
  const canSwap = isTransfer && Boolean(toAccountId) && toAccountId !== EXTERNAL_WALLET_ID;
  const heroChip = "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-bold text-white active:bg-white/30";
  const openPicker = (p: "acc" | "to" | "date") => { lightTap(); setCatsOpen(false); setPicker(p); };
  const dateOpt = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-bold transition-colors",
      active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
    );
  const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  return (
    <>
    <BottomSheet
      bare
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          {!catsOpen && !showSmart && <AmountKeypad
            variant="flat"
            value={amount}
            onChange={setAmount}
            currencySymbol={cur}
            calculator={calcOn}
            onCalculatorChange={setCalcOn}
            thousandKey={!currencyCode || NO_CENTS.has(currencyCode)}
          />}
          <div className="px-4 pt-2 pb-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "w-full h-14 rounded-[20px] bg-gradient-to-br text-white font-extrabold text-base shadow-lg dark:shadow-none disabled:opacity-35 disabled:shadow-none transition-all active:scale-[0.98]",
                st.save
              )}
            >
              {submitting
                ? "Menyimpan..."
                : amountNumber <= 0
                ? "Simpan"
                : !isTransfer && !category
                ? "Pilih kategori dulu"
                : `Simpan ${cur} ${groupDigits(amount)}`}
            </button>
          </div>
        </div>
      }
    >
      <div className={cn("relative overflow-hidden bg-gradient-to-br px-4 pt-7 pb-5 text-white", st.hero)}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-2">
          <ModeToggle value={mode} onChange={setMode} />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { lightTap(); setCalcOn((v) => !v); }}
              aria-label="Kalkulator"
              aria-pressed={calcOn}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", calcOn ? "bg-white text-slate-900" : "bg-white/20 text-white")}
            >
              <Calculator size={16} />
            </button>
            <button
              type="button"
              onClick={() => { lightTap(); setCatsOpen(false); setShowSmart((v) => !v); }}
              aria-label="Isi lewat ketik, suara, atau foto struk"
              aria-pressed={showSmart}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", showSmart ? "bg-white text-slate-900" : "bg-white/20 text-white")}
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { if (!catsOpen && !showSmart) return; lightTap(); setCatsOpen(false); setShowSmart(false); }}
          aria-label="Ketik nominal"
          className="relative mt-5 flex w-full items-baseline justify-center gap-1.5 min-w-0"
          aria-live="polite"
        >
          <span className="shrink-0 text-lg font-bold text-white/80">{cur}</span>
          <motion.span
            key={shown}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.16 }}
            className={cn(
              "truncate font-extrabold leading-none tracking-tight tabular-nums",
              shown.length > 11 ? "text-[36px]" : "text-[50px]",
              amountNumber <= 0 && "text-white/50"
            )}
          >
            {shown}
          </motion.span>
        </button>
        {(catsOpen || showSmart) && (
          <p className="relative -mt-0.5 text-center text-[11px] font-bold text-white/70">Ketuk nominal untuk mengetik</p>
        )}

        <div className="relative mt-3.5 flex flex-wrap justify-center gap-2">
          {!isTransfer && (
            <button type="button" onClick={() => { lightTap(); setShowSmart(false); setCatsOpen((v) => !v); }} className={heroChip}>
              <span className="truncate">{category ? `${catEmoji} ${subCategory || category}` : "Pilih kategori"}</span>
              <ChevronDown size={13} className="shrink-0 opacity-70" />
            </button>
          )}
          {!isTransfer && (
            <button type="button" onClick={() => openPicker("acc")} className={cn(heroChip, "pl-1.5")}>
              {selectedAccount && <AccountLogo account={selectedAccount} className="h-5 w-5 rounded-full" />}
              <span className="truncate max-w-[130px]">{selectedAccount?.name ?? "Rekening"}</span>
              <ChevronDown size={13} className="shrink-0 opacity-70" />
            </button>
          )}
          <button type="button" onClick={() => openPicker("date")} className={heroChip}>
            <CalendarDays size={13} className="shrink-0 opacity-80" />
            <span className="truncate">{dateLabel}</span>
            <ChevronDown size={13} className="shrink-0 opacity-70" />
          </button>
        </div>
      </div>

      {(feedback && !feedback.ok) || showSmart || (fromReminder && !hint) || hint ? (
        <div className="space-y-2 px-4 pt-3">
          {feedback && !feedback.ok && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">
              {feedback.msg}
            </div>
          )}
          {showSmart && <SmartBar ctx={ctx} onDraft={(d, src, info) => { applyDraft(d, src, info); setShowSmart(false); }} layout="tiles" />}
          {fromReminder && !hint && (
            <div className="flex items-start gap-2 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 px-3.5 py-2.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
              <Sparkles size={13} className="mt-0.5 shrink-0" />
              <span>Dari pengingat &ldquo;{fromReminder}&rdquo; — pilih kategori, cek rekening, lalu simpan.</span>
            </div>
          )}
          {hint && (
            <div className="flex items-start gap-2 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 px-3.5 py-2.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
              <Sparkles size={13} className="mt-0.5 shrink-0" />
              <span>
                Terisi dari {hint.source === "voice" ? "suara" : hint.source === "scan" ? "foto struk" : "teks"} — cek lalu simpan.
                {hint.text ? <span className="block font-medium text-amber-600 dark:text-amber-400">{hint.text}</span> : null}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {showSmart ? null : isTransfer ? (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 rounded-[20px] bg-slate-100 dark:bg-slate-800 p-2.5">
            <button type="button" onClick={() => openPicker("acc")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {selectedAccount && <AccountLogo account={selectedAccount} className="h-9 w-9 rounded-xl" />}
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500">Dari</span>
                <span className="block truncate text-[14px] font-extrabold text-slate-900 dark:text-white">{selectedAccount?.name ?? "—"}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => { if (!canSwap) return; lightTap(); const from = accountId; setAccountId(toAccountId); setToAccountId(from); }}
              disabled={!canSwap}
              aria-label="Tukar rekening"
              className="shrink-0 w-9 h-9 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 disabled:opacity-40"
            >
              <ArrowLeftRight size={16} />
            </button>
            <button type="button" onClick={() => openPicker("to")} className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500">Ke</span>
                <span className="block truncate text-[14px] font-extrabold text-slate-900 dark:text-white">{toAccount?.name ?? "—"}</span>
              </span>
              {toAccount && <AccountLogo account={toAccount} className="h-9 w-9 rounded-xl" />}
            </button>
          </div>
          {selectedAccount && toAccount && toAccount.currency !== selectedAccount.currency && toAccountId !== EXTERNAL_WALLET_ID && (
            <p className="mt-2 px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Nominal dalam {selectedAccount.currency}. Jumlah yang masuk dikonversi otomatis pakai kurs hari ini.
            </p>
          )}
        </div>
      ) : (
        <div className="pt-4">
          <CategoryGrid
            layout="row"
            activeRing={st.ring}
            expanded={catsOpen}
            onExpandedChange={setCatsOpen}
            type={type}
            value={category}
            subValue={subCategory}
            history={transactions}
            onChange={(c, sub) => { setCategory(c); setSubCategory(sub); }}
          />
        </div>
      )}

      {!catsOpen && !showSmart && (
        <label className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5 dark:bg-slate-800">
          <PencilLine size={14} className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tambah catatan (opsional)"
            aria-label="Catatan"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
        </label>
      )}

      {!catsOpen && !showSmart && !isTransfer && tagPref.enabled && (
        <AppTagChips value={txTags} onChange={setTxTags} className="px-4 pt-1" />
      )}

      {/* Pop-up pilihan rekening / tanggal: satu ketukan memilih & langsung tertutup. */}
      <AnimatePresence>
        {picker && (
          <motion.div
            key="picker"
            className="absolute inset-0 z-20 flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPicker(null)}
          >
            <div className="absolute inset-0 bg-slate-900/45" />
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="relative w-full max-h-[75%] overflow-y-auto rounded-t-[28px] bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] dark:bg-slate-900"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              {picker === "date" ? (
                <>
                  <p className="mb-3 px-1 text-[15px] font-extrabold text-slate-900 dark:text-white">Tanggal transaksi</p>
                  <div className="space-y-2">
                    <button type="button" onClick={() => { lightTap(); setDate(null); setPicker(null); }} className={dateOpt(date === null)}>
                      Hari ini <span className="text-[13px] font-semibold opacity-60">{shortDate(toISODate(new Date()))}</span>
                    </button>
                    <button type="button" onClick={() => { lightTap(); setDate(yesterdayISO()); setPicker(null); }} className={dateOpt(date === yesterdayISO())}>
                      Kemarin <span className="text-[13px] font-semibold opacity-60">{shortDate(yesterdayISO())}</span>
                    </button>
                    <label className={cn(dateOpt(date !== null && date !== yesterdayISO()), "relative cursor-pointer")}>
                      <span className="flex items-center gap-2"><CalendarDays size={16} /> Tanggal lain</span>
                      <span className="text-[13px] font-semibold opacity-60">{date !== null && date !== yesterdayISO() ? shortDate(date) : "Pilih"}</span>
                      <input
                        type="date"
                        aria-label="Pilih tanggal lain"
                        value={date ?? toISODate(new Date())}
                        max={toISODate(new Date())}
                        onChange={(e) => { setDate(e.target.value && e.target.value !== toISODate(new Date()) ? e.target.value : null); setPicker(null); }}
                        className="absolute inset-0 opacity-0"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 px-1 text-[15px] font-extrabold text-slate-900 dark:text-white">
                    {picker === "to" ? "Transfer ke" : isTransfer ? "Transfer dari" : "Pakai rekening"}
                  </p>
                  <AccountRow
                    accounts={picker === "to" ? transferTargets : accounts}
                    value={picker === "to" ? toAccountId : accountId}
                    onChange={(id) => { if (picker === "to") setToAccountId(id); else setAccountId(id); setPicker(null); }}
                  />
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheet>
    <UndoToast item={undoItem} onUndo={(item) => quickTxService.undo(item.id)} onDone={() => setUndoItem(null)} />
    </>
  );
}

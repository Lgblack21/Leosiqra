"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  StickyNote,
  Check,
  Loader2,
  LogIn,
  ExternalLink,
  X,
  AlertTriangle,
  ChevronDown,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { cn, toLocalDateString } from "@/lib/utils";
import { accountService, Account } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { onAuthStateChanged } from "@/lib/cf-auth";
import { CategorySelect } from "@/components/CategorySelect";
import { subscribeUserProfile, UserProfile } from "@/lib/services/userService";
import { LogoImage } from "@/components/ui/LogoImage";
import { SplashScreen } from "@/components/input-cepat/SplashScreen";
import { InputCepatInstall } from "@/components/install/InputCepatInstall";
import { reportAppOpened } from "@/lib/appUsage";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { isCreditAccountType, computeCreditUsage } from "@/lib/creditCard";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { quickTxService } from "@/lib/services/quickTxService";
import { useQuickContext } from "@/lib/quick/useQuickContext";
import type { QuickDraft } from "@/lib/quick/parse";
import { SmartBar, type DraftSource } from "@/components/quick/SmartBar";
import { UndoToast, type UndoItem } from "@/components/quick/UndoToast";

type AuthState = "loading" | "ok" | "unauth";
type TxType = "pengeluaran" | "pemasukan";

// "50000.5" -> "50,000.5" (koma ribuan, titik desimal — gaya internasional,
// supaya nominal mata uang asing seperti USD "4.5" gampang diketik apa
// adanya). Input disimpan sebagai angka polos; format hanya untuk tampilan.
const groupDigits = (raw: string) => {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = intPart.replace("-", "");
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

export default function InputCepatPage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [type, setType] = useState<TxType>("pengeluaran");
  const [amount, setAmount] = useState(""); // digit murni
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [note, setNote] = useState("");
  // null = hari ini (tanggal ditentukan server, WIB).
  const [date, setDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hint, setHint] = useState<{ source: DraftSource; text?: string } | null>(null);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [uid, setUid] = useState("");
  // Nominal "meletup" sebentar saat terisi dari ketik pintar / suara / struk.
  const amountControls = useAnimationControls();

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Akun/Rekening ditampilkan sebagai dropdown (bukan daftar penuh selalu
  // terbuka) — cuma rekening terpilih yang tampil sampai user tap untuk pilih.
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Popup notifikasi auto-tutup — sukses lebih cepat (form sudah siap dipakai
  // lagi buat input cepat berikutnya), gagal lebih lama supaya sempat dibaca.
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback.ok ? 1800 : 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Pakai onAuthStateChanged (bukan panggil /api/auth/me langsung) supaya
  // auth.currentUser terisi — dibutuhkan CategorySelect (kategori yang sama
  // dengan Input Harian) untuk query kategori milik user.
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubAcc: (() => void) | undefined;
    let unsubTrx: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setAuthState("unauth");
        return;
      }
      setAuthState("ok");
      setUid(u.uid);
      reportAppOpened("input-cepat");

      const loadAccounts = () =>
        accountService
          .getUserAccounts(u.uid)
          .then((accs) => {
            setAccounts(accs);
            setAccountId((prev) => prev || accs[0]?.id || "");
          })
          .catch(() => setAccounts([]));
      loadAccounts();

      // Transaksi dipakai untuk menghitung sisa limit kartu kredit/paylater —
      // lihat lib/creditCard.ts, kolom `balance` kartu kredit bukan saldo kas.
      const loadTransactions = () =>
        transactionService.getUserTransactions(u.uid).then(setTransactions).catch(() => setTransactions([]));
      loadTransactions();

      unsubProfile = subscribeUserProfile(u.uid, setProfile);

      // getUserAccounts/getUserTransactions cuma fetch sekali — refetch manual
      // tiap ada tambah rekening/transaksi baru/hapus di mana pun (termasuk
      // dari halaman ini sendiri) supaya tidak perlu reload manual.
      unsubAcc = subscribeToCollectionChanges("accounts", loadAccounts);
      unsubTrx = subscribeToCollectionChanges("transactions", loadTransactions);
    });
    return () => {
      unsub();
      if (unsubProfile) unsubProfile();
      if (unsubAcc) unsubAcc();
      if (unsubTrx) unsubTrx();
    };
  }, []);

  const formatBalance = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: currency || "IDR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency || ""} ${groupDigits(String(Math.round(amount)))}`.trim();
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  // Kartu kredit/paylater dimodelkan sebagai limit, bukan saldo kas — jadi
  // tampilkan sisa limit (dihitung dari transaksi) alih-alih kolom `balance`
  // mentah (yang memang 0 untuk kartu kredit), sama seperti halaman Rekening.
  const creditUsageByAccount = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCreditUsage>>();
    accounts.filter((a) => isCreditAccountType(a.type) && a.id).forEach((acc) => {
      map.set(acc.id!, computeCreditUsage(acc, transactions));
    });
    return map;
  }, [accounts, transactions]);

  const amountNumber = Number(amount || "0");
  // category wajib — kolom transactions.category di D1 punya constraint
  // NOT NULL, submit tanpa kategori gagal di server dengan error generik.
  const canSubmit =
    amountNumber > 0 && Boolean(selectedAccount) && category.trim().length > 0 && !submitting;

  // Transaksi hari ini (kalender lokal), dipisah per jenis — daftar ini yang
  // dipakai BAIK buat kartu total maupun daftar rincian pas diklik, supaya
  // angka total dan daftarnya dijamin selalu sinkron (satu sumber data).
  const todayTransactions = useMemo(() => {
    const now = new Date();
    const pengeluaran: Transaction[] = [];
    const pemasukan: Transaction[] = [];
    for (const t of transactions) {
      const d = new Date(t.date);
      if (
        d.getFullYear() !== now.getFullYear() ||
        d.getMonth() !== now.getMonth() ||
        d.getDate() !== now.getDate()
      ) {
        continue;
      }
      if (t.type === "pengeluaran") pengeluaran.push(t);
      else if (t.type === "pemasukan") pemasukan.push(t);
    }
    const byCreatedAtDesc = (a: Transaction, b: Transaction) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    pengeluaran.sort(byCreatedAtDesc);
    pemasukan.sort(byCreatedAtDesc);
    return { pengeluaran, pemasukan };
  }, [transactions]);

  const todayTotals = useMemo(() => {
    const sum = (list: Transaction[]) =>
      list.reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
    return {
      pengeluaran: sum(todayTransactions.pengeluaran),
      pemasukan: sum(todayTransactions.pemasukan),
    };
  }, [todayTransactions]);

  const [showTodayList, setShowTodayList] = useState(false);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(d);
  const getAccountName = (id?: string) => accounts.find((a) => a.id === id)?.name || "-";

  const { ctx } = useQuickContext(uid, accounts, transactions);
  const today = toLocalDateString();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDateString(d); })();

  // Isi form dari ketik pintar / suara / foto struk — tidak langsung disimpan.
  const applyDraft = (draft: QuickDraft, source: DraftSource, info?: string) => {
    if (draft.type) setType(draft.type);
    if (draft.amount) {
      setAmount(String(draft.amount));
      void amountControls.start({ scale: [1, 1.12, 1], transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } });
    }
    if (draft.accountId && accounts.some((a) => a.id === draft.accountId)) setAccountId(draft.accountId);
    if (draft.category) { setCategory(draft.category); setSubCategory(draft.subCategory ?? ""); }
    if (draft.note) setNote(draft.note);
    if (draft.date) { setDate(draft.date === today ? null : draft.date); setShowDatePicker(false); }
    setHint({ source, text: info });
  };

  const saved = (id: string, label: string) => {
    setUndoItem({ id, label });
    // Reset field yang berubah-ubah; sisakan type/akun/kategori untuk input cepat berikutnya.
    setAmount("");
    setNote("");
    setDate(null);
    setShowDatePicker(false);
    setHint(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      // quickTxService: transaksi + saldo atomik di server, lalu memberi tahu
      // halaman lain (Rekening, Kartu Saya, dst) supaya langsung ter-update.
      const res = await quickTxService.create({
        type,
        amount: amountNumber,
        accountId: selectedAccount.id ?? "",
        category,
        subCategory,
        note,
        ...(date ? { date } : {}),
      });
      saved(res.id, `${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} ${res.currency} ${groupDigits(amount)} · ${res.matchedAccount}`);
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Gagal menyimpan transaksi." });
    } finally {
      setSubmitting(false);
    }
  };

  if (authState === "loading") {
    return (
      <>
        <SplashScreen ready={false} userName={profile?.name} userPhoto={profile?.photoURL} />
      </>
    );
  }

  if (authState === "unauth") {
    return (
      <>
        <SplashScreen ready userName={profile?.name} userPhoto={profile?.photoURL} />
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Masuk dulu</h1>
            <p className="text-sm font-medium text-slate-400 mt-1 max-w-xs">
              Login sekali di sini, setelah itu Input Cepat langsung siap dipakai dari layar utama.
            </p>
          </div>
          <Link
            href="/auth/login?next=/input-cepat"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <LogIn size={16} /> Masuk ke Leosiqra
          </Link>
          <InputCepatInstall />
        </div>
      </>
    );
  }

  return (
    <>
      <SplashScreen ready userName={profile?.name} userPhoto={profile?.photoURL} />
      <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="stagger-in w-full max-w-md mx-auto px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-36 flex-1">
        {/* Header ringkas: profil + total hari ini (tap = rincian). */}
        <div className="flex items-center gap-3">
          <Link href="/membership/profile" className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-indigo-600 shrink-0 overflow-hidden">
              <LogoImage
                src={profile?.photoURL}
                alt={profile?.name || "Profil"}
                fallbackText={(profile?.name || "U").slice(0, 1).toUpperCase()}
                fallbackIcon={<Wallet size={18} className="text-white" />}
                className="w-full h-full object-cover text-white"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 leading-tight">Input Cepat</h1>
              <p className="text-[11px] font-bold text-slate-400 truncate">{profile?.name ? `Halo, ${profile.name.split(" ")[0]}` : "Leosiqra"}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setShowTodayList(true)}
            className={cn(
              "shrink-0 text-right rounded-2xl px-3 py-1.5 border active:scale-95 transition-transform",
              type === "pengeluaran" ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
            )}
          >
            <span className={cn("block text-[9px] font-black uppercase tracking-wider", type === "pengeluaran" ? "text-rose-400" : "text-emerald-500")}>
              {type === "pengeluaran" ? "Keluar" : "Masuk"} hari ini
            </span>
            <span className={cn("block text-sm font-black tabular-nums", type === "pengeluaran" ? "text-rose-600" : "text-emerald-700")}>
              {formatRp(type === "pengeluaran" ? todayTotals.pengeluaran : todayTotals.pemasukan)}
            </span>
          </button>
        </div>

        {/* Ketik pintar / suara / foto struk — mengisi form di bawah. */}
        <SmartBar ctx={ctx} onDraft={applyDraft} className="mt-5" />
        {hint && (
          <div className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3.5 py-2.5 mt-2 text-[11px] font-bold text-indigo-700">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            <span>
              Terisi dari {hint.source === "voice" ? "suara" : hint.source === "scan" ? "foto struk" : "teks"} — cek lalu simpan.
              {hint.text ? <span className="block font-medium text-amber-600">{hint.text}</span> : null}
            </span>
          </div>
        )}

        {/* Kartu utama: jenis, nominal, tanggal */}
        <div className="mt-4 bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100">
            {([["pengeluaran", "Pengeluaran", ArrowDownCircle, "bg-rose-500"], ["pemasukan", "Pemasukan", ArrowUpCircle, "bg-emerald-500"]] as const).map(
              ([value, label, Icon, active]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-300",
                    type === value ? "text-white" : "text-slate-500"
                  )}
                >
                  {/* Pil warna meluncur ke jenis terpilih. */}
                  {type === value && (
                    <motion.span
                      layoutId="qc-type-pill"
                      className={cn("absolute inset-0 rounded-xl shadow-sm", active)}
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5"><Icon size={14} /> {label}</span>
                </button>
              )
            )}
          </div>

          <div className="pt-6 pb-4 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nominal</p>
            <motion.div animate={amountControls} className="mt-1 flex items-baseline justify-center gap-2">
              <span className="text-xl font-black text-slate-300">{selectedAccount?.currency ?? "IDR"}</span>
              <NumberInput
                autoFocus
                value={amount}
                onChange={setAmount}
                placeholder="0"
                aria-label="Nominal"
                // Lebar mengikuti panjang angka supaya kode mata uang menempel di depannya.
                style={{ width: `${Math.max(1, groupDigits(amount).length) + 0.5}ch` }}
                className={cn(
                  "max-w-[75%] min-w-0 text-4xl font-black bg-transparent outline-none placeholder:text-slate-200 tabular-nums text-left",
                  type === "pengeluaran" ? "text-rose-600" : "text-emerald-600"
                )}
              />
            </motion.div>
          </div>

          {/* Tanggal — default hari ini; kemarin/tanggal lain untuk yang lupa dicatat. */}
          <div className="flex items-center justify-center gap-2">
            {([[null, "Hari ini"], [yesterday, "Kemarin"]] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => { setDate(value); setShowDatePicker(false); }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[11px] font-bold border",
                  date === value ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500"
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              aria-label="Pilih tanggal lain"
              className={cn(
                "h-[30px] shrink-0 rounded-full border flex items-center justify-center gap-1.5 px-3 text-[11px] font-bold",
                showDatePicker || (date !== null && date !== yesterday) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500"
              )}
            >
              <CalendarDays size={13} />
              {date !== null && date !== yesterday ? date.split("-").reverse().join("/") : null}
            </button>
          </div>
          {showDatePicker && (
            <input
              type="date"
              value={date ?? today}
              max={today}
              onChange={(e) => setDate(e.target.value && e.target.value !== today ? e.target.value : null)}
              aria-label="Tanggal"
              className="w-full mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
            />
          )}
        </div>

        {/* Kartu detail: rekening, kategori, catatan dalam satu daftar. */}
        <div className="mt-3 bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          {/* Akun — dropdown: cuma rekening terpilih yang tampil, tap untuk buka pilihan lain. */}
          <div className="p-4 relative" ref={accountPickerRef}>
            <p className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <Wallet size={12} /> {type === "pengeluaran" ? "Dari rekening" : "Masuk ke rekening"}
            </p>
            {accounts.length === 0 ? (
              <p className="text-xs font-medium text-slate-400">
                Belum ada rekening.{" "}
                <Link href="/membership/rekening" className="text-indigo-600 font-bold underline">Buat dulu</Link>.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((o) => !o)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  {selectedAccount ? (
                    <>
                      <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-white">
                        <LogoImage
                          src={selectedAccount.logoUrl}
                          alt={selectedAccount.name}
                          fallbackText={selectedAccount.name.slice(0, 2).toUpperCase()}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 truncate">{selectedAccount.name}</p>
                        <p className="text-[11px] font-bold text-slate-400 tabular-nums">
                          {isCreditAccountType(selectedAccount.type)
                            ? `Sisa limit ${formatBalance(creditUsageByAccount.get(selectedAccount.id ?? "")?.remaining ?? 0, selectedAccount.currency)}`
                            : `Saldo ${formatBalance(selectedAccount.balance || 0, selectedAccount.currency)}`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="flex-1 text-sm font-bold text-slate-400">Pilih rekening</span>
                  )}
                  <ChevronDown size={16} className={cn("text-slate-400 shrink-0 transition-transform", isAccountOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isAccountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute left-3 right-3 top-full -mt-1 z-20 bg-white border border-slate-100 rounded-2xl shadow-xl p-1.5 max-h-72 overflow-y-auto"
                    >
                      {accounts.map((a) => {
                        const isSelected = a.id === accountId;
                        const isCredit = isCreditAccountType(a.type);
                        const creditUsage = a.id ? creditUsageByAccount.get(a.id) : undefined;
                        const displayAmount = isCredit ? (creditUsage?.remaining ?? 0) : (a.balance || 0);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setAccountId(a.id || "");
                              setIsAccountOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-xl p-2.5 transition-colors text-left",
                              isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-white">
                              <LogoImage
                                src={a.logoUrl}
                                alt={a.name}
                                fallbackText={a.name.slice(0, 2).toUpperCase()}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="min-w-0 flex-1 text-sm font-bold text-slate-800 truncate">{a.name}</p>
                            <div className="text-right shrink-0">
                              <p className={cn("text-xs font-black tabular-nums", isCredit ? "text-emerald-600" : "text-slate-600")}>
                                {formatBalance(displayAmount, a.currency)}
                              </p>
                              {isCredit && <p className="text-[9px] font-bold text-slate-400">Sisa limit</p>}
                            </div>
                            {isSelected && <Check size={15} className="text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Kategori — picker yang sama dengan Input Harian, supaya daftar
              kategori & sub-kategorinya konsisten di seluruh aplikasi. */}
          <div className="p-4">
            <CategorySelect
              label="Kategori"
              type={type === "pengeluaran" ? "expense" : "income"}
              value={category}
              onChange={setCategory}
              onSubCategoryChange={setSubCategory}
              subValue={subCategory}
              showBadge={false}
            />
            <Link href="/membership/nama-akun" className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 mt-2 pl-1">
              Kelola kategori <ExternalLink size={10} />
            </Link>
          </div>

          <label className="flex items-center gap-3 px-4 py-3.5">
            <StickyNote size={16} className="text-slate-300 shrink-0" />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)"
              aria-label="Catatan"
              className="flex-1 min-w-0 text-sm font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-300 placeholder:font-medium"
            />
          </label>
        </div>

        <InputCepatInstall />
      </div>

      {/* Tombol simpan — sticky di bawah, warna mengikuti jenis transaksi. */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)] px-5">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-[0.99]",
              !canSubmit
                ? "bg-slate-200 text-slate-400 shadow-none"
                : type === "pengeluaran"
                  ? "bg-rose-500 text-white shadow-rose-200"
                  : "bg-emerald-500 text-white shadow-emerald-200"
            )}
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Menyimpan…</>
            ) : (
              <>
                <Check size={16} /> Simpan {type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}
                {amountNumber > 0 ? ` ${selectedAccount?.currency ?? ""} ${groupDigits(amount)}` : ""}
              </>
            )}
          </button>
          {!canSubmit && amountNumber > 0 && !category && (
            <p className="mt-2 text-center text-[11px] font-bold text-slate-400">Pilih kategori dulu</p>
          )}
        </div>
      </div>

      <UndoToast item={undoItem} onUndo={(item) => quickTxService.undo(item.id)} onDone={() => setUndoItem(null)} />

      {/* Popup notifikasi hasil simpan — menggantikan banner inline supaya
          lebih kelihatan di layar kecil dan tidak mendorong-dorong layout. */}
      <AnimatePresence>
        {feedback && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-5 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.35 }}
              className="relative pointer-events-auto w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-3"
            >
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shrink-0",
                  feedback.ok ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}
              >
                {feedback.ok ? <Check size={26} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">
                  {feedback.ok ? "Tersimpan!" : "Gagal Menyimpan"}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">{feedback.msg}</p>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rincian transaksi hari ini — daftar ini dihitung dari sumber data yang
          SAMA dengan kartu total di atas (todayTransactions), jadi angka total
          dan daftarnya dijamin selalu cocok. */}
      <Modal
        isOpen={showTodayList}
        onClose={() => setShowTodayList(false)}
        title={`${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} Hari Ini`}
        maxWidth="max-w-md"
      >
        {(() => {
          const list = type === "pengeluaran" ? todayTransactions.pengeluaran : todayTransactions.pemasukan;
          if (list.length === 0) {
            return (
              <p className="text-sm font-medium text-slate-400 text-center py-6">
                Belum ada {type === "pengeluaran" ? "pengeluaran" : "pemasukan"} hari ini.
              </p>
            );
          }
          return (
            <div className="space-y-2">
              {list.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {t.subCategory || t.category || "-"}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {formatTime(new Date(t.createdAt))} · {getAccountName(t.accountId)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-black shrink-0",
                      type === "pengeluaran" ? "text-rose-600" : "text-emerald-700"
                    )}
                  >
                    {type === "pengeluaran" ? "-" : "+"} {formatBalance(t.amount, t.currency || "IDR")}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                <span className="text-xs font-black text-slate-500">Total</span>
                <span
                  className={cn(
                    "text-sm font-black",
                    type === "pengeluaran" ? "text-rose-600" : "text-emerald-700"
                  )}
                >
                  {formatRp(type === "pengeluaran" ? todayTotals.pengeluaran : todayTotals.pemasukan)}
                </span>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
    </>
  );
}

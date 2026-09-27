"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Receipt } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR, formatMoney, isIncomingTransaction, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { TransactionDetailSheet } from "@/components/app/transactions/TransactionDetailSheet";
import { txKind, txTitle, toIdr } from "@/components/app/transactions/txDisplay";

const FILTERS = ["Semua", "Masuk", "Keluar", "Transfer"] as const;

// Ringkasan bulan di kartu sempit: "Rp 15 jt", "Rp 165 rb" — angka penuh
// tetap tersedia lewat title/tooltip.
const compactIDR = (n: number) =>
  `${n < 0 ? "−" : ""}Rp ${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(n))}`;
type Filter = typeof FILTERS[number];

export default function AppTransactionsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState<Filter>("Semua");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const loadTx = () => transactionService.getUserTransactions(uid).then(setTransactions).catch(() => setTransactions([]));
    const loadAcc = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    loadTx();
    loadAcc();
    const u1 = subscribeToCollectionChanges("transactions", loadTx);
    const u2 = subscribeToCollectionChanges("accounts", loadAcc);
    return () => { u1(); u2(); };
  }, []);

  const accountName = (id?: string) =>
    id === "Wallet" ? "E-Wallet luar" : accounts.find((a) => a.id === id)?.name || "";

  // Catatan Hutang/Piutang (type "debt") bukan arus uang — punya halamannya sendiri.
  const monthTx = useMemo(
    () =>
      (transactions ?? []).filter((t) => {
        if (t.type === "debt") return false;
        const d = new Date(t.date);
        return d.getMonth() === month && d.getFullYear() === year;
      }),
    [transactions, month, year]
  );

  const summary = useMemo(() => {
    const masuk = monthTx.filter((t) => t.type === "pemasukan").reduce((s, t) => s + toIdr(t), 0);
    const keluar = monthTx.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + toIdr(t), 0);
    return { masuk, keluar, net: masuk - keluar };
  }, [monthTx]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTx
      .filter((t) => {
        const kind = txKind(t);
        if (filter === "Masuk" && kind !== "in") return false;
        if (filter === "Keluar" && kind !== "out") return false;
        if (filter === "Transfer" && kind !== "transfer") return false;
        if (!q) return true;
        return `${t.note ?? ""} ${t.category ?? ""} ${t.subCategory ?? ""} ${accountName(t.accountId)}`.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthTx, filter, query, accounts]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of visible) {
      const key = toLocalDateString(new Date(t.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [visible]);

  const shiftMonth = (delta: number) => {
    lightTap();
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  const today = toLocalDateString();
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
  const dayLabel = (key: string) => {
    if (key === today) return "Hari ini";
    if (key === yesterday) return "Kemarin";
    const [y, m, d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Transaksi</h1>
        <button
          type="button"
          onClick={() => { lightTap(); setSearchOpen((v) => !v); if (searchOpen) setQuery(""); }}
          aria-label={searchOpen ? "Tutup pencarian" : "Cari transaksi"}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500"
        >
          {searchOpen ? <X size={18} /> : <Search size={18} />}
        </button>
      </FadeIn>

      {searchOpen && (
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari catatan, kategori, rekening..."
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
        />
      )}

      {/* Bulan + ringkasan */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5 shadow-lg shadow-indigo-200/50 dark:shadow-none">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-black capitalize">{monthLabel}</p>
          <button type="button" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Bulan berikutnya" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Masuk", summary.masuk, "text-emerald-200"],
            ["Keluar", summary.keluar, "text-rose-200"],
            ["Net", summary.net, summary.net < 0 ? "text-rose-200" : "text-white"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="rounded-2xl bg-white/10 px-2 py-2.5 min-w-0">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{label}</p>
              <p className={cn("text-sm font-black tabular-nums truncate", cls as string)} title={formatIDR(value as number)}>{compactIDR(value as number)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { lightTap(); setFilter(f); }}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-colors",
              filter === f
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Daftar per hari */}
      {transactions === null ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <Receipt size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">
            {query || filter !== "Semua" ? "Tidak ada yang cocok" : "Belum ada transaksi di bulan ini"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Tap tombol + untuk mencatat.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, items]) => {
            const dayNet = items.reduce((s, t) => {
              const k = txKind(t);
              return k === "in" ? s + toIdr(t) : k === "out" ? s - toIdr(t) : s;
            }, 0);
            return (
              <section key={day}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 capitalize">{dayLabel(day)}</h2>
                  {dayNet !== 0 && (
                    <span className={cn("text-xs font-black tabular-nums", dayNet > 0 ? "text-emerald-600" : "text-rose-500")}>
                      {dayNet > 0 ? "+" : "−"}{formatIDR(Math.abs(dayNet))}
                    </span>
                  )}
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {items.map((t) => {
                    const kind = txKind(t);
                    const incoming = isIncomingTransaction(t);
                    const Icon = kind === "in" ? ArrowUpCircle : kind === "out" ? ArrowDownCircle : ArrowLeftRight;
                    const subtitle =
                      kind === "transfer"
                        ? `${incoming ? "Masuk ke" : "Dari"} ${accountName(t.accountId)}`
                        : [t.subCategory || t.category, accountName(t.accountId)].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { lightTap(); setSelected(t); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                      >
                        <span
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            kind === "in" && "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            kind === "out" && "bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400",
                            kind === "transfer" && "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          )}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{txTitle(t)}</span>
                          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">{subtitle}</span>
                        </span>
                        <span
                          className={cn(
                            "text-sm font-black tabular-nums shrink-0",
                            kind === "in" ? "text-emerald-600" : kind === "out" ? "text-rose-500" : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {kind === "transfer" ? (incoming ? "+" : "−") : kind === "in" ? "+" : "−"}
                          {formatMoney(t.amount, t.currency || "IDR")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TransactionDetailSheet tx={selected} accounts={accounts} onClose={() => setSelected(null)} />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Repeat, Pause, Play, Trash2, AlertTriangle } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { recurringService, RecurringTransaction } from "@/lib/services/recurringService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR, formatMoney, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { RecurringSheet } from "@/components/app/recurring/RecurringSheet";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);
const PER_MONTH: Record<string, number> = { Harian: 30, Mingguan: 52 / 12, Bulanan: 1, Tahunan: 1 / 12 };
const TYPE_STYLE: Record<string, string> = {
  Pemasukan: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Pengeluaran: "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400",
  Tabungan: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
};

export default function AppRecurringPage() {
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const load = () => recurringService.getUserRecurring(uid).then(setItems).catch(() => setItems([]));
    const loadAcc = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    load();
    loadAcc();
    transactionService.getUserTransactions(uid).then(setTransactions).catch(() => {});
    const u1 = subscribeToCollectionChanges("recurring", load);
    const u2 = subscribeToCollectionChanges("accounts", loadAcc);
    return () => { u1(); u2(); };
  }, []);

  const categories = useMemo(() => {
    const pick = (type: string) => [...new Set(transactions.filter((t) => t.type === type).map((t) => t.category))]
      .filter((c): c is string => Boolean(c) && c !== "Hutang" && c !== "Piutang")
      .slice(0, 20);
    return { Pengeluaran: pick("pengeluaran"), Pemasukan: pick("pemasukan") };
  }, [transactions]);

  const today = toLocalDateString();
  const list = [...(items ?? [])].sort((a, b) =>
    (a.status === "PAUSED" ? 1 : 0) - (b.status === "PAUSED" ? 1 : 0) || new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime()
  );
  const account = (id: string) => accounts.find((a) => a.id === id);
  // Perkiraan arus per bulan (IDR hanya untuk rekening IDR; lainnya dilewati).
  const monthly = (type: string) =>
    list
      .filter((r) => r.status !== "PAUSED" && r.type === type && (account(r.accountId)?.currency || "IDR") === "IDR")
      .reduce((s, r) => s + r.amount * (PER_MONTH[r.interval] ?? 1), 0);
  const outMonthly = monthly("Pengeluaran") + monthly("Tabungan");
  const inMonthly = monthly("Pemasukan");

  const openSheet = (item: RecurringTransaction | null) => { lightTap(); setEditing(item); setSheetOpen(true); };

  const toggle = async (r: RecurringTransaction) => {
    if (!r.id) return;
    setBusyId(r.id);
    setError("");
    try {
      await recurringService.updateRecurring(r.id, { status: r.status === "PAUSED" ? "ACTIVE" : "PAUSED" });
      lightTap();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal mengubah status.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: RecurringTransaction) => {
    if (!r.id) return;
    if (confirmId !== r.id) { lightTap(); setConfirmId(r.id); return; }
    setBusyId(r.id);
    setError("");
    try {
      await recurringService.deleteRecurring(r.id);
      lightTap();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menghapus.");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Transaksi Rutin</h1>
        </div>
        <button type="button" onClick={() => openSheet(null)} className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-xs font-black px-3.5 py-2">
          <Plus size={14} /> Jadwal
        </button>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Keluar / bulan</p>
          <p className="mt-1 text-base font-black text-rose-500 tabular-nums truncate">{formatIDR(outMonthly)}</p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Masuk / bulan</p>
          <p className="mt-1 text-base font-black text-emerald-600 tabular-nums truncate">{formatIDR(inMonthly)}</p>
        </div>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

      {items === null ? (
        <div className="space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <Repeat size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">Belum ada jadwal</p>
          <p className="text-xs text-slate-400 mt-1">Catat otomatis tagihan rutin, gaji, atau setoran tabungan.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const paused = r.status === "PAUSED";
            const next = toLocalDateString(new Date(r.nextDate));
            const stuck = !paused && next < today;
            const acc = account(r.accountId);
            return (
              <li key={r.id} className={cn("rounded-2xl bg-white dark:bg-slate-900 border p-4", stuck ? "border-amber-200 dark:border-amber-500/30" : "border-slate-100 dark:border-slate-800", paused && "opacity-60")}>
                <button type="button" onClick={() => openSheet(r)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{r.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase mr-1.5", TYPE_STYLE[r.type] ?? "bg-slate-100 text-slate-500")}>{r.type}</span>
                        {r.category} · {acc?.name ?? "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatMoney(r.amount, acc?.currency || "IDR")}</p>
                      <p className="text-[10px] text-slate-400">{r.interval}</p>
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className={cn("text-[11px] font-bold", stuck ? "text-amber-600 flex items-center gap-1" : "text-slate-500")}>
                    {stuck && <AlertTriangle size={12} />}
                    {paused ? "Dijeda" : stuck ? `Terlewat ${fmtDate(new Date(r.nextDate))} — tap untuk ubah tanggal` : `Berikutnya ${fmtDate(new Date(r.nextDate))}`}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => toggle(r)} disabled={busyId === r.id} aria-label={paused ? "Aktifkan" : "Jeda"} className="p-2 rounded-full text-slate-400 disabled:opacity-40">
                      {paused ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busyId === r.id}
                      aria-label={confirmId === r.id ? "Yakin hapus jadwal" : "Hapus jadwal"}
                      className={cn("rounded-full text-[11px] font-black disabled:opacity-40", confirmId === r.id ? "bg-rose-500 text-white px-3 py-1.5" : "p-2 text-slate-400")}
                    >
                      {confirmId === r.id ? "Hapus?" : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RecurringSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} accounts={accounts} categories={categories} editing={editing} />
    </div>
  );
}

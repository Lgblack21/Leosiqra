"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PiggyBank, ArrowDownToLine, Plus, Trash2, Repeat } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { savingsService, Saving } from "@/lib/services/savingsService";
import { savingsGoalService, SavingsGoal } from "@/lib/services/savingsGoalService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR, formatMoney } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SavingsSheet, SavingsMode } from "@/components/app/savings/SavingsSheet";

// Saldo tabungan = akumulasi semua setoran − penarikan (amountIDR), sama
// dengan halaman web Tabungan & kartu Tabungan di Dashboard.
const toIdr = (s: Saving) => Number(s.amountIDR) || Number(s.amount) || 0;
const signed = (s: Saving) => (s.transactionType === "Penarikan" ? -toIdr(s) : toIdr(s));
const fmtDate = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default function AppSavingsPage() {
  const [savings, setSavings] = useState<Saving[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [sheet, setSheet] = useState<{ mode: SavingsMode; category?: string } | null>(null);
  const [selected, setSelected] = useState<Saving | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const loadSavings = () => savingsService.getUserSavings(uid).then(setSavings).catch(() => setSavings([]));
    const loadAcc = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    const loadGoals = () => savingsGoalService.getUserSavingsGoals().then(setGoals).catch(() => setGoals([]));
    loadSavings();
    loadAcc();
    loadGoals();
    const u1 = subscribeToCollectionChanges("savings", () => { loadSavings(); loadGoals(); });
    const u2 = subscribeToCollectionChanges("accounts", loadAcc);
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(() => savings ?? [], [savings]);
  const total = useMemo(() => all.reduce((sum, s) => sum + signed(s), 0), [all]);
  const goalBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of all) {
      const key = s.category || "Lainnya";
      map.set(key, (map.get(key) ?? 0) + signed(s));
    }
    return map;
  }, [all]);
  const pos = [...goalBalances.entries()].filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => b[1] - a[1]);

  const now = new Date();
  const thisMonth = all.filter((s) => s.date.getFullYear() === now.getFullYear() && s.date.getMonth() === now.getMonth());
  const monthIn = thisMonth.filter((s) => s.transactionType !== "Penarikan").reduce((a, s) => a + toIdr(s), 0);
  const monthOut = thisMonth.filter((s) => s.transactionType === "Penarikan").reduce((a, s) => a + toIdr(s), 0);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || (id && id !== "General" ? id : "—");
  const targetFor = (category: string) => goals.find((g) => g.category === category && g.targetAmount);

  const openSheet = (mode: SavingsMode, category?: string) => { lightTap(); setSheet({ mode, category }); };
  const closeDetail = () => { setSelected(null); setConfirmDelete(false); setError(""); };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirmDelete) { lightTap(); setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await savingsService.deleteSaving(selected);
      lightTap();
      closeDetail();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Tabungan</h1>
      </FadeIn>

      <FadeIn delay={0.05} className="rounded-3xl bg-gradient-to-br from-rose-500 to-pink-500 text-white p-5 shadow-lg shadow-rose-200/50 dark:shadow-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Saldo tabungan</p>
        <p className="mt-1 text-3xl font-black tabular-nums">
          <AnimatedNumber value={total} format={formatIDR} />
        </p>
        <p className="mt-1 text-[11px] text-white/80 tabular-nums">
          Bulan ini +{formatIDR(monthIn)} · −{formatIDR(monthOut)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => openSheet("Setoran")} className="flex items-center justify-center gap-1.5 rounded-2xl bg-white text-rose-600 text-xs font-black py-3 active:scale-[0.98] transition-transform">
            <Plus size={15} /> Setor
          </button>
          <button type="button" onClick={() => openSheet("Penarikan")} className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/20 text-white text-xs font-black py-3 active:scale-[0.98] transition-transform">
            <ArrowDownToLine size={15} /> Tarik
          </button>
        </div>
      </FadeIn>

      <section>
        <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Pos tabungan</h2>
        {savings === null ? (
          <div className="grid grid-cols-2 gap-3 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
        ) : pos.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 text-center">
            <PiggyBank size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">Belum ada tabungan</p>
            <p className="text-xs text-slate-400 mt-1">Mulai dengan setoran pertama, mis. Dana Darurat.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {pos.map(([category, balance]) => {
              const goal = targetFor(category);
              const pct = goal?.targetAmount ? Math.min(100, Math.max(0, (balance / goal.targetAmount) * 100)) : null;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => openSheet("Setoran", category)}
                  className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 active:scale-[0.98] transition-transform"
                >
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{category}</p>
                  <p className={cn("mt-1 text-sm font-black tabular-nums truncate", balance < 0 ? "text-rose-500" : "text-slate-900 dark:text-white")}>{formatIDR(balance)}</p>
                  {pct !== null && goal?.targetAmount ? (
                    <>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400 tabular-nums">{pct.toFixed(0)}% dari {formatIDR(goal.targetAmount)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-400">Tap untuk setor</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {goals.length > 0 && (
        <section>
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Setoran otomatis</h2>
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0"><Repeat size={16} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{g.name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {g.status === "PAUSED" ? "Dijeda" : `${formatIDR(g.monthlyAmount)} / ${g.interval.toLowerCase()} · berikutnya ${fmtDate(new Date(g.nextDate))}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Riwayat</h2>
        {all.length === 0 ? (
          <p className="text-xs text-slate-400 px-1">Belum ada riwayat.</p>
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {all.slice(0, 50).map((s) => {
              const tarik = s.transactionType === "Penarikan";
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => { lightTap(); setSelected(s); }} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s.description || s.category}</span>
                      <span className="block text-[11px] text-slate-400 truncate">{s.category} · {fmtDate(s.date)}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-black tabular-nums", tarik ? "text-rose-500" : "text-emerald-600")}>
                      {tarik ? "−" : "+"}{formatMoney(Number(s.amount) || 0, s.currency || "IDR")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SavingsSheet
        isOpen={sheet !== null}
        onClose={() => setSheet(null)}
        accounts={accounts}
        goalBalances={goalBalances}
        initialMode={sheet?.mode ?? "Setoran"}
        initialCategory={sheet?.category}
      />

      <BottomSheet isOpen={selected !== null} onClose={closeDetail} title={selected?.transactionType === "Penarikan" ? "Detail Penarikan" : "Detail Setoran"}>
        {selected && (
          <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-5">
              <p className="text-xs font-bold text-slate-400">{selected.description || selected.category}</p>
              <p className={cn("mt-1 text-3xl font-black tabular-nums", selected.transactionType === "Penarikan" ? "text-rose-500" : "text-emerald-600")}>
                {selected.transactionType === "Penarikan" ? "−" : "+"}{formatMoney(Number(selected.amount) || 0, selected.currency || "IDR")}
              </p>
              <dl className="mt-3 space-y-1.5 text-xs">
                {[
                  ["Pos", selected.category || "—"],
                  [selected.transactionType === "Penarikan" ? "Masuk ke" : "Dari", accountName(selected.fromAccount)],
                  ["Tanggal", fmtDate(selected.date)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="font-bold text-slate-700 dark:text-slate-200 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-colors disabled:opacity-40",
                confirmDelete ? "bg-rose-500 text-white" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <Trash2 size={15} /> {busy ? "Menghapus..." : confirmDelete ? "Yakin hapus?" : "Hapus catatan"}
            </button>
            {confirmDelete && (
              <p className="text-[11px] text-center text-slate-500">
                {accounts.some((a) => a.id === selected.fromAccount) ? `Saldo ${accountName(selected.fromAccount)} akan dikembalikan. ` : ""}Tap lagi untuk menghapus.
              </p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

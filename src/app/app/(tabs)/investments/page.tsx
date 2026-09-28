"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, Landmark, LineChart, Layers, Plus } from "lucide-react";
import { investmentService, Investment } from "@/lib/services/investmentService";
import { accountService, Account } from "@/lib/services/accountService";
import { AddInvestmentSheet } from "@/components/app/investments/AddInvestmentSheet";
import { InvestmentDetailSheet } from "@/components/app/investments/InvestmentDetailSheet";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR, formatMoney } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";

// Rumus ringkasan SAMA dengan halaman web Investasi (/membership/investment):
// semua posisi (kecuali proyeksi "Planned", sudah difilter service) dijumlah
// dalam IDR via amountIDR/currentValueIDR.
const idrInvested = (i: Investment) => Number(i.amountIDR) || Number(i.amountInvested) || 0;
const idrCurrent = (i: Investment) => Number(i.currentValueIDR) || Number(i.currentValue) || 0;
const fmtDate = (d: Date) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);

const GROUPS = [
  { key: "Saham", label: "Saham", icon: LineChart, bar: "bg-emerald-600" },
  { key: "Deposito", label: "Deposito", icon: Landmark, bar: "bg-blue-500" },
  { key: "Lainnya", label: "Lainnya", icon: Layers, bar: "bg-slate-400" },
] as const;
const groupOf = (i: Investment) => (i.type === "Saham" || i.type === "Deposito" ? i.type : "Lainnya");

export default function AppInvestmentsPage() {
  const [items, setItems] = useState<Investment[] | null>(null);
  const [filter, setFilter] = useState<string>("Semua");
  const [status, setStatus] = useState<"Aktif" | "Selesai">("Aktif");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const load = () => investmentService.getUserInvestments(uid).then(setItems).catch(() => setItems([]));
    const loadAcc = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    load();
    loadAcc();
    const u1 = subscribeToCollectionChanges("investments", load);
    const u2 = subscribeToCollectionChanges("accounts", loadAcc);
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(() => items ?? [], [items]);
  const modal = all.reduce((s, i) => s + idrInvested(i), 0);
  const aset = all.reduce((s, i) => s + idrCurrent(i), 0);
  const gain = aset - modal;
  const roi = modal > 0 ? (gain / modal) * 100 : 0;
  const alloc = GROUPS.map((g) => ({ ...g, value: all.filter((i) => groupOf(i) === g.key).reduce((s, i) => s + idrCurrent(i), 0) }));
  const visible = all
    .filter((i) => (status === "Aktif" ? i.status !== "Closed" : i.status === "Closed"))
    .filter((i) => filter === "Semua" || groupOf(i) === filter)
    .sort((a, b) => idrCurrent(b) - idrCurrent(a));

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="flex-1 text-xl font-black text-slate-900 dark:text-white">Investasi</h1>
        <button type="button" onClick={() => { lightTap(); setAdding(true); }} className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-xs font-black px-3.5 py-2">
          <Plus size={14} /> Tambah
        </button>
      </FadeIn>

      <FadeIn delay={0.05} className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-5 shadow-lg shadow-blue-200/50 dark:shadow-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Nilai portofolio</p>
        <p className="mt-1 text-3xl font-black tabular-nums"><AnimatedNumber value={aset} format={formatIDR} /></p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tabular-nums">
          <span className={cn("flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1", gain >= 0 ? "bg-emerald-400/25" : "bg-rose-400/30")}>
            {gain >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {gain >= 0 ? "+" : "−"}{formatIDR(Math.abs(gain))} ({roi >= 0 ? "+" : ""}{roi.toFixed(2)}%)
          </span>
          <span className="text-white/75">modal {formatIDR(modal)}</span>
        </div>
        {aset > 0 && (
          <>
            <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-white/20">
              {alloc.filter((a) => a.value > 0).map((a) => (
                <div key={a.key} className={a.bar} style={{ width: `${(a.value / aset) * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/85">
              {alloc.filter((a) => a.value > 0).map((a) => (
                <span key={a.key} className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", a.bar)} /> {a.label} {Math.round((a.value / aset) * 100)}%
                </span>
              ))}
            </div>
          </>
        )}
      </FadeIn>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
        {(["Aktif", "Selesai"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { lightTap(); setStatus(s); }}
            className={cn("py-2 rounded-xl text-xs font-black transition-colors", status === s ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}
          >
            {s === "Aktif" ? "Aktif" : "Selesai / terjual"}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {["Semua", ...GROUPS.map((g) => g.key)].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { lightTap(); setFilter(f); }}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-xs font-black border",
              filter === f ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <TrendingUp size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">Belum ada investasi</p>
        </div>
      ) : (
        <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map((i) => {
            const invested = Number(i.amountInvested) || 0;
            const current = Number(i.currentValue) || 0;
            const diff = current - invested;
            const pct = invested > 0 ? (diff / invested) * 100 : 0;
            const currency = i.currency || "IDR";
            const isDeposit = i.type === "Deposito";
            return (
              <li key={i.id}>
                <button type="button" onClick={() => { lightTap(); setSelectedId(i.id ?? null); }} className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{i.stockCode ? `${i.stockCode} · ` : ""}{i.name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {i.platform || i.type}
                    {i.transactionType ? ` · ${i.transactionType}` : ""}
                    {isDeposit && i.targetDate ? ` · jatuh tempo ${fmtDate(i.targetDate)}` : ""}
                    {isDeposit && i.returnPercentage ? ` · ${i.returnPercentage}%/th` : ""}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatMoney(current, currency)}</span>
                  {invested > 0 && Math.abs(diff) >= 0.005 && (
                    <span className={cn("block text-[11px] font-bold tabular-nums", diff >= 0 ? "text-emerald-600" : "text-rose-500")}>
                      {diff >= 0 ? "+" : ""}{pct.toFixed(2)}%
                    </span>
                  )}
                </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AddInvestmentSheet
        isOpen={adding}
        onClose={() => setAdding(false)}
        accounts={accounts}
        initialKind={filter === "Deposito" || filter === "Lainnya" ? filter : "Saham"}
      />
      {/* Ambil versi terbaru dari daftar supaya detail ikut ter-update setelah jual/cairkan. */}
      {selectedId && (
        <InvestmentDetailSheet
          inv={all.find((i) => i.id === selectedId) ?? null}
          accounts={accounts}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

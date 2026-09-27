"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, ExternalLink, Landmark, LineChart, Layers } from "lucide-react";
import { investmentService, Investment } from "@/lib/services/investmentService";
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
  { key: "Saham", label: "Saham", icon: LineChart, bar: "bg-emerald-600", web: "/membership/investasi/saham" },
  { key: "Deposito", label: "Deposito", icon: Landmark, bar: "bg-blue-500", web: "/membership/investasi/deposito" },
  { key: "Lainnya", label: "Lainnya", icon: Layers, bar: "bg-slate-400", web: "/membership/investasi/lainnya" },
] as const;
const groupOf = (i: Investment) => (i.type === "Saham" || i.type === "Deposito" ? i.type : "Lainnya");

export default function AppInvestmentsPage() {
  const [items, setItems] = useState<Investment[] | null>(null);
  const [filter, setFilter] = useState<string>("Semua");

  useEffect(() => {
    const load = () => investmentService.getUserInvestments(auth.currentUser?.uid ?? "").then(setItems).catch(() => setItems([]));
    load();
    return subscribeToCollectionChanges("investments", load);
  }, []);

  const all = useMemo(() => items ?? [], [items]);
  const modal = all.reduce((s, i) => s + idrInvested(i), 0);
  const aset = all.reduce((s, i) => s + idrCurrent(i), 0);
  const gain = aset - modal;
  const roi = modal > 0 ? (gain / modal) * 100 : 0;
  const alloc = GROUPS.map((g) => ({ ...g, value: all.filter((i) => groupOf(i) === g.key).reduce((s, i) => s + idrCurrent(i), 0) }));
  const visible = all
    .filter((i) => filter === "Semua" || groupOf(i) === filter)
    .sort((a, b) => idrCurrent(b) - idrCurrent(a));

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Investasi</h1>
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
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
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
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Tambah & kelola</p>
        <div className="grid grid-cols-3 gap-2">
          {GROUPS.map(({ key, label, icon: Icon, web }) => (
            <a key={key} href={web} onClick={lightTap} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <Icon size={18} className="text-slate-400" />
              <span className="flex items-center gap-1">{label} <ExternalLink size={10} className="text-slate-300" /></span>
            </a>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 px-1">Beli/jual saham dan penempatan deposito masih lewat versi web.</p>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, HandCoins } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { paidByDebt, debtRemaining } from "@/lib/services/debtService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { cn, formatIDR, formatMoney } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { DebtDetailSheet } from "@/components/app/debts/DebtDetailSheet";
import { AddDebtSheet } from "@/components/app/debts/AddDebtSheet";

const STATUS = ["Belum lunas", "Lunas"] as const;
const TYPES = ["Semua", "Hutang", "Piutang"] as const;

export default function AppDebtsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<typeof STATUS[number]>("Belum lunas");
  const [type, setType] = useState<typeof TYPES[number]>("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  const all = useMemo(() => transactions ?? [], [transactions]);
  const paid = useMemo(() => paidByDebt(all), [all]);
  const debts = useMemo(() => all.filter((t) => t.type === "debt"), [all]);

  // Sisa dalam IDR (rasio amountIDR/amount saat dicatat) untuk ringkasan lintas mata uang.
  const remainingIdr = (t: Transaction) => {
    const r = debtRemaining(t, paid);
    const ratio = t.amount > 0 && Number(t.amountIDR) > 0 ? Number(t.amountIDR) / t.amount : 1;
    return r * ratio;
  };
  const sisaHutang = debts.filter((t) => t.category === "Hutang").reduce((s, t) => s + remainingIdr(t), 0);
  const sisaPiutang = debts.filter((t) => t.category === "Piutang").reduce((s, t) => s + remainingIdr(t), 0);

  const visible = debts
    .filter((t) => (status === "Belum lunas" ? debtRemaining(t, paid) > 0 : debtRemaining(t, paid) <= 0))
    .filter((t) => type === "Semua" || t.category === type)
    .sort((a, b) => debtRemaining(b, paid) - debtRemaining(a, paid) || new Date(b.date).getTime() - new Date(a.date).getTime());

  // Ambil versi terbaru dari daftar (bukan salinan saat di-tap) supaya sisa &
  // riwayat di sheet ikut ter-update setelah pembayaran.
  const selected = debts.find((d) => d.id === selectedId) ?? null;
  const selectedPayments = selected ? all.filter((t) => t.relatedType === "debt" && t.relatedId === selected.id) : [];

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Hutang & Piutang</h1>
        </div>
        <button
          type="button"
          onClick={() => { lightTap(); setAdding(true); }}
          className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-xs font-black px-3.5 py-2"
        >
          <Plus size={14} /> Catat
        </button>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-rose-500 text-white p-4 shadow-lg shadow-rose-200/50 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Sisa hutang</p>
          <p key={sisaHutang} className="mt-1 text-lg font-black tabular-nums truncate animate-in">{formatIDR(sisaHutang)}</p>
          <p className="text-[10px] text-white/70">yang harus kamu bayar</p>
        </div>
        <div className="rounded-3xl bg-emerald-500 text-white p-4 shadow-lg shadow-emerald-200/50 dark:shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Sisa piutang</p>
          <p key={sisaPiutang} className="mt-1 text-lg font-black tabular-nums truncate animate-in">{formatIDR(sisaPiutang)}</p>
          <p className="text-[10px] text-white/70">yang akan kamu terima</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {STATUS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { lightTap(); setStatus(s); }}
              className={cn("py-2 rounded-xl text-xs font-black transition-colors", status === s ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { lightTap(); setType(t); }}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-black border",
                type === t ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {transactions === null ? (
        <div className="space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <HandCoins size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">
            {status === "Belum lunas" ? "Tidak ada yang belum lunas 🎉" : "Belum ada yang lunas"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((d) => {
            const rem = debtRemaining(d, paid);
            const principal = Number(d.amount) || 0;
            const pct = principal > 0 ? Math.min(100, ((principal - rem) / principal) * 100) : 0;
            const isHutang = d.category === "Hutang";
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => { lightTap(); setSelectedId(d.id ?? null); }}
                  className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{d.lenderName || d.note || d.category}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        <span className={isHutang ? "text-rose-500" : "text-emerald-600"}>{isHutang ? "Hutang" : "Piutang"}</span>
                        {isHutang && d.subCategory ? ` · ${d.subCategory}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-black tabular-nums", rem <= 0 ? "text-emerald-600" : isHutang ? "text-rose-500" : "text-emerald-600")}>
                        {rem <= 0 ? "Lunas" : formatMoney(rem, d.currency || "IDR")}
                      </p>
                      {rem > 0 && rem < principal && (
                        <p className="text-[10px] text-slate-400 tabular-nums">dari {formatMoney(principal, d.currency || "IDR")}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <DebtDetailSheet
        debt={selected}
        remaining={selected ? debtRemaining(selected, paid) : 0}
        payments={selectedPayments}
        accounts={accounts}
        onClose={() => setSelectedId(null)}
      />
      <AddDebtSheet isOpen={adding} onClose={() => setAdding(false)} accounts={accounts} />
    </div>
  );
}

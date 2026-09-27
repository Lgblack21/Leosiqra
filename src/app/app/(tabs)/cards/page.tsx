"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CreditCard, CalendarClock, AlertTriangle, ExternalLink } from "lucide-react";
import { accountService, Account } from "@/lib/services/accountService";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { auth } from "@/lib/cf-client";
import { isCreditAccountType, computeCreditUsage, getCardCycle, cardFlowsFromTransactions } from "@/lib/creditCard";
import { getCardGradientClass } from "@/lib/cardColors";
import { txTitle } from "@/components/app/transactions/txDisplay";
import { cn, formatMoney } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { FadeIn } from "@/components/app/FadeIn";
import { PayCardSheet } from "@/components/app/cards/PayCardSheet";

const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(typeof d === "string" ? new Date(`${d}T00:00:00`) : d);

const dueLabel = (days: number) => (days < 0 ? `lewat ${-days} hari` : days === 0 ? "hari ini" : `${days} hari lagi`);

export default function AppCardsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "";
    const loadAcc = () => accountService.getUserAccounts(uid).then(setAccounts).catch(() => setAccounts([]));
    const loadTx = () => transactionService.getUserTransactions(uid).then(setTransactions).catch(() => setTransactions([]));
    loadAcc();
    loadTx();
    const u1 = subscribeToCollectionChanges("accounts", loadAcc);
    const u2 = subscribeToCollectionChanges("transactions", loadTx);
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(() => accounts ?? [], [accounts]);
  const cards = all.filter((a) => isCreditAccountType(a.type));
  const sources = all.filter((a) => !isCreditAccountType(a.type));

  const paying = cards.find((c) => c.id === payingId) ?? null;
  const payingUsage = paying ? computeCreditUsage(paying) : null;

  return (
    <div className="max-w-md mx-auto px-5 pt-8 space-y-5">
      <FadeIn className="flex items-center gap-2">
        <Link href="/app/more" aria-label="Kembali" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Kartu Kredit</h1>
      </FadeIn>

      {accounts === null ? (
        <div className="h-48 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : cards.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center">
          <CreditCard size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">Belum ada kartu kredit</p>
          <p className="text-xs text-slate-400 mt-1">Tambahkan lewat tab Aset (tipe Credit Card).</p>
        </div>
      ) : (
        cards.map((card) => {
          const { limit, used, remaining } = computeCreditUsage(card);
          const currency = card.currency || "IDR";
          const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
          const cycle = getCardCycle(card, transactions);
          const recent = transactions
            .filter((t) => t.accountId === card.id && t.type !== "debt")
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 4);
          const flows = card.id ? cardFlowsFromTransactions(card.id, recent) : [];
          return (
            <FadeIn key={card.id} className="space-y-3">
              <div className={cn("relative overflow-hidden rounded-3xl p-5 text-white shadow-lg", getCardGradientClass(card.cardColor, card.type))}>
                <div className="flex items-start justify-between">
                  <p className="text-sm font-black">{card.name}</p>
                  <CreditCard size={20} className="text-white/70" />
                </div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-white/70">Terpakai</p>
                <p className="text-2xl font-black tabular-nums">{formatMoney(used, currency)}</p>
                <div className="mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", pct >= 90 ? "bg-rose-300" : "bg-white")} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-white/80 tabular-nums">
                  <span>Sisa {formatMoney(remaining, currency)}</span>
                  <span>Limit {limit > 0 ? formatMoney(limit, currency) : "—"}</span>
                </div>
              </div>

              {cycle ? (
                <div className={cn(
                  "rounded-2xl border p-4",
                  cycle.overdue ? "bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20" : "bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tagihan tercetak {fmtDate(cycle.statementDate)}</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                        {cycle.amountDue > 0 ? formatMoney(cycle.amountDue, currency) : "Lunas"}
                      </p>
                    </div>
                    {cycle.amountDue > 0 && (
                      <span className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
                        cycle.overdue ? "bg-rose-500 text-white" : cycle.daysUntilDue <= 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      )}>
                        {cycle.overdue ? <AlertTriangle size={11} /> : <CalendarClock size={11} />}
                        {dueLabel(cycle.daysUntilDue)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                    Jatuh tempo {fmtDate(cycle.dueDate)}
                    {cycle.minPayment > 0 ? ` · minimum ${formatMoney(cycle.minPayment, currency)}` : ""}
                    {` · cetak berikutnya ${fmtDate(cycle.nextStatementDate)}`}
                  </p>
                </div>
              ) : (
                <a href="/membership/cards" className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-500">
                  Atur tanggal cetak & jatuh tempo supaya tagihan dihitung otomatis
                  <ExternalLink size={13} className="shrink-0 text-slate-300" />
                </a>
              )}

              <button
                type="button"
                onClick={() => { lightTap(); setPayingId(card.id ?? null); }}
                disabled={used <= 0}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {used > 0 ? "Bayar tagihan" : "Tidak ada tagihan"}
              </button>

              {recent.length > 0 && (
                <ul className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.map((t, i) => {
                    const out = (flows[i]?.delta ?? 0) > 0;
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{txTitle(t)}</span>
                          <span className="block text-[11px] text-slate-400">{fmtDate(new Date(t.date))}</span>
                        </span>
                        <span className={cn("shrink-0 text-sm font-black tabular-nums", out ? "text-slate-700 dark:text-slate-200" : "text-emerald-600")}>
                          {out ? "−" : "+"}{formatMoney(Number(t.amount) || 0, t.currency || currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FadeIn>
          );
        })
      )}

      <PayCardSheet
        card={paying}
        used={payingUsage?.used ?? 0}
        cycle={paying ? getCardCycle(paying, transactions) : null}
        sources={sources}
        onClose={() => setPayingId(null)}
      />
    </div>
  );
}

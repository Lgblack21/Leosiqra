"use client";

import { useEffect, useMemo, useState } from "react";
import { HandCoins, Trash2, CheckCircle2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { AccountPicker } from "@/components/app/AccountPicker";
import { transactionService, Transaction } from "@/lib/services/transactionService";
import type { Account } from "@/lib/services/accountService";
import { debtService } from "@/lib/services/debtService";
import { cn, formatMoney } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface Props {
  debt: Transaction | null;
  remaining: number;
  payments: Transaction[];
  accounts: Account[];
  onClose: () => void;
}

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export function DebtDetailSheet({ debt, remaining, payments, accounts, onClose }: Props) {
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [needAccount, setNeedAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // Reset hanya saat catatan yang dibuka BERGANTI (id), bukan tiap objeknya
  // diperbarui — setelah bayar, daftar di-refresh otomatis dan pesan sukses
  // jangan ikut hilang.
  const debtId = debt?.id;
  const debtAccountId = debt?.accountId;
  useEffect(() => {
    setPaying(false);
    setAmount("");
    setConfirmDelete(false);
    setError("");
    setDone("");
  }, [debtId]);
  useEffect(() => {
    // Rekening catatan lama bisa tidak valid ("General") — minta pilih di depan.
    const valid = accounts.some((a) => a.id === debtAccountId);
    setNeedAccount(!valid);
    setAccountId((prev) => (valid ? debtAccountId ?? "" : prev && accounts.some((a) => a.id === prev) ? prev : accounts[0]?.id ?? ""));
  }, [debtId, debtAccountId, accounts]);

  const history = useMemo(
    () => [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments]
  );

  if (!debt) return <BottomSheet isOpen={false} onClose={onClose}>{null}</BottomSheet>;

  const isHutang = debt.category === "Hutang";
  const currency = debt.currency || "IDR";
  const principal = Number(debt.amount) || 0;
  const paidPct = principal > 0 ? Math.min(100, ((principal - remaining) / principal) * 100) : 0;
  const amountNumber = Number(amount || "0");
  const lunas = remaining <= 0;

  const submitPay = async () => {
    if (!debt.id || amountNumber <= 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await debtService.pay(debt.id, { amount: amountNumber, ...(needAccount ? { accountId } : {}) });
      lightTap();
      setDone(res.settled ? `Lunas! ${formatMoney(res.paid, currency)} tercatat.` : `${formatMoney(res.paid, currency)} tercatat. Sisa ${formatMoney(res.remaining, currency)}.`);
      setPaying(false);
      setAmount("");
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Gagal menyimpan pembayaran.";
      if (msg.toLowerCase().includes("pilih rekening")) setNeedAccount(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { lightTap(); setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await transactionService.deleteTransaction(debt);
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menghapus.");
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={Boolean(debt)}
      onClose={onClose}
      title={paying ? (isHutang ? "Bayar Hutang" : "Terima Pembayaran") : isHutang ? "Detail Hutang" : "Detail Piutang"}
      footer={
        paying ? (
          <div className="pb-[env(safe-area-inset-bottom)]">
            <AmountKeypad value={amount} onChange={setAmount} currencySymbol={currency} />
            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={submitPay}
                disabled={busy || amountNumber <= 0 || (needAccount && !accountId)}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {busy ? "Menyimpan..." : `Simpan ${amountNumber >= remaining ? "Pelunasan" : "Cicilan"} ${amountNumber > 0 ? groupDigits(amount) : ""}`}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-5">
          <p className="text-xs font-bold text-slate-400">{isHutang ? `Hutang ke ${debt.lenderName || "—"}` : `Piutang dari ${debt.lenderName || "—"}`}</p>
          <p className={cn("mt-1 text-3xl font-black tabular-nums", lunas ? "text-emerald-600" : isHutang ? "text-rose-500" : "text-emerald-600")}>
            {lunas ? "Lunas" : formatMoney(remaining, currency)}
          </p>
          <p className="text-xs font-medium text-slate-400 tabular-nums">
            {lunas ? `Pokok ${formatMoney(principal, currency)}` : `sisa dari ${formatMoney(principal, currency)}`}
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {debt.subCategory && debt.subCategory !== "Piutang" ? `${debt.subCategory} · ` : ""}dicatat {fmtDate(debt.date)}
            {debt.note ? ` · ${debt.note}` : ""}
          </p>
        </div>

        {done && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={16} /> {done}
          </div>
        )}
        {error && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>
        )}

        {paying ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {[
                ["50%", Math.round(remaining / 2)],
                ["Lunasi", remaining],
              ].map(([label, value]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => { lightTap(); setAmount(String(value)); }}
                  className="px-4 py-2 rounded-full text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {label} · {formatMoney(value as number, currency)}
                </button>
              ))}
            </div>
            {needAccount && (
              <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={isHutang ? "Bayar dari rekening" : "Masuk ke rekening"} />
            )}
            {!needAccount && (
              <p className="text-[11px] text-slate-400 px-1">
                {isHutang ? "Dibayar dari" : "Masuk ke"} {accounts.find((a) => a.id === accountId)?.name}.
              </p>
            )}
            <button type="button" onClick={() => setPaying(false)} className="text-xs font-bold text-slate-400 px-1">
              ← Kembali ke detail
            </button>
          </div>
        ) : (
          <>
            {!lunas && (
              <button
                type="button"
                onClick={() => { lightTap(); setPaying(true); setDone(""); }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 text-white text-sm font-black active:scale-[0.98] transition-all"
              >
                <HandCoins size={17} /> {isHutang ? "Bayar cicilan" : "Catat pembayaran masuk"}
              </button>
            )}

            <section>
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2 px-1">Riwayat pembayaran</h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 px-1">Belum ada pembayaran.</p>
              ) : (
                <ul className="rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>
                        <span className="block font-bold text-slate-800 dark:text-slate-100">{p.subCategory?.endsWith("Lunas") ? "Pelunasan" : "Cicilan"}</span>
                        <span className="block text-[11px] text-slate-400">{fmtDate(p.date)}</span>
                      </span>
                      <span className="font-black tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(p.amount, p.currency || currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-colors disabled:opacity-40",
                confirmDelete ? "bg-rose-500 text-white" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <Trash2 size={15} /> {confirmDelete ? "Yakin hapus catatan ini?" : "Hapus catatan"}
            </button>
            {confirmDelete && (
              <p className="text-[11px] text-center text-slate-500">Riwayat pembayaran yang sudah tercatat tidak ikut terhapus. Tap lagi untuk menghapus.</p>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

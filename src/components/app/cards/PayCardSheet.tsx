"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AmountKeypad, groupDigits } from "@/components/app/AmountKeypad";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { transferService } from "@/lib/services/transferService";
import type { CardCycle } from "@/lib/creditCycle";
import { cn, formatMoney, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";

interface Props {
  card: Account | null;
  used: number;
  cycle: CardCycle | null;
  /** Rekening sumber pembayaran (bukan kartu kredit). */
  sources: Account[];
  onClose: () => void;
}

// Bayar tagihan = transfer dari rekening biasa ke rekening kartu lewat
// POST /api/member/transfer (atomik, kurs dikonversi server) — saldo kartu
// naik, jadi terpakai turun, sama seperti bayar tagihan di Transfer & Top Up web.
export function PayCardSheet({ card, used, cycle, sources, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cardId = card?.id;
  useEffect(() => {
    setAmount("");
    setError("");
  }, [cardId]);
  useEffect(() => {
    if (!sources.some((a) => a.id === fromId) && sources[0]?.id) setFromId(sources[0].id);
  }, [sources, fromId]);

  if (!card) return <BottomSheet isOpen={false} onClose={onClose}>{null}</BottomSheet>;

  const cardCurrency = card.currency || "IDR";
  const from = sources.find((a) => a.id === fromId);
  const sameCurrency = (from?.currency || "IDR") === cardCurrency;
  const amountNumber = Number(amount || "0");

  const presets: Array<[string, number]> = sameCurrency
    ? ([
        cycle && cycle.minPayment > 0 ? ["Minimum", cycle.minPayment] : null,
        cycle && cycle.amountDue > 0 ? ["Tagihan", cycle.amountDue] : null,
        used > 0 ? ["Semua terpakai", used] : null,
      ].filter(Boolean) as Array<[string, number]>)
    : [];

  const submit = async () => {
    if (!from?.id || !card.id || amountNumber <= 0) return;
    setBusy(true);
    setError("");
    try {
      await transferService.createTransfer({
        fromAccountId: from.id,
        toAccountId: card.id,
        amount: amountNumber,
        note: `Bayar tagihan ${card.name}`,
        date: toLocalDateString(),
      });
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan pembayaran.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={`Bayar ${card.name}`}
      footer={
        <div className="pb-[env(safe-area-inset-bottom)]">
          <AmountKeypad value={amount} onChange={setAmount} currencySymbol={from?.currency || "IDR"} />
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !from || amountNumber <= 0}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {busy ? "Menyimpan..." : `Bayar ${amountNumber > 0 ? groupDigits(amount) : ""}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terpakai</p>
            <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatMoney(used, cardCurrency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tagihan tercetak</p>
            <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{cycle ? formatMoney(cycle.amountDue, cardCurrency) : "—"}</p>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {presets.map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => { lightTap(); setAmount(String(value)); }}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-black border",
                  amountNumber === value ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {label} · {formatMoney(value, cardCurrency)}
              </button>
            ))}
          </div>
        )}

        {sources.length === 0 ? (
          <p className="text-xs text-slate-400 px-1">Belum ada rekening biasa untuk membayar tagihan.</p>
        ) : (
          <AccountPicker accounts={sources} value={fromId} onChange={setFromId} label="Bayar dari rekening" />
        )}
        {from && !sameCurrency && (
          <p className="text-[11px] text-slate-400 px-1">
            Nominal dalam {from.currency}; dikonversi otomatis ke {cardCurrency} dengan kurs hari ini.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

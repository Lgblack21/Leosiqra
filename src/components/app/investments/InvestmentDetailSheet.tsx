"use client";

import { useEffect, useState } from "react";
import { Trash2, Pencil, ArrowUpRight, Wallet, RefreshCw } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { investmentService, Investment } from "@/lib/services/investmentService";
import { cn, formatMoney, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { Field, NumberField, inputClass } from "./fields";

interface Props {
  inv: Investment | null;
  accounts: Account[];
  onClose: () => void;
}

type Mode = "view" | "sell" | "edit";

const fmtDate = (d?: Date) => (d ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d) : "—");
const MATURITY_LABEL: Record<string, string> = { cairkan: "Cairkan ke rekening", aro_bunga: "Bunga cair, pokok diperpanjang", aro_full: "Pokok + bunga diperpanjang" };

export function InvestmentDetailSheet({ inv, accounts, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [confirm, setConfirm] = useState<"delete" | "cairkan" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // Jual
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [toAccount, setToAccount] = useState("");
  // Edit ringan
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  const invId = inv?.id;
  useEffect(() => {
    setMode("view"); setConfirm(null); setError(""); setDone("");
    setQty(""); setPrice("");
  }, [invId]);
  useEffect(() => {
    if (!inv) return;
    setToAccount(accounts.some((a) => a.id === inv.accountId) ? inv.accountId ?? "" : accounts[0]?.id ?? "");
    setName(inv.name); setPlatform(inv.platform || ""); setCurrentValue(String(Math.round((Number(inv.currentValue) || 0) * 100) / 100));
  }, [inv, accounts]);

  if (!inv) return <BottomSheet isOpen={false} onClose={onClose}>{null}</BottomSheet>;

  const currency = inv.currency || "IDR";
  const isStock = inv.type === "Saham";
  const isDeposit = inv.type === "Deposito";
  const held = Number(isStock ? inv.sharesCount : inv.quantity) || 0;
  const unit = isStock ? "lembar" : inv.unit || "unit";
  const invested = Number(inv.amountInvested) || 0;
  const current = Number(inv.currentValue) || 0;
  const gain = current - invested;
  const isBuyRow = inv.transactionType === "Beli" || inv.transactionType === "Pembelian";
  const isSaleRow = inv.transactionType === "Jual" || inv.transactionType === "Penjualan";
  const canSell = !isDeposit && inv.status === "Active" && isBuyRow && held > 0;
  const canCairkan = isDeposit && inv.transactionType === "Penempatan" && inv.status === "Active";
  const canEditValue = inv.status === "Active" && isBuyRow;
  const matured = !inv.targetDate || inv.targetDate.getTime() <= Date.now();
  const account = accounts.find((a) => a.id === inv.accountId);

  const n = (s: string) => Number(s) || 0;
  const sellQty = n(qty);
  const proceeds = sellQty * n(price);
  const costSold = held > 0 ? (invested * sellQty) / held : 0;
  const sellValid = sellQty > 0 && sellQty <= held && n(price) > 0 && Boolean(toAccount);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError("");
    try {
      const msg = await fn();
      lightTap();
      if (msg) setDone(msg);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doSell = () =>
    run(async () => {
      const res = await investmentService.sell(inv.id!, { quantity: sellQty, price: n(price), accountId: toAccount, date: toLocalDateString() });
      setMode("view");
      setQty(""); setPrice("");
      return `Terjual — ${formatMoney(res.proceeds, currency)} masuk ke ${accounts.find((a) => a.id === toAccount)?.name ?? "rekening"}`;
    });

  const doCairkan = () =>
    run(async () => {
      const res = await investmentService.cairkan(inv.id!);
      return `Dicairkan — ${formatMoney(res.total, currency)} masuk ke ${account?.name ?? "rekening"}`;
    });

  const doDelete = () =>
    run(async () => {
      await investmentService.hardDeleteInvestment(inv);
      onClose();
    });

  // Edit ringan: nama, platform, nilai sekarang — tidak menyentuh saldo.
  const doEdit = () =>
    run(async () => {
      const cv = n(currentValue);
      // Rasio kurs dari modal (tetap sejak dibeli), bukan dari nilai sekarang
      // yang bisa sudah basi; posisi IDR selalu 1.
      const ratio = currency === "IDR" ? 1 : invested > 0 && Number(inv.amountIDR) > 0 ? Number(inv.amountIDR) / invested : 1;
      await investmentService.updateInvestment(inv.id!, {
        ...(name.trim() && !isStock ? { name: name.trim() } : {}),
        platform: platform.trim(),
        ...(canEditValue && cv > 0
          ? { currentValue: cv, currentValueIDR: cv * ratio, returnPercentage: invested > 0 ? ((cv - invested) / invested) * 100 : 0 }
          : {}),
      });
      setMode("view");
      return "Tersimpan";
    });

  const fetchLive = async () => {
    try {
      const res = await investmentService.getStockPrice(inv.stockCode || inv.name, inv.exchangeCode || "IDX");
      if ((res.currency || "IDR") === currency) setPrice(String(res.price));
      else setError(`Harga live dalam ${res.currency} — isi harga jual dalam ${currency}.`);
    } catch {
      setError("Harga live tidak ditemukan — isi manual.");
    }
  };

  const title = mode === "sell" ? `Jual ${inv.name}` : mode === "edit" ? "Edit Posisi" : inv.name;

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={title}
      footer={
        mode === "sell" ? (
          <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex justify-between text-xs mb-3 px-1 tabular-nums">
              <span className="text-slate-400">Hasil {formatMoney(proceeds, currency)}</span>
              <span className={cn("font-black", proceeds - costSold >= 0 ? "text-emerald-600" : "text-rose-500")}>
                {proceeds - costSold >= 0 ? "Untung" : "Rugi"} {formatMoney(Math.abs(proceeds - costSold), currency)}
              </span>
            </div>
            <button type="button" onClick={doSell} disabled={!sellValid || busy} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all">
              {busy ? "Menyimpan..." : `Jual ${sellQty > 0 ? `${sellQty} ${unit}` : ""}`}
            </button>
          </div>
        ) : mode === "edit" ? (
          <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("view")} className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm">Batal</button>
            <button type="button" onClick={doEdit} disabled={busy} className="py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40">{busy ? "Menyimpan..." : "Simpan"}</button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}
        {done && <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">{done}</div>}

        {mode === "view" && (
          <>
            <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-5">
              <p className="text-xs font-bold text-slate-400">
                {inv.type}{inv.platform ? ` · ${inv.platform}` : ""} · {inv.transactionType ?? "—"}{inv.status === "Closed" ? " · Selesai" : ""}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white tabular-nums">{formatMoney(current, currency)}</p>
              {invested > 0 && Math.abs(gain) >= 0.005 && (
                <p className={cn("text-xs font-black tabular-nums", gain >= 0 ? "text-emerald-600" : "text-rose-500")}>
                  {gain >= 0 ? "+" : "−"}{formatMoney(Math.abs(gain), currency)} ({((gain / invested) * 100).toFixed(2)}%)
                </p>
              )}
              <dl className="mt-4 space-y-1.5 text-xs">
                {([
                  [isSaleRow ? "Modal terjual" : isDeposit ? "Pokok" : "Modal", formatMoney(invested, currency)],
                  held > 0 ? ["Jumlah", `${held.toLocaleString("id-ID")} ${unit}`] : null,
                  isStock && inv.pricePerShare ? ["Harga beli/lembar", formatMoney(inv.pricePerShare, currency)] : null,
                  isDeposit ? ["Bunga", `${inv.returnPercentage}%/th · pajak ${inv.taxPercentage ?? 0}%`] : null,
                  isDeposit && inv.targetDate ? ["Jatuh tempo", fmtDate(inv.targetDate)] : null,
                  isDeposit && inv.maturityAction ? ["Saat jatuh tempo", MATURITY_LABEL[inv.maturityAction] ?? inv.maturityAction] : null,
                  ["Tanggal", fmtDate(inv.dateInvested)],
                  ["Rekening", account?.name ?? "—"],
                ].filter(Boolean) as Array<[string, string]>).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="font-bold text-slate-700 dark:text-slate-200 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {canSell && (
                <button type="button" onClick={() => { lightTap(); setMode("sell"); setDone(""); }} className="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-black">
                  <ArrowUpRight size={16} /> Jual
                </button>
              )}
              {canCairkan && (
                <button
                  type="button"
                  onClick={() => (confirm === "cairkan" ? doCairkan() : (lightTap(), setConfirm("cairkan")))}
                  disabled={busy}
                  className={cn("flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-sm font-black disabled:opacity-40", confirm === "cairkan" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white")}
                >
                  <Wallet size={16} /> {confirm === "cairkan" ? "Yakin cairkan?" : "Cairkan"}
                </button>
              )}
              <button type="button" onClick={() => { lightTap(); setMode("edit"); setDone(""); }} className="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-black">
                <Pencil size={15} /> Edit
              </button>
            </div>
            {confirm === "cairkan" && (
              <p className="text-[11px] text-center text-slate-500 px-2">
                {matured
                  ? `Pokok + bunga masuk ke ${account?.name ?? "rekening sumber"}.`
                  : `Belum jatuh tempo (${fmtDate(inv.targetDate)}) — bunga HANGUS, hanya pokok ${formatMoney(invested, currency)} yang masuk ke ${account?.name ?? "rekening sumber"}.`}{" "}
                Tap lagi untuk lanjut.
              </p>
            )}

            <button
              type="button"
              onClick={() => (confirm === "delete" ? doDelete() : (lightTap(), setConfirm("delete")))}
              disabled={busy}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-colors disabled:opacity-40",
                confirm === "delete" ? "bg-rose-500 text-white" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <Trash2 size={15} /> {confirm === "delete" ? "Yakin hapus?" : "Hapus catatan"}
            </button>
            {confirm === "delete" && (
              <p className="text-[11px] text-center text-slate-500 px-2">
                {isSaleRow
                  ? `Uang hasil jual ditarik lagi dari ${account?.name ?? "rekening"} dan ${unit} dikembalikan ke posisi asal.`
                  : inv.transactionType === "Penarikan"
                    ? "Dana pencairan ditarik lagi dan deposito asal dibuka kembali."
                    : `Efeknya ke saldo ${account?.name ?? "rekening"} dibatalkan.`}{" "}
                Tap lagi untuk menghapus.
              </p>
            )}
          </>
        )}

        {mode === "sell" && (
          <>
            <Field label={`Jumlah dijual (${unit})`} hint={`Dimiliki ${held.toLocaleString("id-ID")} ${unit}`}>
              <div className="flex gap-2">
                <div className="flex-1"><NumberField value={qty} onChange={setQty} ariaLabel="Jumlah dijual" /></div>
                <button type="button" onClick={() => { lightTap(); setQty(String(held)); }} className="shrink-0 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300">Semua</button>
              </div>
            </Field>
            <Field label={`Harga jual / ${isStock ? "lembar" : unit} (${currency})`}>
              <div className="flex gap-2">
                <div className="flex-1"><NumberField value={price} onChange={setPrice} ariaLabel="Harga jual" /></div>
                {isStock && (
                  <button type="button" onClick={fetchLive} className="shrink-0 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <RefreshCw size={13} /> Live
                  </button>
                )}
              </div>
            </Field>
            {sellQty > held && <p className="text-[11px] font-bold text-rose-500 px-1">Melebihi jumlah yang dimiliki.</p>}
            <AccountPicker accounts={accounts} value={toAccount} onChange={setToAccount} label="Uang masuk ke rekening" />
            <button type="button" onClick={() => setMode("view")} className="text-xs font-bold text-slate-400 px-1">← Kembali ke detail</button>
          </>
        )}

        {mode === "edit" && (
          <>
            {!isStock && (
              <Field label="Nama"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama" className={inputClass} /></Field>
            )}
            <Field label="Platform / bank"><input value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform" className={inputClass} /></Field>
            {canEditValue && (
              <Field label={`Nilai sekarang (${currency})`} hint="Untuk memperbarui untung/rugi. Tidak mengubah saldo rekening.">
                <NumberField value={currentValue} onChange={setCurrentValue} ariaLabel="Nilai sekarang" />
              </Field>
            )}
            <p className="text-[11px] text-slate-400 px-1">
              Salah jumlah, harga beli, atau rekening? Hapus catatan ini (saldo kembali otomatis) lalu catat ulang.
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

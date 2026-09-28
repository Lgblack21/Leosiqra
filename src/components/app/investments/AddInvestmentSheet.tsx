"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Landmark, Layers, RefreshCw } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AccountPicker } from "@/components/app/AccountPicker";
import type { Account } from "@/lib/services/accountService";
import { investmentService, InvestmentPositionInput } from "@/lib/services/investmentService";
import { cn, formatMoney, toLocalDateString } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import { Chips, Field, NumberField, inputClass } from "./fields";

type Kind = "Saham" | "Deposito" | "Lainnya";
type Maturity = "cairkan" | "aro_bunga" | "aro_full";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  initialKind?: Kind;
}

const KINDS: Array<[Kind, string, React.ElementType]> = [
  ["Saham", "Saham", LineChart],
  ["Deposito", "Deposito", Landmark],
  ["Lainnya", "Lainnya", Layers],
];
const TENORS = [["1", "1 bln"], ["3", "3 bln"], ["6", "6 bln"], ["12", "12 bln"]] as const;
const MATURITY = [["cairkan", "Cairkan ke rekening"], ["aro_bunga", "Bunga cair, pokok diperpanjang"], ["aro_full", "Pokok + bunga diperpanjang"]] as const;
const UNITS = [["gram", "gram"], ["unit", "unit"], ["koin", "koin"], ["lot", "lot"]] as const;

const addMonths = (ymd: string, months: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));

// Catat posisi baru — nilai & efek uang (saldo, riwayat, ringkasan) dihitung dan
// disimpan server dalam satu batch atomik lewat investmentService.entry.
export function AddInvestmentSheet({ isOpen, onClose, accounts, initialKind = "Saham" }: Props) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(toLocalDateString());
  // Saham
  const [code, setCode] = useState("");
  const [exchange, setExchange] = useState<"IDX" | "US">("IDX");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [livePrice, setLivePrice] = useState<{ price: number; currency: string } | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  // Deposito
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tax, setTax] = useState("20");
  const [tenor, setTenor] = useState<"1" | "3" | "6" | "12">("3");
  const [maturity, setMaturity] = useState<Maturity>("cairkan");
  // Lainnya
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<"gram" | "unit" | "koin" | "lot">("gram");
  const [unitPrice, setUnitPrice] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setKind(initialKind);
    setError("");
    setName(""); setPlatform(""); setDate(toLocalDateString());
    setCode(""); setShares(""); setPrice(""); setLivePrice(null);
    setPrincipal(""); setRate(""); setTax("20"); setTenor("3"); setMaturity("cairkan");
    setQty(""); setUnitPrice("");
  }, [isOpen, initialKind]);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency || "IDR";
  const n = (s: string) => Number(s) || 0;
  const targetDate = addMonths(date, Number(tenor));

  const total = useMemo(() => {
    if (kind === "Saham") return n(shares) * n(price);
    if (kind === "Lainnya") return n(qty) * n(unitPrice);
    return n(principal);
  }, [kind, shares, price, qty, unitPrice, principal]);
  const depositInterest = kind === "Deposito" ? n(principal) * (n(rate) / 100) * (daysBetween(date, targetDate) / 365) * (1 - n(tax) / 100) : 0;

  const valid =
    Boolean(account) &&
    total > 0 &&
    (kind === "Saham" ? code.trim().length > 0 : name.trim().length > 0) &&
    (kind !== "Deposito" || n(rate) >= 0);

  const fetchLivePrice = async () => {
    if (!code.trim()) return;
    lightTap();
    setFetchingPrice(true);
    setError("");
    try {
      const res = await investmentService.getStockPrice(code.trim().toUpperCase(), exchange === "IDX" ? "IDX" : "NASDAQ");
      setLivePrice({ price: res.price, currency: res.currency });
      // Harga dicatat dalam mata uang rekening sumber — isi otomatis hanya
      // kalau mata uangnya sama (saham AS dalam USD dari rekening IDR: isi manual).
      if ((res.currency || "IDR") === currency) setPrice(String(res.price));
    } catch {
      setError("Harga live tidak ditemukan — isi harga beli manual.");
    } finally {
      setFetchingPrice(false);
    }
  };

  const submit = async () => {
    if (!valid || busy || !account?.id) return;
    setBusy(true);
    setError("");
    const common = { accountId: account.id, currency, platform: platform.trim(), dateInvested: date };
    const position: InvestmentPositionInput =
      kind === "Saham"
        ? { ...common, type: "Saham", transactionType: "Beli", name: code.trim().toUpperCase(), stockCode: code.trim().toUpperCase(), exchangeCode: exchange === "IDX" ? "IDX" : "NASDAQ", sharesCount: n(shares), pricePerShare: n(price) }
        : kind === "Lainnya"
          ? { ...common, type: "Lainnya", transactionType: "Pembelian", name: name.trim(), quantity: n(qty), unit, pricePerUnit: n(unitPrice) }
          : { ...common, type: "Deposito", transactionType: "Penempatan", name: name.trim(), amountInvested: n(principal), returnPercentage: n(rate), taxPercentage: n(tax), targetDate, maturityAction: maturity };
    try {
      await investmentService.entry(position);
      lightTap();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Gagal menyimpan investasi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Investasi"
      footer={
        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-baseline justify-between mb-3 px-1">
            <span className="text-xs font-bold text-slate-400">{kind === "Deposito" ? "Pokok ditempatkan" : "Total dibayar"}</span>
            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{formatMoney(total, currency)}</span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {busy ? "Menyimpan..." : kind === "Deposito" ? "Tempatkan Deposito" : `Catat Pembelian`}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Saldo {account?.name ?? "rekening"} berkurang {formatMoney(total, currency)}.</p>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</div>}

        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {KINDS.map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => { lightTap(); setKind(k); setError(""); }}
              className={cn("flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-colors", kind === k ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {kind === "Saham" && (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Field label="Kode saham">
                <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setLivePrice(null); }} placeholder="BBCA" aria-label="Kode saham" autoCapitalize="characters" className={inputClass} />
              </Field>
              <button
                type="button"
                onClick={fetchLivePrice}
                disabled={!code.trim() || fetchingPrice}
                className="h-[50px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 disabled:opacity-40"
              >
                <RefreshCw size={13} className={fetchingPrice ? "animate-spin" : ""} /> Harga live
              </button>
            </div>
            <Chips options={[["IDX", "Bursa Indonesia (IDX)"], ["US", "Bursa AS"]] as const} value={exchange} onChange={setExchange} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jumlah lembar"><NumberField value={shares} onChange={setShares} placeholder="100" ariaLabel="Jumlah lembar" /></Field>
              <Field
                label={`Harga / lembar (${currency})`}
                hint={
                  livePrice
                    ? livePrice.currency === currency
                      ? `Harga live ${formatMoney(livePrice.price, livePrice.currency)}`
                      : `Harga live ${formatMoney(livePrice.price, livePrice.currency)} — isi dalam ${currency} sesuai yang dibayar`
                    : undefined
                }
              >
                <NumberField value={price} onChange={setPrice} placeholder="9000" ariaLabel="Harga per lembar" />
              </Field>
            </div>
            <p className="text-[11px] text-slate-400 px-1">Di bursa Indonesia 1 lot = 100 lembar.</p>
          </>
        )}

        {kind === "Deposito" && (
          <>
            <Field label="Nama deposito"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deposito BCA" aria-label="Nama deposito" className={inputClass} /></Field>
            <Field label="Pokok"><NumberField value={principal} onChange={setPrincipal} placeholder="10000000" ariaLabel="Pokok deposito" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bunga % / tahun"><NumberField value={rate} onChange={setRate} placeholder="4.5" ariaLabel="Bunga per tahun" /></Field>
              <Field label="Pajak bunga %"><NumberField value={tax} onChange={setTax} placeholder="20" ariaLabel="Pajak bunga" /></Field>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Tenor</p>
              <Chips options={TENORS} value={tenor} onChange={setTenor} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Saat jatuh tempo</p>
              <Chips options={MATURITY} value={maturity} onChange={setMaturity} />
            </div>
            {n(principal) > 0 && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-300">
                Jatuh tempo <b>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(targetDate))}</b> · bunga bersih ±<b>{formatMoney(depositInterest, currency)}</b>
              </div>
            )}
          </>
        )}

        {kind === "Lainnya" && (
          <>
            <Field label="Nama aset"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emas Antam, Bitcoin, Reksadana..." aria-label="Nama aset" className={inputClass} /></Field>
            <Chips options={UNITS} value={unit} onChange={setUnit} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Jumlah (${unit})`}><NumberField value={qty} onChange={setQty} placeholder="10" ariaLabel="Jumlah" /></Field>
              <Field label={`Harga / ${unit} (${currency})`}><NumberField value={unitPrice} onChange={setUnitPrice} placeholder="1500000" ariaLabel="Harga per unit" /></Field>
            </div>
          </>
        )}

        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Dana dari rekening" />
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === "Deposito" ? "Bank" : "Platform"}>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder={kind === "Saham" ? "Ajaib, Stockbit" : kind === "Deposito" ? "BCA" : "Pegadaian"} aria-label="Platform" className={inputClass} />
          </Field>
          <Field label="Tanggal">
            <input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value || toLocalDateString())} aria-label="Tanggal" className={inputClass} />
          </Field>
        </div>
      </div>
    </BottomSheet>
  );
}

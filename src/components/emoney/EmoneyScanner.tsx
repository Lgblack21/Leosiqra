"use client";

import { useEffect, useState } from "react";
import { Nfc, Loader2, Check, Plus, ShieldCheck, Smartphone, RotateCcw, AlertTriangle } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { accountService, type Account } from "@/lib/services/accountService";
import { subscribeToCollectionChanges } from "@/lib/cf-firestore";
import { emoneySupport, scanEmoney, cancelEmoneyScan, maskCardNumber, EMONEY_CARDS, type EmoneyResult, type EmoneySupport } from "@/lib/emoney";
import { lightTap } from "@/lib/haptics";

// Baca saldo kartu e-money lewat NFC (plugin native), lalu SAMAKAN saldo
// rekening e-wallet di Leosiqra dengan saldo kartu. Disimpan sebagai nilai
// absolut (PUT balance), bukan selisih — memindai kartu yang sama dua kali
// tidak menggandakan apa pun. Dipakai Pengaturan (web) & /app/emoney (HP).

const NEW = "__baru__";

const SUPPORT_TEXT: Record<Exclude<EmoneySupport, "ready">, { title: string; desc: string }> = {
  web: { title: "Buka di aplikasi Leosiqra", desc: "Browser tidak bisa membaca chip kartu. Pindai lewat aplikasi Leosiqra di HP ber-NFC (Android atau iPhone)." },
  "old-app": { title: "Perbarui aplikasi Leosiqra", desc: "Versi aplikasi di HP-mu belum bisa membaca kartu. Pasang versi terbaru dari Play Store / App Store." },
  "no-nfc": { title: "HP ini tidak punya NFC", desc: "Membaca kartu e-money butuh HP dengan NFC." },
  "nfc-off": { title: "NFC masih mati", desc: "Nyalakan NFC di Pengaturan HP, lalu kembali ke sini." },
};

function guessAccount(accounts: Account[], r: EmoneyResult) {
  const key = r.card === "mandiri" ? /e-?money|mandiri/i : /tap ?cash|bni/i;
  return accounts.find((a) => a.type === "E-Wallet" && key.test(a.name))?.id ?? accounts.find((a) => key.test(a.name))?.id ?? NEW;
}

export function EmoneyScanner() {
  const [support, setSupport] = useState<EmoneySupport | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<EmoneyResult | null>(null);
  const [target, setTarget] = useState(NEW);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void emoneySupport().then(setSupport);
    const load = () => accountService.getUserAccounts("").then(setAccounts).catch(() => setAccounts([]));
    void load();
    const unsub = subscribeToCollectionChanges("accounts", load);
    return () => {
      unsub();
      cancelEmoneyScan();
    };
  }, []);

  // e-money selalu rupiah — hanya rekening IDR non-kartu-kredit yang bisa disamakan.
  const choices = accounts.filter((a) => (a.currency || "IDR") === "IDR" && !(a.creditLimit && a.creditLimit > 0));

  const scan = async () => {
    lightTap();
    setError("");
    setSaved(null);
    setResult(null);
    setScanning(true);
    try {
      const r = await scanEmoney();
      setResult(r);
      setTarget(guessAccount(choices, r));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== "CANCELLED") setError(err.message || "Kartu tidak terbaca. Coba lagi.");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      if (target === NEW) {
        await accountService.createAccount({
          userId: "",
          name: result.cardName,
          type: "E-Wallet",
          currency: "IDR",
          balance: result.balance,
          initialBalance: result.balance,
          logoLabel: result.cardName,
        } as Omit<Account, "id" | "createdAt">);
        setSaved(`Rekening "${result.cardName}" dibuat dengan saldo ${formatMoney(result.balance, "IDR")}.`);
      } else {
        const acc = choices.find((a) => a.id === target);
        await accountService.updateAccount(target, { balance: result.balance });
        setSaved(`Saldo ${acc?.name ?? "rekening"} kini ${formatMoney(result.balance, "IDR")}.`);
      }
      lightTap();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan saldo.");
    } finally {
      setSaving(false);
    }
  };

  const meta = result ? EMONEY_CARDS.find((c) => c.id === result.card) : null;
  const current = choices.find((a) => a.id === target);
  const diff = result && current ? result.balance - current.balance : 0;
  const notReady = support && support !== "ready" ? SUPPORT_TEXT[support] : null;

  return (
    <div className="space-y-5">
      {!result && (
        <div className="overflow-hidden rounded-[26px] bg-gradient-to-b from-indigo-50 to-white p-5 text-center ring-1 ring-indigo-100 dark:from-indigo-500/10 dark:to-slate-900 dark:ring-indigo-500/20">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn("absolute inset-0 rounded-full border-2 border-indigo-300/60", scanning ? "animate-ping" : "")}
                style={{ transform: `scale(${0.55 + i * 0.22})`, animationDelay: `${i * 0.35}s`, animationDuration: "1.8s" }}
              />
            ))}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Nfc size={30} />
            </span>
          </div>
          <p className="mt-2 text-[18px] font-bold text-slate-900 dark:text-white">{scanning ? "Tempelkan kartu sekarang…" : "Cek saldo kartu e-money"}</p>
          <p className="mx-auto mt-1 max-w-sm text-[14px] leading-snug text-slate-500 dark:text-slate-400">
            {scanning ? "Tahan kartu di belakang HP (iPhone: bagian atas) sampai terbaca." : "Tempelkan kartu ke belakang HP. Saldonya dibaca langsung dari chip, lalu kamu pilih rekening yang mau disamakan."}
          </p>
          {notReady ? (
            <div className="mt-4 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-800 dark:text-slate-100"><Smartphone size={16} className="text-indigo-600" /> {notReady.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-500 dark:text-slate-400">{notReady.desc}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void scan()}
              disabled={!support || scanning}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-7 py-3 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {scanning ? <Loader2 size={17} className="animate-spin" /> : <Nfc size={17} />} {scanning ? "Menunggu kartu…" : "Pindai kartu"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && meta && (
        <div className="space-y-4">
          <div className={cn("relative overflow-hidden rounded-[24px] bg-gradient-to-br p-5 text-white shadow-lg", meta.color)}>
            <span className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="flex items-center justify-between text-[13px] font-semibold text-white/80">
              <span>{result.cardName}</span>
              <Nfc size={18} />
            </div>
            <p className="mt-5 text-[12px] uppercase tracking-wider text-white/70">Saldo di kartu</p>
            <p className="text-[32px] font-extrabold tabular-nums leading-tight">{formatMoney(result.balance, "IDR")}</p>
            {maskCardNumber(result.cardNumber) && <p className="mt-2 font-mono text-[13px] text-white/80">{maskCardNumber(result.cardNumber)}</p>}
          </div>

          {saved ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Check size={16} className="mt-0.5 shrink-0" /> {saved}
              </p>
              <button type="button" onClick={() => { setResult(null); setSaved(null); }} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-indigo-600">
                <RotateCcw size={15} /> Pindai kartu lain
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="px-1 text-[14px] font-semibold text-slate-700 dark:text-slate-200">Samakan dengan rekening</p>
                <div className="mt-2 space-y-2">
                  {choices.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setTarget(a.id!)}
                      className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition", target === a.id ? "bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-500/10" : "bg-white ring-slate-200 dark:bg-slate-800 dark:ring-slate-700")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-white">{a.name}</span>
                        <span className="text-[12px] text-slate-500">Saldo sekarang {formatMoney(a.balance, "IDR")}</span>
                      </span>
                      {target === a.id && <Check size={18} className="text-indigo-600" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTarget(NEW)}
                    className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition", target === NEW ? "bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-500/10" : "bg-white ring-slate-200 dark:bg-slate-800 dark:ring-slate-700")}
                  >
                    <Plus size={18} className="text-slate-500" />
                    <span className="flex-1 text-[15px] font-semibold text-slate-900 dark:text-white">Rekening baru &quot;{result.cardName}&quot;</span>
                    {target === NEW && <Check size={18} className="text-indigo-600" />}
                  </button>
                </div>
              </div>
              {current && (
                <p className="px-1 text-[13px] text-slate-500 dark:text-slate-400">
                  {diff === 0 ? "Saldo sudah sama — tidak ada yang berubah." : `${formatMoney(current.balance, "IDR")} → ${formatMoney(result.balance, "IDR")} (${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff), "IDR")}).`}
                  {diff < 0 && " Selisihnya pengeluaran yang belum dicatat — tidak dibuat transaksi otomatis."}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setResult(null)} className="rounded-full bg-slate-100 px-5 py-3 text-[14px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Batal</button>
                <button type="button" onClick={() => void save()} disabled={saving || (!!current && diff === 0)} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {target === NEW ? "Buat rekening" : "Samakan saldo"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!result && (
        <div>
          <p className="px-1 text-[14px] text-slate-500">Kartu yang bisa dibaca</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {EMONEY_CARDS.map((c) => (
              <div key={c.id} className={cn("flex h-20 flex-col justify-between rounded-2xl bg-gradient-to-br p-3 text-white", c.color)}>
                <span className="h-3 w-5 rounded-sm bg-white/40" />
                <span className="text-[13px] font-bold">{c.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" /> Hanya membaca saldo — Leosiqra tidak pernah menulis ke kartu atau memindahkan uang. Nomor kartu tidak disimpan.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Tag,
  StickyNote,
  Check,
  Loader2,
  LogIn,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudflareApi } from "@/lib/cloudflare-api";
import { accountService, Account } from "@/lib/services/accountService";

type AuthState = "loading" | "ok" | "unauth";
type TxType = "pengeluaran" | "pemasukan";

// "50000" -> "50.000" (pemisah ribuan gaya Indonesia). Input disimpan sebagai
// digit murni; format hanya untuk tampilan.
const groupDigits = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default function InputCepatPage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  const [type, setType] = useState<TxType>("pengeluaran");
  const [amount, setAmount] = useState(""); // digit murni
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await cloudflareApi<{ user?: unknown | null }>("/api/auth/me");
        if (!alive) return;
        if (!me.user) {
          setAuthState("unauth");
          return;
        }
        setAuthState("ok");

        const accs = await accountService.getUserAccounts("");
        if (!alive) return;
        setAccounts(accs);
        if (accs.length > 0) setAccountId(accs[0].id ?? "");

        // Saran kategori dari transaksi terakhir (best-effort, jangan sampai
        // menggagalkan halaman kalau error).
        try {
          const tx = await cloudflareApi<{ items: { category?: string }[] }>(
            "/api/member/transactions?limit=100"
          );
          if (!alive) return;
          const uniq = Array.from(
            new Set((tx.items || []).map((t) => (t.category || "").trim()).filter(Boolean))
          ).slice(0, 30);
          setCategorySuggestions(uniq);
        } catch {
          /* abaikan */
        }
      } catch {
        if (alive) setAuthState("unauth");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const amountNumber = Number(amount || "0");
  const canSubmit = amountNumber > 0 && Boolean(selectedAccount) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      await cloudflareApi("/api/member/quick-transaction", {
        method: "POST",
        json: {
          type,
          amount: amountNumber,
          category: category.trim(),
          account: selectedAccount.name,
          note: note.trim(),
        },
      });
      setFeedback({
        ok: true,
        msg: `${type === "pengeluaran" ? "Pengeluaran" : "Pemasukan"} ${selectedAccount.currency} ${groupDigits(
          amount
        )} tercatat ✓`,
      });
      // Reset field yang berubah-ubah; sisakan type/akun/kategori untuk input cepat berikutnya.
      setAmount("");
      setNote("");
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Gagal menyimpan transaksi." });
    } finally {
      setSubmitting(false);
    }
  };

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  if (authState === "unauth") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <Wallet size={28} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Masuk dulu</h1>
          <p className="text-sm font-medium text-slate-400 mt-1 max-w-xs">
            Login sekali di sini, setelah itu Input Cepat langsung siap dipakai dari layar utama.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
        >
          <LogIn size={16} /> Masuk ke Leosiqra
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="w-full max-w-md mx-auto px-5 pt-8 pb-28 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Input Cepat</h1>
            <p className="text-[11px] font-bold text-slate-400 mt-1">Catat transaksi dalam hitungan detik</p>
          </div>
        </div>

        {/* Jenis transaksi */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType("pengeluaran")}
            className={cn(
              "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all border-2",
              type === "pengeluaran"
                ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100"
                : "bg-white border-slate-100 text-slate-400"
            )}
          >
            <ArrowDownCircle size={16} /> Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setType("pemasukan")}
            className={cn(
              "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all border-2",
              type === "pemasukan"
                ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                : "bg-white border-slate-100 text-slate-400"
            )}
          >
            <ArrowUpCircle size={16} /> Pemasukan
          </button>
        </div>

        {/* Nominal */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Nominal {selectedAccount ? `(${selectedAccount.currency})` : ""}
          </label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-300">{selectedAccount?.currency ?? "Rp"}</span>
            <input
              autoFocus
              inputMode="numeric"
              value={groupDigits(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="flex-1 min-w-0 text-4xl font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-200 tabular-nums"
            />
          </div>
        </div>

        {/* Akun */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            <Wallet size={12} /> Akun / Rekening
          </label>
          {accounts.length === 0 ? (
            <p className="text-xs font-medium text-slate-400">
              Belum ada rekening.{" "}
              <Link href="/membership/rekening" className="text-indigo-600 font-bold underline">
                Buat dulu
              </Link>
              .
            </p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full text-sm font-bold text-slate-800 bg-slate-50 rounded-xl px-3 py-3 outline-none border border-slate-100 focus:border-indigo-300"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Kategori */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            <Tag size={12} /> Kategori
          </label>
          <input
            list="kategori-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="mis. Makan, Transport"
            className="w-full text-sm font-bold text-slate-800 bg-slate-50 rounded-xl px-3 py-3 outline-none border border-slate-100 focus:border-indigo-300"
          />
          <datalist id="kategori-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Catatan (opsional) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            <StickyNote size={12} /> Catatan <span className="text-slate-300 normal-case tracking-normal font-medium">(opsional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tambah keterangan…"
            className="w-full text-sm font-bold text-slate-800 bg-slate-50 rounded-xl px-3 py-3 outline-none border border-slate-100 focus:border-indigo-300"
          />
        </div>

        {feedback && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold mb-3",
              feedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            )}
          >
            {feedback.ok && <Check size={14} className="shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        <p className="text-center text-[11px] font-medium text-slate-400 mt-4">
          Tips: buka lewat Safari →{" "}
          <span className="inline-flex items-center gap-1 font-bold text-slate-500">
            <ExternalLink size={11} /> Share
          </span>{" "}
          → &quot;Add to Home Screen&quot; supaya jadi ikon di layar iPhone.
        </p>
      </div>

      {/* Tombol simpan — sticky di bawah */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-6 pb-6 px-5">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black transition-all shadow-lg",
              canSubmit
                ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.99]"
                : "bg-slate-200 text-slate-400 shadow-none"
            )}
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Menyimpan…</>
            ) : (
              <><Check size={16} /> Simpan Transaksi</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

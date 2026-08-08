"use client";

import { useState } from "react";
import { Wallet, Landmark, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { accountService } from "@/lib/services/accountService";
import { auth } from "@/lib/cf-client";
import { NumberInput } from "@/components/ui/NumberInput";

interface FirstWalletStepProps {
  onDone: () => void;
}

const TYPES = [
  { value: "Cash", label: "Cash", icon: Wallet },
  { value: "Bank Account", label: "Bank", icon: Landmark },
  { value: "E-Wallet", label: "E-Wallet", icon: Smartphone },
] as const;

export function FirstWalletStep({ onDone }: FirstWalletStepProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("Cash");
  const [balance, setBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      // Currency di-hardcode IDR di sini (bukan pakai CurrencySelect) — user
      // baru belum tentu punya baris `currencies` sama sekali (currency
      // seeding di backend belum jalan otomatis), jadi picker-nya bisa
      // kosong dan bikin macet langkah wajib ini. IDR juga sudah jadi
      // mata uang utama di seluruh app.
      await accountService.createAccount({
        userId: auth.currentUser?.uid ?? "",
        name: name.trim(),
        type,
        currency: "IDR",
        balance: Number(balance || "0"),
        initialBalance: Number(balance || "0"),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat rekening.");
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 pt-10">
      <h1 className="text-xl font-black text-slate-900">Rekening Pertama</h1>
      <p className="text-sm font-medium text-slate-400 mt-1">
        Buat satu rekening dulu (bisa tambah lagi nanti).
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
            Nama Rekening
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Dompet, BCA, GoPay"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-xs font-bold border-2 transition-all",
                    type === t.value
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "bg-white border-slate-100 text-slate-400"
                  )}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Saldo Awal (IDR)
          </label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-300">Rp</span>
            <NumberInput
              value={balance}
              onChange={setBalance}
              placeholder="0"
              className="flex-1 min-w-0 text-3xl font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-200 tabular-nums"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {submitting ? "Menyimpan..." : "Selesai"}
        </button>
      </div>
    </div>
  );
}

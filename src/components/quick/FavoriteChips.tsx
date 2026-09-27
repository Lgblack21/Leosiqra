"use client";

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightTap } from "@/lib/haptics";
import type { QuickFavorite } from "@/lib/quick/favorites";

interface Props {
  favorites: QuickFavorite[];
  accountName: (id: string) => string | undefined;
  currencyOf: (id: string) => string;
  onPick: (fav: QuickFavorite) => void;
  disabled?: boolean;
}

const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : n >= 1e3 ? `${(n / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb` : n.toLocaleString("id-ID");

// Chip 1-tap: langsung menyimpan transaksi yang sering diulang (dengan tombol
// "Batalkan" setelahnya), tanpa isi form.
export function FavoriteChips({ favorites, accountName, currencyOf, onPick, disabled }: Props) {
  if (favorites.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
        <Zap size={11} /> Sekali tap, langsung tersimpan
      </p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
        {favorites.map((f) => {
          const cur = currencyOf(f.accountId);
          return (
            <button
              key={f.key}
              type="button"
              disabled={disabled}
              onClick={() => { lightTap(); onPick(f); }}
              className={cn(
                "shrink-0 text-left rounded-2xl border px-3.5 py-2.5 active:scale-95 transition-transform disabled:opacity-40",
                f.type === "pemasukan"
                  ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              )}
            >
              <span className="block text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">
                {f.subCategory || f.category} · {cur === "IDR" ? short(f.amount) : `${cur} ${f.amount}`}
              </span>
              <span className="block text-[10px] text-slate-400 whitespace-nowrap">{accountName(f.accountId) ?? "—"} · {f.count}x</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { currencyService, Currency } from '@/lib/services/currencyService';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
  /** Ringkas: cuma kode mata uang (mis. di samping input nominal). */
  compact?: boolean;
}

export const CurrencySelect = ({ value, onChange, className, label, compact }: CurrencySelectProps) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubCur = currencyService.getUserCurrencies(user.uid, (data) => {
          setCurrencies(data);
          setLoading(false);
        });
        return () => unsubCur();
      } else {
        setCurrencies([]);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // IDR & nilai yang sedang dipilih selalu ada di pilihan — dulu kalau daftar
  // mata uang user kosong, select menampilkan "-- Pilih --" walau nilainya IDR.
  const options = [...currencies.map((c) => ({ code: c.code, name: c.name }))];
  for (const code of ['IDR', value]) {
    if (code && !options.some((o) => o.code === code)) options.unshift({ code, name: code === 'IDR' ? 'Rupiah' : code });
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          aria-label="Mata uang"
          className={cn(
            "w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-slate-700 cursor-pointer transition-all disabled:opacity-50",
            compact ? "h-full rounded-2xl py-3.5 pl-4 pr-9 text-[15px]" : "rounded-xl py-3.5 px-5"
          )}
        >
          {loading ? (
            <option>Memuat...</option>
          ) : (
            options.map(c => (
              <option key={c.code} value={c.code}>{compact ? c.code : `${c.code} - ${c.name}`}</option>
            ))
          )}
        </select>
        <ChevronDown className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", compact ? "right-3" : "right-5")} size={16} />
      </div>
    </div>
  );
};


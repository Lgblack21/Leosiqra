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
}

export const CurrencySelect = ({ value, onChange, className, label }: CurrencySelectProps) => {
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
          className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 cursor-pointer transition-all disabled:opacity-50"
        >
          {loading ? (
            <option>Memuat...</option>
          ) : currencies.length === 0 ? (
            <option value="">-- Pilih Mata Uang --</option>
          ) : (
            currencies.map(c => (
              <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
      </div>
    </div>
  );
};


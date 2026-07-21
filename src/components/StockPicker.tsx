"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { investmentService, StockSearchResult } from '@/lib/services/investmentService';

interface StockComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (stock: StockSearchResult) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const StockCombobox = ({ value, onChange, onSelect, disabled, placeholder, className }: StockComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const q = value.trim();

  // Debounce 400ms sebelum manggil backend (proksi Yahoo Finance) tiap ketikan.
  useEffect(() => {
    if (!open || !q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset hasil lama saat kolom dikosongkan/panel ditutup
      setResults([]);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      investmentService.searchStocks(q)
        .then(items => {
          if (requestSeq.current !== seq) return; // hasil basi, sudah ada ketikan baru
          setResults(items);
        })
        .catch(err => {
          console.error('Gagal mencari saham:', err);
          if (requestSeq.current === seq) setResults([]);
        })
        .finally(() => {
          if (requestSeq.current === seq) setLoading(false);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [open, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePick = (stock: StockSearchResult) => {
    onSelect(stock);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
        >
          <ChevronDown size={15} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open && !disabled && q && (
        <div className="absolute z-20 left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl p-2 custom-scrollbar">
          {loading && (
            <p className="text-[10px] text-slate-400 text-center py-4 font-bold">Mencari &quot;{q}&quot;...</p>
          )}

          {!loading && results.length > 0 && results.map(stock => (
            <button
              key={`${stock.symbol}-${stock.exchangeCode}`}
              type="button"
              onClick={() => handlePick(stock)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
            >
              <LogoImage src={stock.logoUrl} alt={stock.name} fallbackText={stock.symbol.slice(0, 2)} className="w-7 h-7 rounded-full object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-700">{stock.symbol} <span className="text-slate-400 font-bold">· {stock.exchangeCode}</span></p>
                <p className="text-[10px] font-medium text-slate-400 truncate">{stock.name}</p>
              </div>
            </button>
          ))}

          {!loading && results.length === 0 && (
            <p className="text-[10px] text-slate-400 text-center py-4 font-bold">Tidak ditemukan — kode ini akan dipakai sebagai input manual.</p>
          )}
        </div>
      )}
    </div>
  );
};

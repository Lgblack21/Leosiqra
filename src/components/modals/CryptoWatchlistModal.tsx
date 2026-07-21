"use client";

import { useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LogoImage } from '@/components/ui/LogoImage';
import { loadPopularCoins, searchCoins, CoinOption } from '@/lib/coingecko';

export const MAX_WATCHLIST_COINS = 10;

interface CryptoWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelected: CoinOption[];
  onSave: (selected: CoinOption[]) => void;
}

export const CryptoWatchlistModal = ({ isOpen, onClose, initialSelected, onSave }: CryptoWatchlistModalProps) => {
  const [selected, setSelected] = useState<CoinOption[]>(initialSelected);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(initialSelected);
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    if (!query.trim()) {
      loadPopularCoins().then(coins => { setResults(coins); setLoading(false); });
      return;
    }
    const timer = setTimeout(() => {
      searchCoins(query).then(coins => { setResults(coins); setLoading(false); });
    }, 400);
    return () => clearTimeout(timer);
  }, [isOpen, query]);

  const isSelected = (id: string) => selected.some(s => s.id === id);
  const toggle = (coin: CoinOption) => {
    setSelected(prev => {
      if (prev.some(s => s.id === coin.id)) return prev.filter(s => s.id !== coin.id);
      if (prev.length >= MAX_WATCHLIST_COINS) return prev;
      return [...prev, coin];
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pilih Koin (Maks. ${MAX_WATCHLIST_COINS})`} maxWidth="max-w-md">
      <div className="space-y-4">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map(c => (
              <span key={c.id} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-black pl-2.5 pr-1 py-1 rounded-full">
                {c.symbol}
                <button type="button" onClick={() => toggle(c)} className="hover:bg-indigo-100 rounded-full p-0.5 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari koin..."
            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-9 pr-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
          {selected.length}/{MAX_WATCHLIST_COINS} dipilih
        </p>

        <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
          {loading && (
            <p className="text-xs font-bold text-slate-400 text-center py-6">Memuat...</p>
          )}
          {!loading && results.map(coin => {
            const active = isSelected(coin.id);
            const disabledAdd = !active && selected.length >= MAX_WATCHLIST_COINS;
            return (
              <button
                key={coin.id}
                type="button"
                disabled={disabledAdd}
                onClick={() => toggle(coin)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <LogoImage src={coin.logoUrl} alt={coin.name} fallbackText={coin.symbol.slice(0, 2)} className="w-7 h-7 rounded-full object-contain shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{coin.name}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{coin.symbol}</p>
                </div>
                {active && <Check size={16} className="text-indigo-600 shrink-0" />}
              </button>
            );
          })}
          {!loading && results.length === 0 && (
            <p className="text-xs font-bold text-slate-400 text-center py-6">Tidak ditemukan.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => { onSave(selected); onClose(); }}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-sm font-black transition-all shadow-xl shadow-indigo-100"
        >
          Simpan
        </button>
      </div>
    </Modal>
  );
};

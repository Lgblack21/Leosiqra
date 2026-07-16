"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Check, Plus, Loader2 } from 'lucide-react';
import { currencyService } from '@/lib/services/currencyService';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { Modal } from '@/components/ui/Modal';
import { ALL_PICKABLE_CURRENCIES } from '@/lib/data/worldCurrencies';

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CurrencyModal = ({ isOpen, onClose }: CurrencyModalProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [addingCode, setAddingCode] = useState<string | null>(null);

  // Fallback manual untuk mata uang yang tidak ada di daftar (mis. kripto baru).
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ code: '', name: '', symbol: '' });
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Ambil mata uang yang sudah dimiliki user, supaya bisa ditandai "sudah ditambahkan".
  useEffect(() => {
    if (!isOpen || !user) return;
    const unsub = currencyService.getUserCurrencies(user.uid, (data) => {
      setAddedCodes((prev) => {
        const next = new Set(prev);
        data.forEach((c) => c.code && next.add(c.code.toUpperCase()));
        return next;
      });
    });
    return () => unsub();
  }, [isOpen, user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_PICKABLE_CURRENCIES;
    return ALL_PICKABLE_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [search]);

  const handleAdd = async (code: string, name: string, symbol: string) => {
    if (!user || addedCodes.has(code.toUpperCase()) || addingCode) return;
    setAddingCode(code);
    try {
      await currencyService.addCurrency({ userId: user.uid, code, name, symbol });
      setAddedCodes((prev) => new Set(prev).add(code.toUpperCase()));
    } catch (error) {
      console.error('Add currency error:', error);
    } finally {
      setAddingCode(null);
    }
  };

  const handleManualSave = async () => {
    if (!user || !manual.code || !manual.name) return;
    setSavingManual(true);
    try {
      await currencyService.addCurrency({
        userId: user.uid,
        code: manual.code.toUpperCase(),
        name: manual.name,
        symbol: manual.symbol || manual.code.toUpperCase(),
      });
      setAddedCodes((prev) => new Set(prev).add(manual.code.toUpperCase()));
      setManual({ code: '', name: '', symbol: '' });
      setShowManual(false);
    } catch (error) {
      console.error('Add currency error:', error);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Mata Uang Dunia">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari mata uang… (mis. Euro, USD, Yen)"
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-slate-700"
          />
        </div>

        {/* Daftar mata uang */}
        <div className="max-h-[46vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-bold text-slate-400">Tidak ada hasil untuk &quot;{search}&quot;</p>
              <button
                onClick={() => { setShowManual(true); setManual((m) => ({ ...m, code: search.toUpperCase().slice(0, 5) })); }}
                className="mt-2 text-xs font-black text-emerald-600 hover:underline"
              >
                Tambah manual
              </button>
            </div>
          ) : (
            filtered.map((c) => {
              const added = addedCodes.has(c.code.toUpperCase());
              const busy = addingCode === c.code;
              return (
                <div
                  key={c.code}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
                >
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-sm font-black text-slate-700 shrink-0">
                    {c.symbol.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 leading-tight">{c.code}</p>
                    <p className="text-[11px] font-medium text-slate-400 truncate">{c.name}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(c.code, c.name, c.symbol)}
                    disabled={added || busy}
                    className={
                      added
                        ? 'flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-black text-emerald-600 bg-emerald-50 shrink-0'
                        : 'flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-black text-white bg-emerald-500 hover:bg-emerald-600 transition-all shrink-0 disabled:opacity-60'
                    }
                  >
                    {added ? (
                      <><Check size={13} /> Ditambahkan</>
                    ) : busy ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <><Plus size={13} /> Tambah</>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Fallback manual */}
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-emerald-600 transition-colors pt-1"
          >
            Tidak ketemu? Tambah manual
          </button>
        ) : (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tambah manual</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                maxLength={5}
                placeholder="Kode (mis. BTC)"
                value={manual.code}
                onChange={(e) => setManual({ ...manual, code: e.target.value })}
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
              />
              <input
                type="text"
                placeholder="Simbol (mis. ₿)"
                value={manual.symbol}
                onChange={(e) => setManual({ ...manual, symbol: e.target.value })}
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
              />
            </div>
            <input
              type="text"
              placeholder="Nama lengkap (mis. Bitcoin)"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700"
            />
            <button
              onClick={handleManualSave}
              disabled={savingManual || !manual.code || !manual.name}
              className="w-full bg-slate-900 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {savingManual ? 'Menyimpan…' : 'Simpan Mata Uang'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Coins } from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { loadPopularCoins, searchCoins } from '@/lib/coingecko';

export interface AssetPickerOption {
  name: string;
  unit: string;
  logoUrl: string;
  category: 'Kripto' | 'Emas';
}

// Produk emas/perak umum di Indonesia — tidak ada logo resmi per produk,
// jadi cukup ikon generik (LogoImage fallback ke fallbackIcon).
const GOLD_OPTIONS: AssetPickerOption[] = [
  { name: 'Emas Antam', unit: 'Gram', logoUrl: '', category: 'Emas' },
  { name: 'Emas UBS', unit: 'Gram', logoUrl: '', category: 'Emas' },
  { name: 'Emas Digital Pegadaian', unit: 'Gram', logoUrl: '', category: 'Emas' },
  { name: 'Emas Digital Galeri24', unit: 'Gram', logoUrl: '', category: 'Emas' },
  { name: 'Perak Antam', unit: 'Gram', logoUrl: '', category: 'Emas' },
];

interface AssetComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AssetPickerOption) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const AssetCombobox = ({ value, onChange, onSelect, disabled, placeholder, className }: AssetComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cryptoOptions, setCryptoOptions] = useState<AssetPickerOption[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const q = value.trim();

  // Kolom kosong -> tampilkan daftar koin populer (sekali per sesi, dari cache).
  useEffect(() => {
    if (!open || q) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indikator loading untuk fetch async yang dipicu efek ini sendiri
    setLoading(true);
    loadPopularCoins().then(coins => {
      setCryptoOptions(coins.map(c => ({ name: `${c.name} (${c.symbol})`, unit: 'Koin', logoUrl: c.logoUrl, category: 'Kripto' as const })));
      setLoading(false);
    });
  }, [open, q]);

  // Ada ketikan -> cari lintas seluruh koin CoinGecko (debounce 400ms), bukan
  // cuma difilter dari daftar populer, supaya koin apa pun bisa ditemukan.
  useEffect(() => {
    if (!open || !q) return;
    const seq = ++requestSeq.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indikator loading untuk fetch async yang dipicu efek ini sendiri
    setLoading(true);
    const timer = setTimeout(() => {
      searchCoins(q).then(coins => {
        if (requestSeq.current !== seq) return; // hasil basi, sudah ada ketikan baru
        setCryptoOptions(coins.map(c => ({ name: `${c.name} (${c.symbol})`, unit: 'Koin', logoUrl: c.logoUrl, category: 'Kripto' as const })));
        setLoading(false);
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

  const qLower = q.toLowerCase();
  const emas = qLower ? GOLD_OPTIONS.filter(o => o.name.toLowerCase().includes(qLower)) : GOLD_OPTIONS;
  const kripto = cryptoOptions;
  const totalCount = kripto.length + emas.length;

  const handlePick = (opt: AssetPickerOption) => {
    onSelect(opt);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
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

      {open && !disabled && (
        <div className="absolute z-20 left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl p-2 custom-scrollbar">
          {loading && (
            <p className="text-[10px] text-slate-400 text-center py-4 font-bold">
              {q ? `Mencari "${q}"...` : 'Memuat daftar koin...'}
            </p>
          )}

          {!loading && kripto.length > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">
                {q ? 'Hasil Pencarian Koin' : 'Kripto Populer'}
              </p>
              {kripto.map(opt => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => handlePick(opt)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <LogoImage src={opt.logoUrl} alt={opt.name} fallbackText={opt.name.slice(0, 2)} className="w-6 h-6 rounded-full object-contain shrink-0" />
                  <span className="text-xs font-bold text-slate-700">{opt.name}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && emas.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">Emas & Perak</p>
              {emas.map(opt => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => handlePick(opt)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Coins size={12} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{opt.name}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && totalCount === 0 && (
            <p className="text-[10px] text-slate-400 text-center py-4 font-bold">Tidak ditemukan — nama ini akan dipakai sebagai judul manual.</p>
          )}
        </div>
      )}
    </div>
  );
};

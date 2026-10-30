"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NumberInput } from '@/components/ui/NumberInput';
import { LogoImage } from '@/components/ui/LogoImage';
import { useFeedback } from '@/components/ui/Feedback';
import { investmentService } from '@/lib/services/investmentService';
import { accountService, type Account } from '@/lib/services/accountService';
import { isCreditAccountType } from '@/lib/creditCard';
import { loadPopularCoins, searchCoins } from '@/lib/coingecko';
import { cn, formatMoney, toLocalDateString } from '@/lib/utils';

// "Tambah investasi" dari halaman Kekayaan. Saham (IDX, AS/ETF) & kripto bisa
// "Harga otomatis": cari ticker → harga terbaru dari Worker (Yahoo/CoinGecko).
// Jenis lain manual (belum ada sumber harga resmi). Penyimpanan TETAP lewat
// investmentService.entry — satu batch atomik di server yang memotong saldo
// rekening sumber (wajib dipilih) & mencatat transaksi tertaut.
// Catatan: Worker belum mengonversi mata uang posisi ↔ rekening, jadi saham
// berharga USD hanya boleh dibayar dari rekening USD.

type Kind = 'idx' | 'us' | 'crypto' | 'emas' | 'reksadana' | 'obligasi' | 'lainnya' | 'deposito';
type Pick = { symbol: string; name: string; logoUrl?: string; exchangeCode?: string; coinId?: string };
type Live = { price: number; currency: string };

const KINDS: { id: Kind; label: string; emoji: string; auto?: boolean }[] = [
  { id: 'idx', label: 'Saham Indonesia', emoji: '📈', auto: true },
  { id: 'crypto', label: 'Kripto', emoji: '🪙', auto: true },
  { id: 'us', label: 'Saham AS & ETF', emoji: '🗽', auto: true },
  { id: 'emas', label: 'Emas', emoji: '🥇' },
  { id: 'reksadana', label: 'Reksa dana', emoji: '🧺' },
  { id: 'obligasi', label: 'Obligasi / SBN', emoji: '📜' },
  { id: 'deposito', label: 'Deposito', emoji: '🏦' },
  { id: 'lainnya', label: 'Lainnya', emoji: '✨' },
];
const UNIT: Record<Kind, string> = { idx: 'lembar', us: 'lembar', crypto: 'koin', emas: 'gram', reksadana: 'unit', obligasi: 'unit', lainnya: 'unit', deposito: '' };
const CATEGORY: Partial<Record<Kind, string>> = { crypto: 'Kripto', emas: 'Emas', reksadana: 'Reksa Dana', obligasi: 'Obligasi', lainnya: 'Lainnya' };
const PLATFORMS: Partial<Record<Kind, string[]>> = {
  idx: ['Stockbit', 'Ajaib', 'IPOT', 'Bibit', 'Pluang', 'Mirae'],
  us: ['Gotrade', 'Pluang', 'Stockbit', 'Ajaib', 'Interactive Brokers'],
  crypto: ['Indodax', 'Tokocrypto', 'Pintu', 'Binance', 'Pluang', 'Reku'],
  emas: ['Pegadaian', 'Logam Mulia', 'Tring', 'Pluang', 'Bibit', 'Fisik'],
  reksadana: ['Bibit', 'Bareksa', 'Ajaib', 'Stockbit', 'Bank'],
  obligasi: ['Bibit', 'Bareksa', 'Bank', 'Sekuritas'],
};
const NAME_HINT: Partial<Record<Kind, string>> = { emas: 'mis. Emas Antam', reksadana: 'mis. Sucorinvest Money Market Fund', obligasi: 'mis. ORI027T3', lainnya: 'mis. P2P, kebun, koleksi' };

export function AddInvestmentModal({ isOpen, onClose, onDeposito }: { isOpen: boolean; onClose: () => void; onDeposito: () => void }) {
  const reduce = useReducedMotion();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<Kind>('idx');
  const [auto, setAuto] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Pick[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [priceState, setPriceState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [lot, setLot] = useState(true);
  const [avg, setAvg] = useState('');
  const [cur, setCur] = useState('');
  const [platform, setPlatform] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const meta = KINDS.find((k) => k.id === kind)!;
  const isAuto = Boolean(meta.auto) && auto;
  const isStock = kind === 'idx' || kind === 'us';

  const reset = (k: Kind = 'idx') => {
    setKind(k); setAuto(true); setQ(''); setResults(null); setPicked(null); setLive(null); setPriceState('idle');
    setName(''); setQty(''); setLot(true); setAvg(''); setCur(''); setPlatform(''); setError(''); setDate(toLocalDateString());
  };

  useEffect(() => {
    if (!isOpen) return;
    accountService.getUserAccounts('session')
      .then((a) => setAccounts(a.filter((x) => !isCreditAccountType(x.type))))
      .catch(() => setAccounts([]));
  }, [isOpen]);

  // Cari ticker / koin (debounce), hasil basi dibuang.
  useEffect(() => {
    if (!isOpen || !isAuto || picked) return;
    const id = ++seq.current;
    const term = q.trim();
    if (isStock && term.length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        let list: Pick[] = [];
        if (kind === 'crypto') {
          const coins = term ? await searchCoins(term) : await loadPopularCoins();
          list = coins.slice(0, 12).map((c) => ({ symbol: c.symbol, name: c.name, logoUrl: c.logoUrl, coinId: c.id }));
        } else {
          const items = await investmentService.searchStocks(term);
          list = items
            .filter((s) => (kind === 'idx' ? s.exchangeCode === 'IDX' : s.exchangeCode !== 'IDX'))
            .slice(0, 12)
            .map((s) => ({ symbol: s.symbol, name: s.name, logoUrl: s.logoUrl, exchangeCode: s.exchangeCode }));
        }
        if (seq.current === id) setResults(list);
      } catch {
        if (seq.current === id) setResults([]);
      } finally {
        if (seq.current === id) setSearching(false);
      }
    }, term ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, kind, isAuto, isStock, picked, isOpen]);

  const fetchPrice = async (p: Pick, fillAvg: boolean) => {
    setPriceState('loading');
    try {
      let res: Live;
      if (p.coinId) {
        const r = await fetch(`/api/market/coingecko/simple/price?ids=${encodeURIComponent(p.coinId)}&vs_currencies=idr`);
        if (!r.ok) throw new Error('harga');
        const d = (await r.json()) as Record<string, { idr?: number }>;
        const price = d[p.coinId]?.idr;
        if (typeof price !== 'number' || !(price > 0)) throw new Error('harga');
        res = { price, currency: 'IDR' };
      } else {
        const d = await investmentService.getStockPrice(p.symbol, p.exchangeCode || 'IDX');
        if (!(d.price > 0)) throw new Error('harga');
        res = { price: d.price, currency: d.currency || (p.exchangeCode === 'IDX' ? 'IDR' : 'USD') };
      }
      setLive(res);
      setPriceState('idle');
      if (fillAvg) setAvg((v) => v || String(Math.round(res.price * 100) / 100));
    } catch {
      setLive(null);
      setPriceState('error');
    }
  };
  const choose = (p: Pick) => { setPicked(p); setResults(null); setQ(''); void fetchPrice(p, true); };

  // Hitungan ringkasan (mata uang posisi).
  const currency = kind === 'us' ? live?.currency || 'USD' : 'IDR';
  const qtyNum = parseFloat(qty) || 0;
  const units = kind === 'idx' && lot ? qtyNum * 100 : qtyNum;
  const avgNum = parseFloat(avg) || 0;
  const curNum = isAuto ? live?.price ?? 0 : parseFloat(cur) || 0;
  const cost = units * avgNum;
  const value = curNum > 0 ? units * curNum : 0;
  const gain = value > 0 ? value - cost : 0;
  const account = accounts.find((a) => a.id === accountId);
  const currencyMismatch = account && (account.currency || 'IDR') !== currency;
  const lowBalance = account && !currencyMismatch && cost > (Number(account.balance) || 0);
  const label = isAuto ? picked?.symbol : name.trim();
  const canSave = Boolean(label) && units > 0 && avgNum > 0 && accountId && !currencyMismatch && !saving;

  const save = async () => {
    if (!canSave || !label) return;
    setSaving(true);
    setError('');
    try {
      const common = { currency, platform: platform || undefined, accountId, dateInvested: date, currentValue: value > 0 ? Math.round(value * 100) / 100 : undefined, logoUrl: picked?.logoUrl || undefined };
      if (isStock) {
        const code = (isAuto ? picked!.symbol : name).trim().toUpperCase();
        await investmentService.entry({
          ...common, type: 'Saham', transactionType: 'Beli', name: code, stockCode: code,
          exchangeCode: isAuto ? picked!.exchangeCode || (kind === 'idx' ? 'IDX' : 'NASDAQ') : kind === 'idx' ? 'IDX' : 'NASDAQ',
          sharesCount: units, pricePerShare: avgNum, category: 'Saham',
        });
      } else {
        await investmentService.entry({
          ...common, type: 'Lainnya', transactionType: 'Pembelian',
          name: kind === 'crypto' && isAuto ? `${picked!.name} (${picked!.symbol})` : name.trim(),
          quantity: units, unit: UNIT[kind] === 'koin' ? 'Koin' : UNIT[kind] === 'gram' ? 'Gram' : 'Unit', pricePerUnit: avgNum, category: CATEGORY[kind],
        });
      }
      toast.success(`${label} tersimpan di portofolio.`);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan investasi. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const selectKind = (k: Kind) => {
    if (k === 'deposito') { reset(); onClose(); onDeposito(); return; }
    reset(k);
  };
  const field = 'w-full rounded-2xl border-none bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-800 ring-1 ring-transparent placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-slate-300';
  const lbl = 'pl-1 text-[12px] font-semibold text-slate-500';
  const unitWord = kind === 'idx' ? (lot ? 'lot' : 'lembar') : UNIT[kind];
  const platforms = useMemo(() => PLATFORMS[kind] ?? [], [kind]);

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Tambah investasi" maxWidth="max-w-xl">
      <div className="space-y-5">
        {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{error}</div>}

        {/* Jenis */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar sm:grid sm:grid-cols-4 sm:overflow-visible">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => selectKind(k.id)} aria-pressed={kind === k.id} className={cn('flex w-[92px] shrink-0 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-center transition-all sm:w-auto', kind === k.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100')}>
              <span aria-hidden className="text-[20px] leading-none">{k.emoji}</span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{k.label}</span>
            </button>
          ))}
        </div>

        {/* Mode harga */}
        {meta.auto ? (
          <LayoutGroup id="inv-mode">
            <div className="flex w-fit gap-1 rounded-full bg-slate-100 p-1">
              {[{ v: true, t: 'Harga otomatis' }, { v: false, t: 'Manual' }].map((m) => (
                <button key={m.t} type="button" onClick={() => { setAuto(m.v); setPicked(null); setLive(null); setPriceState('idle'); }} aria-pressed={auto === m.v} className={cn('relative rounded-full px-4 py-1.5 text-[13px] font-semibold', auto === m.v ? 'text-slate-900' : 'text-slate-500')}>
                  {auto === m.v && <motion.span layoutId={reduce ? undefined : 'inv-mode-pill'} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative">{m.t}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        ) : (
          <p className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">Harga {meta.label.toLowerCase()} diisi manual — belum ada sumber harga resmi yang bisa diambil otomatis.</p>
        )}

        {/* Aset */}
        {isAuto ? (
          picked ? (
            <div className="flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-slate-900 to-indigo-950 p-4 text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                <LogoImage src={picked.logoUrl} alt={picked.symbol} fallbackText={picked.symbol.slice(0, 4)} className="h-full w-full object-contain p-1" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-extrabold">{picked.symbol}</p>
                <p className="truncate text-[12px] text-white/60">{picked.name}{picked.exchangeCode ? ` · ${picked.exchangeCode}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/50">Harga terbaru</p>
                {priceState === 'loading' ? <Loader2 size={16} className="ml-auto animate-spin" /> : live ? (
                  <p className="text-[16px] font-extrabold tabular-nums">{formatMoney(live.price, live.currency)}</p>
                ) : <p className="text-[12px] text-amber-300">Gagal dimuat</p>}
                <button type="button" onClick={() => fetchPrice(picked, false)} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white"><RefreshCw size={11} /> Muat ulang</button>
              </div>
              <button type="button" onClick={() => { setPicked(null); setLive(null); setAvg(''); }} aria-label="Ganti aset" className="ml-1 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X size={16} /></button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'crypto' ? 'Cari koin, mis. BTC atau Solana' : kind === 'idx' ? 'Cari kode saham, mis. BBCA' : 'Cari ticker, mis. AAPL atau VOO'} aria-label="Cari ticker" className={cn(field, 'rounded-full pl-11')} />
                {searching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
              </div>
              <AnimatePresence initial={false}>
                {results && (
                  <motion.ul initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200">
                    {results.length === 0 ? <li className="px-4 py-4 text-center text-[13px] text-slate-500">Tidak ketemu. Coba kode lain atau pakai <button type="button" onClick={() => setAuto(false)} className="font-semibold text-slate-900 underline">Manual</button>.</li> : results.map((r) => (
                      <li key={`${r.symbol}-${r.exchangeCode ?? r.coinId}`}>
                        <button type="button" onClick={() => choose(r)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                            <LogoImage src={r.logoUrl} alt={r.symbol} fallbackText={r.symbol.slice(0, 3)} className="h-full w-full object-contain p-0.5" />
                          </span>
                          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-slate-900">{r.symbol}</span><span className="block truncate text-[12px] text-slate-500">{r.name}</span></span>
                          {r.exchangeCode && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{r.exchangeCode}</span>}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <label htmlFor="inv-name" className={lbl}>{isStock ? 'Kode saham' : 'Nama'}</label>
            <input id="inv-name" value={name} onChange={(e) => setName(isStock ? e.target.value.toUpperCase() : e.target.value)} placeholder={isStock ? (kind === 'idx' ? 'mis. BBCA' : 'mis. AAPL') : NAME_HINT[kind] ?? 'Nama investasi'} className={field} />
          </div>
        )}

        {/* Jumlah & harga */}
        {(!isAuto || picked) && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={lbl}>Jumlah ({unitWord})</label>
                  {kind === 'idx' && (
                    <button type="button" onClick={() => setLot((l) => !l)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">{lot ? 'pakai lembar' : 'pakai lot'}</button>
                  )}
                </div>
                <NumberInput value={qty} onChange={setQty} placeholder="0" className={field} />
                {kind === 'idx' && lot && qtyNum > 0 && <p className="pl-1 text-[11px] text-slate-400">= {(qtyNum * 100).toLocaleString('id-ID')} lembar</p>}
              </div>
              <div className="space-y-2">
                <label className={lbl}>Harga beli rata-rata / {kind === 'idx' || kind === 'us' ? 'lembar' : UNIT[kind]}</label>
                <NumberInput value={avg} onChange={setAvg} placeholder="0" className={field} />
              </div>
              {!isAuto && (
                <div className="col-span-2 space-y-2">
                  <label className={lbl}>Harga sekarang / {kind === 'idx' || kind === 'us' ? 'lembar' : UNIT[kind]} <span className="font-normal text-slate-400">· opsional</span></label>
                  <NumberInput value={cur} onChange={setCur} placeholder="Kosongkan = sama dengan harga beli" className={field} />
                </div>
              )}
            </div>

            {/* Ringkasan */}
            {cost > 0 && (
              <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-slate-50 p-3 text-center">
                <div><p className="text-[11px] text-slate-500">Modal</p><p className="text-[14px] font-extrabold tabular-nums text-slate-900">{formatMoney(cost, currency)}</p></div>
                <div><p className="text-[11px] text-slate-500">Nilai sekarang</p><p className="text-[14px] font-extrabold tabular-nums text-slate-900">{value > 0 ? formatMoney(value, currency) : '—'}</p></div>
                <div><p className="text-[11px] text-slate-500">Untung/rugi</p><p className={cn('text-[14px] font-extrabold tabular-nums', value <= 0 ? 'text-slate-400' : gain >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{value > 0 ? `${gain >= 0 ? '+' : '−'}${formatMoney(Math.abs(gain), currency)}` : '—'}</p></div>
              </div>
            )}

            {/* Sumber dana (wajib) */}
            <div className="space-y-2">
              <p className={lbl}>Bayar dari rekening</p>
              {accounts.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-3.5 py-3 text-[13px] text-slate-500">Belum ada rekening. Tambah akun dulu dari menu Tambah → Akun.</p>
              ) : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                  {accounts.map((a) => {
                    const on = accountId === a.id;
                    return (
                      <button key={a.id} type="button" onClick={() => setAccountId(a.id!)} aria-pressed={on} className={cn('flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-2 pr-3 text-left ring-1 transition-colors', on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}>
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white">
                          <LogoImage src={a.logoUrl} alt={a.name} fallbackText={a.name.slice(0, 3).toUpperCase()} className="h-full w-full object-contain" />
                        </span>
                        <span>
                          <span className="block text-[13px] font-bold">{a.name}</span>
                          <span className={cn('block text-[11px] tabular-nums', on ? 'text-white/60' : 'text-slate-400')}>{formatMoney(Number(a.balance) || 0, a.currency || 'IDR')}</span>
                        </span>
                        {on && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              )}
              {currencyMismatch && <p className="pl-1 text-[12px] font-medium text-rose-600">Harga {label || 'aset ini'} dalam {currency}, rekening {account?.name} dalam {account?.currency || 'IDR'}. Pilih rekening {currency} — konversi otomatis belum didukung.</p>}
              {lowBalance && <p className="pl-1 text-[12px] font-medium text-amber-700">Saldo {account?.name} kurang dari modal — saldonya akan jadi minus.</p>}
              {!currencyMismatch && account && cost > 0 && <p className="pl-1 text-[12px] text-slate-400">Saldo {account.name} berkurang {formatMoney(cost, currency)} dan tercatat sebagai pembelian investasi — tidak dihitung sebagai belanja di laporan.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="inv-date" className={lbl}>Tanggal beli</label>
                <input id="inv-date" type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              {platforms.length > 0 && (
                <div className="space-y-2">
                  <p className={lbl}>Platform <span className="font-normal text-slate-400">· opsional</span></p>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform" className={field}>
                    <option value="">—</option>
                    {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <button type="button" onClick={save} disabled={!canSave} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-[15px] font-bold text-white transition-all hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Menyimpan…' : cost > 0 ? `Tambah investasi · ${formatMoney(cost, currency)}` : 'Tambah investasi'}
        </button>
      </div>
    </Modal>
  );
}

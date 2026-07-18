"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlusCircle,
  PieChart,
  Trash2,
  Gem,
  TrendingUp,
  Pencil,
  RefreshCw
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogoImage } from '@/components/ui/LogoImage';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { Account } from '@/lib/services/accountService';
import type { Category } from '@/lib/services/categoryService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { useRef } from 'react';
import { OtherInvestmentModal } from '@/components/modals/OtherInvestmentModal';
import { useCountUp } from '@/lib/hooks/useCountUp';

// Deteksi posisi crypto dari teks bebas di "name"/"unit" (tidak ada field
// simbol terstruktur untuk Investasi Lainnya) — kalau salah satu kata cocok
// simbol/nama koin umum, harga live-nya ditarik dari CoinGecko.
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', BITCOIN: 'bitcoin',
  ETH: 'ethereum', ETHEREUM: 'ethereum',
  SOL: 'solana', SOLANA: 'solana',
  BNB: 'binancecoin', BINANCECOIN: 'binancecoin',
  ADA: 'cardano', CARDANO: 'cardano',
  XRP: 'ripple', RIPPLE: 'ripple',
  DOT: 'polkadot', POLKADOT: 'polkadot',
  DOGE: 'dogecoin', DOGECOIN: 'dogecoin',
  HOT: 'holotoken', HOLOCHAIN: 'holotoken',
  ASTER: 'aster-2',
};

const detectCryptoId = (inv: Investment): string | null => {
  const tokens = `${inv.name} ${inv.unit || ''}`.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  for (const t of tokens) {
    if (CRYPTO_ID_MAP[t]) return CRYPTO_ID_MAP[t];
  }
  return null;
};

type LivePrice = { priceUsd: number; changePercent: number };

export default function OtherInvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>(undefined);
  const [sellingInvestment, setSellingInvestment] = useState<Investment | undefined>(undefined);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [syncingPrices, setSyncingPrices] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);
  const syncedKeyRef = useRef<string>('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch Accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        // Fetch Categories for lookup
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        });

        const q = query(
          collection(db, 'investments'),
          where('userId', '==', u.uid),
          where('type', '==', 'Lainnya')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setInvestments(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, 
              amountInvested: Number(d.amountInvested) || 0,
              currentValue: Number(d.currentValue) || 0,
              dateInvested: d.dateInvested?.toDate?.() ?? new Date(), 
              createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Investment;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else { setInvestments([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Harga live (CoinGecko, langsung dari browser — endpoint publiknya
  // mendukung CORS) untuk posisi yang terdeteksi crypto, lalu otomatis
  // ditulis ke currentValue/currentValueIDR/returnPercentage-nya.
  const syncLivePrices = useCallback(async (cryptoPositions: Array<{ inv: Investment; coinId: string }>, force = false) => {
    if (cryptoPositions.length === 0) return;

    const uniqueIds = Array.from(new Set(cryptoPositions.map(p => p.coinId)));
    const idsKey = uniqueIds.sort().join(',');
    if (!force && idsKey === syncedKeyRef.current) return;
    syncedKeyRef.current = idsKey;

    setSyncingPrices(true);
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );
      if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);
      const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;

      const priceMap = new Map<string, LivePrice>();
      for (const id of uniqueIds) {
        if (typeof data[id]?.usd === 'number') {
          priceMap.set(id, { priceUsd: data[id].usd!, changePercent: data[id].usd_24h_change || 0 });
        }
      }
      setLivePrices(priceMap);

      const rates: ExchangeRates | null = await exchangeRateService.getLatestRates().catch(() => null);

      for (const { inv, coinId } of cryptoPositions) {
        const live = priceMap.get(coinId);
        if (!live || !inv.id) continue;

        const pricePerUnitInCurrency = rates
          ? exchangeRateService.convert(live.priceUsd, 'USD', inv.currency || 'IDR', rates)
          : live.priceUsd;
        const newCurrentValue = (inv.quantity || 0) * pricePerUnitInCurrency;
        const newCurrentValueIdr = rates
          ? exchangeRateService.convert(newCurrentValue, inv.currency || 'IDR', 'IDR', rates)
          : newCurrentValue;
        const newReturnPct = inv.amountInvested > 0
          ? ((newCurrentValue - inv.amountInvested) / inv.amountInvested) * 100
          : 0;

        await investmentService.updateInvestment(inv.id, {
          currentValue: newCurrentValue,
          currentValueIDR: newCurrentValueIdr,
          returnPercentage: newReturnPct,
        }).catch(e => console.error(`Gagal sync harga live ke posisi ${inv.id}:`, e));
      }
    } catch (e) {
      console.error('Gagal ambil harga live crypto:', e);
    } finally {
      setSyncingPrices(false);
    }
  }, []);

  useEffect(() => {
    const cryptoPositions = investments
      .filter(i => i.status === 'Active')
      .map(inv => ({ inv, coinId: detectCryptoId(inv) }))
      .filter((p): p is { inv: Investment; coinId: string } => p.coinId !== null);
    syncLivePrices(cryptoPositions);
  }, [investments, syncLivePrices]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '-';
  };

  // Portofolio aset alternatif bersifat all-time: posisi lama tidak "hilang" saat berpindah bulan.
  const filteredInvestments = investments;

  // Total digabung lintas aset yang bisa beda mata uang, jadi pakai
  // amountIDR/currentValueIDR (sudah dikonversi saat disimpan).
  const totalInvested = useMemo(() => filteredInvestments.reduce((s, i) => s + (Number(i.amountIDR) || i.amountInvested), 0), [filteredInvestments]);
  const totalCurrent = useMemo(() => filteredInvestments.reduce((s, i) => s + (Number(i.currentValueIDR) || i.currentValue), 0), [filteredInvestments]);
  const totalReturn = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  const animatedTotalCurrent = useCountUp(totalCurrent);
  const animatedTotalReturn = useCountUp(totalReturn);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace('Rp', '').trim();
  const formatAmount = (n: number, currency: string | undefined) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency || 'IDR', minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency || ''} ${formatRp(n)}`.trim();
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  const getAssetColor = (platform: string) => {
    if (platform?.startsWith('Emas')) return 'bg-yellow-50 text-yellow-600';
    if (platform?.startsWith('Kripto')) return 'bg-purple-50 text-purple-600';
    if (platform?.startsWith('Properti')) return 'bg-emerald-50 text-emerald-600';
    return 'bg-slate-50 text-slate-600';
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <Gem size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Investasi Lainnya</h1>
            <p className="text-[10px] md:text-sm font-medium text-slate-400 mt-1 max-w-xl">
              Lacak seluruh aset investasi alternatif Anda.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              const cryptoPositions = investments
                .filter(i => i.status === 'Active')
                .map(inv => ({ inv, coinId: detectCryptoId(inv) }))
                .filter((p): p is { inv: Investment; coinId: string } => p.coinId !== null);
              syncLivePrices(cryptoPositions, true);
            }}
            disabled={syncingPrices}
            className="px-4 py-3 bg-white border border-slate-100 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={syncingPrices ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Refresh Harga Crypto</span>
          </button>
          <button
            onClick={() => { setEditingInvestment(undefined); setSellingInvestment(undefined); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <PlusCircle size={18} />
            <span className="hidden md:inline">Tambah Investasi</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <PieChart size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Aset</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight tabular-nums">Rp {formatRp(Math.round(animatedTotalCurrent))}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{filteredInvestments.length} posisi aktif</p>
          </div>
          <Gem size={48} className="absolute -right-2 -bottom-2 text-purple-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Return</p>
          </div>
          <div>
            <h3 className={`text-3xl font-black leading-tight tabular-nums ${totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {animatedTotalReturn >= 0 ? '+' : ''}{animatedTotalReturn.toFixed(2)}%
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Unrealized Gain / Loss</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat aset...</div>
        ) : filteredInvestments.length === 0 ? (
          <div className="p-10">
            <EmptyState title="Belum ada aset alternatif" description="Belum ada transaksi aset alternatif yang tercatat." icon={<Gem size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px] xl:min-w-0">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Produk Investasi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Logo</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Mata Uang</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Kuantitas</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Satuan</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Harga / 1 Satuan</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap text-right">Nilai Sekarang</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipe Transaksi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Platform</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-b-0">
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{formatDate(inv.dateInvested)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><p className="text-sm font-black text-slate-900">{inv.name}</p></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center">
                      <LogoImage 
                        src={inv.logoUrl} 
                        alt={inv.name} 
                        fallbackText="IMG" 
                        className="w-6 h-6 object-cover mx-auto" 
                      />
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center"><span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{inv.currency || 'IDR'}</span></td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap"><span className="text-sm font-bold text-slate-700">{inv.quantity || 0}</span></td>
                    <td className="px-4 md:px-6 py-5 text-center whitespace-nowrap"><span className="text-xs font-bold text-slate-500">{inv.unit || '-'}</span></td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap font-black text-slate-900 text-sm">{formatAmount(inv.pricePerUnit || 0, inv.currency)}</td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap">
                      <p className="font-black text-slate-900 text-sm">{formatAmount(inv.currentValue || 0, inv.currency)}</p>
                      <p className={`text-[10px] font-bold ${inv.returnPercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {inv.returnPercentage >= 0 ? '+' : ''}{inv.returnPercentage.toFixed(2)}%
                        {(() => {
                          const coinId = detectCryptoId(inv);
                          const live = coinId ? livePrices.get(coinId) : null;
                          return live ? <span className="text-slate-400 font-medium"> · Live {live.changePercent >= 0 ? '+' : ''}{live.changePercent.toFixed(2)}%</span> : null;
                        })()}
                      </p>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{inv.transactionType || '-'}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{getCategoryName(inv.category || '')}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{getAccountName(inv.accountId || '')}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${getAssetColor(inv.platform)}`}>
                        {inv.platform || '-'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { setEditingInvestment(inv); setSellingInvestment(undefined); setShowModal(true); }}
                          className="p-2 rounded-lg bg-blue-50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all">
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => { setSellingInvestment(inv); setEditingInvestment(undefined); setShowModal(true); }}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all group/sell relative">
                          <TrendingUp size={14} className="rotate-180" />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/sell:opacity-100 transition-opacity whitespace-nowrap">Jual Aset</span>
                        </button>
                        <button onClick={async () => { 
                          if (inv.id && user?.uid) { 
                            if (confirm(`Hapus investasi ${inv.name}? Semua total saldo akan dikembalikan.`)) {
                              await investmentService.hardDeleteInvestment(inv.id, user.uid);
                            }
                          } 
                        }}
                          className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OtherInvestmentModal 
        userId={user?.uid || ''} 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingInvestment(undefined); setSellingInvestment(undefined); }} 
        editData={editingInvestment}
        initialData={sellingInvestment}
      />
    </div>
  );
}


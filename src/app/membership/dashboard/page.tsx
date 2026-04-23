"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  TrendingUp,
  CreditCard,
  Wallet,
  TrendingDown,
  PiggyBank,
  Landmark,
  Search,
  ChevronDown,
  LayoutDashboard,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';

interface MarketTicker {
  label: string; sub: string; val: string; pct: string; up: boolean | null;
  color: string;
}

export default function MonthlyDashboard() {
  const [filterType, setFilterType] = useState('Semua');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketTickers, setMarketTickers] = useState<MarketTicker[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      transactionService.getUserTransactions('session'),
      investmentService.getUserInvestments('session'),
    ])
      .then(([allTransactions, allInvestments]) => {
        if (!active) return;
        const periodTransactions = allTransactions.filter((t) => {
          const d = new Date(t.date);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
        setTransactions(periodTransactions);
        setInvestments(allInvestments);
      })
      .catch((err) => {
        console.error('Gagal memuat dashboard member:', err);
        if (!active) return;
        setTransactions([]);
        setInvestments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMonth, selectedYear]);

  const fetchMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const [cryptoRes, fxRes] = await Promise.all([
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'),
        fetch('https://open.er-api.com/v6/latest/USD')
      ]);
      const crypto = cryptoRes.ok ? await cryptoRes.json() : null;
      const fx = fxRes.ok ? await fxRes.json() : null;
      const tickers: MarketTicker[] = [
        { label: 'BTC/USD', sub: 'Bitcoin', val: crypto ? `$${Number(crypto.bitcoin?.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', pct: crypto ? `${Number(crypto.bitcoin?.usd_24h_change).toFixed(2)}%` : '-', up: crypto ? crypto.bitcoin?.usd_24h_change >= 0 : null, color: 'bg-amber-100 text-amber-600' },
        { label: 'ETH/USD', sub: 'Ethereum', val: crypto ? `$${Number(crypto.ethereum?.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', pct: crypto ? `${Number(crypto.ethereum?.usd_24h_change).toFixed(2)}%` : '-', up: crypto ? crypto.ethereum?.usd_24h_change >= 0 : null, color: 'bg-slate-100 text-slate-600' },
        { label: 'USD/IDR', sub: 'Rupiah', val: fx ? `Rp${Number(fx.rates?.IDR).toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : '-', pct: '-', up: null, color: 'bg-emerald-100 text-emerald-600' },
        { label: 'EUR/USD', sub: 'Euro', val: fx ? `$${(1 / Number(fx.rates?.EUR)).toFixed(4)}` : '-', pct: '-', up: null, color: 'bg-blue-100 text-blue-600' },
      ];
      setMarketTickers(tickers);
    } catch (e) { console.error(e); }
    finally { setMarketLoading(false); }
  }, []);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  const filteredData = useMemo(() => {
    if (filterType === 'Semua') return transactions;
    if (filterType === 'Pemasukan') return transactions.filter((t) => t.type === 'pemasukan');
    if (filterType === 'Pengeluaran') return transactions.filter((t) => t.type === 'pengeluaran');
    if (filterType === 'Investasi') {
      return transactions.filter((t) =>
        t.type === 'investasi' || /investasi|saham|deposito/i.test(t.category || '')
      );
    }
    if (filterType === 'Tabungan') {
      return transactions.filter((t) =>
        t.type === 'tabungan' || /tabungan|dana darurat/i.test(t.category || '')
      );
    }
    return transactions;
  }, [transactions, filterType]);

  // Guard Number() agar tidak NaN
  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + (Number(t.amount) || 0), 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + (Number(t.amount) || 0), 0), [transactions]);
  const totalInvestasi = useMemo(() => investments.reduce((s, i) => s + (Number(i.amountInvested) || 0), 0), [investments]);
  const netBalance = totalPemasukan - totalPengeluaran;
  const netTabungan = Math.max(netBalance - totalInvestasi, 0);

  const formatRp = (num: number) => {
    if (isNaN(num) || !isFinite(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d);

  const footerLabel = filterType === 'Semua' ? 'Total Keseluruhan' : `Total ${filterType}`;

  const pemasukanPct = totalPengeluaran > 0 ? Math.min(Math.round((totalPemasukan / Math.max(totalPengeluaran, 1)) * 100), 100) : 100;
  const pengeluaranPct = totalPemasukan > 0 ? Math.min(Math.round((totalPengeluaran / Math.max(totalPemasukan, 1)) * 100), 100) : 0;
  const tabunganPct = totalPemasukan > 0 ? Math.min(Math.round((netTabungan / Math.max(totalPemasukan, 1)) * 100), 100) : 0;
  const investasiPct = totalPemasukan > 0 ? Math.min(Math.round((totalInvestasi / Math.max(totalPemasukan, 1)) * 100), 100) : 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1400px]">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Dashboard Bulanan</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Laporan Periode {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth))}</p>
        </div>

          <MonthPicker 
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
      </div>

      {/* Top Cards (3 Cols) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Card 1: Total Kekayaan */}
        <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Saldo Bersih</p>
          <h3 className={`text-xl md:text-3xl font-black mb-4 tracking-tight ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>{formatRp(netBalance)}</h3>
          <div className="flex items-center gap-1.5 text-blue-500 text-[10px] md:text-xs font-bold">
            <TrendingUp size={14} />
            <span>{transactions.length} transaksi tercatat</span>
          </div>
        </div>

        {/* Card 2: Tagihan Kartu Kredit */}
        <div className="bg-slate-50 rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tagihan Kartu Kredit</p>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
              <CreditCard size={14} />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-emerald-600 mb-5 tracking-tight">{formatRp(totalPemasukan)}</h3>
          <div className="flex items-end gap-3 w-full">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full" />
            </div>
            <span className="text-[9px] font-black text-slate-400 shrink-0 uppercase tracking-wider">{transactions.filter(t => t.type === 'pemasukan').length} transaksi</span>
          </div>
        </div>

        {/* Card 3: Hutang Lainnya */}
        <div className="bg-slate-50 rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hutang Lainnya</p>
            <div className="text-slate-600 p-1.5 bg-white rounded shadow-sm border border-slate-50">
              <Landmark size={16} />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-rose-500 mb-4 tracking-tight">{formatRp(totalPengeluaran)}</h3>
          <div className="inline-block px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500">
            {transactions.filter(t => t.type === 'pengeluaran').length} transaksi pengeluaran
          </div>
        </div>
      </div>

      {/* Middle Grid (Pulse + Cashflows) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">

        {/* Pulse Pasar (1/4 width) - Live */}
        <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Pulse Pasar</p>
            <button onClick={fetchMarket} disabled={marketLoading} className="text-slate-300 hover:text-slate-600 transition-colors">
              <RefreshCw size={12} className={marketLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-5">
            {marketLoading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)
            ) : marketTickers.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black", m.color)}>
                    {m.label.split('/')[0].slice(0, 3)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none mb-1">{m.label}</p>
                    <p className="text-[10px] font-medium text-slate-400">{m.sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 leading-none mb-1">{m.val}</p>
                  <p className={cn(
                    "text-[10px] font-bold",
                    m.up === null ? 'text-slate-300' : m.up ? 'text-emerald-500' : 'text-rose-500'
                  )}>{m.up !== null && (m.up ? '+' : '')}{m.pct}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2x2 Flow Grid (3/4 width) */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Pemasukan - Firebase */}
          <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <TrendingUp size={12} className="text-emerald-500" /> Pemasukan
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pengeluaranPct <= 80 ? 'bg-sky-50 text-sky-500' : 'bg-rose-50 text-rose-500'}`}>
                {pengeluaranPct <= 80 ? 'Sehat' : 'Waspada'}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 tracking-tight">{formatRp(totalPemasukan)}</h3>
            <div className="flex justify-between items-end gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pemasukanPct}%` }} />
              </div>
              <span className="text-[9px] font-medium text-slate-400 leading-none">{transactions.filter(t => t.type === 'pemasukan').length} trx</span>
            </div>
          </div>
          {/* Pengeluaran - Firebase */}
          <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <TrendingDown size={12} className="text-rose-500" /> Pengeluaran
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pengeluaranPct > 90 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                {pengeluaranPct > 90 ? 'Waspada' : 'Normal'}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 tracking-tight">{formatRp(totalPengeluaran)}</h3>
            <div className="flex justify-between items-end gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${pengeluaranPct}%` }} />
              </div>
              <span className="text-[9px] font-medium text-slate-400 leading-none">{pengeluaranPct}% dari masuk</span>
            </div>
          </div>
          {/* Tabungan - dihitung dari Net */}
          <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <PiggyBank size={12} className="text-blue-500" /> Tabungan
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-500">{tabunganPct}% sisa</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 tracking-tight">{formatRp(netTabungan)}</h3>
            <div className="flex justify-between items-end gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${tabunganPct}%` }} />
              </div>
              <span className="text-[9px] font-medium text-slate-400 leading-none">Saldo bersih</span>
            </div>
          </div>
          {/* Investasi - Firebase */}
          <div className="bg-white rounded-[20px] md:rounded-2xl p-5 md:p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Wallet size={12} className="text-slate-600" /> Investasi
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-500 uppercase">
                {investments.filter(i => i.status === 'Active').length} Aktif
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-6 tracking-tight">{formatRp(totalInvestasi)}</h3>
            <div className="flex justify-between items-end gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 transition-all" style={{ width: `${investasiPct}%` }} />
              </div>
              <span className="text-[9px] font-medium text-slate-400 leading-none">{investasiPct}% dari masuk</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight Row - Top 3 Pengeluaran Tertinggi */}
      {transactions.filter(t => t.type === 'pengeluaran').length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-rose-500" />
            <h4 className="text-[10px] font-black tracking-widest uppercase text-slate-800">Pengeluaran Tertinggi</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {transactions
              .filter(t => t.type === 'pengeluaran')
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 3)
              .map((trx, i) => (
                <div key={trx.id || i} className="bg-white rounded-xl p-3.5 md:p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 text-sm font-black">
                    #{i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{trx.category}</p>
                    <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">{trx.note || trx.category}</p>
                    <p className="text-[10px] font-black text-rose-500 mt-1">{formatRp(trx.amount)}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Detail Table */}
      <div className="bg-white rounded-[20px] md:rounded-[20px] shadow-sm overflow-hidden mb-10">
        <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="text-sm md:text-[15px] font-bold text-slate-900">Detail Anggaran & Realisasi</h3>
            <span className="hidden xs:inline text-[10px] font-medium text-slate-400 tracking-wide mt-0.5">(Dalam IDR)</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 relative w-full lg:w-auto">
            <div className="relative w-full sm:flex-1 lg:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari item..." className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-slate-50 border-none rounded-lg text-xs text-slate-600 font-medium focus:ring-0 outline-none" />
            </div>
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-10 md:h-8 w-full sm:w-[140px] px-3 flex items-center justify-between gap-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold"
              >
                <span className="truncate">{filterType}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-40 bg-white border border-slate-100 rounded-xl shadow-lg shadow-indigo-500/10 z-10 py-2">
                  {['Semua', 'Pemasukan', 'Pengeluaran', 'Investasi', 'Tabungan'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setFilterType(cat); setIsDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat transaksi...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-8">
            <EmptyState title="Belum ada transaksi" description="Catat pemasukan atau pengeluaran pertama Anda melalui menu Tambah Cepat di header." icon={<LayoutDashboard size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[650px] md:min-w-0">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-[0.15em] text-slate-400">Tanggal</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-[0.15em] text-slate-400">Kategori / Catatan</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-[0.15em] text-slate-400 text-center">Tipe</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-[0.15em] text-slate-400 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map((trx, i) => (
                  <tr key={trx.id || i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 md:px-6 py-4">
                      <span className="font-black text-slate-900">{formatDate(trx.date)}</span>
                    </td>
                    <td className="px-5 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                        <span className="font-bold text-slate-700">{trx.category}{trx.note ? ` - ${trx.note}` : ''}</span>
                      </div>
                    </td>
                    <td className="px-5 md:px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${trx.type === 'pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                        }`}>{trx.type}</span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-black",
                      trx.type === 'pemasukan' ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {trx.type === 'pemasukan' ? '+' : '-'} {formatRp(trx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-black text-white">
                <tr>
                  <td colSpan={2} className="px-5 md:px-6 py-4 font-bold text-[10px] uppercase tracking-widest rounded-bl-[14px]">
                    {footerLabel} ({filteredData.length} transaksi)
                  </td>
                  <td className="px-5 md:px-6 py-4 font-black text-xs text-right text-emerald-400">
                    +{formatRp(totalPemasukan)}
                  </td>
                  <td className={cn(
                    "px-5 md:px-6 py-4 font-black text-xs text-right rounded-br-[14px]",
                    netBalance < 0 ? "text-rose-400" : "text-emerald-400"
                  )}>
                    Net: {netBalance >= 0 ? '+' : ''}{formatRp(netBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

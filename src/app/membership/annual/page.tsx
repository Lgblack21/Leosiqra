"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown,
  TrendingDown,
  TrendingUp, 
  WalletCards, 
  Landmark, 
  Activity,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { YearPicker } from '@/components/ui/YearPicker';
import { CategorySelect } from '@/components/CategorySelect';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { accountService, Account } from '@/lib/services/accountService';
import { categoryService, Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';

export default function AnnualDashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // States for Category Comparison
  const [cat1Id, setCat1Id] = useState<string>(''); // Default to 'All Income' logic if empty?
  const [cat2Id, setCat2Id] = useState<string>('');
  
  // Helper for Category Name from ID
  const getCatName = (id: string) => {
    const cat = categories.find(c => c.id === id || c.category === id);
    return cat?.category || id || 'Pilih Kategori';
  };

  useEffect(() => {
    let unsubTrx: (() => void) | null = null;
    let unsubInv: (() => void) | null = null;
    let unsubBdg: (() => void) | null = null;
    let unsubAcc: (() => void) | null = null;
    let unsubCat: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Calculate year range
        const startOfYear = new Date(selectedYear, 0, 1);
        const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);

        const qTrx = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('date', '>=', startOfYear),
          where('date', '<=', endOfYear),
          orderBy('date', 'desc')
        );
        unsubTrx = onSnapshot(qTrx, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Transaction;
          }));
        }, (err) => console.error("Annual TRX error:", err));

        const qInv = query(collection(db, 'investments'), where('userId', '==', u.uid));
        unsubInv = onSnapshot(qInv, (snap) => {
          setInvestments(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, dateInvested: d.dateInvested?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Investment;
          }));
        }, (err) => console.error("Annual INV error:", err));

        const qBdg = query(collection(db, 'budgets'), where('userId', '==', u.uid));
        unsubBdg = onSnapshot(qBdg, (snap) => {
          setBudgets(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Budget;
          }));
        }, (err) => console.error("Annual BDG error:", err));

        // Add accounts subscription
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        unsubAcc = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Account));
        }, (err) => console.error("Annual ACC error:", err));

        // Add categories subscription
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        unsubCat = onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Category));
        }, (err) => {
          if (err.code !== 'permission-denied') console.error("Annual CAT error:", err);
        });
      } else {
        setTransactions([]);
        setInvestments([]);
        setBudgets([]);
        setAccounts([]);
        if (unsubTrx) unsubTrx();
        if (unsubInv) unsubInv();
        if (unsubBdg) unsubBdg();
        if (unsubAcc) unsubAcc();
        if (unsubCat) unsubCat();
      }
    });
    return () => { 
      unsub(); 
      if (unsubTrx) unsubTrx();
      if (unsubInv) unsubInv();
      if (unsubBdg) unsubBdg();
      if (unsubAcc) unsubAcc();
      if (unsubCat) unsubCat();
    };
  }, [selectedYear]);

  const yearTransactions = useMemo(() =>
    transactions,
    [transactions]
  );

  const totalPemasukan = useMemo(() => yearTransactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0), [yearTransactions]);
  const totalPengeluaran = useMemo(() => yearTransactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0), [yearTransactions]);
  const totalInvestasi = useMemo(() => investments.reduce((s, i) => s + (Number(i.amountInvested) || 0), 0), [investments]);
  const netSavings = totalPemasukan - totalPengeluaran;

  // Monthly Aggregation for the Chart
  const monthlyData = useMemo(() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const data = months.map(m => ({ m, v1: 0, v2: 0 }));
    
    yearTransactions.forEach(t => {
      const monthIdx = t.date.getMonth();
      
      // If we have specific categories selected
      if (cat1Id && cat2Id) {
        // Compare by category name or ID (we normalize to name for comparison in charts usually)
        if (t.category === cat1Id || t.category === getCatName(cat1Id)) data[monthIdx].v1 += t.amount;
        if (t.category === cat2Id || t.category === getCatName(cat2Id)) data[monthIdx].v2 += t.amount;
      } else {
        // Default: Income vs Expense
        if (t.type === 'pemasukan') data[monthIdx].v1 += t.amount;
        if (t.type === 'pengeluaran') data[monthIdx].v2 += t.amount;
      }
    });

    // Convert to percentages relative to max value for chart heights
    const maxVal = Math.max(...data.map(d => Math.max(d.v1, d.v2, 1)));
    return data.map(d => ({
      m: d.m,
      b1: (d.v1 / maxVal) * 100,
      b2: (d.v2 / maxVal) * 100,
      v1: d.v1,
      v2: d.v2
    }));
  }, [yearTransactions, cat1Id, cat2Id]);

  // Top Transactions
  const topTransactionsList = useMemo(() => {
    return [...yearTransactions].sort((a, b) => b.amount - a.amount).slice(0, 4);
  }, [yearTransactions]);

  // Budget vs Actual for the Year Table
  const budgetRincian = useMemo(() => {
    return budgets.map(b => {
      // actual sum across the selected year for this category
      const actual = yearTransactions
        .filter(t => t.type === 'pengeluaran' && t.category === b.category)
        .reduce((sum, t) => sum + t.amount, 0);
      const limitTahunan = b.period === 'yearly' ? b.amount : b.amount * 12; // Handle period
      const isOver = actual > limitTahunan;
      return {
        item: b.category,
        budgetStr: 'Rp ' + new Intl.NumberFormat('id-ID').format(limitTahunan),
        actualStr: 'Rp ' + new Intl.NumberFormat('id-ID').format(actual),
        diffStr: (isOver ? '-Rp ' : 'Rp ') + new Intl.NumberFormat('id-ID').format(Math.abs(limitTahunan - actual)),
        diffColor: isOver ? 'text-rose-500' : 'text-sky-500',
        status: isOver ? 'OVER' : 'HEMAT',
        statusStyle: isOver ? 'text-rose-500 border-rose-100 bg-white' : 'text-sky-500 border-sky-100 bg-white'
      };
    });
  }, [budgets, yearTransactions]);

  const formatRpShort = (n: number) => {
    if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}M`;
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}Jt`;
    return new Intl.NumberFormat('id-ID').format(n);
  };
  const pemasPerc = Math.min(Math.round((yearTransactions.filter(t=>t.type==='pemasukan').length / Math.max(yearTransactions.length,1)) * 100), 100) || 0;
  const keluarPerc = totalPemasukan > 0 ? Math.min(Math.round((totalPengeluaran / totalPemasukan) * 100), 100) : 0;
  const tabunganPerc = totalPemasukan > 0 ? Math.min(Math.round((Math.max(netSavings,0) / totalPemasukan) * 100), 100) : 0;
  const invPerc = totalPemasukan > 0 ? Math.min(Math.round((totalInvestasi / totalPemasukan) * 100), 100) : 0;

  // Circular Progress Helper Component
  const CircularProgress = ({ value, colorClass, strokeClass }: {value: number, colorClass: string, strokeClass: string}) => {
    const radius = 18;
    const stroke = 3;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90">
          <circle 
            stroke="#f1f5f9" 
            strokeWidth={stroke} 
            fill="transparent" 
            r={normalizedRadius} 
            cx={radius} 
            cy={radius} 
          />
          <circle 
            className={strokeClass}
            strokeDasharray={circumference + ' ' + circumference} 
            style={{ strokeDashoffset }} 
            strokeWidth={stroke} 
            fill="transparent" 
            r={normalizedRadius} 
            cx={radius} 
            cy={radius} 
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute text-[10px] font-bold", colorClass)}>{value}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1400px] print:p-0 print:m-0 print:bg-white print:max-w-none">
      
      {/* 0. Print-Only Header */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl">L</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Leosiqra Report</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Keuangan Tahunan Resmi</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dibuat Pada</p>
          <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* 1. Header (Top Bar) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Dashboard Tahunan</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Laporan Fiskal Tahun {selectedYear}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 print:hidden">

          <div className="w-px h-6 bg-slate-100 mx-1" />

          {/* Year Picker */}
          <YearPicker 
            value={selectedYear}
            onChange={(y) => setSelectedYear(y)}
          />
        </div>
      </div>

      {/* 2. Top Summary Cards (4 Cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        
        {/* Card 1: Pemasukan */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pemasukan</p>
            <CircularProgress value={pemasPerc} colorClass="text-sky-600" strokeClass="stroke-sky-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">{formatRpShort(totalPemasukan)}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{yearTransactions.filter(t=>t.type==='pemasukan').length} transaksi</p>
              </div>
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-sky-50 text-sky-500 text-[9px] md:text-[10px] font-bold rounded-full">{pemasPerc}% dari total</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pengeluaran */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengeluaran</p>
            <CircularProgress value={keluarPerc} colorClass="text-rose-600" strokeClass="stroke-rose-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">{formatRpShort(totalPengeluaran)}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{yearTransactions.filter(t=>t.type==='pengeluaran').length} transaksi</p>
              </div>
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-[10px] font-bold rounded-full ${keluarPerc > 80 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{keluarPerc > 80 ? 'Caution' : 'Normal'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tabungan */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tabungan</p>
            <CircularProgress value={tabunganPerc} colorClass="text-slate-700" strokeClass="stroke-slate-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">{formatRpShort(Math.max(netSavings, 0))}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{tabunganPerc}% dari pemasukan</p>
              </div>
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-[10px] font-bold rounded-full ${tabunganPerc > 20 ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>{tabunganPerc > 20 ? 'Goal Near' : 'Growing'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Investasi */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Investasi</p>
            <CircularProgress value={invPerc} colorClass="text-teal-600" strokeClass="stroke-teal-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">{formatRpShort(totalInvestasi)}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Semua waktu</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{investments.length} posisi aktif</p>
              </div>
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-slate-100 text-slate-500 text-[9px] md:text-[10px] font-bold rounded-full">Growing</span>
            </div>
          </div>
        </div>
      </div>
      


      {/* 3. Middle Area (2/3 Graph + 1/3 Sidebar List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* GRAPH SECTION (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-[20px] md:rounded-[24px] p-5 md:p-8 border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 md:mb-10">
            <div>
              <h3 className="text-[14px] md:text-[18px] font-bold text-slate-900 leading-tight">Perbandingan Tahunan</h3>
              <p className="text-[9px] md:text-xs font-medium text-slate-400 mt-1 max-w-sm">Visual comparison of selected financial metrics.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 w-full md:w-fit">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white h-7 px-2 flex items-center rounded-lg border border-slate-100 shrink-0">1</span>
                  <select 
                    value={cat1Id} 
                    onChange={(e) => setCat1Id(e.target.value)}
                    className="flex-1 min-w-[100px] bg-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer truncate"
                  >
                    <option value="">+ Pemasukan (Total)</option>
                    {[...new Map(categories.map(c => [c.category, c])).values()].map(c => (
                      <option key={c.id} value={c.category}>{c.category}</option>
                    ))}
                  </select>
                </div>
                
                <span className="text-[9px] font-black text-indigo-300 italic px-1 shrink-0">VS</span>
                
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white h-7 px-2 flex items-center rounded-lg border border-slate-100 shrink-0">2</span>
                  <select 
                    value={cat2Id} 
                    onChange={(e) => setCat2Id(e.target.value)}
                    className="flex-1 min-w-[100px] bg-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer truncate"
                  >
                    <option value="">- Pengeluaran (Total)</option>
                    {[...new Map(categories.map(c => [c.category, c])).values()].map(c => (
                      <option key={c.id} value={c.category}>{c.category}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Simulated Bar Chart Layout */}
          <div className="bg-slate-50/50 rounded-xl p-3 md:p-4 h-[180px] md:h-[280px] flex items-end justify-between gap-1.5 md:gap-4 relative px-2 md:px-8 border border-slate-50 overflow-x-auto custom-scrollbar">
            {/* Dynamic 12 Months bars */}
            {monthlyData.map((col) => (
              <div key={col.m} className="flex flex-col items-center gap-3 w-full h-full justify-end group">
                <div className="flex items-end gap-1 w-full justify-center h-[200px]">
                  <div 
                    title={`${cat1Id || 'Pemasukan'}: Rp ${col.v1.toLocaleString()}`}
                    className="w-1/2 max-w-[12px] bg-indigo-500/40 rounded-t-sm group-hover:bg-indigo-600 transition-colors cursor-help" 
                    style={{ height: `${col.b1}%` }}
                  />
                  <div 
                    title={`${cat2Id || 'Pengeluaran'}: Rp ${col.v2.toLocaleString()}`}
                    className="w-1/2 max-w-[12px] bg-slate-400 rounded-t-sm group-hover:bg-slate-700 transition-colors cursor-help" 
                    style={{ height: `${col.b2}%` }}
                  />
                </div>
                <span className="text-[7px] md:text-[8px] font-black text-slate-400 tracking-tight md:tracking-widest uppercase">{col.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR SECTION (1/3) */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <h3 className="text-[14px] font-bold text-slate-800 mb-2 mt-2 px-1">Transaksi Tertinggi</h3>
          
          <div className="flex-1 flex flex-col gap-4">
            {topTransactionsList.length === 0 ? (
               <p className="text-xs text-slate-400 text-center py-10 font-bold">Belum ada transaksi</p>
            ) : topTransactionsList.map((trx, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", 
                    trx.type === 'pemasukan' ? 'bg-sky-100 text-sky-500' :
                    trx.type === 'pengeluaran' ? 'bg-rose-100 text-rose-500' : 
                    'bg-slate-100 text-slate-500'
                  )}>
                    {trx.type === 'pemasukan' ? <TrendingUp size={16} /> : <WalletCards size={16} />}
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{trx.type}</p>
                    <p className="text-xs font-bold text-slate-900">{trx.category || 'Transaksi'}</p>
                  </div>
                </div>
                <span className={cn("text-xs font-black", trx.type === 'pemasukan' ? 'text-sky-500' : 'text-rose-500')}>
                  {trx.type === 'pemasukan' ? '+' : '-'}Rp {formatRpShort(trx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Area Tabel (Rincian Anggaran Tahunan) */}
      <div className="bg-white rounded-[20px] md:rounded-[24px] shadow-sm overflow-hidden mb-10 border border-slate-100">
        <div className="p-4 md:p-6 md:px-8 py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50">
          <h3 className="text-sm md:text-[16px] font-bold text-slate-900">Rincian Anggaran Tahunan</h3>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-3 md:px-4 py-1 md:py-1.5 w-fit">
            <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-slate-300" />
            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Dalam IDR</span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[650px] md:min-w-0">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-5 md:px-8 py-4 md:py-5 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-slate-400">Item</th>
                <th className="px-5 md:px-6 py-4 md:py-5 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-slate-400">Budget</th>
                <th className="px-5 md:px-6 py-4 md:py-5 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-slate-400">Aktual</th>
                <th className="px-5 md:px-6 py-4 md:py-5 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-slate-400">Selisih</th>
                <th className="px-5 md:px-8 py-4 md:py-5 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-slate-400 text-right w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {budgetRincian.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-bold text-[11px]">
                    Belum ada anggaran yang diatur
                  </td>
                </tr>
              ) : budgetRincian.map((b, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 md:px-8 py-4 md:py-5 font-black text-slate-900 text-[10px] md:text-xs tracking-tight">{b.item}</td>
                  <td className="px-5 md:px-6 py-4 md:py-5 font-bold text-slate-500 text-[10px] md:text-[11px]">{b.budgetStr}</td>
                  <td className="px-5 md:px-6 py-4 md:py-5 font-bold text-slate-900 text-[10px] md:text-[11px]">{b.actualStr}</td>
                  <td className={`px-5 md:px-6 py-4 md:py-5 font-black text-[10px] md:text-[11px] tracking-tight ${b.diffColor}`}>{b.diffStr}</td>
                  <td className="px-5 md:px-8 py-4 md:py-5 text-right w-28">
                    <span className={`inline-block px-3 py-1 text-[8px] md:text-[9px] font-black rounded border tracking-widest ${b.statusStyle}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide elements */
          .print\\:hidden, 
          header, 
          aside, 
          button, 
          .YearPicker, 
          .custom-scrollbar::-webkit-scrollbar {
            display: none !important;
          }
          /* Reset layout for print */
          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }
          .max-w-[1400px] {
            max-width: none !important;
          }
          /* Cards and content */
          .bg-white {
            background-color: white !important;
            border: 1px solid #e2e8f0 !important;
            break-inside: avoid;
            padding: 20px !important;
          }
          .grid {
            gap: 1rem !important;
          }
          /* Text colors */
          .text-slate-400 {
            color: #94a3b8 !important;
          }
          .text-slate-900 {
            color: #0f172a !important;
          }
        }
      `}</style>
    </div>
  );
}


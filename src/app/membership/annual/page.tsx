"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  WalletCards,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps
} from 'recharts';
import { cn, isIncomingTransaction } from '@/lib/utils';
import { YearPicker } from '@/components/ui/YearPicker';
import type { Transaction } from '@/lib/services/transactionService';
import type { Investment } from '@/lib/services/investmentService';
import type { Budget } from '@/lib/services/budgetService';
import type { Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { useCountUp } from '@/lib/hooks/useCountUp';

type CircularProgressProps = {
  value: number;
  colorClass: string;
  strokeClass: string;
};

const CircularProgress = ({ value, colorClass, strokeClass }: CircularProgressProps) => {
  const animated = useCountUp(value);
  // Lingkaran diperbesar (36px -> 42px svg, container 48px -> 56px) supaya
  // teks 3 digit ("100%") tidak mepet/ketutupan sama ring-nya seperti
  // sebelumnya — sebelumnya svg cuma 36px, terlalu sempit untuk 4 karakter.
  const radius = 21;
  const stroke = 3;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animated / 100) * circumference;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
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
      <span className={cn("absolute text-[10px] font-bold tabular-nums leading-none", colorClass)}>{Math.round(animated)}%</span>
    </div>
  );
};

const MONTH_FULL_ID: Record<string, string> = {
  JAN: 'Januari', FEB: 'Februari', MAR: 'Maret', APR: 'April', MAY: 'Mei', JUN: 'Juni',
  JUL: 'Juli', AUG: 'Agustus', SEP: 'September', OCT: 'Oktober', NOV: 'November', DEC: 'Desember',
};

const formatRpTooltip = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

type ChartTooltipContentProps = TooltipContentProps & {
  label1: string;
  label2: string;
  year: number;
};

// Tooltip kustom (bukan bawaan browser via atribut `title`, yang sebelumnya
// bikin hover kelihatan cuma "?" di beberapa browser/OS) — pakai komponen
// React biasa lewat prop `content` Recharts supaya bisa didesain penuh.
const ChartTooltipContent = ({ active, payload, label, label1, label2, year }: ChartTooltipContentProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const v1 = Number(payload.find(p => p.dataKey === 'v1')?.value) || 0;
  const v2 = Number(payload.find(p => p.dataKey === 'v2')?.value) || 0;
  const selisih = v1 - v2;
  const monthName = MONTH_FULL_ID[String(label)] || String(label);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-4 min-w-[210px] animate-in fade-in zoom-in-95 duration-150">
      <p className="text-xs font-black text-slate-900 mb-2.5">{monthName} {year}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" /> {label1}
          </span>
          <span className="text-[11px] font-bold text-indigo-600 tabular-nums whitespace-nowrap">{formatRpTooltip(v1)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" /> {label2}
          </span>
          <span className="text-[11px] font-bold text-slate-600 tabular-nums whitespace-nowrap">{formatRpTooltip(v2)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 mt-2.5 pt-2.5 border-t border-slate-100">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selisih</span>
        <span className={cn("text-xs font-black tabular-nums whitespace-nowrap", selisih >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
          {selisih >= 0 ? '+' : '-'}{formatRpTooltip(Math.abs(selisih))}
        </span>
      </div>
    </div>
  );
};

type FireTimestampLike = {
  toDate?: () => Date;
};

const toSafeDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const ts = value as FireTimestampLike;
    if (typeof ts.toDate === 'function') {
      return ts.toDate();
    }
  }
  return new Date();
};

export default function AnnualDashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevYearTransactions, setPrevYearTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [chartMode, setChartMode] = useState<'monthly' | 'cumulative'>('monthly');

  // States for Category Comparison
  const [cat1Id, setCat1Id] = useState<string>(''); // Default to 'All Income' logic if empty?
  const [cat2Id, setCat2Id] = useState<string>('');

  const categoryNameById = useMemo(() => {
    return categories.reduce((acc, cat) => {
      if (cat.id) {
        acc.set(cat.id, cat.category);
      }
      return acc;
    }, new Map<string, string>());
  }, [categories]);
  const category1Name = cat1Id ? (categoryNameById.get(cat1Id) ?? cat1Id) : '';
  const category2Name = cat2Id ? (categoryNameById.get(cat2Id) ?? cat2Id) : '';

  useEffect(() => {
    let unsubTrx: (() => void) | null = null;
    let unsubInv: (() => void) | null = null;
    let unsubBdg: (() => void) | null = null;
    let unsubCat: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
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
            const row = d as { amount?: number; date?: unknown; createdAt?: unknown };
            return {
              ...d,
              id: doc.id,
              amount: Number(row.amount) || 0,
              date: toSafeDate(row.date),
              createdAt: toSafeDate(row.createdAt),
            } as Transaction;
          }));
        }, (err) => console.error("Annual TRX error:", err));

        const qInv = query(collection(db, 'investments'), where('userId', '==', u.uid));
        unsubInv = onSnapshot(qInv, (snap) => {
          setInvestments(
            snap.docs
              .map(doc => {
                const d = doc.data();
                const row = d as { dateInvested?: unknown; createdAt?: unknown };
                return {
                  ...d,
                  id: doc.id,
                  dateInvested: toSafeDate(row.dateInvested),
                  createdAt: toSafeDate(row.createdAt),
                } as Investment;
              })
              // Deposito "Penempatan" otomatis punya baris proyeksi "(Hasil Akhir)"
              // berstatus Planned — bukan posisi nyata, jangan ikut dihitung di
              // ringkasan investasi tahunan (dulu bikin totalnya dobel).
              .filter(inv => inv.status !== 'Planned')
          );
        }, (err) => console.error("Annual INV error:", err));

        const qBdg = query(collection(db, 'budgets'), where('userId', '==', u.uid));
        unsubBdg = onSnapshot(qBdg, (snap) => {
          setBudgets(snap.docs.map(doc => {
            const d = doc.data();
            const row = d as { amount?: number; createdAt?: unknown };
            return {
              ...d,
              id: doc.id,
              amount: Number(row.amount) || 0,
              createdAt: toSafeDate(row.createdAt),
            } as Budget;
          }));
        }, (err) => console.error("Annual BDG error:", err));

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
        if (unsubTrx) unsubTrx();
        if (unsubInv) unsubInv();
        if (unsubBdg) unsubBdg();
        if (unsubCat) unsubCat();
      }
    });
    return () => {
      unsub();
      if (unsubTrx) unsubTrx();
      if (unsubInv) unsubInv();
      if (unsubBdg) unsubBdg();
      if (unsubCat) unsubCat();
    };
  }, [selectedYear]);

  // Tahun sebelumnya, cuma buat pembanding "vs tahun lalu" di ringkasan chart
  // — query terpisah & lebih ringan (tidak perlu live-update securepat data
  // tahun berjalan) karena datanya sudah final/tidak berubah lagi.
  useEffect(() => {
    let unsubPrev: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setPrevYearTransactions([]);
        return;
      }
      const startOfPrevYear = new Date(selectedYear - 1, 0, 1);
      const endOfPrevYear = new Date(selectedYear - 1, 11, 31, 23, 59, 59);
      const qPrev = query(
        collection(db, 'transactions'),
        where('userId', '==', u.uid),
        where('date', '>=', startOfPrevYear),
        where('date', '<=', endOfPrevYear)
      );
      if (unsubPrev) unsubPrev();
      unsubPrev = onSnapshot(qPrev, (snap) => {
        setPrevYearTransactions(snap.docs.map(doc => {
          const d = doc.data();
          const row = d as { amount?: number; date?: unknown };
          return { ...d, id: doc.id, amount: Number(row.amount) || 0, date: toSafeDate(row.date) } as Transaction;
        }));
      }, (err) => console.error("Annual PrevYear TRX error:", err));
    });
    return () => { unsub(); if (unsubPrev) unsubPrev(); };
  }, [selectedYear]);

  const yearTransactions = useMemo(() =>
    transactions,
    [transactions]
  );

  // Rincian tahunan ini ditampilkan sepenuhnya dalam IDR, jadi pakai
  // amountIDR (sudah dikonversi saat transaksi disimpan) — bukan .amount
  // mentah yang masih dalam mata uang asli transaksi tersebut.
  const idrAmount = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;
  // Menaruh uang ke investasi (Deposito/Saham/dll) BUKAN pengeluaran/kerugian
  // — itu cuma uang tunai berubah jadi instrumen investasi (aset tetap ada,
  // cuma beda bentuk, dan sudah dihitung terpisah sebagai kekayaan investasi
  // di "Total Investasi"). Kalau ikut dijumlah sebagai "Pengeluaran", angkanya
  // salah besar-besaran (mis. taruh Rp280 juta ke deposito bikin kelihatan
  // defisit besar padahal sebenarnya surplus) — konsisten dengan fix yang
  // sama di Pajak Center.
  const isInvestmentPurchase = (t: { type: string; category?: string }) =>
    t.type === 'pengeluaran' && (t.category?.toLowerCase().includes('investasi') || t.category === 'Saham' || t.category === 'Deposito');
  const totalPemasukan = useMemo(() => yearTransactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + idrAmount(t), 0), [yearTransactions]);
  const totalPengeluaran = useMemo(() => yearTransactions.filter(t => t.type === 'pengeluaran' && !isInvestmentPurchase(t)).reduce((s, t) => s + idrAmount(t), 0), [yearTransactions]);
  const totalInvestasi = useMemo(() => investments.reduce((s, i) => s + (Number(i.amountIDR) || Number(i.amountInvested) || 0), 0), [investments]);
  const netSavings = totalPemasukan - totalPengeluaran;

  const prevYearNet = useMemo(() => {
    const inc = prevYearTransactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + idrAmount(t), 0);
    const exp = prevYearTransactions.filter(t => t.type === 'pengeluaran' && !isInvestmentPurchase(t)).reduce((s, t) => s + idrAmount(t), 0);
    return inc - exp;
  }, [prevYearTransactions]);
  // null kalau tahun lalu belum ada data sama sekali — jangan tampilkan
  // persentase yang menyesatkan (mis. "naik tak terhingga") dibanding nol.
  const netVsLastYearPct = prevYearNet !== 0 ? ((netSavings - prevYearNet) / Math.abs(prevYearNet)) * 100 : null;

  // Monthly Aggregation for the Chart
  const monthlyData = useMemo(() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const data = months.map(m => ({ m, v1: 0, v2: 0 }));

    yearTransactions.forEach(t => {
      const monthIdx = t.date.getMonth();
      const amt = idrAmount(t);

      // If we have specific categories selected
      if (cat1Id && cat2Id) {
        // Compare by category name or ID (we normalize to name for comparison in charts usually)
        if (t.category === cat1Id || t.category === category1Name) data[monthIdx].v1 += amt;
        if (t.category === cat2Id || t.category === category2Name) data[monthIdx].v2 += amt;
      } else {
        // Default: Income vs Expense — penempatan investasi dikecualikan dari
        // Pengeluaran (lihat isInvestmentPurchase), sama seperti totalPengeluaran.
        if (t.type === 'pemasukan') data[monthIdx].v1 += amt;
        if (t.type === 'pengeluaran' && !isInvestmentPurchase(t)) data[monthIdx].v2 += amt;
      }
    });

    return data;
  }, [yearTransactions, cat1Id, cat2Id, category1Name, category2Name]);

  // "Kumulatif" mengubah tiap bulan jadi total berjalan sejak Januari —
  // dihitung terpisah dari monthlyData supaya toggle-nya instan tanpa
  // menghitung ulang agregasi transaksi.
  const chartData = useMemo(() => {
    if (chartMode === 'monthly') return monthlyData;
    let runningV1 = 0;
    let runningV2 = 0;
    return monthlyData.map(d => {
      runningV1 += d.v1;
      runningV2 += d.v2;
      return { m: d.m, v1: runningV1, v2: runningV2 };
    });
  }, [monthlyData, chartMode]);

  // Top Transactions — catatan Hutang/Piutang (type "debt") dikecualikan,
  // sama seperti Transaksi Harian & Cards: bukan arus kas beneran, ikut
  // masuk ranking + tanda +/- di sini bikin kelihatan seperti transaksi
  // dobel untuk pembelian yang sama.
  const topTransactionsList = useMemo(() => {
    return [...yearTransactions].filter(t => t.type !== 'debt').sort((a, b) => idrAmount(b) - idrAmount(a)).slice(0, 4);
  }, [yearTransactions]);

  // Budget vs Actual for the Year Table
  const budgetRincian = useMemo(() => {
    return budgets.map(b => {
      // actual sum across the selected year for this category
      const actual = yearTransactions
        .filter(t => t.type === 'pengeluaran' && t.category === b.category)
        .reduce((sum, t) => sum + idrAmount(t), 0);
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

  // Angka yang sama dipakai di cincin progres & badge teks supaya animasinya sinkron.
  const animatedPemasPerc = useCountUp(pemasPerc);
  const animatedTabunganPerc = useCountUp(tabunganPerc);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex print:hidden w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <CalendarRange size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Dashboard Tahunan</h2>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Laporan Fiskal Tahun {selectedYear}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
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
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pemasukan</p>
            <CircularProgress value={pemasPerc} colorClass="text-sky-600" strokeClass="stroke-sky-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{formatRpShort(totalPemasukan)}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{yearTransactions.filter(t=>t.type==='pemasukan').length} transaksi</p>
              </div>
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-sky-50 text-sky-500 text-[9px] md:text-[10px] font-bold rounded-full tabular-nums">{Math.round(animatedPemasPerc)}% dari total</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pengeluaran */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengeluaran</p>
            <CircularProgress value={keluarPerc} colorClass="text-rose-600" strokeClass="stroke-rose-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{formatRpShort(totalPengeluaran)}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none">{yearTransactions.filter(t=>t.type==='pengeluaran').length} transaksi</p>
              </div>
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-[10px] font-bold rounded-full tabular-nums ${keluarPerc > 80 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{keluarPerc > 80 ? 'Caution' : 'Normal'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tabungan */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tabungan</p>
            <CircularProgress value={tabunganPerc} colorClass="text-slate-700" strokeClass="stroke-slate-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{formatRpShort(Math.max(netSavings, 0))}</h3>
            </div>
            <div className="flex justify-between items-center mt-3 md:mt-5">
              <div>
                <p className="text-[9px] text-slate-400 font-medium leading-none mb-1">Thn {selectedYear}</p>
                <p className="text-[10px] font-bold text-slate-600 leading-none tabular-nums">{Math.round(animatedTabunganPerc)}% dari pemasukan</p>
              </div>
              <span className={`px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-[10px] font-bold rounded-full ${tabunganPerc > 20 ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>{tabunganPerc > 20 ? 'Goal Near' : 'Growing'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Investasi */}
        <div className="bg-white rounded-[20px] p-4 md:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Investasi</p>
            <CircularProgress value={invPerc} colorClass="text-teal-600" strokeClass="stroke-teal-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs md:text-lg font-bold text-slate-900">Rp</span>
              <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{formatRpShort(totalInvestasi)}</h3>
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
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-[14px] md:text-[18px] font-bold text-slate-900 leading-tight">Perbandingan Tahunan</h3>
              <p className="text-[9px] md:text-xs font-medium text-slate-400 mt-1 max-w-sm">Bandingkan performa keuangan sepanjang tahun.</p>
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

          {/* Ringkasan selisih + toggle Bulanan/Kumulatif */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Selisih ({category1Name || 'Pemasukan'} - {category2Name || 'Pengeluaran'})
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={cn("text-xl md:text-2xl font-black tracking-tight tabular-nums", netSavings >= 0 ? 'text-indigo-600' : 'text-rose-500')}>
                  {netSavings >= 0 ? '+' : '-'}Rp {formatRpShort(Math.abs(netSavings))}
                </span>
                {netVsLastYearPct !== null && (
                  <span className={cn("flex items-center gap-0.5 text-[11px] font-bold", netVsLastYearPct >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                    {netVsLastYearPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(netVsLastYearPct).toFixed(1)}% vs tahun lalu
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 w-fit">
              {(['monthly', 'cumulative'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setChartMode(mode)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    chartMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {mode === 'monthly' ? 'Bulanan' : 'Kumulatif'}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-[220px] md:h-[300px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v === 0 ? '0' : `${formatRpShort(v)}`}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: '#6366f1', opacity: 0.06 }}
                  content={(props) => (
                    <ChartTooltipContent
                      {...props}
                      label1={category1Name || 'Pemasukan (Total)'}
                      label2={category2Name || 'Pengeluaran (Total)'}
                      year={selectedYear}
                    />
                  )}
                />
                <Bar dataKey="v1" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={900} animationEasing="ease-out" />
                <Bar dataKey="v2" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={900} animationEasing="ease-out" animationBegin={120} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend + timestamp */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-indigo-600" /> {category1Name || 'Pemasukan (Total)'}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> {category2Name || 'Pengeluaran (Total)'}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-300">
              Data diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </p>
          </div>
        </div>

        {/* SIDEBAR SECTION (1/3) */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <h3 className="text-[14px] font-bold text-slate-800 mb-2 mt-2 px-1">Transaksi Tertinggi</h3>
          
          <div className="flex-1 flex flex-col gap-4">
            {topTransactionsList.length === 0 ? (
               <p className="text-xs text-slate-400 text-center py-10 font-bold">Belum ada transaksi</p>
            ) : topTransactionsList.map((trx, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center",
                    isIncomingTransaction(trx) ? 'bg-sky-100 text-sky-500' :
                    (trx.type === 'pengeluaran' || trx.type === 'transfer') ? 'bg-rose-100 text-rose-500' :
                    'bg-slate-100 text-slate-500'
                  )}>
                    {isIncomingTransaction(trx) ? <TrendingUp size={16} /> : <WalletCards size={16} />}
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{trx.type}</p>
                    <p className="text-xs font-bold text-slate-900">{trx.category || 'Transaksi'}</p>
                  </div>
                </div>
                <span className={cn("text-xs font-black", isIncomingTransaction(trx) ? 'text-sky-500' : 'text-rose-500')}>
                  {isIncomingTransaction(trx) ? '+' : '-'}Rp {formatRpShort(idrAmount(trx))}
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


"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown,
  TrendingDown,
  TrendingUp, 
  CheckCircle2,
  Clock,
  Briefcase,
  PieChart,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { MonthPicker } from '@/components/ui/MonthPicker';

export default function InvestmentDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubInv: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Calculate date range for filtering
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const qInv = query(
          collection(db, 'investments'), 
          where('userId', '==', u.uid),
          where('dateInvested', '>=', startOfMonth),
          where('dateInvested', '<=', endOfMonth),
          orderBy('dateInvested', 'desc')
        );
        unsubInv = onSnapshot(qInv, (snap) => {
          setInvestments(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id,
              amountInvested: Number(d.amountInvested) || 0,
              currentValue: Number(d.currentValue) || 0,
              returnPercentage: Number(d.returnPercentage) || 0,
              dateInvested: d.dateInvested?.toDate?.() ?? new Date(), 
              createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Investment;
          }));
          setLoading(false);
        });
      } else {
        setInvestments([]);
        setLoading(false);
      }
    });
    return () => { unsub(); if (unsubInv) unsubInv(); };
  }, [selectedMonth, selectedYear]);

  const totalModal = useMemo(() => investments.reduce((sum, i) => sum + i.amountInvested, 0), [investments]);
  const totalAset = useMemo(() => investments.reduce((sum, i) => sum + i.currentValue, 0), [investments]);
  const totalSelisih = totalAset - totalModal;
  const roiTotal = totalModal > 0 ? (totalSelisih / totalModal) * 100 : 0;
  
  // Additional aggregations
  const allocationTypes = useMemo(() => {
    let saham = 0, lainnya = 0, deposito = 0;
    investments.forEach(i => {
      if (i.type === 'Saham') saham += i.currentValue;
      else if (i.type === 'Deposito') deposito += i.currentValue;
      else lainnya += i.currentValue;
    });
    return { saham, deposito, lainnya };
  }, [investments]);

  const percentageSaham = totalAset > 0 ? Math.round((allocationTypes.saham / totalAset) * 100) : 0;
  const percentageLainnya = totalAset > 0 ? Math.round(((allocationTypes.deposito + allocationTypes.lainnya) / totalAset) * 100) : 0;

  const topAssets = useMemo(() => {
    return [...investments].sort((a,b) => b.currentValue - a.currentValue).slice(0, 3).map(i => ({
      label: i.name.substring(0, 10),
      value: totalAset > 0 ? Number(((i.currentValue / totalAset) * 100).toFixed(1)) : 0
    }));
  }, [investments, totalAset]);

  const topPlatforms = useMemo(() => {
    const platMap: Record<string, number> = {};
    investments.forEach(i => {
      platMap[i.platform] = (platMap[i.platform] || 0) + i.currentValue;
    });
    const formatBillion = (n: number) => {
      if (n >= 1_000_000_000) return `Rp ${(n/1_000_000_000).toFixed(1)}M`;
      if (n >= 1_000_000) return `Rp ${(n/1_000_000).toFixed(1)}Jt`;
      return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
    };
    return Object.entries(platMap).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([p, v]) => ({
      label: p, sub: 'Investasi', value: formatBillion(v)
    }));
  }, [investments]);

  const highestReturns = useMemo(() => {
    return [...investments].sort((a,b) => (b.returnPercentage||0) - (a.returnPercentage||0)).slice(0, 4);
  }, [investments]);

  const formatRpShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(2)}Jt`;
    return new Intl.NumberFormat('id-ID').format(n);
  };

  // Doughnut Chart Simulation Component
  interface DoughnutProps {
    pSaham: number;
    pLainnya: number;
  }
  const SimulatedDoughnut = ({ pSaham, pLainnya }: DoughnutProps) => {
    const radius = 50;
    const stroke = 10;
    const normalizedRadius = radius - stroke * 1.5;
    const circumference = normalizedRadius * 2 * Math.PI;

    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90">
          {/* Gray Background */}
          <circle
            stroke="#e2e8f0" // slate-200
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Saham Segment */}
          {pSaham > 0 && (
            <circle
              stroke="#064e3b" // emerald-950
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset: circumference - (pSaham / 100) * circumference }}
              strokeWidth={stroke}
              fill="transparent"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeLinecap="round"
            />
          )}
          {/* Lainnya Segment */}
          {pLainnya > 0 && (
            <circle
              stroke="#e2e8f0" // slate-200 / use slate-300 or another color for contrast if desired
              strokeDasharray={circumference + ' ' + circumference}
              style={{ 
                strokeDashoffset: circumference - (pLainnya / 100) * circumference,
                rotate: `${(pSaham / 100) * 360}deg`,
                transformOrigin: '50% 50%'
              }}
              strokeWidth={stroke}
              fill="transparent"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-black text-slate-900">{pSaham}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1400px]">
      
      {/* 1. Header (Title & Controls) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Ringkasan Investasi</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Periode {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth))}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker 
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={({ month, year }) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
        </div>
      </div>

      {/* 2. Top Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        
        {/* Total Aset */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-center mb-3 md:mb-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Total Aset Investasi</p>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              <Building2 size={16} />
            </div>
          </div>
          <div>
            <h3 className="text-[10px] md:text-[12px] font-bold text-slate-900">Rp</h3>
            <p className="text-lg md:text-2xl font-black text-slate-900 tracking-tight mt-1 leading-none">{formatRpShort(totalAset)}</p>
            <p className={cn("flex items-center gap-1 text-[9px] md:text-[10px] font-bold mt-2 md:mt-3 leading-none", roiTotal >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {roiTotal >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {roiTotal >= 0 ? '+' : ''}{roiTotal.toFixed(2)}% ROI
            </p>
          </div>
        </div>

        {/* Total Modal */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-center mb-3 md:mb-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Total Modal Investasi</p>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <h3 className="text-[10px] md:text-[12px] font-bold text-slate-900">Rp</h3>
            <p className="text-lg md:text-2xl font-black text-slate-900 tracking-tight mt-1 leading-none">{formatRpShort(totalModal)}</p>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-2 md:mt-3 leading-none">
              Selisih: {totalSelisih >= 0 ? '+' : '-'}Rp {formatRpShort(Math.abs(totalSelisih))}
            </p>
          </div>
        </div>

        {/* Keuntungan Terrealisasi */}
        <div className="bg-[#023326] rounded-[20px] md:rounded-[24px] p-4 md:p-6 border border-emerald-950 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-3 md:mb-6">
            <p className="text-[8px] md:text-[9px] font-black text-emerald-100/50 uppercase tracking-[0.1em]">Keuntungan Terrealisasi</p>
            <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-300">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <h3 className="text-[10px] md:text-[12px] font-bold text-white">Rp</h3>
            <p className="text-lg md:text-2xl font-black text-white tracking-tight mt-1 leading-none">0</p>
            <p className="text-[9px] md:text-[10px] font-bold text-emerald-400 mt-2 md:mt-3 leading-none">
               Belum didukung
            </p>
          </div>
        </div>

        {/* Keuntungan Belum Terrealisasi */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-center mb-3 md:mb-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Keuntungan Belum Terrealisasi</p>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <h3 className="text-[10px] md:text-sm font-bold text-slate-900">Rp</h3>
            <p className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">{formatRpShort(totalSelisih)}</p>
            <p className={cn("flex items-center gap-1 text-[9px] md:text-[10px] font-bold mt-2", roiTotal >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {roiTotal >= 0 ? '+' : ''}{roiTotal.toFixed(2)}% floating
            </p>
          </div>
        </div>
      </div>

      {/* 3. Middle Grid (Allocation Analysis) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Alokasi Portofolio Tipe */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-5 md:p-8 border border-slate-100 shadow-sm">
          <h3 className="text-[13px] md:text-sm font-bold text-slate-900 mb-4 md:mb-8 tracking-tight">Alokasi Portofolio Tipe</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8">
            <div className="shrink-0">
              <SimulatedDoughnut pSaham={percentageSaham} pLainnya={percentageLainnya} />
            </div>
            <div className="space-y-3 md:space-y-4 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#064e3b] shrink-0" />
                <p className="text-[11px] font-bold text-slate-900">Saham ({percentageSaham}%)</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-slate-200 shrink-0" />
                <p className="text-[11px] font-bold text-slate-400">Deposito/Lainnya ({percentageLainnya}%)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alokasi Portofolio Aset */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-5 md:p-8 border border-slate-100 shadow-sm">
          <h3 className="text-[13px] md:text-sm font-bold text-slate-900 mb-4 md:mb-8 tracking-tight">Alokasi Portofolio Aset</h3>
          <div className="space-y-6">
            {topAssets.length === 0 && <p className="text-xs text-slate-400 font-bold">Belum ada portofolio</p>}
            {topAssets.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-900 tracking-wider uppercase">{item.label}</span>
                  <span className="text-[10px] font-bold text-slate-400">{item.value}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#064e3b] h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${item.value}%` }} // Scale for visual
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Investasi Sidebar */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] p-5 md:p-8 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4 md:mb-8">
            <h3 className="text-[13px] md:text-sm font-bold text-slate-900 tracking-tight">Platform Investasi</h3>
            <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Lihat Semua</button>
          </div>
          <div className="space-y-6 flex-1">
            {topPlatforms.length === 0 && <p className="text-xs text-slate-400 font-bold">Belum ada data</p>}
            {topPlatforms.map((p) => (
              <div key={p.label} className="flex items-center justify-between group cursor-pointer overflow-hidden">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-900 leading-tight truncate uppercase">{p.label}</p>
                    <p className="text-[9px] font-medium text-slate-400 truncate">{p.sub}</p>
                  </div>
                </div>
                <span className="text-[11px] font-black text-slate-900 shrink-0 ml-2">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="bg-white rounded-[20px] md:rounded-[24px] p-5 md:p-8 border border-slate-100 shadow-sm">
        <h3 className="text-[13px] md:text-sm font-bold text-slate-900 mb-4 md:mb-6">Return Investasi Tertinggi</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {highestReturns.length === 0 && <p className="text-xs text-slate-400 font-bold col-span-2">Belum ada portofolio</p>}
          {highestReturns.map((r) => (
            <div key={r.id} className="bg-emerald-50/30 rounded-xl p-3 md:p-4 border border-emerald-50/50">
              <p className="text-[8px] md:text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1 truncate">{r.name}</p>
              <p className="text-base md:text-lg font-black text-emerald-600 tracking-tight">{(r.returnPercentage??0) >= 0 ? '+' : ''}{(r.returnPercentage??0).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Portfolio Tables */}
      <div className="space-y-6">
        
        {/* Table 1: Saham */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 md:p-6 md:px-8 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-[13px] md:text-[15px] font-bold text-slate-900">Ringkasan Portofolio Saham</h3>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><BarChart2 size={16} /></button>
              <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ArrowUpRight size={16} /></button>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[750px] md:min-w-0">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 md:px-8 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Kode Saham</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Lembar</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Harga Rata-Rata</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Harga Saat Ini</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Total Nilai</th>
                  <th className="px-5 md:px-8 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400 text-right">Return (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {investments.filter(i => i.type === 'Saham').length === 0 && (
                   <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400 font-bold">Belum ada saham tersimpan</td></tr>
                )}
                {investments.filter(i => i.type === 'Saham').map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-5 md:px-8 py-4 md:py-5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black", (s.returnPercentage??0) >= 0 ? 'bg-emerald-900' : 'bg-emerald-700')}>
                          {s.name[0]}
                        </div>
                        <span className="font-black text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-bold text-slate-500">{s.sharesCount || 0}</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-bold text-slate-500">Rp {new Intl.NumberFormat('id-ID').format(s.pricePerShare || 0)}</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-black text-slate-900">Rp {new Intl.NumberFormat('id-ID').format(s.sharesCount ? Math.round(s.currentValue / s.sharesCount) : 0)}</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-black text-slate-900">Rp {new Intl.NumberFormat('id-ID').format(s.currentValue)}</td>
                    <td className={cn("px-5 md:px-8 py-4 md:py-5 text-right font-black", (s.returnPercentage??0) >= 0 ? 'text-emerald-500' : 'text-rose-500')}>{(s.returnPercentage??0) >= 0 ? '+' : ''}{(s.returnPercentage??0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Others */}
        <div className="bg-white rounded-[20px] md:rounded-[24px] shadow-sm border border-slate-100 overflow-hidden mb-10">
          <div className="p-4 md:px-8 border-b border-slate-50">
            <h3 className="text-[13px] md:text-[15px] font-bold text-slate-900">Ringkasan Portofolio Investasi Lainnya</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[750px] md:min-w-0">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 md:px-8 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400 text-left">Jenis Aset</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Platform</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Modal Pokok</th>
                  <th className="px-5 md:px-6 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400">Nilai Sekarang</th>
                  <th className="px-5 md:px-8 py-4 font-bold text-[9px] uppercase tracking-widest text-slate-400 text-right">Keuntungan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {investments.filter(i => i.type !== 'Saham').length === 0 && (
                   <tr><td colSpan={5} className="text-center py-6 text-xs text-slate-400 font-bold">Belum ada investasi lain</td></tr>
                )}
                {investments.filter(i => i.type !== 'Saham').map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-5 md:px-8 py-4 md:py-5 font-black text-slate-900">{a.name} ({a.type})</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-bold text-slate-400">{a.platform}</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-black text-slate-900">Rp {new Intl.NumberFormat('id-ID').format(a.amountInvested)}</td>
                    <td className="px-5 md:px-6 py-4 md:py-5 font-black text-slate-900">Rp {new Intl.NumberFormat('id-ID').format(a.currentValue)}</td>
                    <td className={cn("px-5 md:px-8 py-4 md:py-5 text-right font-black", ((a.currentValue - a.amountInvested) >= 0) ? 'text-emerald-600' : 'text-rose-500')}>
                      Rp {new Intl.NumberFormat('id-ID').format(a.currentValue - a.amountInvested)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

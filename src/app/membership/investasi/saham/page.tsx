"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PlusCircle, 
  Search, 
  TrendingUp, 
  Briefcase, 
  Trash2, 
  BarChart3,
  Edit2,
  ChevronDown,
  TrendingDown,
  Pencil
} from 'lucide-react';
import { useModal } from '@/context/ModalContext';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogoImage } from '@/components/ui/LogoImage';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { updateMemberTotals } from '@/lib/services/userService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { cn } from '@/lib/utils';
import { StockInvestmentModal } from '@/components/modals/StockInvestmentModal';

export default function SahamPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>(undefined);
  const { openModal } = useModal();

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'investments'), 
          where('userId', '==', u.uid),
          where('type', '==', 'Saham'),
          where('dateInvested', '>=', startOfMonth),
          where('dateInvested', '<=', endOfMonth),
          orderBy('dateInvested', 'desc')
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
        
        accountService.getUserAccounts(u.uid).then(setAccounts).catch(console.error);
      } else { setInvestments([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, [selectedMonth, selectedYear]);

  const totalInvested = useMemo(() => investments.reduce((s, i) => s + i.amountInvested, 0), [investments]);
  const totalCurrent = useMemo(() => investments.reduce((s, i) => s + i.currentValue, 0), [investments]);
  const totalReturn = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  const filtered = useMemo(() =>
    searchQuery ? investments.filter(s => (s.stockCode || s.name || '').toLowerCase().includes(searchQuery.toLowerCase())) : investments,
    [investments, searchQuery]
  );

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n);
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Portofolio Saham</h1>
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
          <button 
            onClick={() => { setEditingInvestment(undefined); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <PlusCircle size={18} />
            <span className="hidden md:inline">Tambah Saham</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nilai Portofolio</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight">Rp {formatRp(totalCurrent)}</h3>
            <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${totalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}% Unrealized {totalReturn >= 0 ? 'Profit' : 'Loss'}
            </p>
          </div>
          <TrendingUp size={48} className="absolute -right-2 -bottom-2 text-emerald-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
              <Briefcase size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimasi Modal</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight">Rp {formatRp(totalInvested)}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{investments.length} posisi aktif</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 md:p-2 rounded-[24px] md:rounded-3xl border border-slate-50 shadow-sm">
        <div className="flex-1 min-w-[200px] relative group">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari kode saham..."
            className="w-full bg-slate-50/50 border-transparent rounded-xl md:rounded-2xl py-3 md:py-4 pl-12 pr-6 text-sm font-medium focus:ring-0 outline-none transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat portofolio...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState title="Portofolio Saham Kosong" description="Tambahkan posisi saham pertama Anda untuk mulai tracking kinerja portofolio." icon={<BarChart3 size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px] xl:min-w-0">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kode Saham</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Icon/Logo</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kode Bursa</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mata Uang</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah Lembar</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Harga / Lembar</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipe Transaksi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Platform</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0">
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{formatDate(inv.dateInvested)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <p className="text-sm font-black text-slate-900">{inv.stockCode || inv.name}</p>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center">
                      <LogoImage 
                        src={inv.logoUrl} 
                        alt={inv.name} 
                        fallbackText="STK" 
                        className="w-6 h-6 object-cover mx-auto" 
                      />
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-600 uppercase tracking-tighter">{inv.exchangeCode || 'IDX'}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center"><span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">{inv.currency || 'IDR'}</span></td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap font-bold text-slate-700">{inv.sharesCount || 0}</td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap font-black text-slate-900 text-sm">{formatRp(inv.pricePerShare || 0)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{inv.transactionType || 'Beli'}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{inv.category || 'Saham'}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-600">
                        {accounts.find(a => a.id === inv.accountId)?.name || inv.accountId || '—'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { setEditingInvestment(inv); setShowModal(true); }}
                          className="p-2 rounded-lg bg-blue-50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openModal('saham', inv)}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all group/sell relative">
                          <TrendingDown size={14} />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/sell:opacity-100 transition-opacity whitespace-nowrap">Jual Saham</span>
                        </button>
                        <button onClick={async () => { 
                          if (inv.id && user?.uid) { 
                            if (confirm(`Hapus investasi ${inv.name}? Semua total saldo akan dikembalikan.`)) {
                              const isSell = inv.transactionType === 'Jual';
                              const invested = inv.amountInvested || 0;
                              
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

      <StockInvestmentModal 
        userId={user?.uid || ''} 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingInvestment(undefined); }} 
        editData={editingInvestment}
      />
    </div>
  );
}


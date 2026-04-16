"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PlusCircle,
  Banknote,
  Percent,
  Clock,
  Trash2,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { cn } from '@/lib/utils';
import { DepositModal } from '@/components/modals/DepositModal';

export default function DepositoPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>(undefined);

  const unsubRef = useRef<(() => void) | null>(null);

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
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const q = query(
          collection(db, 'investments'),
          where('userId', '==', u.uid),
          where('type', '==', 'Deposito')
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
              targetDate: d.targetDate?.toDate?.() ?? null,
              durationDays: d.durationDays || 0,
              createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Investment;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else { setInvestments([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, []);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '—';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '—';
  };

  const filteredInvestments = useMemo(() => {
    return investments.filter(inv => {
      const d = inv.dateInvested;
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [investments, selectedMonth, selectedYear]);

  const totalDeposited = useMemo(() => {
    return filteredInvestments.reduce((s, i) => {
      if (i.transactionType === 'Penarikan') return s - i.amountInvested;
      if (i.transactionType === 'Bunga') return s;
      return s + i.amountInvested;
    }, 0);
  }, [filteredInvestments]);
  const avgRate = filteredInvestments.length > 0 ? filteredInvestments.reduce((s, i) => s + i.returnPercentage, 0) / filteredInvestments.length : 0;

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace('Rp', '').trim();
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Deposito</h1>
          <p className="text-[10px] md:text-sm font-medium text-slate-400 mt-1 max-w-xl">
            Kelola penempatan dana deposito Anda untuk periode {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth))}.
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
            <span className="hidden md:inline">Buka Deposito</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <Banknote size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Deposito</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight">Rp {formatRp(totalDeposited)}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{filteredInvestments.length} penempatan di periode ini</p>
          </div>
          <Banknote size={48} className="absolute -right-2 -bottom-2 text-orange-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Percent size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rata-rata Bunga/Thn</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight">{avgRate.toFixed(2)}%</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Per Annum</p>
          </div>
          <Percent size={48} className="absolute -right-2 -bottom-2 text-blue-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat data deposito...</div>
        ) : filteredInvestments.length === 0 ? (
          <div className="p-10">
            <EmptyState title="Belum ada deposito" description="Belum ada penempatan deposito pada periode ini." icon={<Banknote size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px] xl:min-w-0">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tgl Penempatan</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap">Tgl Jatuh Tempo</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Nama Deposito</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Bank/Institusi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Nominal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Durasi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Bunga %</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipe</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((inv) => {
                  const isPlanned = inv.status === 'Planned';
                  return (
                    <tr key={inv.id} className={cn(
                      "group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0",
                      isPlanned && "bg-slate-50/30 opacity-75"
                    )}>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{formatDate(inv.dateInvested)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-black text-indigo-600 italic bg-indigo-50/20">{inv.targetDate ? formatDate(inv.targetDate) : '—'}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <p className={cn("text-sm font-black", isPlanned ? "text-slate-400" : "text-slate-900")}>{inv.name}</p>
                        {isPlanned && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter mt-0.5">Automated Projection</span>}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="px-3 py-1 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg uppercase tracking-widest">{inv.platform || '—'}</span></td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap font-black text-slate-900 text-sm">{formatRp(inv.amountInvested)}</td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap"><span className="text-sm font-bold text-slate-600">{inv.durationDays || 0} Hari</span></td>
                    <td className="px-4 md:px-6 py-5 text-center whitespace-nowrap"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg">{inv.returnPercentage.toFixed(2)}%</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{inv.transactionType || '—'}</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest",
                        isPlanned ? "bg-indigo-50 text-indigo-500" : "bg-slate-100 text-slate-600"
                      )}>
                        {isPlanned ? 'Rencana' : getCategoryName(inv.category || '')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{getAccountName(inv.accountId || '')}</span></td>
                    <td className="px-4 md:px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setEditingInvestment(inv); setShowModal(true); }}
                            className="p-2 rounded-lg bg-blue-50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={async () => { if (user && inv.id) { await investmentService.hardDeleteInvestment(inv.id, user.uid); } }}
                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 tracking-tighter whitespace-nowrap">
                          Rp {formatRp(inv.currentValue)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>


      <DepositModal 
        userId={user?.uid || ''} 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingInvestment(undefined); }} 
        editData={editingInvestment}
      />
    </div>
  );
}

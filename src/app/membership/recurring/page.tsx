"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  ChevronDown, 
  Save, 
  Calendar as CalendarIcon,
  RefreshCw,
  Trash2,
  Edit2,
  PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { recurringService, RecurringTransaction } from '@/lib/services/recurringService';
import { accountService, Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';

export default function RecurringPage() {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        // Fetch categories for lookup
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'recurring'), 
          where('userId', '==', u.uid),
          where('nextDate', '>=', startOfMonth),
          where('nextDate', '<=', endOfMonth),
          orderBy('nextDate', 'asc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, nextDate: d.nextDate?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as RecurringTransaction;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else { setTransactions([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, [selectedMonth, selectedYear]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '—';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '—';
  };

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 max-w-[1200px] mb-12">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Transaksi Berulang</h1>
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

      {/* 2. List Transaksi Berulang */}
      <div className="bg-white rounded-[20px] md:rounded-[40px] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Daftar Jadwal Otomatis</h2>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="p-10 text-center text-sm font-medium text-slate-400">Memuat data...</div>
          ) : transactions.length === 0 ? (
            <div className="p-10 md:p-16 h-full flex items-center justify-center">
              <EmptyState 
                title="Belum ada transaksi berulang"
                description="Simpan transaksi yang rutin Anda lakukan setiap bulan, minggu, atau tahun untuk pencatatan otomatis."
                icon={<RefreshCw size={24} />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px] md:min-w-0">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Nama</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Jenis</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Nominal</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Interval</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Berikutnya</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Akun</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((trx) => (
                    <tr key={trx.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-b-0">
                      <td className="px-4 md:px-6 py-4">
                        <p className="text-sm font-black text-slate-900">{trx.name}</p>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                          trx.type === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                        }`}>
                          {trx.type}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                         <span className="text-xs font-bold text-slate-600">{getCategoryName(trx.category || '')}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        {formatRp(trx.amount)}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-slate-100 text-[10px] font-black text-slate-500 rounded-lg tracking-widest uppercase whitespace-nowrap">
                          {trx.interval}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right font-bold text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(trx.nextDate)}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                         <span className="text-xs font-bold text-slate-600">{getAccountName(trx.accountId || '')}</span>
                      </td>
                      <td className="px-5 md:px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (trx.id) {
                                await recurringService.deleteRecurring(trx.id);
                                // onSnapshot otomatis update
                              }
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={16} />
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
      </div>
    </div>
  );
}

